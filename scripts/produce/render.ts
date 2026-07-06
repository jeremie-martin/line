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
import { openSync, closeSync, existsSync, mkdirSync, rmSync, copyFileSync, writeFileSync, readFileSync, renameSync, statSync } from "node:fs";
import { resolve, join, dirname, basename, relative } from "node:path";
import type { RenderConfig } from "./config.ts";
import { LOCKED_FX } from "../fx_recipe.ts";

const ROOT = resolve(import.meta.dirname, "..", "..");
const MIRROR_URL = "http://127.0.0.1:8765/index.html";
const RIDE_QP = 14;   // ride intermediate quality (near-lossless, fed to compositor)
const FINAL_CRF = 16; // published overlay master quality
const OUTPUT_FPS = 60; // overlay/output fps — the ride source.mp4 is 60fps, so this is 1:1 (no dup frames)
// LOCKED_FX (the production post-FX recipe) lives in scripts/fx_recipe.ts — shared
// with the sweep tool so the shipped look can't drift from the validated one.

/** Spawn a child, append combined stdout+stderr to logPath, resolve on exit 0. */
function run(cmd: string, args: string[], logPath: string, cwd = ROOT): Promise<void> {
  return new Promise((res, rej) => {
    const fd = openSync(logPath, "a");
    const p = spawn(cmd, args, { cwd, stdio: ["ignore", fd, fd], env: headlessChildEnv() });
    p.on("error", (e) => { closeSync(fd); rej(e); });
    p.on("exit", (code) => { closeSync(fd); code === 0 ? res() : rej(new Error(`${cmd} ${args[0] ?? ""} exited ${code} (see ${logPath})`)); });
  });
}

function headlessChildEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  // The render children are non-interactive, but healthy workstations may still
  // have a useful local display. Only scrub stale SSH-forwarded DISPLAY values;
  // those make Chromium's headless SwiftShader path try XCB and fail WebGL startup.
  if (shouldScrubDisplay(env.DISPLAY)) {
    delete env.DISPLAY;
    delete env.XAUTHORITY;
  }
  return env;
}

function shouldScrubDisplay(display: string | undefined): boolean {
  if (process.env.LR_KEEP_DISPLAY === "1") return false;
  if (process.env.LR_SCRUB_DISPLAY === "1") return true;
  return display !== undefined && /^(localhost|127\.0\.0\.1|\[?::1\]?):/.test(display);
}

function displaySummary(): string {
  const display = process.env.DISPLAY;
  if (shouldScrubDisplay(display)) return `headless Chromium, stale DISPLAY=${display} scrubbed`;
  if (display) return `headless Chromium, DISPLAY=${display} kept`;
  if (process.env.WAYLAND_DISPLAY) return `headless Chromium, WAYLAND_DISPLAY=${process.env.WAYLAND_DISPLAY} kept`;
  return "headless Chromium, no display env";
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  return `${m}m${Math.round(s - m * 60).toString().padStart(2, "0")}s`;
}

function fileSizeLabel(path: string): string {
  try {
    const mb = statSync(path).size / (1024 * 1024);
    return `${mb.toFixed(mb >= 10 ? 0 : 1)} MB`;
  } catch {
    return "";
  }
}

