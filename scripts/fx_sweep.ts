/**
 * Post-FX variant sweep — renders many short "look" variants of an already-rendered
 * production over a fixed clip window, by re-running ONLY the Remotion overlay stage
 * (CurveOverlayVertical) with different `fx` props. No ride re-render: it reuses the
 * existing remotion/public/<song>.{source.mp4,overlay.json,spectrum.json}.
 *
 * Usage:
 *   node --import tsx scripts/fx_sweep.ts <song> <move> [window_s] [fps] [durationS]
 *   e.g. node --import tsx scripts/fx_sweep.ts luna_bala_44s shake 9-17 60 44.5
 *   window_s is a SECONDS range ("9-17"); frames are derived from fps so the clip is
 *   the same musical window regardless of fps.
 *
 * Output: remotion/out/sweeps/<move>/<label>.mp4  (+ props/<label>.json, manifest.json)
 * Each variant clip carries the song audio for that window, so they're judged in context.
 */
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { LOCKED_FX } from "./fx_recipe.ts";

const ROOT = resolve(import.meta.dirname, "..");
const REMOTION = join(ROOT, "remotion");

type Variant = { label: string; note: string; fx: Record<string, unknown> };

// The locked shake winner (02_medium) — the shake-sweep entry and the chroma/look
// variants both reference it so the "medium shake" base is defined exactly once.
const MEDIUM_SHAKE = { maxPx: 18, maxRotDeg: 0.7, overscan: 1.05, freq: 11, decayPerSec: 6, gain: 1.8, minImpact: 0.22, power: 1.5 } as const;

// ── MOVE 1: camera shake — translational + rotational, impact-driven ────────────
const SHAKE: Variant[] = [
  { label: "00_baseline", note: "no fx (reference)", fx: {} },
  { label: "01_subtle", note: "small, quick settle", fx: { shake: { maxPx: 10, maxRotDeg: 0.4, overscan: 1.04, freq: 9, decayPerSec: 7, gain: 1.6, minImpact: 0.22, power: 1.5 } } },
  { label: "02_medium", note: "balanced default", fx: { shake: { ...MEDIUM_SHAKE } } },
  { label: "03_strong", note: "big amplitude", fx: { shake: { maxPx: 30, maxRotDeg: 1.2, overscan: 1.07, freq: 12, decayPerSec: 5, gain: 2.0, minImpact: 0.22, power: 1.3 } } },
  { label: "04_punchy", note: "snappy, high-freq, quiet between", fx: { shake: { maxPx: 24, maxRotDeg: 0.9, overscan: 1.06, freq: 15, decayPerSec: 10, gain: 2.2, minImpact: 0.22, power: 2.0 } } },
  { label: "05_rumble", note: "low-freq slow roll", fx: { shake: { maxPx: 26, maxRotDeg: 0.7, overscan: 1.06, freq: 6, decayPerSec: 4, gain: 1.9, minImpact: 0.22, power: 1.4 } } },
  { label: "06_rotation", note: "tilt-led, little translate", fx: { shake: { maxPx: 12, maxRotDeg: 2.2, overscan: 1.06, freq: 10, decayPerSec: 6, gain: 1.9, minImpact: 0.22, power: 1.5 } } },
  { label: "07_translate_only", note: "no rotation", fx: { shake: { maxPx: 28, maxRotDeg: 0, overscan: 1.06, freq: 12, decayPerSec: 6, gain: 2.0, minImpact: 0.22, power: 1.5 } } },
];

