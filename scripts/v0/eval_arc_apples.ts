/**
 * eval_arc_apples.ts — a TRUE apples-to-apples comparison of the SHORT (objective)
 * leaf vs the FULL leaf on the SAME arcs from the SAME rider state.
 *
 * WHY THIS EXISTS
 * ---------------
 * The forward-eval rollout has two leaf scorers:
 *   - SHORT (objective): reads each candidate's `fit.achieved`, measured exactly
 *     on the current scorer interval by the truncated candidate evaluation.
 *   - FULL: re-detects the whole composed prefix with the engine and the true
 *     scorer measures the achieved axes from THAT (core/measure.ts measureGapAxes,
 *     via buildDriftReport).
 *
 * On the golden suite the short leaf trails the full leaf only on air specs
 * (big_air_ramp), in `speed`/`impact`. But that golden comparison is NOT
 * apples-to-apples: short and full run DIFFERENT searches → different committed
 * arcs → different tracks, so the per-axis gap conflates MEASUREMENT error with
 * SEARCH divergence.
 *
 * This script isolates the measurement/scorer difference by feeding BOTH paths the
 * IDENTICAL arc from the IDENTICAL rider state:
 *   1. Compile big_air_ramp normally; capture a committed mid-track SearchNode at a
 *      gap G with real speed/air/impact. node.prefixEngine + entry state IS the
 *      fixed initial condition.
 *   2. From that SAME state, sample ~1000 candidate arcs at gap G via the normal
 *      sampler (getCandidatesSorted). Each viable arc carries a GapFit with
 *      `achieved` (the SHORT exact-window measurement) and `lines`.
 *   3. For each arc, compute the FULL achieved: re-detect the SAME arc on the SAME
 *      entry engine to the full horizon, then measureGapAxes over the SAME window.
 *   4. Compare per-axis (smoking gun = impact, which is engine-simulated in BOTH
 *      paths and must agree per-arc) and per-leaf ranking (short argmax vs full
 *      argmax, misranking cost, rank correlation).
 *
 * Run:
 *   LR_ENGINE=wasm npx tsx scripts/v0/eval_arc_apples.ts
 *   LR_ENGINE=wasm npx tsx scripts/v0/eval_arc_apples.ts --spec=big_air_ramp --gap=5 --arcs=1000 --seed=0 --budget=200000
 *
 * Diagnostic only. Does NOT modify production code. Reuses the exported production
 * functions (compileHandoff, getCandidatesSorted, extendNodeCached, detectWindow,
 * measureGapAxes, objectiveLeafValue, buildDriftReport, leafKeyForReport, ...) so
 * it measures EXACTLY the way production does.
 */

import { resolve } from "node:path";
import { makeRng } from "../lib/rng.ts";
import {
  buildDriftReport,
  effectiveAxes,
  engineLineFromTrackLine,
  impactFeasibilityBound,
  makeBaseEngine,
  sampleGapTargets,
  sliceTimeline,
  validateSpec,
} from "./core/substrate.ts";
import { measureGapAxes } from "./core/measure.ts";
import { axisLookaheadEndFrame, detectWindow } from "./core/candidate.ts";
import { axisQualityForTargets } from "./score.ts";
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
import {
  compileHandoff,
  objectiveLeafValue,
  setForwardEvalContext,
  type HandoffNode,
} from "./optimizer/handoff.ts";
import {
  extendNodeCached,
  getCandidatesSorted,
  makeRootNode,
  type SearchNode,
} from "./optimizer/node.ts";
import type { Candidate, SpecContext } from "./optimizer/sample.ts";
import { leafKeyForReport, isStrictlyBetter, type LeafKey } from "./optimizer/register.ts";
import { setImpactTemplateSpecMeanImpact } from "./arc_placement.ts";
import { resetSimFrames } from "./optimizer/sim_frames.ts";
import type { DriftReport } from "./optimizer/types.ts";

