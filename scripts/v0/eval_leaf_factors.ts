/**
 * eval_leaf_factors.ts — can the SHORT leaf reconstruct the true scorer's
 * drift / off_beat / missing / survival factors as well as the FULL leaf?
 *
 * THE QUESTION (Jérémie): in greedy:2 both gaps are engine-simulated identically up
 * to the arc exit; we proved no clean-airborne-past-exit deaths and that the ballistic
 * reconstructs the AXES faithfully. So the short leaf should be able to predict
 * drift/off_beat/missing/survival "just as well" too — the only thing that could break
 * that is genuine COMPOSED-context divergence (a later arc clipping an earlier flight,
 * a catch failing only in the composed world, a ride-out that stalls). How often does
 * that actually happen?
 *
 * THE TEST: compile big_air, capture every OFFERED partial/complete node (real tracks
 * the compiler committed to). For each, compute BOTH leaves' factors on the IDENTICAL node:
 *   FULL  = scoreDriftReport over the composed re-detection (what forwardNodeScore scores):
 *           axis_q, drift_q, off_beat_q, missing_q, survival_q.
 *   SHORT = objectiveLeafValue's reconstruction, reproduced exactly:
 *           axis_q (combined RMS over committed prefix), survival = committed-depth/total,
 *           missing = exp(-futureMissing/TOL); drift and off_beat ASSUMED 1.
 * Report, per factor, |FULL − SHORT| (the reconstruction error). drift_q≈1 / off_beat_q≈1
 * ⇒ the assumption holds. survival_q≈short survival ⇒ the proxy holds. Divergence on a
 * factor ⇒ THAT is what the short leaf cannot reconstruct per-gap.
 *
 * Run: LR_ENGINE=wasm npx tsx scripts/v0/eval_leaf_factors.ts --spec=big_air_ramp --seed=0 --budget=200000
 */
import { resolve } from "node:path";
import { makeRng } from "../lib/rng.ts";
import {
  buildDriftReport,
  effectiveAxes,
  impactFeasibilityBound,
  sampleGapTargets,
  sliceTimeline,
  validateSpec,
} from "./core/substrate.ts";
import { detectWindow } from "./core/candidate.ts";
import {
  axisErrorsForTargets,
  axisQualityFromErrors,
  MISSING_CONTACT_TOLERANCE,
  scoreDriftReport,
} from "./score.ts";
import {
  CALIB,
  FPS,
  secToFrame,
  type AxisValues,
  type Gap,
  type Spec,
} from "./types.ts";
import { K_BOUNCE_LANDING } from "../lib/detector.ts";
import { compileHandoff, setForwardEvalContext, type HandoffNode } from "./optimizer/handoff.ts";
import type { SearchNode } from "./optimizer/node.ts";
import { setImpactTemplateSpecMeanImpact } from "./arc_placement.ts";
import type { DriftReport } from "./optimizer/types.ts";

function argVal(name: string, fallback: string): string {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}
const SPEC_NAME = argVal("spec", "big_air_ramp");
const SEED = parseInt(argVal("seed", "0"), 10);
const BUDGET = parseInt(argVal("budget", "200000"), 10);
const PARTIAL_FUTURE_CONTACT_WINDOW = 20;

async function loadSpec(name: string): Promise<Spec> {
  return (await import(resolve("specs/golden", `${name}.ts`))).default as Spec;
}
function meanAuthoredImpact(contacts: Spec["contacts"]): number {
  const xs = contacts.slice(1).map((c) => c.impact).filter((i): i is number => i !== undefined);
  return xs.length === 0 ? 0 : xs.reduce((s, i) => s + i, 0) / xs.length;
}
function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

// ── compiler gap/target/impact reconstruction (verbatim from eval_arc_apples.ts) ──
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
  setImpactTemplateSpecMeanImpact(meanAuthoredImpact(spec.contacts));
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

