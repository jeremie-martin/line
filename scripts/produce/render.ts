/**
 * Render + bundle ONE qualifying track — the single source of truth for turning a
 * compiled track into a production-ready bundle. A direct port of
 * render_vert_shorts.sh's `render_one` + bundle-commit, parameterised by select.json.
 *
 * Pipeline (each step a spawned child — Playwright/Remotion need real processes, so
 * this orchestrates rather than running them in-process; safe to call from the main
 * loop with a small render-lane cap):
 *   1. ride render   — scripts/export.ts (mirror + Playwright) → <name>.vert.mp4
 *   2. mux song      — ffmpeg → remotion/public/<name>.source.mp4
 *   3. overlay data  — scripts/make_overlay_data.ts → remotion/public/<name>.overlay.json
 *   4. overlay render— remotion CurveOverlayVertical → remotion/out/<name>.mp4
 *   5. bundle        — stage in .staging-…, write upload.json (sidecar last), atomic mv
 *                      into <inbox>/<project>/<Y>/<M>/<D>/<project>-s<seed>-<stamp>/
 *
 * One-time-per-run setup (ensureMirror / ensureSpectrum) is exported so produce.ts
 * runs it once at launch, not per bundle.
 */
import { spawn } from "node:child_process";
import { openSync, closeSync, existsSync, mkdirSync, rmSync, copyFileSync, writeFileSync, readFileSync, renameSync } from "node:fs";
import { resolve, join, dirname, basename } from "node:path";
import type { RenderConfig } from "./config.ts";

const ROOT = resolve(import.meta.dirname, "..", "..");
const MIRROR_URL = "http://127.0.0.1:8765/index.html";
const RIDE_QP = 14;   // ride intermediate quality (near-lossless, fed to compositor)
const FINAL_CRF = 16; // published overlay master quality

/** Spawn a child, append combined stdout+stderr to logPath, resolve on exit 0. */
function run(cmd: string, args: string[], logPath: string, cwd = ROOT): Promise<void> {
  return new Promise((res, rej) => {
    const fd = openSync(logPath, "a");
    const p = spawn(cmd, args, { cwd, stdio: ["ignore", fd, fd] });
    p.on("error", (e) => { closeSync(fd); rej(e); });
    p.on("exit", (code) => { closeSync(fd); code === 0 ? res() : rej(new Error(`${cmd} ${args[0] ?? ""} exited ${code} (see ${logPath})`)); });
  });
}

// node binary + tsx loader, so we don't depend on npx resolution for .ts scripts.
const TSX = [process.execPath, "--import", "tsx"];

/** Start the local linerider.com mirror on :8765 if it isn't already up. Returns the
 *  spawned child (kill it on exit) or null if one was already serving. */
