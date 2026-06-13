/**
 * eval_pergap_vs_composed.ts — does the BALLISTIC per-gap axis reconstruction lose
 * information the COMPOSED-track engine measurement keeps?
 *
 * THE QUESTION (Jérémie): full and short are engine-identical up to the arc exit;
 * the only difference is the airborne span (short = ballistic from the exit state,
 * full = engine to gap end). So simple math from the exit state should reconstruct
 * every axis precisely. Is that right, or does the full leaf's COMPOSED re-detection
 * (every other committed arc present, every downstream catch happening) measure
 * something the isolated per-gap math cannot?
 *
 * THE TEST (confound-free, no search, no cost): take ONE real committed big_air
 * track. For each committed contact gap, compare the two measurements of its axes
 * on the IDENTICAL geometry:
 *   - BALLISTIC  = the committed fit.achieved (engine through the arc to the
 *                  geometric exit, then propagateBallisticArrivalState suffix).
 *   - COMPOSED   = measureGapAxes over a detection of the WHOLE composed track
 *                  (winningNode.prefixEngine, all arcs present) — what the FULL leaf
 *                  actually scores.
 * If they agree per axis -> the ballistic reconstruction is NOT lossy; the full
 * leaf's edge is elsewhere (survival/viability of the composed partial track, or the
 * search). If they diverge -> Jérémie is right, and the divergent axis is the lost
 * information.
 *
 * Run: LR_ENGINE=wasm npx tsx scripts/v0/eval_pergap_vs_composed.ts
 *      LR_ENGINE=wasm npx tsx scripts/v0/eval_pergap_vs_composed.ts --spec=big_air_ramp --seed=0 --budget=200000
 */
import { resolve } from "node:path";
import { makeRng } from "../lib/rng.ts";
import {
  effectiveAxes,
  impactFeasibilityBound,
  sampleGapTargets,
  sliceTimeline,
  validateSpec,
} from "./core/substrate.ts";
import { measureGapAxes } from "./core/measure.ts";
import { axisLookaheadEndFrame, detectWindow } from "./core/candidate.ts";
import {
  AXES,
  CALIB,
  FPS,
  secToFrame,
  type AxisName,
  type AxisValues,
  type Gap,
  type Spec,
} from "./types.ts";
import { K_BOUNCE_LANDING } from "../lib/detector.ts";
import { compileHandoff, setForwardEvalContext, type HandoffNode } from "./optimizer/handoff.ts";
import type { Candidate } from "./optimizer/sample.ts";
import { isStrictlyBetter, type LeafKey } from "./optimizer/register.ts";
import { setImpactTemplateSpecMeanImpact } from "./arc_placement.ts";

function argVal(name: string, fallback: string): string {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}
const SPEC_NAME = argVal("spec", "big_air_ramp");
const SEED = parseInt(argVal("seed", "0"), 10);
const BUDGET = parseInt(argVal("budget", "200000"), 10);

async function loadSpec(name: string): Promise<Spec> {
  const mod = await import(resolve("specs/golden", `${name}.ts`));
  return mod.default as Spec;
}

function meanAuthoredImpactAfterFirstFeasibleContact(contacts: Spec["contacts"]): number {
  const impacts = contacts.slice(1).map((c) => c.impact).filter((i): i is number => i !== undefined);
  return impacts.length === 0 ? 0 : impacts.reduce((s, i) => s + i, 0) / impacts.length;
}

// VERBATIM from eval_arc_apples.ts buildSearchSetup (the compiler's gap/target/impact block).
function buildSearchSetup(userSpec: Spec, seed: number) {
  validateSpec(userSpec);
  const feasibleContacts = userSpec.contacts.filter((c) => secToFrame(c.t) >= K_BOUNCE_LANDING);
  const spec: Spec = { ...userSpec, preroll: undefined, contacts: feasibleContacts };
  const durationFrames = secToFrame(spec.duration);
  const allContactFrames = [...spec.contacts].map((c) => secToFrame(c.t)).sort((a, b) => a - b);
  const gaps = sliceTimeline(allContactFrames, durationFrames);
  const masterRng = makeRng(seed);
  const gapAxisTargets = gaps.map((gap) => effectiveAxes(gap, spec));
  for (const gap of gaps) {
    gap.targets = sampleGapTargets(gapAxisTargets[gap.index], spec.jitter ?? CALIB.SIGMA, masterRng);
  }
  setImpactTemplateSpecMeanImpact(meanAuthoredImpactAfterFirstFeasibleContact(spec.contacts));
  const impactByFrame = new Map<number, number>();
  for (const c of spec.contacts) if (c.impact !== undefined) impactByFrame.set(secToFrame(c.t), c.impact);
  if (impactByFrame.size > 0) {
    for (const gap of gaps) {
      if (!gap.endsWithContact) continue;
      const impact = impactByFrame.get(gap.endFrame);
      if (impact === undefined) continue;
      const nextContact = allContactFrames.find((f) => f > gap.endFrame);
      const nextGapSeconds = nextContact === undefined ? 1.5 : (nextContact - gap.endFrame) / FPS;
      const prevGapSeconds = (gap.endFrame - gap.startFrame) / FPS;
      const t = gapAxisTargets[gap.index];
      const bounded = Math.min(impact, impactFeasibilityBound(t.speed, prevGapSeconds, nextGapSeconds));
      gap.targets.impact = bounded;
      gapAxisTargets[gap.index].impact = bounded;
    }
    for (let i = 0; i + 1 < gaps.length; i++) {
      if (!gaps[i].endsWithContact) continue;
      const next = gaps[i + 1];
      if (next.endsWithContact && next.targets.impact !== undefined) gaps[i].nextImpact = next.targets.impact;
    }
  }
  return { searchSpec: spec, gaps, gapAxisTargets, allContactFrames, durationFrames };
}