// ── forwardNodeScore report reproduction (verbatim from eval_arc_apples.ts) ──
function nextContactGapIndex(gaps: Gap[], from: number): number {
  for (let i = Math.max(0, from); i < gaps.length; i++) if (gaps[i].endsWithContact) return i;
  return -1;
}
function isTerminalNode(node: SearchNode, gaps: Gap[]): boolean {
  return node.gapIndex >= gaps.length || nextContactGapIndex(gaps, node.gapIndex) < 0;
}
function processedHorizonFrame(node: SearchNode, gaps: Gap[]): number {
  for (let i = Math.min(node.gapIndex, gaps.length) - 1; i >= 0; i--) {
    if (gaps[i].endsWithContact) return gaps[i].endFrame;
  }
  return 0;
}
function remainingContactGaps(gaps: Gap[], from: number): number {
  let n = 0;
  for (let i = Math.max(0, from); i < gaps.length; i++) if (gaps[i].endsWithContact) n++;
  return n;
}
function partialOutputDurationFrames(h: number, dur: number): number {
  return Math.max(1, Math.min(dur, h + 20));
}
function asPartialReport(report: DriftReport, horizonFrame: number): DriftReport {
  const reached = report.contacts.filter((c) => secToFrame(c.t_target) <= horizonFrame);
  const future = report.contacts
    .filter((c) => secToFrame(c.t_target) > horizonFrame)
    .slice(0, PARTIAL_FUTURE_CONTACT_WINDOW)
    .map((c) => ({ t_target: c.t_target, t_actual: null, frame_error: null, status: "missing" as const }));
  return {
    ...report,
    contacts: [...reached, ...future],
    gaps: report.gaps.filter((g) => secToFrame(g.t_end) <= horizonFrame),
    off_beat_landings: report.off_beat_landings.filter((l) => l.frame <= horizonFrame),
    terminus: {
      frame: Math.min(report.terminus.frame, horizonFrame),
      reason: report.terminus.reason === "endOfSpec" ? "rideStalled" : report.terminus.reason,
    },
  };
}

type Setup = ReturnType<typeof buildSearchSetup>;
type Factors = { axis: number; drift: number; off_beat: number; missing: number; survival: number };

function fullFactors(node: SearchNode, s: Setup): Factors {
  const { searchSpec, gaps, gapAxisTargets, allContactFrames, durationFrames } = s;
  const fullDuration = isTerminalNode(node, gaps);
  const horizonFrame = fullDuration ? durationFrames : processedHorizonFrame(node, gaps);
  const outDur = fullDuration ? durationFrames + 20 : partialOutputDurationFrames(horizonFrame, durationFrames);
  const det = detectWindow(node.prefixEngine, 0, outDur);
  const fits = node.prefixFits.slice();
  while (fits.length < gaps.length) fits.push(null);
  const raw = buildDriftReport(det, searchSpec, gaps, allContactFrames, durationFrames, [], fits, gapAxisTargets);
  const report = fullDuration ? raw : asPartialReport(raw, horizonFrame);
  const sc = scoreDriftReport(report, { totalFrames: durationFrames });
  return {
    axis: sc.axis_quality,
    drift: sc.drift_quality,
    off_beat: sc.off_beat_quality,
    missing: sc.missing_quality,
    survival: sc.survival_quality,
  };
}

function shortFactors(leaf: SearchNode, s: Setup): Factors {
  const { gaps, gapAxisTargets, durationFrames } = s;
  const errors: number[] = [];
  for (let i = 0; i < leaf.gapIndex; i++) {
    if (!gaps[i]?.endsWithContact) continue;
    const fit = leaf.prefixFits[i] ?? null;
    if (fit === null) continue;
    for (const e of axisErrorsForTargets(gapAxisTargets[i], fit.achieved)) errors.push(e);
  }
  const horizonFrame = processedHorizonFrame(leaf, gaps);
  const futureMissing = Math.min(PARTIAL_FUTURE_CONTACT_WINDOW, remainingContactGaps(gaps, leaf.gapIndex));
  return {
    axis: axisQualityFromErrors(errors).axis_quality,
    drift: 1, // ASSUMED (gate-enforced ±1 per gap)
    off_beat: 1, // ASSUMED (gate-rejected per gap)
    missing: Math.exp(-futureMissing / MISSING_CONTACT_TOLERANCE),
    survival: durationFrames > 0 ? clamp01(horizonFrame / durationFrames) : 0,
  };
}