export async function ensureMirror(): Promise<{ kill: () => void } | null> {
  const up = async () => { try { return (await fetch(MIRROR_URL)).ok; } catch { return false; } };
  if (await up()) return null;
  const child = spawn("python3", ["-m", "http.server", "8765", "--bind", "127.0.0.1", "--directory", "mirror"],
    { cwd: ROOT, stdio: "ignore", detached: false });
  for (let i = 0; i < 40; i++) {
    if (await up()) return { kill: () => { try { child.kill(); } catch { /* already gone */ } } };
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error("mirror server did not come up on :8765");
}

/** make_spectrum.py needs librosa, which lives in the project venv, not base python3.
 *  Override with LR_SPECTRUM_PYTHON. */
function spectrumPython(): string {
  if (process.env.LR_SPECTRUM_PYTHON) return process.env.LR_SPECTRUM_PYTHON;
  const venv = join(ROOT, "beats", ".venv", "bin", "python");
  return existsSync(venv) ? venv : "python3";
}

/** Compute the music spectrum once (same song → same spectrum for every bundle).
 *  Writes remotion/public/<song>.spectrum.json; returns its basename. */
export async function ensureSpectrum(audioPath: string, song: string, logPath: string): Promise<string> {
  const out = join(ROOT, "remotion", "public", `${song}.spectrum.json`);
  mkdirSync(dirname(out), { recursive: true });
  if (!existsSync(out)) {
    await run(spectrumPython(), ["scripts/make_spectrum.py", `--audio=${audioPath}`, `--out=${out}`, "--fps=30", "--bands=56"], logPath);
  }
  return basename(out);
}

/** True if a bundle for (song, seed) already exists in this run dir (<outDir>/<song>/
 *  <song>-s<seed>). Cross-run / cross-machine dedup is handled by the persistent
 *  per-host seed cursor; this guards only within a single run dir. */
export function bundleExistsForSeed(outDir: string, song: string, seed: number): boolean {
  return existsSync(join(outDir, song, `${song}-s${seed}`));
}

export type RenderInput = {
  specPath: string;
  trackPath: string;
  reportPath: string;
  audioPath: string;
  spectrumBase: string;     // basename of the once-computed spectrum in remotion/public/
  seed: number;
  song: string;             // song folder name — the per-song key (bundle name, dedup)
  project: string;          // upload/channel label + inbox root (e.g. "line")
  metrics: { score: number; rotations: number; standTimePct: number };
  render: RenderConfig;
  budget: number;
  jolt: number;            // felt-jolt ms the track was compiled with — so beat-punch aligns to it
  outDir: string;           // this run's output dir, e.g. generated/bundles/<YYMMDD-HHMMSS>
  workDir: string;          // scratch dir for the ride intermediate + logs
  gitSha: string;
  host: string;
  keepIntermediates?: boolean;
};

function utcStamp(d: Date): { day: string; stamp: string; iso: string } {
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  const Y = d.getUTCFullYear(), M = p(d.getUTCMonth() + 1), D = p(d.getUTCDate());
  const h = p(d.getUTCHours()), m = p(d.getUTCMinutes()), s = p(d.getUTCSeconds());
  return { day: `${Y}/${M}/${D}`, stamp: `${Y}${M}${D}T${h}${m}${s}Z`, iso: `${Y}-${M}-${D}T${h}:${m}:${s}Z` };
}

/** Render one track and commit a production-ready bundle. Returns the bundle dir. */
export async function renderBundle(inp: RenderInput): Promise<string> {
  const name = `${inp.song}-s${inp.seed}`;
  const gen = resolve(inp.workDir);
  mkdirSync(gen, { recursive: true });
  mkdirSync(join(ROOT, "remotion", "public"), { recursive: true });
  mkdirSync(join(ROOT, "remotion", "out"), { recursive: true });
  const log = join(gen, `${name}.render.log`);
  try { rmSync(log, { force: true }); } catch { /* fresh log */ }

  const ride = join(gen, `${name}.vert.mp4`);
  const source = join(ROOT, "remotion", "public", `${name}.source.mp4`);
  const overlay = join(ROOT, "remotion", "public", `${name}.overlay.json`);
  const outMp4 = join(ROOT, "remotion", "out", `${name}.mp4`);

  // 1. ride render (spec camera, zoom-mult + beat-punch); QP near-lossless intermediate.
  const bp = inp.render.beatPunchPct > 0
    ? ["--beat-punch", `--beat-punch-pct=${inp.render.beatPunchPct}`, "--zoom-ease=cubic", `--jolt-ms=${inp.jolt}`]
    : [];
  await run(TSX[0], [...TSX.slice(1), "scripts/export.ts",
    `--track=${inp.trackPath}`, `--spec=${inp.specPath}`, "--zoom=action",
    `--zoom-mult=${inp.render.zoomMult}`, ...bp, `--res=${inp.render.res}`, `--qp=${RIDE_QP}`, `--out=${ride}`], log);

  // 2. mux song.
  await run("ffmpeg", ["-y", "-i", ride, "-i", inp.audioPath, "-map", "0:v:0", "-map", "1:a:0",
    "-c:v", "copy", "-c:a", "aac", "-shortest", source], log);

  // 3. overlay data bundle.
  await run(TSX[0], [...TSX.slice(1), "scripts/make_overlay_data.ts",
    `--spec=${inp.specPath}`, `--report=${inp.reportPath}`, `--track=${inp.trackPath}`, `--out=${overlay}`], log);
  const durationS = JSON.parse(readFileSync(overlay, "utf8")).durationS as number;

  // 4. overlay render (CurveOverlayVertical, locked look) — runs from remotion/.
  const props = JSON.stringify({ dataFile: `${name}.overlay.json`, videoFile: `${name}.source.mp4`, durationS, spectrumFile: inp.spectrumBase });
  await run("npx", ["remotion", "render", "src/index.ts", "CurveOverlayVertical", `out/${name}.mp4`,
    `--crf=${FINAL_CRF}`, "--jpeg-quality=100", `--props=${props}`], log, join(ROOT, "remotion"));

  // 5. bundle: stage → upload.json (sidecar last) → atomic mv into this run dir.
  const { iso } = utcStamp(new Date());
  const final = join(inp.outDir, inp.song, name); // <run>/<song>/<song>-s<seed>
  const tmp = join(inp.outDir, `.staging-${name}`);
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp, { recursive: true });
  mkdirSync(dirname(final), { recursive: true });
  copyFileSync(outMp4, join(tmp, "video.mp4"));
  const upload = {
    project: inp.project,
    song: inp.song,
    video: "video.mp4",
    created_at: iso,
    values: { seed: inp.seed, rep: 0 },
    meta: {
      git_sha: inp.gitSha, generator_host: inp.host,
      score: Number(inp.metrics.score.toFixed(1)),
      revolutions: Number(inp.metrics.rotations.toFixed(2)),
      standTimePct: Number(inp.metrics.standTimePct.toFixed(2)),
      budget: inp.budget,
    },
  };
  writeFileSync(join(tmp, "upload.json"), JSON.stringify(upload, null, 2));
  rmSync(final, { recursive: true, force: true });
  renameSync(tmp, final);

  // 6. delete big intermediates unless asked to keep.
  if (!inp.keepIntermediates) {
    for (const f of [ride, source, overlay, outMp4]) { try { rmSync(f, { force: true }); } catch { /* best-effort */ } }
  }
  return final;
}