// ── MOVE 2: chromatic aberration / impact flash (all on the medium-shake base) ──
const CHROMA: Variant[] = [
  { label: "00_shake_only", note: "medium shake, no chroma (reference)", fx: { shake: { ...MEDIUM_SHAKE } } },
  { label: "01_chroma_subtle", note: "small RGB split on hits", fx: { shake: { ...MEDIUM_SHAKE }, chroma: { maxPx: 5, gain: 1.8, decayPerSec: 8, minImpact: 0.25, power: 1.5 } } },
  { label: "02_chroma_medium", note: "moderate split on hits", fx: { shake: { ...MEDIUM_SHAKE }, chroma: { maxPx: 9, gain: 1.9, decayPerSec: 7, minImpact: 0.25, power: 1.5 } } },
  { label: "03_chroma_strong", note: "big split on hits", fx: { shake: { ...MEDIUM_SHAKE }, chroma: { maxPx: 14, gain: 2.0, decayPerSec: 7, minImpact: 0.25, power: 1.4 } } },
  { label: "04_chroma_constant", note: "constant low split + hit boost (VHS-ish)", fx: { shake: { ...MEDIUM_SHAKE }, chroma: { maxPx: 9, baseline: 2.5, gain: 1.8, decayPerSec: 7, minImpact: 0.25, power: 1.5 } } },
  { label: "05_flash_only", note: "white flash on hits, no chroma", fx: { shake: { ...MEDIUM_SHAKE }, flash: { color: "#ffffff", maxOpacity: 0.45, gain: 2.0, decayPerSec: 12, minImpact: 0.3, blend: "screen" } } },
  { label: "06_chroma_flash", note: "moderate chroma + subtle flash", fx: { shake: { ...MEDIUM_SHAKE }, chroma: { maxPx: 9, gain: 1.9, decayPerSec: 7, minImpact: 0.25, power: 1.5 }, flash: { color: "#ffffff", maxOpacity: 0.3, gain: 1.8, decayPerSec: 12, minImpact: 0.3, blend: "screen" } } },
  { label: "07_max_slam", note: "strong chroma + flash (everything)", fx: { shake: { ...MEDIUM_SHAKE }, chroma: { maxPx: 13, gain: 2.0, decayPerSec: 7, minImpact: 0.25, power: 1.4 }, flash: { color: "#ffffff", maxOpacity: 0.34, gain: 1.9, decayPerSec: 12, minImpact: 0.3, blend: "screen" } } },
];

// The LOCKED look (shared with production via scripts/fx_recipe.ts): subtle shake +
// strong chroma + subtle flash + faint recentered vignette. Sweeps that vary one
// dimension spread this then override that one key. Deep-cloned per use so variants
// can't mutate the shared recipe.
const impact = () => JSON.parse(JSON.stringify(LOCKED_FX)) as Record<string, unknown>;

// ── MOVE 3: kill the flat white — grade / vignette / tint (on the locked impact) ─
const LOOK: Variant[] = [
  { label: "00_impact_only", note: "locked impact, flat white (reference)", fx: { ...impact() } },
  { label: "01_vignette", note: "+ vignette only", fx: { ...impact(), vignette: { strength: 0.45 } } },
  { label: "02_grade_punch", note: "+ contrast/saturation", fx: { ...impact(), grade: { contrast: 1.12, saturate: 1.18, brightness: 0.99 } } },
  { label: "03_tint_warm", note: "+ warm multiply wash + vignette", fx: { ...impact(), tint: { color: "#f0c08a", blend: "multiply", opacity: 0.16 }, vignette: { strength: 0.4 } } },
  { label: "04_tint_cool", note: "+ cool cinematic wash + vignette", fx: { ...impact(), tint: { color: "#5b7fb5", blend: "multiply", opacity: 0.18 }, vignette: { strength: 0.45 } } },
  { label: "05_phase_tint", note: "+ tint tracks phase color + vignette", fx: { ...impact(), tint: { byPhase: true, blend: "multiply", opacity: 0.2 }, vignette: { strength: 0.4 } } },
  { label: "06_full_look", note: "+ grade + phase tint + vignette (+pulse)", fx: { ...impact(), grade: { contrast: 1.1, saturate: 1.15, brightness: 0.99 }, tint: { byPhase: true, blend: "multiply", opacity: 0.16 }, vignette: { strength: 0.42, pulse: 0.18 } } },
];

