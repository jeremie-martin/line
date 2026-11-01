/** Shared ride → audio → optional presentation renderer.
 * Plain review clips and finished videos use the same camera and native exporter.
 * renderBundle adds publication metadata; it does not own a separate render path.
 */
import { spawn } from "node:child_process";
import {createHash,randomUUID} from "node:crypto";
import { appendFileSync, openSync, closeSync, existsSync, mkdirSync, rmSync, copyFileSync, writeFileSync, readFileSync, renameSync, statSync } from "node:fs";
import { resolve, join, dirname, basename, relative } from "node:path";
import { exportVideo } from "../lib/export.ts";
import { resolveVideoOptions } from "../lib/video_options.ts";
import type { RenderConfig } from "./config.ts";
import { LOCKED_FX } from "../fx_recipe.ts";

const ROOT = resolve(import.meta.dirname, "..", "..");
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

/** make_spectrum.py needs librosa, which lives in the project venv, not base python3.
 *  Override with LR_SPECTRUM_PYTHON. */
function spectrumPython(): string {
  if (process.env.LR_SPECTRUM_PYTHON) return process.env.LR_SPECTRUM_PYTHON;
  const venv = join(ROOT, "beats", ".venv", "bin", "python");
  return existsSync(venv) ? venv : "python3";
}

/** Cache the actual recording and analysis recipe, not a mutable song name.
 * Concurrent render lanes publish complete files atomically. */
