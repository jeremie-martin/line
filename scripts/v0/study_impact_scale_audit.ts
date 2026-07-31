/**
 * Scale audit (2026-07-31, docs/impact_definition.md Phase 1 / Study 3):
 * deliverability + compatibility for the cArc scale decision.
 *
 * A — CONTROLLABILITY: probe specs authoring constant impact x on a beat grid,
 *     compiled with the CURRENT scorer (compileHandoff); per authored contact we
 *     measure achieved redirArc and cArc. The asked→achieved response shows what
 *     today's compiler delivers per ask band (a lower bound on post-swap
 *     alignment — after promotion, selection itself adapts to the new measure).
 *
 * B — MEANING SHIFT: across real compiled tracks (labeled studies + productions
 *     in generated/), per landing: Δ(V) = |clamp(cArc/V) − clamp(redirArc/7.29)|
 *     as a function of the candidate anchor V. The 7.29 baseline is the FROZEN
 *     pre-promotion anchor (OLD_VSTRONG), not the live REDIRARC.VERY_STRONG —
 *     the drift is measured against what shipped before, not against itself.
 *     Reports the compatibility-optimal V* and the shift at notable candidates
 *     (7.29 · shipped REDIRARC.VERY_STRONG · atlas top ≈ 11.3 · V*).
 *
 * C — SEED STABILITY: cArc envelope across probe seeds.
 *
 *   LR_ENGINE=wasm npx tsx scripts/v0/study_impact_scale_audit.ts [--quick]
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as SS from "./impact_support.ts";
import { compileHandoff } from "./optimizer/handoff.ts";
import { REDIRARC, type Spec } from "./types.ts";

const QUICK = process.argv.includes("--quick");
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/** Pre-promotion `REDIRARC.VERY_STRONG` — the baseline this audit measures drift AGAINST.
 *  Frozen on purpose: it must NOT follow the live anchor (now 7.55, the cArc promotion),
 *  or the meaning-shift comparison becomes self-referential and V* comes out wrong. */
const OLD_VSTRONG = 7.29;
/** The pre-promotion `normImpact`: SOFT was 0 before and after, so the divide is exact. */
const oldNorm = (px: number) => clamp01(px / OLD_VSTRONG);

// ── A: controllability via the purpose-built calibration corpus ───────────────
// impact_calib_rich authors 10 impact levels × 14 deliberately-varied setups
// (gap/amplitude/air/speed), so the asked→achieved response is measured under
// realistic authoring variety, not one arbitrary probe configuration.
const SEEDS = QUICK ? [0] : [0, 1, 2];
const BUDGET = QUICK ? 60_000 : 150_000;