// ── vignette refinement v2: faint/soft, RECENTERED on the rider (cy~36%) so the
//    clear oval sits over the action and the bottom reads a touch darker. ─────────
const VIGNETTE: Variant[] = [
  { label: "00_none", note: "locked impact, no vignette (reference)", fx: { ...impact() } },
  { label: "01_faint", note: "very light, centered on rider", fx: { ...impact(), vignette: { strength: 0.20, rx: 74, ry: 54, core: 68, cy: 36 } } },
  { label: "02_soft", note: "light, centered on rider", fx: { ...impact(), vignette: { strength: 0.28, rx: 74, ry: 52, core: 65, cy: 36 } } },
  { label: "03_soft_plus", note: "light+, centered on rider", fx: { ...impact(), vignette: { strength: 0.36, rx: 74, ry: 52, core: 64, cy: 36 } } },
  { label: "04_higher_center", note: "soft, center higher (32%) → darker bottom", fx: { ...impact(), vignette: { strength: 0.30, rx: 74, ry: 52, core: 64, cy: 32 } } },
  { label: "05_wider", note: "soft, wider clear (sides cleaner)", fx: { ...impact(), vignette: { strength: 0.30, rx: 84, ry: 52, core: 68, cy: 36 } } },
];

const MOVES: Record<string, Variant[]> = { shake: SHAKE, chroma: CHROMA, look: LOOK, vignette: VIGNETTE };

function run(cmd: string, args: string[], cwd: string): Promise<void> {
  return new Promise((res, rej) => {
    const p = spawn(cmd, args, { cwd, stdio: "inherit" });
    p.on("error", rej);
    p.on("exit", (code) => (code === 0 ? res() : rej(new Error(`${cmd} exited ${code}`))));
  });
}

async function main() {
  const song = process.argv[2] ?? "luna_bala_44s";
  const move = process.argv[3] ?? "shake";
  const window = process.argv[4] ?? "9-17";   // seconds
  const fps = Number(process.argv[5] ?? 60);
  const durationS = Number(process.argv[6] ?? 44.5);
  const variants = MOVES[move];
  if (!variants) throw new Error(`unknown move "${move}" (have: ${Object.keys(MOVES).join(", ")})`);
  if (!Number.isFinite(fps) || !Number.isFinite(durationS)) {
    throw new Error(`fps and durationS must be numbers (got fps="${process.argv[5]}", durationS="${process.argv[6]}")`);
  }
  const [s0, s1] = window.split("-").map(Number);
  if (!Number.isFinite(s0) || !Number.isFinite(s1)) throw new Error(`window must be "start-end" in seconds (got "${window}")`);
  const frames = `${Math.round(s0 * fps)}-${Math.round(s1 * fps)}`;

  const outDir = join(REMOTION, "out", "sweeps", move);
  const propDir = join(outDir, "props");
  mkdirSync(propDir, { recursive: true });

  const manifest: Array<{ label: string; note: string; out: string; fx: Record<string, unknown> }> = [];
  for (const v of variants) {
    const props = {
      dataFile: `${song}.overlay.json`,
      videoFile: `${song}.source.mp4`,
      spectrumFile: `${song}.spectrum.json`,
      durationS,
      fps,
      fx: v.fx,
    };
    const propPath = join(propDir, `${v.label}.json`);
    writeFileSync(propPath, JSON.stringify(props));
    const out = `out/sweeps/${move}/${v.label}.mp4`;
    console.log(`\n=== ${move}/${v.label} — ${v.note} ===`);
    await run("npx", ["remotion", "render", "src/index.ts", "CurveOverlayVertical", out,
      `--props=${propPath}`, `--frames=${frames}`, "--crf=18", "--log=error"], REMOTION);
    manifest.push({ label: v.label, note: v.note, out, fx: v.fx });
  }
  writeFileSync(join(outDir, "manifest.json"), JSON.stringify({ song, move, window, fps, frames, durationS, variants: manifest }, null, 2));
  console.log(`\nDONE → ${outDir}  (${variants.length} clips)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