async function main(): Promise<void> {
  const userSpec = await loadSpec(SPEC_NAME);
  const setup = buildSearchSetup(userSpec, SEED);
  const { gaps, gapAxisTargets, allContactFrames, durationFrames } = setup;

  // Compile; keep the best COMPLETE committed track (carries the full fit chain + composed engine).
  let winning: HandoffNode | null = null;
  let winningKey: LeafKey | null = null;
  compileHandoff(userSpec, SEED, {
    budget: BUDGET,
    onNode: (node, key, event) => {
      if (!event.fullDuration) return;
      if (winningKey === null || isStrictlyBetter(key, winningKey)) {
        winning = node;
        winningKey = key;
      }
    },
  });
  if (winning === null) throw new Error(`no complete track for ${SPEC_NAME} seed=${SEED} budget=${BUDGET}`);
  const win: HandoffNode = winning;
  setForwardEvalContext(setup.searchSpec, gapAxisTargets);

  // The COMPOSED detection: the whole committed track, every arc's lines present (what the FULL leaf scores).
  const composedDet = detectWindow(win.search.prefixEngine, 0, durationFrames + 20);
  const fits = win.search.prefixFits;

  console.log("============================================================");
  console.log("  eval_pergap_vs_composed — BALLISTIC per-gap vs COMPOSED engine axes");
  console.log("  on the SAME committed track (no search, no cost confound)");
  console.log("============================================================");
  console.log(`  spec=${SPEC_NAME} seed=${SEED} budget=${BUDGET}`);
  console.log(`  committed track: gapIndex=${win.search.gapIndex}  full_score=${winningKey?.full_score.toFixed(2)}`);
  console.log(`  composed terminus: frame=${composedDet.terminus.frame}/${durationFrames}  reason=${composedDet.terminus.reason}`);
  console.log("");
  console.log("  per committed contact gap: |ballistic − composed| per axis (the lost info, if any)");
  console.log(`  ${"gap".padStart(3)} ${"frames".padStart(11)}  ${AXES.map((a) => a.padStart(9)).join(" ")}`);

  const sums: Record<string, number> = {};
  const maxs: Record<string, number> = {};
  let rows = 0;
  for (const gap of gaps) {
    if (!gap.endsWithContact) continue;
    const fit = fits[gap.index] as Candidate | null;
    if (fit === null || fit === undefined) continue;
    const ballistic = fit.achieved;
    const axisMeasureEnd = axisLookaheadEndFrame(gap, allContactFrames);
    const composed = measureGapAxes(composedDet, gap, fit.lines, axisMeasureEnd);
    rows++;
    const cells = AXES.map((axis: AxisName) => {
      const b = ballistic[axis];
      const c = composed[axis];
      if (b === undefined || c === undefined) return "    -    ";
      const d = Math.abs(b - c);
      sums[axis] = (sums[axis] ?? 0) + d;
      maxs[axis] = Math.max(maxs[axis] ?? 0, d);
      return d.toFixed(4).padStart(9);
    });
    console.log(`  ${String(gap.index).padStart(3)} ${`[${gap.startFrame}..${gap.endFrame}]`.padStart(11)}  ${cells.join(" ")}`);
  }

  console.log("");
  console.log(`  MEAN |ballistic − composed| over ${rows} committed contact gaps:`);
  console.log(`      ${AXES.map((a) => `${a} ${((sums[a] ?? 0) / Math.max(1, rows)).toFixed(4)}`).join("   ")}`);
  console.log(`  MAX  |ballistic − composed|:`);
  console.log(`      ${AXES.map((a) => `${a} ${(maxs[a] ?? 0).toFixed(4)}`).join("   ")}`);
  console.log("");
  console.log("  READ: ~0 across axes  => ballistic reconstruction is NOT lossy vs the composed");
  console.log("        measurement; the full leaf's edge is the composed-track VIABILITY/survival or");
  console.log("        the search, not the airborne axis math (Jérémie's 'missing axis info' falsified).");
  console.log("        Non-zero on an axis => that axis IS lost info the composed measurement keeps.");
  console.log("============================================================");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
