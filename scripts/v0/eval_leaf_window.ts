/**
 * eval_leaf_window.ts — is the objective leaf's axis term scoring the WRONG WINDOW?
 *
 * THE HYPOTHESIS: the objective leaf reads each committed gap's `fit.achieved`, which
 * is measured over the LOOKAHEAD window [gap.start, axisLookaheadEndFrame] (extends to
 * the NEXT contact for air gaps — core/candidate.ts axisLookaheadEndFrame). But the TRUE
 * scorer (core/substrate.ts buildDriftReport:684) measures each gap's achieved over
 * [gap.start, gap.endFrame] — the gap window. For big_air's long post-landing flights
 * these windows differ a lot, so the objective leaf's combined-RMS axis quality is a
 * SYSTEMATICALLY different number than the true scorer's, even with a perfect ballistic.
 *
 * THE TEST: take one real committed track. Over ALL committed contact gaps, pool the
 * per-axis errors three ways and report the resulting combined-RMS axis_quality (the
 * leaf's axis factor):
 *   A) fit.achieved              — lookahead window, ballistic  (what the leaf uses NOW)
 *   B) engine @ axisMeasureEnd   — lookahead window, engine     (isolates ballistic err)
 *   C) engine @ gap.endFrame     — gap window, engine           (what the TRUE scorer uses)
 * If qual(A) ≈ qual(C): window is not the issue. If qual(A) diverges from qual(C) but
 * qual(B) ≈ qual(A): the divergence is the WINDOW, not the ballistic — fix = score the
 * leaf on the gap-window (engine, zero extra frames, inside the already-simulated prefix).
 *
 * Run: LR_ENGINE=wasm npx tsx scripts/v0/eval_leaf_window.ts --spec=big_air_ramp --seed=0 --budget=200000
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
import { axisErrorsForTargets, axisQualityFromErrors } from "./score.ts";
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

function meanImpactAfterFirst(contacts: Spec["contacts"]): number {
  const impacts = contacts.slice(1).map((c) => c.impact).filter((i): i is number => i !== undefined);
  return impacts.length === 0 ? 0 : impacts.reduce((s, i) => s + i, 0) / impacts.length;
}

async function main(): Promise<void> {
  const userSpec = await loadSpec(SPEC_NAME);
  validateSpec(userSpec);
  const feasible = userSpec.contacts.filter((c) => secToFrame(c.t) >= K_BOUNCE_LANDING);
  const spec: Spec = { ...userSpec, preroll: undefined, contacts: feasible };
  const durationFrames = secToFrame(spec.duration);
  const allContactFrames = [...spec.contacts].map((c) => secToFrame(c.t)).sort((a, b) => a - b);
  const gaps = sliceTimeline(allContactFrames, durationFrames);
  const masterRng = makeRng(SEED);
  const gapAxisTargets = gaps.map((gap) => effectiveAxes(gap, spec));
  for (const gap of gaps) gap.targets = sampleGapTargets(gapAxisTargets[gap.index], spec.jitter ?? CALIB.SIGMA, masterRng);
  setImpactTemplateSpecMeanImpact(meanImpactAfterFirst(spec.contacts));
  const impactByFrame = new Map<number, number>();
  for (const c of spec.contacts) if (c.impact !== undefined) impactByFrame.set(secToFrame(c.t), c.impact);
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

  let win: HandoffNode | null = null;
  let winKey: LeafKey | null = null;
  compileHandoff(userSpec, SEED, {
    budget: BUDGET,
    onNode: (node, key, event) => {
      if (!event.fullDuration) return;
      if (winKey === null || isStrictlyBetter(key, winKey)) { win = node; winKey = key; }
    },
  });
  if (win === null) throw new Error(`no complete track ${SPEC_NAME} seed=${SEED}`);
  const winNode: HandoffNode = win;
  setForwardEvalContext(spec, gapAxisTargets);
  const composedDet = detectWindow(winNode.search.prefixEngine, 0, durationFrames + 20);

  // Pool errors three ways across all committed contact gaps.
  const errA: number[] = []; // fit.achieved (lookahead, ballistic) — leaf BEFORE the fix
  const errB: number[] = []; // engine @ lookahead window
  const errC: number[] = []; // engine @ gap.endFrame — TRUE scorer
  const errD: number[] = []; // fit.achievedAtEnd (what the leaf reads NOW)
  let nGaps = 0;
  console.log("============================================================");
  console.log("  eval_leaf_window — objective-leaf axis window vs true-scorer window");
  console.log("============================================================");
  console.log(`  spec=${SPEC_NAME} seed=${SEED} budget=${BUDGET}  full_score=${winKey?.full_score.toFixed(2)}`);
  console.log(`  per-gap axis_quality:  A=fit.achieved(lookahead/ballistic)  C=engine@endFrame(true scorer)`);
  console.log(`  ${"gap".padStart(3)} ${"window".padStart(13)} ${"lookEnd".padStart(7)}   per-axis |A−C|`);
  for (let i = 0; i < winNode.search.gapIndex; i++) {
    const gap = gaps[i];
    if (!gap.endsWithContact) continue;
    const fit = winNode.search.prefixFits[i];
    if (fit == null) continue;
    nGaps++;
    const target = gapAxisTargets[i];
    const lookEnd = axisLookaheadEndFrame(gap, allContactFrames);
    const aAch = fit.achieved;
    const bAch = measureGapAxes(composedDet, gap, fit.lines, lookEnd);
    const cAch = measureGapAxes(composedDet, gap, fit.lines, gap.endFrame);
    errA.push(...axisErrorsForTargets(target, aAch));
    errB.push(...axisErrorsForTargets(target, bAch));
    errC.push(...axisErrorsForTargets(target, cAch));
    // D) the STORED achievedAtEnd the objective leaf now reads (gap-fit det, fit time).
    // Should equal C (composed engine@endFrame) if the gap-fit measurement is causally
    // identical to the composed-track measurement — i.e. the fix is exact.
    if (fit.achievedAtEnd !== undefined) {
      errD.push(...axisErrorsForTargets(target, fit.achievedAtEnd));
    } else {
      errD.push(...axisErrorsForTargets(target, aAch)); // leaf falls back to achieved
    }
    const cells = AXES.filter((ax) => target[ax] !== undefined && aAch[ax] !== undefined && cAch[ax] !== undefined)
      .map((ax) => `${ax.slice(0, 3)} ${Math.abs((aAch[ax] as number) - (cAch[ax] as number)).toFixed(3)}`);
    console.log(`  ${String(i).padStart(3)} ${`[${gap.startFrame}..${gap.endFrame}]`.padStart(13)} ${String(lookEnd).padStart(7)}   ${cells.join("  ")}`);
  }
  const qA = axisQualityFromErrors(errA);
  const qB = axisQualityFromErrors(errB);
  const qC = axisQualityFromErrors(errC);
  const qD = axisQualityFromErrors(errD);
  console.log("");
  console.log(`  pooled over ${nGaps} committed contact gaps (combined RMS, the leaf's axis factor):`);
  console.log(`    A) fit.achieved     (lookahead, ballistic) : rms=${qA.axis_error_rms.toFixed(4)}  axis_quality=${qA.axis_quality.toFixed(4)}`);
  console.log(`    B) engine@lookahead (lookahead, engine)    : rms=${qB.axis_error_rms.toFixed(4)}  axis_quality=${qB.axis_quality.toFixed(4)}`);
  console.log(`    C) engine@endFrame  (gap window, TRUE)     : rms=${qC.axis_error_rms.toFixed(4)}  axis_quality=${qC.axis_quality.toFixed(4)}`);
  console.log(`    D) fit.achievedAtEnd(what the leaf reads NOW): rms=${qD.axis_error_rms.toFixed(4)}  axis_quality=${qD.axis_quality.toFixed(4)}`);
  console.log(`  D vs C (leaf-vs-scorer residual) Δquality = ${(qD.axis_quality - qC.axis_quality).toFixed(4)}  (≈0 ⇒ leaf now faithful)`);
  console.log("");
  console.log(`  A vs C (window+ballistic) Δquality = ${(qA.axis_quality - qC.axis_quality).toFixed(4)}`);
  console.log(`  B vs C (WINDOW only)      Δquality = ${(qB.axis_quality - qC.axis_quality).toFixed(4)}`);
  console.log(`  A vs B (BALLISTIC only)   Δquality = ${(qA.axis_quality - qB.axis_quality).toFixed(4)}`);
  console.log("  => If A≈B and both diverge from C, the leaf is scoring the WRONG WINDOW (lookahead, not gap).");
  console.log("============================================================");
}
main().catch((e) => { console.error(e); process.exit(1); });