// ── arg parsing ────────────────────────────────────────────────────────────
function argVal(name: string, fallback: string): string {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

const SPEC_NAME = argVal("spec", "big_air_ramp");
const SEED = parseInt(argVal("seed", "0"), 10);
const BUDGET = parseInt(argVal("budget", "200000"), 10);
const N_ARCS = parseInt(argVal("arcs", "1000"), 10);
// The gap we capture & sample at. The captured node is advanced to the next
// CONTACT gap at or after this index, so the rider has real speed/air/impact.
const TARGET_GAP = parseInt(argVal("gap", "5"), 10);

async function loadSpec(name: string): Promise<Spec> {
  const mod = await import(resolve("specs/golden", `${name}.ts`));
  return mod.default as Spec;
}

// ── reproduce the compiler's gap + target + impact resolution ────────────────
// VERBATIM from optimizer/handoff.ts compileHandoffInternal (the block that builds
// `gaps` / `gapAxisTargets` and resolves per-beat impact). We rebuild it here so
// the gaps/targets we sample & score with are bit-identical to the ones that built
// the captured node's prefixEngine (jitter=0 on big_air_ramp ⇒ deterministic). The
// impact GUARDRAIL below (impact must agree per-arc) is the live consistency check.
function meanAuthoredImpactAfterFirstFeasibleContact(contacts: Spec["contacts"]): number {
  const impacts = contacts
    .slice(1)
    .map((c) => c.impact)
    .filter((i): i is number => i !== undefined);
  if (impacts.length === 0) return 0;
  return impacts.reduce((s, i) => s + i, 0) / impacts.length;
}

type SearchSetup = {
  searchSpec: Spec;
  gaps: Gap[];
  gapAxisTargets: AxisValues[];
  allContactFrames: number[];
  durationFrames: number;
  ctx: SpecContext;
};

function buildSearchSetup(userSpec: Spec, seed: number): SearchSetup {
  validateSpec(userSpec);
  const feasibleContacts = userSpec.contacts.filter((c) => secToFrame(c.t) >= K_BOUNCE_LANDING);
  const spec: Spec = { ...userSpec, preroll: undefined, contacts: feasibleContacts };
  const durationFrames = secToFrame(spec.duration);
  const allContactFrames = [...spec.contacts]
    .map((c) => secToFrame(c.t))
    .sort((a, b) => a - b);

  const gaps = sliceTimeline(allContactFrames, durationFrames);
  const masterRng = makeRng(seed);
  const gapAxisTargets = gaps.map((gap) => effectiveAxes(gap, spec));
  for (const gap of gaps) {
    gap.targets = sampleGapTargets(gapAxisTargets[gap.index], spec.jitter ?? CALIB.SIGMA, masterRng);
  }
  const impactOff = process.env.LR_IMPACT_OFF === "1";
  setImpactTemplateSpecMeanImpact(
    impactOff ? 0 : meanAuthoredImpactAfterFirstFeasibleContact(spec.contacts),
  );
  const impactByFrame = new Map<number, number>();
  if (!impactOff) {
    for (const c of spec.contacts) {
      if (c.impact !== undefined) impactByFrame.set(secToFrame(c.t), c.impact);
    }
  }
  if (impactByFrame.size > 0) {
    for (const gap of gaps) {
      if (!gap.endsWithContact) continue;
      const impact = impactByFrame.get(gap.endFrame);
      if (impact === undefined) continue;
      const nextContact = allContactFrames.find((f) => f > gap.endFrame);
      const nextGapSeconds = nextContact === undefined ? 1.5 : (nextContact - gap.endFrame) / FPS;
      const prevGapSeconds = (gap.endFrame - gap.startFrame) / FPS;
      const t = gapAxisTargets[gap.index];
      const bounded = Math.min(
        impact,
        impactFeasibilityBound(t.speed, prevGapSeconds, nextGapSeconds),
      );
      gap.targets.impact = bounded;
      gapAxisTargets[gap.index].impact = bounded;
    }
    for (let i = 0; i + 1 < gaps.length; i++) {
      if (!gaps[i].endsWithContact) continue;
      const next = gaps[i + 1];
      if (next.endsWithContact && next.targets.impact !== undefined) {
        gaps[i].nextImpact = next.targets.impact;
      }
    }
  }
  const ctx: SpecContext = { allContactFrames, durationFrames };
  return { searchSpec: spec, gaps, gapAxisTargets, allContactFrames, durationFrames, ctx };
}

// ── full-leaf scorer (faithful reproduction of handoff.ts forwardNodeScore) ──
// forwardNodeScore is module-private, but every primitive it calls IS exported
// (detectWindow, buildDriftReport, leafKeyForReport). We reproduce its body
// verbatim, including the partial-horizon helpers, so the FULL leaf value here is
// the same number the real full leaf would produce for this committed prefix.
function nextContactGapIndex(gaps: Gap[], from: number): number {
  for (let i = Math.max(0, from); i < gaps.length; i++) if (gaps[i].endsWithContact) return i;
  return -1;
}
function isTerminalNode(node: SearchNode, gaps: Gap[]): boolean {
  if (node.gapIndex >= gaps.length) return true;
  return nextContactGapIndex(gaps, node.gapIndex) < 0;
}
function processedHorizonFrame(node: SearchNode, gaps: Gap[]): number {
  for (let i = Math.min(node.gapIndex, gaps.length) - 1; i >= 0; i--) {
    if (gaps[i].endsWithContact) return gaps[i].endFrame;
  }
  return 0;
}
function partialOutputDurationFrames(horizonFrame: number, durationFrames: number): number {
  return Math.max(1, Math.min(durationFrames, horizonFrame + 20));
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
const PARTIAL_FUTURE_CONTACT_WINDOW = 20; // mirrors handoff.ts

function fullLeafScore(node: SearchNode, setup: SearchSetup): number {
  const { searchSpec, gaps, gapAxisTargets, allContactFrames, durationFrames } = setup;
  const fullDuration = isTerminalNode(node, gaps);
  const horizonFrame = fullDuration ? durationFrames : processedHorizonFrame(node, gaps);
  const outputDurationFrames = fullDuration
    ? durationFrames + 20
    : partialOutputDurationFrames(horizonFrame, durationFrames);
  const det = detectWindow(node.prefixEngine, 0, outputDurationFrames);
  const fits = node.prefixFits.slice();
  while (fits.length < gaps.length) fits.push(null);
  const rawReport = buildDriftReport(
    det, searchSpec, gaps, allContactFrames, durationFrames, [], fits, gapAxisTargets,
  );
  const report = fullDuration ? rawReport : asPartialReport(rawReport, horizonFrame);
  return leafKeyForReport(report, durationFrames).full_score;
}

// ── per-arc FULL achieved on the SAME arc / SAME entry engine ────────────────
// The full-horizon branch of evaluateGapFit (core/candidate.ts), byte-identical:
// extend the SAME entry engine with the candidate's lines, detect to the full
// horizon, and measureGapAxes over the SAME axisMeasureEnd the short path used.
// This is exactly the per-arc analog of forwardNodeScore's re-detection — the
// engine simulates the WHOLE composed track, whereas the short path stops once
// the current exact scorer interval and causal launch packet are available.
function fullAchievedForArc(
  entry: SearchNode,
  candidate: Candidate,
  gap: Gap,
  axisMeasureEnd: number,
): AxisValues {
  const child = extendNodeCached(entry, candidate);
  const fullHorizon = Math.max(gap.endFrame + 20, axisMeasureEnd + 20);
  const det = detectWindow(child.prefixEngine, gap.startFrame, fullHorizon);
  return measureGapAxes(det, gap, candidate.lines, axisMeasureEnd);
}

// ── stats helpers ────────────────────────────────────────────────────────────
function pearson(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 2) return NaN;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx, dy = ys[i] - my;
    sxy += dx * dy; sxx += dx * dx; syy += dy * dy;
  }
  return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : NaN;
}