async function main(): Promise<void> {
  const userSpec = await loadSpec(SPEC_NAME);
  const setup = buildSearchSetup(userSpec, SEED);
  setForwardEvalContext(setup.searchSpec, setup.gapAxisTargets);

  const nodes: Array<{ node: SearchNode; partial: boolean }> = [];
  compileHandoff(userSpec, SEED, {
    budget: BUDGET,
    onNode: (n: HandoffNode, _k, event) => {
      if (nodes.length < 8000) nodes.push({ node: n.search, partial: !event.fullDuration });
    },
  });
  if (nodes.length === 0) throw new Error("no offered nodes captured");

  const AXES_F = ["axis", "drift", "off_beat", "missing", "survival"] as const;
  type Bucket = { n: number; sumAbs: Record<string, number>; maxAbs: Record<string, number>; sumFull: Record<string, number>; sumShort: Record<string, number> };
  const mk = (): Bucket => ({ n: 0, sumAbs: {}, maxAbs: {}, sumFull: {}, sumShort: {} });
  const all = mk(), partial = mk(), complete = mk();
  for (const { node, partial: isP } of nodes) {
    const f = fullFactors(node, setup);
    const sh = shortFactors(node, setup);
    for (const b of [all, isP ? partial : complete]) {
      b.n++;
      for (const k of AXES_F) {
        const d = Math.abs(f[k] - sh[k]);
        b.sumAbs[k] = (b.sumAbs[k] ?? 0) + d;
        b.maxAbs[k] = Math.max(b.maxAbs[k] ?? 0, d);
        b.sumFull[k] = (b.sumFull[k] ?? 0) + f[k];
        b.sumShort[k] = (b.sumShort[k] ?? 0) + sh[k];
      }
    }
  }

  const fmt = (b: Bucket, label: string) => {
    console.log(`\n  ${label}  (n=${b.n})`);
    console.log(`    ${"factor".padEnd(10)} ${"mean|F−S|".padStart(10)} ${"max|F−S|".padStart(9)} ${"mean Full".padStart(10)} ${"mean Short".padStart(11)}`);
    for (const k of AXES_F) {
      console.log(
        `    ${k.padEnd(10)} ${((b.sumAbs[k] ?? 0) / Math.max(1, b.n)).toFixed(4).padStart(10)} ` +
        `${(b.maxAbs[k] ?? 0).toFixed(4).padStart(9)} ${((b.sumFull[k] ?? 0) / Math.max(1, b.n)).toFixed(4).padStart(10)} ` +
        `${((b.sumShort[k] ?? 0) / Math.max(1, b.n)).toFixed(4).padStart(11)}`,
      );
    }
  };

  console.log("============================================================");
  console.log("  eval_leaf_factors — SHORT reconstruction vs FULL measurement, per factor");
  console.log("============================================================");
  console.log(`  spec=${SPEC_NAME} seed=${SEED} budget=${BUDGET}   offered nodes=${nodes.length}`);
  fmt(all, "ALL offered nodes");
  fmt(partial, "PARTIAL nodes (mid-track — where the rollout actually ranks)");
  fmt(complete, "COMPLETE nodes (full tracks)");
  console.log("\n  READ: drift/off_beat mean|F−S| ≈ 0 ⇒ the 'assume 1' holds. survival mean|F−S| large");
  console.log("        ⇒ the committed-depth proxy is NOT the composed terminus — the reconstructible gap.");
  console.log("============================================================");
}

main().catch((e) => { console.error(e); process.exit(1); });