type ProbeRow = { x: number; seed: number; redirArc: number; cArc: number; speedIn: number };
const probeRows: ProbeRow[] = [];
const calibSpec: Spec = (await import("./specs/impact_calib_rich.ts")).default;
const askByT = new Map(calibSpec.contacts.filter((c) => c.impact !== undefined).map((c) => [c.t.toFixed(3), c.impact!]));
console.log(`A: compiling impact_calib_rich (${calibSpec.contacts.length} beats) × ${SEEDS.length} seeds, budget ${BUDGET} …`);
for (const seed of SEEDS) {
  const t0 = Date.now();
  const { track, report } = compileHandoff(calibSpec, seed, { budget: BUDGET });
  const sim = SS.simulateTrack(track);
  let hits = 0;
  for (const c of report.contacts) {
    const x = askByT.get(c.t_target.toFixed(3));
    if (x === undefined || c.status !== "hit") continue;
    const lf = SS.landingNear(sim, Math.round(c.t_actual * 40));
    if (lf < 0) continue;
    const v = sim.vel[lf - 1] ?? sim.vel[lf];
    probeRows.push({
      x, seed,
      redirArc: SS.redirArcPx(sim, lf), cArc: SS.contactRedirArcPx(sim, lf),
      speedIn: v ? Math.hypot(v.x, v.y) : 0,
    });
    hits++;
  }
  console.log(`  seed ${seed}: ${hits}/${report.contacts.length} measurable hits (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
}

console.log(`\n=== A: asked → achieved (median over hit contacts, all seeds) ===`);
console.log(`   ask   n    speedIn   redirArc  old-norm    cArc   cArc/${OLD_VSTRONG.toFixed(2)}  cArc/7.85  cArc/11.3`);
for (const x of [...new Set(probeRows.map((r) => r.x))].sort((a, b) => a - b)) {
  const rs = probeRows.filter((r) => r.x === x);
  const m = (f: (r: ProbeRow) => number) => SS.pct(rs.map(f), 0.5);
  console.log(`  ${x.toFixed(2)} ${String(rs.length).padStart(4)}   ${m((r) => r.speedIn).toFixed(1).padStart(6)}   ${m((r) => r.redirArc).toFixed(2).padStart(8)}  ${m((r) => oldNorm(r.redirArc)).toFixed(2).padStart(8)}  ${m((r) => r.cArc).toFixed(2).padStart(6)}   ${m((r) => clamp01(r.cArc / OLD_VSTRONG)).toFixed(2).padStart(8)} ${m((r) => clamp01(r.cArc / 7.85)).toFixed(2).padStart(8)} ${m((r) => clamp01(r.cArc / 11.3)).toFixed(2).padStart(8)}`);
}

// ── C: seed stability (probe cArc envelope by seed) ───────────────────────────
if (SEEDS.length > 1) {
  console.log(`\n=== C: probe cArc p50/p90 by seed (stability) ===`);
  for (const seed of SEEDS) {
    const rs = probeRows.filter((r) => r.seed === seed).map((r) => r.cArc);
    console.log(`  seed ${seed}: n=${rs.length}  p50 ${SS.pct(rs, 0.5).toFixed(2)}  p90 ${SS.pct(rs, 0.9).toFixed(2)}`);
  }
}

// ── B: meaning shift on real compiled tracks ──────────────────────────────────
const TRACKS = [
  // labeled studies
  "impact_lab_v2", "climb_terrace", "rolling_drop", "staircase", "shelter_impact_2m", "believer_impact_2m",
  // productions / long-form compiled content
  "shelter_impact_sync_after_pull_20260705_2m", "shelter_amp_v2_5m", "believer_v2", "believer_curves",
  "amor_na_praia_46s_amp", "tiki_tiki_48s_scores_v2", "luna_bala_44s", "handoff_filt_28s_2M", "showcase",
];
type LandRow = { track: string; redirArc: number; cArc: number };
const landRows: LandRow[] = [];
for (const name of TRACKS) {
  const p = [resolve(`generated/${name}.track.json`), resolve(`labels/impact/${name}.track.json`)].find(existsSync);
  if (!p) { console.log(`  (skip ${name} — no track file)`); continue; }
  const sim = SS.simulateTrack(JSON.parse(readFileSync(p, "utf8")));
  for (const e of sim.det.events) {
    if (e.type !== "landing" || e.frame < 2 || e.frame > sim.last - 1) continue;
    landRows.push({ track: name, redirArc: SS.redirArcPx(sim, e.frame), cArc: SS.contactRedirArcPx(sim, e.frame) });
  }
}
console.log(`\nB: ${landRows.length} landings across ${new Set(landRows.map((r) => r.track)).size} real tracks`);

const shiftAt = (V: number) => {
  const ds = landRows.map((r) => Math.abs(clamp01(r.cArc / V) - oldNorm(r.redirArc)));
  return { mean: SS.mean(ds), p90: SS.pct(ds, 0.9) };
};
let bestV = OLD_VSTRONG, bestMean = Infinity;
for (let V = 6; V <= 13; V += 0.05) {
  const { mean } = shiftAt(V);
  if (mean < bestMean) { bestMean = mean; bestV = V; }
}
console.log(`\n=== B: meaning shift |newNorm − oldNorm| vs candidate anchor V ===`);
console.log(`   V      mean    p90`);
for (const V of [OLD_VSTRONG, REDIRARC.VERY_STRONG, 8, bestV, 9, 10, 11.3]) {
  const { mean, p90 } = shiftAt(V);
  console.log(`  ${V.toFixed(2).padStart(5)}  ${mean.toFixed(3)}  ${p90.toFixed(3)}${Math.abs(V - bestV) < 0.03 ? "   ← compatibility-optimal V*" : ""}`);
}
console.log(
  `\n  (old-norm baseline: pre-promotion VERY_STRONG=${OLD_VSTRONG}; currently shipped REDIRARC.VERY_STRONG=${REDIRARC.VERY_STRONG};` +
    ` atlas reliable in-envelope top ≈ 11.2–12.6)`,
);
// where does the shift live? per-band table at V*
console.log(`\n=== B: per-band shift at V*=${bestV.toFixed(2)} (old-norm band → mean shift, n) ===`);
for (let lo = 0; lo < 1; lo += 0.2) {
  const rs = landRows.filter((r) => { const o = oldNorm(r.redirArc); return o >= lo && o < lo + 0.2; });
  if (!rs.length) continue;
  const mean = SS.mean(rs.map((r) => Math.abs(clamp01(r.cArc / bestV) - oldNorm(r.redirArc))));
  console.log(`  [${lo.toFixed(1)}, ${(lo + 0.2).toFixed(1)})  n=${String(rs.length).padStart(4)}  mean shift ${mean.toFixed(3)}`);
}