/** Spearman rank correlation (rank-then-Pearson; ties broken by index order). */
function spearman(xs: number[], ys: number[]): number {
  const rank = (vs: number[]): number[] => {
    const idx = vs.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
    const r = new Array<number>(vs.length);
    idx.forEach((e, k) => { r[e.i] = k; });
    return r;
  };
  return pearson(rank(xs), rank(ys));
}

function mean(a: number[]): number {
  return a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;
}

// ── main ─────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  const userSpec = await loadSpec(SPEC_NAME);

  // ---- rebuild the gaps/targets/ctx the compiler uses (bit-identical, jitter=0) ----
  // Built BEFORE the compile so the onNode callback can pick a node sitting exactly
  // at the contact gap G we want to sample. compileHandoff resets & re-sets these
  // globals itself, so building them first does not perturb the compile.
  const setup = buildSearchSetup(userSpec, SEED);
  const { gaps, gapAxisTargets, allContactFrames, durationFrames, ctx } = setup;

  // The sampling gap G: the first CONTACT gap at or after TARGET_GAP that is NOT the
  // last contact (we need a real continuation for the leaf-ranking comparison, and
  // a non-empty airborne lookahead).
  let gapGIndex = -1;
  for (let i = TARGET_GAP; i < gaps.length; i++) {
    if (!gaps[i].endsWithContact) continue;
    if (nextContactGapIndex(gaps, i + 1) < 0) break; // last contact — stop, no continuation
    gapGIndex = i;
    break;
  }
  if (gapGIndex < 0) {
    throw new Error(
      `eval_arc_apples: no contact gap with a continuation at/after gap ${TARGET_GAP} ` +
      `(spec=${SPEC_NAME}, ${gaps.length} gaps).`,
    );
  }
  const gapG = gaps[gapGIndex];
  const axisMeasureEnd = axisLookaheadEndFrame(gapG, allContactFrames);

  // ---- 1) compile normally; capture the BEST complete (winning) track ----
  // onNode only fires for nodes OFFERED to the register (partial outputs + complete
  // leaves), not at every intermediate gap. So we capture the best-keyed COMPLETE
  // track (it carries the full committed-fit chain) and reconstruct the entry node
  // at gap G from it below. This is the realistic mid-track rider the compiler
  // actually committed.
  const seenGapIndices = new Set<number>();
  let captured: HandoffNode | null = null;
  let capturedKey: LeafKey | null = null;
  compileHandoff(userSpec, SEED, {
    budget: BUDGET,
    onNode: (node, key, event) => {
      seenGapIndices.add(node.search.gapIndex);
      if (!event.fullDuration) return; // complete tracks only
      // require a committed catch through gap G (so we can rebuild the entry)
      if (node.search.prefixFits.slice(0, gapGIndex).every((f) => f === null)) return;
      if (capturedKey === null || isStrictlyBetter(key, capturedKey)) {
        captured = node;
        capturedKey = key;
      }
    },
  });

  if (captured === null) {
    throw new Error(
      `eval_arc_apples: no complete track committed a catch through gap ${gapGIndex} ` +
      `(spec=${SPEC_NAME}, seed=${SEED}, budget=${BUDGET}). ` +
      `gapIndices seen: ${[...seenGapIndices].sort((a, b) => a - b).join(",")}. ` +
      `Try a different --gap or raise --budget.`,
    );
  }
  const winningNode: HandoffNode = captured;

  // Forward-eval context so objectiveLeafValue / the full scorer read the TRUE
  // (un-jittered) targets, exactly as production sets it (handoff.ts). Re-set AFTER
  // the compile because compileHandoff overwrote the globals during its own run.
  setForwardEvalContext(setup.searchSpec, gapAxisTargets);

  // ---- reconstruct the ENTRY node at gap G from the winning track's committed fits ----
  // Replay the SAME start + SAME committed fits [0, gapGIndex) through production
  // node-extension (makeBaseEngine + addLine via extendNodeCached) — the verbatim
  // recipe the compiler uses to rebuild a prefix (handoff.ts cloneHandoffNodeForBranch).
  // The result's prefixEngine is the rider state at the START of gap G: the fixed
  // initial condition both leaf paths will see, identical to the winning track's
  // own engine at that boundary.
  let rootEngine = makeBaseEngine(winningNode.startState);
  if (winningNode.startLines.length > 0) {
    rootEngine = rootEngine.addLine(
      winningNode.startLines.map((line) => engineLineFromTrackLine(line)),
    );
  }
  let entry: SearchNode = makeRootNode(rootEngine, gaps.length);
  // makeRootNode starts prefixNextLineId at 1; match the winning prefix's line ids by
  // setting it to the start-lines count so committed fits keep their original ids.
  entry = { ...entry, prefixNextLineId: 1 + winningNode.startLines.length };
  for (let i = 0; i < gapGIndex; i++) {
    const fit = winningNode.search.prefixFits[i] ?? null;
    entry = extendNodeCached(entry, fit as Candidate | null);
  }
  if (entry.gapIndex !== gapGIndex) {
    throw new Error(
      `eval_arc_apples: reconstructed entry at gapIndex ${entry.gapIndex}, expected ${gapGIndex}`,
    );
  }

  // ---- 2) sample ~N_ARCS candidate arcs at gap G from the SAME entry state ----
  // getCandidatesSorted is the exact sampler the compiler/rollout use; each viable
  // Candidate is a GapFit whose `achieved` is the SHORT/ballistic measurement and
  // whose `lines` are the placed catch geometry.
  resetSimFrames();
  const candidates = getCandidatesSorted(entry, gaps, ctx, SEED, N_ARCS);

  // ---- 3) per arc: SHORT achieved (candidate.achieved) vs FULL achieved ----
  // Plus two leaf scorings of the SAME committed prefix (arc-extended child):
  //   shortLeaf = objectiveLeafValue (the production short/objective leaf, ZERO frames)
  //   fullLeaf  = the true scorer on the FULL re-detection (forwardNodeScore, reproduced)
  // and the per-arc axis_quality each path's achieved implies against the TRUE targets
  // (gapAxisTargets[gapGIndex], the quantity that actually drives the ranking, with the
  // constant survival/missing factors that are identical across arcs at this gap removed).
  const trueTargets = gapAxisTargets[gapGIndex];
  type ArcRow = {
    cand: Candidate;
    short: AxisValues;
    full: AxisValues;
    shortLeaf: number;
    fullLeaf: number;
    shortAxisQ: number;
    fullAxisQ: number;
  };
  const rows: ArcRow[] = [];
  for (const c of candidates) {
    const full = fullAchievedForArc(entry, c, gapG, axisMeasureEnd);
    const child = extendNodeCached(entry, c);
    const shortLeaf = objectiveLeafValue(child, gaps, durationFrames);
    const fullLeaf = fullLeafScore(child, setup);
    const shortAxisQ = axisQualityForTargets(trueTargets, c.achieved).axis_quality;
    const fullAxisQ = axisQualityForTargets(trueTargets, full).axis_quality;
    rows.push({ cand: c, short: c.achieved, full, shortLeaf, fullLeaf, shortAxisQ, fullAxisQ });
  }

  // ---- 4a) per-axis ballistic - full divergence table ----
  type AxisStat = {
    n: number; meanSigned: number; meanAbs: number; maxAbs: number; over01: number;
  };
  const axisStat = (axis: AxisName): AxisStat | null => {
    const diffs: number[] = [];
    for (const r of rows) {
      const s = r.short[axis];
      const f = r.full[axis];
      if (s === undefined || f === undefined) continue;
      diffs.push(s - f);
    }
    if (diffs.length === 0) return null;
    const abs = diffs.map((d) => Math.abs(d));
    return {
      n: diffs.length,
      meanSigned: mean(diffs),
      meanAbs: mean(abs),
      maxAbs: Math.max(...abs),
      over01: abs.filter((d) => d > 0.01).length,
    };
  };

  // ---- 4b) ranking agreement ----
  // Two views, both over the SAME committed prefix (the candidate-extended child):
  //  (i) production LEAF VALUE: short objectiveLeafValue vs full true score. NOTE the
  //      absolute values are tiny and nearly equal across arcs because at this gap a
  //      depth-0 child shares the SAME survival × exp(−futureMissing) factor for every
  //      arc — a constant that scales the whole pool, so it cancels in the ARGMAX but
  //      makes the absolute misranking cost optically small. Reported for completeness.
  //  (ii) per-arc AXIS_QUALITY against the TRUE targets: the quantity that actually
  //       DRIVES the ranking with the constant factors removed — this is the clean
  //       "would short and full prefer the same arc?" signal.
  const argmaxBy = (key: (r: ArcRow) => number): number => {
    let best = 0;
    for (let i = 1; i < rows.length; i++) if (key(rows[i]) > key(rows[best])) best = i;
    return best;
  };
  const shortArgmax = argmaxBy((r) => r.shortLeaf);
  const fullArgmax = argmaxBy((r) => r.fullLeaf);
  const rankPearson = pearson(rows.map((r) => r.shortLeaf), rows.map((r) => r.fullLeaf));
  const rankSpearman = spearman(rows.map((r) => r.shortLeaf), rows.map((r) => r.fullLeaf));
  const misrankCost = rows.length > 0 ? rows[fullArgmax].fullLeaf - rows[shortArgmax].fullLeaf : NaN;

  const shortAxisArgmax = argmaxBy((r) => r.shortAxisQ);
  const fullAxisArgmax = argmaxBy((r) => r.fullAxisQ);
  const axisQPearson = pearson(rows.map((r) => r.shortAxisQ), rows.map((r) => r.fullAxisQ));
  const axisQSpearman = spearman(rows.map((r) => r.shortAxisQ), rows.map((r) => r.fullAxisQ));
  // Misranking cost on the TRUE-quality scale: how much true axis_quality the short
  // pick gives up vs the full pick (both read on the FULL/engine achieved = ground truth).
  const axisMisrankCost = rows.length > 0
    ? rows[fullAxisArgmax].fullAxisQ - rows[shortAxisArgmax].fullAxisQ
    : NaN;

  // ──────────────────────────── REPORT ────────────────────────────
  const px = (n: number, w = 8, d = 4) => n.toFixed(d).padStart(w);
  console.log("============================================================");
  console.log("  eval_arc_apples — SHORT (ballistic) vs FULL (engine) leaf");
  console.log("  on the SAME arcs from the SAME rider state");
  console.log("============================================================");
  console.log(`  spec=${SPEC_NAME}  seed=${SEED}  budget=${BUDGET}`);
  console.log(
    `  source track: winning complete track (gapIndex=${winningNode.search.gapIndex}, ` +
    `full_score=${capturedKey?.full_score.toFixed(2)})`,
  );
  console.log(
    `  reconstructed entry node: gapIndex=${entry.gapIndex} ` +
    `committedFits=${entry.prefixFits.filter((f) => f !== null).length}`,
  );
  console.log(
    `  sampling gap G: index=${gapG.index}  ` +
    `frames=[${gapG.startFrame}..${gapG.endFrame}]  ` +
    `axisMeasureEnd=${axisMeasureEnd}  (lookahead=${axisMeasureEnd > gapG.endFrame ? "yes" : "no"})`,
  );
  const tgt = gapAxisTargets[gapG.index];
  console.log(
    `  gap G targets: ` +
    AXES.filter((a) => tgt[a] !== undefined).map((a) => `${a}=${tgt[a]!.toFixed(3)}`).join("  "),
  );
  console.log(`  candidate arcs sampled (viable): ${rows.length}  (requested K=${N_ARCS})`);
  console.log("");

  // setup consistency proof
  console.log("  -- setup consistency proof (same arc, same entry state) --");
  console.log(
    `  entry engine is the captured node's prefixEngine, advanced over non-contact`,
  );
  console.log(
    `  gaps by null-extension only (no physics change). Each arc's SHORT achieved`,
  );
  console.log(
    `  is candidate.achieved (placed on entry.prefixEngine by the sampler); the FULL`,
  );
  console.log(
    `  achieved re-detects extendNodeCached(entry,cand).prefixEngine = the SAME entry`,
  );
  console.log(
    `  engine + the SAME candidate.lines, measured over the SAME axisMeasureEnd.`,
  );
  console.log("");

  console.log("  -- per-axis (SHORT ballistic − FULL engine) --");
  console.log(
    `  ${"axis".padEnd(10)} ${"n".padStart(5)} ${"mean(s−f)".padStart(10)} ` +
    `${"mean|s−f|".padStart(10)} ${"max|s−f|".padStart(10)} ${">0.01".padStart(7)}`,
  );
  for (const axis of AXES) {
    const st = axisStat(axis);
    if (st === null) {
      console.log(`  ${axis.padEnd(10)} ${"  -  ".padStart(5)}   (not measured on these arcs)`);
      continue;
    }
    console.log(
      `  ${axis.padEnd(10)} ${String(st.n).padStart(5)} ${px(st.meanSigned, 10)} ` +
      `${px(st.meanAbs, 10)} ${px(st.maxAbs, 10)} ${String(st.over01).padStart(7)}`,
    );
  }
  console.log("");

  // IMPACT verdict
  const impactSt = axisStat("impact");
  console.log("  -- IMPACT VERDICT (the smoking gun) --");
  if (impactSt === null) {
    console.log("  impact was not measured on any sampled arc (no impact target on gap G?).");
  } else {
    const ok = impactSt.maxAbs <= 0.01;
    console.log(
      `  impact is engine-simulated AT THE CATCH in BOTH paths (inside the arc,`,
    );
    console.log(
      `  before the predicted next-gap suffix). Per-arc it should be ~0.`,
    );
    console.log(
      `  -> max|s−f| = ${impactSt.maxAbs.toFixed(6)}  over ${impactSt.n} arcs  ` +
      `(${impactSt.over01} arcs differ by >0.01)`,
    );
    if (ok) {
      console.log(`  -> VERDICT: AGREES per-arc (smell resolved). The golden impact gap`);
      console.log(`     is SEARCH DIVERGENCE, not measurement error.`);
    } else {
      console.log(`  -> VERDICT: DIVERGES per-arc — this is a BUG, not a ballistic limit.`);
      console.log(`     Investigate: wrong entry state / wrong lines / different window.`);
    }
  }
  console.log("");

  // ranking — (i) production leaf value
  console.log("  -- leaf-score ranking agreement (short objective vs full true score) --");
  console.log("  (both score the SAME committed prefix = entry + this arc)");
  console.log(`  arcs ranked: ${rows.length}`);
  console.log(`  short-leaf argmax index = ${shortArgmax}   full-leaf argmax index = ${fullArgmax}   match: ${shortArgmax === fullArgmax ? "YES" : "NO"}`);
  console.log(`  full_score(full pick) = ${rows[fullArgmax].fullLeaf.toFixed(6)}   full_score(short pick) = ${rows[shortArgmax].fullLeaf.toFixed(6)}`);
  console.log(`  misranking cost (full_score) = ${misrankCost.toFixed(6)}`);
  console.log(`  rank correlation: pearson=${rankPearson.toFixed(4)}  spearman=${rankSpearman.toFixed(4)}`);
  console.log("  NOTE: absolute values are scaled tiny by the shared survival×exp(−futureMissing)");
  console.log("        factor (same for every arc at this gap); the argmax/correlation is the signal.");
  console.log("");

  // ranking — (ii) per-arc axis_quality (constant factors removed — the clean signal)
  console.log("  -- per-arc axis_quality ranking (TRUE targets; the clean misrank signal) --");
  console.log("  shortAxisQ = quality of the BALLISTIC achieved;  fullAxisQ = quality of the ENGINE achieved (ground truth)");
  console.log(`  short-axisQ argmax = ${shortAxisArgmax}   full-axisQ argmax = ${fullAxisArgmax}   match: ${shortAxisArgmax === fullAxisArgmax ? "YES" : "NO"}`);
  console.log(`  trueQ(full pick) = ${rows[fullAxisArgmax].fullAxisQ.toFixed(4)}   trueQ(short pick) = ${rows[shortAxisArgmax].fullAxisQ.toFixed(4)}`);
  console.log(`  misranking cost (true axis_quality the short pick gives up) = ${axisMisrankCost.toFixed(4)}`);
  console.log(`  rank correlation: pearson=${axisQPearson.toFixed(4)}  spearman=${axisQSpearman.toFixed(4)}`);
  console.log("");

  // top-5 by each leaf for context
  const topByAxisQ = (key: "shortAxisQ" | "fullAxisQ"): number[] =>
    rows.map((_, i) => i).sort((a, b) => rows[b][key] - rows[a][key]).slice(0, 5);
  const shortTop = topByAxisQ("shortAxisQ");
  const fullTop = topByAxisQ("fullAxisQ");
  console.log("  -- top-5 arcs by axis_quality (index: shortAxisQ / fullAxisQ) --");
  console.log(`  short top5: ${shortTop.map((i) => `${i}(${rows[i].shortAxisQ.toFixed(3)}/${rows[i].fullAxisQ.toFixed(3)})`).join("  ")}`);
  console.log(`  full  top5: ${fullTop.map((i) => `${i}(${rows[i].shortAxisQ.toFixed(3)}/${rows[i].fullAxisQ.toFixed(3)})`).join("  ")}`);
  console.log("============================================================");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