async function stage(name: string, step: string, runStep: () => Promise<void>, detail?: () => string): Promise<void> {
  const t0 = Date.now();
  console.log(`render ${name}  ${step} ...`);
  const pulse = setInterval(() => {
    console.log(`render ${name}  ${step} running ${formatMs(Date.now() - t0)}`);
  }, 30_000);
  pulse.unref();
  try {
    await runStep();
    const extra = detail?.();
    console.log(`render ${name}  ${step} done ${formatMs(Date.now() - t0)}${extra ? `  ${extra}` : ""}`);
  } finally {
    clearInterval(pulse);
  }
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
  const log = join(gen, `${name}.render.log`);
  try { rmSync(log, { force: true }); } catch { /* fresh log */ }

  const ride = join(gen, `${name}.vert.mp4`);
  const renderPublic = join(gen, `${name}.remotion-public`);
  const source = join(renderPublic, `${name}.source.mp4`);
  const overlay = join(renderPublic, `${name}.overlay.json`);
  const outMp4 = join(gen, `${name}.overlay.mp4`);
  rmSync(renderPublic, { recursive: true, force: true });
  mkdirSync(renderPublic, { recursive: true });

  const beatPunch = inp.render.beatPunchPct > 0 ? `p${inp.render.beatPunchPct} jolt ${inp.jolt}ms` : "off";
  console.log(`\nrender ${name}`);
  console.log(`  mode     ride=Playwright/Chromium + overlay=Remotion`);
  console.log(`  browser  ${displaySummary()}`);
  console.log(`  ride     ${inp.render.res} QP${RIDE_QP} zoom action x${inp.render.zoomMult} beat-punch ${beatPunch}`);
  console.log(`  overlay  CurveOverlayVertical ${OUTPUT_FPS}fps CRF${FINAL_CRF} isolated public dir`);
  console.log(`  metrics  score ${inp.metrics.score.toFixed(0)}  stand ${inp.metrics.standTimePct.toFixed(1)}%  rot ${inp.metrics.rotations.toFixed(1)}`);
  console.log(`  log      ${relative(ROOT, log)}`);

  try {
    // 1. ride render (spec camera, zoom-mult + beat-punch); QP near-lossless intermediate.
    const bp = inp.render.beatPunchPct > 0
      ? ["--beat-punch", `--beat-punch-pct=${inp.render.beatPunchPct}`, "--zoom-ease=cubic", `--jolt-ms=${inp.jolt}`]
      : [];
    await stage(name, "[1/5] ride render", () => run(TSX[0], [...TSX.slice(1), "scripts/export.ts",
      `--track=${inp.trackPath}`, `--spec=${inp.specPath}`, "--zoom=action",
      `--zoom-mult=${inp.render.zoomMult}`, ...bp, `--res=${inp.render.res}`, `--qp=${RIDE_QP}`, `--out=${ride}`], log),
      () => fileSizeLabel(ride));

    // 2. mux song.
    await stage(name, "[2/5] mux audio", () => run("ffmpeg", ["-y", "-i", ride, "-i", inp.audioPath, "-map", "0:v:0", "-map", "1:a:0",
      "-c:v", "copy", "-c:a", "aac", "-shortest", source], log),
      () => fileSizeLabel(source));

    // 3. overlay data bundle.
    let durationS = 0;
    await stage(name, "[3/5] overlay data", async () => {
      await run(TSX[0], [...TSX.slice(1), "scripts/make_overlay_data.ts",
        `--spec=${inp.specPath}`, `--report=${inp.reportPath}`, `--track=${inp.trackPath}`, `--out=${overlay}`], log);
      durationS = JSON.parse(readFileSync(overlay, "utf8")).durationS as number;
      copyFileSync(join(ROOT, "remotion", "public", inp.spectrumBase), join(renderPublic, inp.spectrumBase));
    }, () => `${durationS.toFixed(1)}s data`);

    // 4. overlay render (CurveOverlayVertical, locked look + post-FX at 60fps) — runs from remotion/.
    const props = JSON.stringify({
      dataFile: `${name}.overlay.json`, videoFile: `${name}.source.mp4`, durationS,
      spectrumFile: inp.spectrumBase, fps: OUTPUT_FPS, fx: LOCKED_FX,
    });
    await stage(name, "[4/5] Remotion overlay", () => run("npx", ["remotion", "render", "src/index.ts", "CurveOverlayVertical", outMp4,
      `--crf=${FINAL_CRF}`, "--jpeg-quality=100", `--props=${props}`, `--public-dir=${renderPublic}`], log, join(ROOT, "remotion")),
      () => fileSizeLabel(outMp4));

    // 5. bundle: stage → upload.json (sidecar last) → atomic mv into this run dir.
    let final = "";
    await stage(name, "[5/5] bundle commit", async () => {
      const { iso } = utcStamp(new Date());
      final = join(inp.outDir, inp.song, name); // <run>/<song>/<song>-s<seed>
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
    }, () => `${fileSizeLabel(join(final, "video.mp4"))} -> ${relative(ROOT, final)}`);
    return final;
  } finally {
    // 6. delete big intermediates unless asked to keep, even after failed renders.
    if (!inp.keepIntermediates) {
      for (const f of [ride, source, overlay, outMp4]) { try { rmSync(f, { force: true }); } catch { /* best-effort */ } }
      try { rmSync(renderPublic, { recursive: true, force: true }); } catch { /* best-effort */ }
    }
  }
}