export async function ensureSpectrum(audioPath: string, song: string, logPath: string): Promise<string> {
  const identity=createHash('sha256').update(readFileSync(audioPath))
    .update(readFileSync(join(ROOT,'scripts/make_spectrum.py'))).update('fps=30;bands=56').digest('hex');
  const out=join(ROOT,'remotion','public',`${song}.${identity}.spectrum.json`);
  mkdirSync(dirname(out),{recursive:true});
  if(!existsSync(out)){
    const temporary=out+'.'+randomUUID()+'.tmp';
    try{
      await run(spectrumPython(),['scripts/make_spectrum.py',`--audio=${audioPath}`,`--out=${temporary}`,'--fps=30','--bands=56'],logPath);
      JSON.parse(readFileSync(temporary,'utf8')); // Never publish a truncated analysis.
      renameSync(temporary,out);
    }finally{if(existsSync(temporary))rmSync(temporary);}
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
  impactPath?: string;
  workPath: string;
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
  style?: "plain" | "finished";
};

function utcStamp(d: Date): { day: string; stamp: string; iso: string } {
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  const Y = d.getUTCFullYear(), M = p(d.getUTCMonth() + 1), D = p(d.getUTCDate());
  const h = p(d.getUTCHours()), m = p(d.getUTCMinutes()), s = p(d.getUTCSeconds());
  return { day: `${Y}/${M}/${D}`, stamp: `${Y}${M}${D}T${h}${m}${s}Z`, iso: `${Y}-${M}-${D}T${h}:${m}:${s}Z` };
}

/** Bound execution resources independently of the visual recipe. */
export function renderResourceArgs(env: NodeJS.ProcessEnv = process.env): string[] {
  const positive = (name: string, fallback: number) => {
    const text = env[name] ?? String(fallback), value = Number(text);
    if (!/^\d+$/.test(text) || !Number.isSafeInteger(value) || value < 1)
      throw new Error(`${name} must be a positive integer`);
    return value;
  };
  const concurrency = positive('LR_REMOTION_CONCURRENCY', 4);
  const cacheBytes = positive('LR_REMOTION_CACHE_MB', 512) * 1024 * 1024;
  if (!Number.isSafeInteger(cacheBytes)) throw new Error('LR_REMOTION_CACHE_MB is too large');
  return [`--concurrency=${concurrency}`, `--offthreadvideo-cache-size-in-bytes=${cacheBytes}`];
}

/** Render the ride and optional presentation layers through one shared path. */
export type VideoInput = Pick<RenderInput, 'trackPath' | 'render' | 'jolt' | 'workDir' | 'keepIntermediates' | 'style'> & {
  name: string; audioPath?: string; qp?: number; specPath?: string; reportPath?: string; impactPath?: string; spectrumBase?: string;
};
export async function renderVideo(inp: VideoInput): Promise<string> {
  // Remotion's default frame cache can claim half the machine's available RAM
  // per process. A collection needs a per-render bound, independently of workers.
  // These controls change execution resources, not the locked visual recipe.
  const resources = renderResourceArgs();
  const name = inp.name, qp = inp.qp ?? RIDE_QP;
  const finished = (inp.style ?? "finished") === "finished";
  if (finished && (!inp.audioPath || !inp.specPath || !inp.reportPath || !inp.spectrumBase)) throw new Error("Finished video requires audio, spec, report and spectrum");
  const steps = finished ? 3 : inp.audioPath ? 2 : 1;
  const gen = resolve(inp.workDir);
  mkdirSync(gen, { recursive: true });
  mkdirSync(join(ROOT, "remotion", "public"), { recursive: true });
  const log = join(gen, `${name}.render.log`);
  try { rmSync(log, { force: true }); } catch { /* fresh log */ }

  const ride = join(gen, `${name}.ride.mp4`);
  const renderPublic = join(gen, `${name}.remotion-public`);
  const source = join(renderPublic, `${name}.source.mp4`);
  const overlay = join(renderPublic, `${name}.overlay.json`);
  const outMp4 = join(gen, `${name}.mp4`);
  rmSync(renderPublic, { recursive: true, force: true });
  mkdirSync(renderPublic, { recursive: true });

  console.log(`\nrender ${name}`);
  console.log(`  mode     ${finished ? "finished · ride + presentation" : inp.audioPath ? "plain · ride + audio" : "plain · silent ride"}`);
  console.log(`  browser  ${displaySummary()}`);
  console.log(`  picture  ${inp.render.res} · ${OUTPUT_FPS}fps`);
  if (finished) console.log(`  finish   ${OUTPUT_FPS}fps CRF${FINAL_CRF}`);
  console.log(`  log      ${relative(ROOT, log)}`);

  try {
    // 1. ride render (spec camera, zoom-mult + beat-punch); QP near-lossless intermediate.
    const bp = inp.render.beatPunchPct > 0
      ? ["--beat-punch", `--beat-punch-pct=${inp.render.beatPunchPct}`, "--zoom-ease=cubic", `--jolt-ms=${inp.jolt}`]
      : [];
    await stage(name, `[1/${steps}] ride`, async () => {
      const logLine = (message: unknown) => appendFileSync(log, String(message) + "\n");
      const options = await resolveVideoOptions([
        `--track=${inp.trackPath}`, ...(inp.specPath ? [`--spec=${inp.specPath}`, "--zoom=action"] : []),
        `--zoom-mult=${inp.render.zoomMult}`, ...bp, `--res=${inp.render.res}`, `--qp=${qp}`, `--out=${ride}`,
      ], {log: logLine, warn: logLine, error: logLine});
      await exportVideo({...options, log: logLine});
    }, () => fileSizeLabel(ride));

    // 2. mux song.
    if (inp.audioPath) await stage(name, `[2/${steps}] audio`, () => run("ffmpeg", ["-y", "-i", ride, "-i", inp.audioPath!, "-map", "0:v:0", "-map", "1:a:0",
      "-c:v", "copy", "-c:a", "aac", "-shortest", source], log),
      () => fileSizeLabel(source));
    else copyFileSync(ride, source);

    if (!finished) {copyFileSync(source, outMp4); return outMp4;}

    // 3. overlay data bundle.
    let durationS = 0;
    await stage(name, "presentation data", async () => {
      await run(TSX[0], [...TSX.slice(1), "scripts/make_overlay_data.ts",
        `--spec=${inp.specPath}`, `--report=${inp.reportPath}`, `--track=${inp.trackPath}`, `--out=${overlay}`,
        ...(inp.impactPath ? [`--impact-account=${inp.impactPath}`] : [])], log);
      durationS = JSON.parse(readFileSync(overlay, "utf8")).durationS as number;
      copyFileSync(join(ROOT, "remotion", "public", inp.spectrumBase!), join(renderPublic, inp.spectrumBase!));
    }, () => `${durationS.toFixed(1)}s data`);

    // 4. overlay render (CurveOverlayVertical, locked look + post-FX at 60fps) — runs from remotion/.
    const props = JSON.stringify({
      dataFile: `${name}.overlay.json`, videoFile: `${name}.source.mp4`, durationS,
      spectrumFile: inp.spectrumBase, fps: OUTPUT_FPS, fx: LOCKED_FX,
      width: Number(inp.render.res.split("x")[0]), height: Number(inp.render.res.split("x")[1]),
    });
    await stage(name, "[3/3] presentation", () => run("npx", ["remotion", "render", "src/index.ts", "CurveOverlayVertical", outMp4,
      `--crf=${FINAL_CRF}`, "--jpeg-quality=100", "--color-space=bt709", `--props=${props}`, `--public-dir=${renderPublic}`,
      ...resources], log, join(ROOT, "remotion")),
      () => fileSizeLabel(outMp4));

    return outMp4;
  } finally {
    // 6. delete big intermediates unless asked to keep, even after failed renders.
    if (!inp.keepIntermediates) {
      for (const f of [ride, source, overlay]) { try { rmSync(f, { force: true }); } catch { /* best-effort */ } }
      try { rmSync(renderPublic, { recursive: true, force: true }); } catch { /* best-effort */ }
    }
  }
}

/** Render one track and commit a production-ready bundle. Returns the bundle dir. */
export async function renderBundle(inp: RenderInput): Promise<string> {
  const name = `${inp.song}-s${inp.seed}`;
  const outMp4 = await renderVideo({...inp, name});
  try {
    // 5. bundle: stage → upload.json (sidecar last) → atomic mv into this run dir.
    let final = "";
    await stage(name, "bundle", async () => {
      const { iso } = utcStamp(new Date());
      final = join(inp.outDir, inp.song, name); // <run>/<song>/<song>-s<seed>
      const tmp = join(inp.outDir, `.staging-${name}`);
      rmSync(tmp, { recursive: true, force: true });
      mkdirSync(tmp, { recursive: true });
      mkdirSync(dirname(final), { recursive: true });
      copyFileSync(outMp4, join(tmp, "video.mp4"));
      copyFileSync(inp.workPath, join(tmp, "work.json"));
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
    if (!inp.keepIntermediates) rmSync(outMp4, {force: true});
  }
}
