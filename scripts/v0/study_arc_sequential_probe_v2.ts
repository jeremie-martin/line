/**
 * Five-probe sequential arc-control counterfactual (V2-native, read-only).
 *
 * Incumbent: cross5 observes pitch and rotation about the raw arc, fits an
 * additive response, then proposes combined shapes.
 *
 * Pitch-first sequential: pitch3 fits a continuous pitch p*. Two rotation
 * observations are then made on the physically pitched arc at (p*, +/-2.5).
 * Rotation-first sequential is its strict order mirror: it fits r* from three
 * raw rotation rides, then makes two tail-pitch observations on the physically
 * rotated arc at (-/+8.5, r*). Each uses five probe calls, no third actuator,
 * and sends only top-2 proposals to `tryCandidateLines`.
 *
 * Full probe mode is intentional for this first decision-quality study: it
 * eliminates short-probe/ballistic approximation as a confound. It is not an
 * implementation-cost claim.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { developmentCases } from "../../benchmark/v2/catalog.ts";
import { benchmarkPolicy } from "../../benchmark/v2/policy.ts";
import { K_BOUNCE_LANDING } from "../lib/detector.ts";
import { makeRng } from "../lib/rng.ts";
import { effectiveAxes, engineLineFromTrackLine, makeBaseEngine, sampleGapTargets, sliceTimeline } from "./core/substrate.ts";
import { axisLookaheadEndFrame, tryCandidateLines } from "./core/candidate.ts";
import { applyJolt } from "../produce/seed.ts";
import { compileHandoff, type HandoffNode } from "./optimizer/handoff.ts";
import { extendNodeCached, makeRootNode, type SearchNode } from "./optimizer/node.ts";
import {
  applyArcKnobs,
  arcProbeDesign,
  fitJointArcResponseModel,
  jointArcCurrentScoreAxes,
  predictJointArcOutputs,
  predictJointArcScoreReadout,
  type ArcKnobs,
  type JointArcProbeRow,
  type JointArcResponseModel,
} from "./optimizer/arc_model.ts";
import { evaluateJointArcKnobs } from "./optimizer/arc_probe.ts";
import { isStrictlyBetter, type LeafKey } from "./optimizer/register.ts";
import { nextGapFrameCount, predictedNextGapAir, scoreGapObjectiveWithCurrentQuality } from "./optimizer/objective.ts";
import { getCandidateProbe, type Candidate, type SpecContext } from "./optimizer/sample.ts";
import { CALIB, secToFrame, type AxisValues, type Gap } from "./types.ts";
import type { Spec } from "./optimizer/types.ts";

const argv = process.argv.slice(2);
const arg = (name: string): string | undefined => argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const ids = (arg("specs") ?? "frontier_dense_recovery,frontier_dense_recovery_240ms_figures,frontier_pickup_progression,frontier_low_air_endurance,dense_dialogue,believer_56_6s")
  .split(",").filter(Boolean);
const seeds = (arg("seeds") ?? "0").split(",").filter(Boolean).map(Number);
const budget = Number(arg("budget") ?? "300000");
const maxGaps = Number(arg("max-gaps") ?? "4");
const probeMode = arg("probe-mode") ?? "full";
const outPath = arg("out");
if (!Number.isInteger(budget) || budget <= 0) throw new Error(`invalid --budget=${budget}`);
if (!Number.isInteger(maxGaps) || maxGaps <= 0) throw new Error(`invalid --max-gaps=${maxGaps}`);
if (probeMode !== "short" && probeMode !== "full") throw new Error(`invalid --probe-mode=${probeMode}`);
const cases = new Map(developmentCases.map((entry) => [entry.case.metadata.id, entry.case.spec] as const));
for (const id of ids) if (!cases.has(id)) throw new Error(`unknown V2 development case "${id}"`);

type Setup = { gaps: Gap[]; ctx: SpecContext };
type Scored = { knobs: ArcKnobs; value: number };
type Policy = { selected: Scored[]; emitted: number };

function prepare(userSpec: Spec, seed: number): Setup {
  const contacts = userSpec.contacts.filter((contact) => secToFrame(contact.t) >= K_BOUNCE_LANDING);
  const spec = { ...userSpec, preroll: undefined, contacts };
  const durationFrames = secToFrame(spec.duration);
  const frames = contacts.map((contact) => secToFrame(contact.t)).sort((a, b) => a - b);
  const gaps = sliceTimeline(frames, durationFrames);
  const targets = gaps.map((gap) => effectiveAxes(gap, spec));
  const rng = makeRng(seed);
  for (const gap of gaps) gap.targets = sampleGapTargets(targets[gap.index], spec.jitter ?? CALIB.SIGMA, rng);
  const impactByFrame = new Map(contacts.flatMap((contact) => contact.impact === undefined ? [] : [[secToFrame(contact.t), contact.impact] as const]));
  for (const gap of gaps) {
    const impact = gap.endsWithContact ? impactByFrame.get(gap.endFrame) : undefined;
    if (impact !== undefined) { gap.targets.impact = impact; targets[gap.index].impact = impact; }
  }
  return { gaps, ctx: { allContactFrames: frames, durationFrames, gapAxisTargets: targets } };
}
function initialEntry(node: HandoffNode, gaps: Gap[]): SearchNode {
  let engine = makeBaseEngine(node.startState);
  if (node.startLines.length > 0) engine = engine.addLine(node.startLines.map(engineLineFromTrackLine));
  return { ...makeRootNode(engine, gaps.length), prefixNextLineId: 1 + node.startLines.length };
}
function score(model: JointArcResponseModel, knobs: ArcKnobs, current: AxisValues, next: AxisValues, nextGap: Gap): number | null {
  const readout = predictJointArcScoreReadout(model, knobs, current, jointArcCurrentScoreAxes(current));
  if (Number.isFinite(readout.exitFrame) && readout.exitFrame > nextGap.endFrame) return null;
  if (readout.state === null) return null;
  const arrival = { ...readout.state };
  if (Number.isFinite(readout.exitSpeed) && Number.isFinite(readout.state.speed)) arrival.meanSpeed = (readout.exitSpeed + readout.state.speed) / 2;
  if (Number.isFinite(readout.exitFrame)) {
    arrival.nextAir = predictedNextGapAir(readout.exitFrame, nextGap);
    arrival.nextGapFrames = nextGapFrameCount(nextGap);
  }
  return scoreGapObjectiveWithCurrentQuality(readout.currentQuality, arrival, next)?.value ?? null;
}
function distinct(a: ArcKnobs, b: ArcKnobs): boolean {
  const pitch = Math.abs(a.pitchDeg - b.pitchDeg) / 1.5;
  const rotate = Math.abs(a.rotateDeg - b.rotateDeg) / 0.5;
  return pitch * pitch + rotate * rotate >= 1;
}
function choose(candidates: Scored[]): Scored[] {
  const out: Scored[] = [];
  for (const candidate of candidates.sort((a, b) => b.value - a.value || Math.abs(a.knobs.rotateDeg) - Math.abs(b.knobs.rotateDeg))) {
    if (out.every((previous) => distinct(previous.knobs, candidate.knobs))) out.push(candidate);
    if (out.length === 2) break;
  }
  return out;
}
function scan(
  model: JointArcResponseModel,
  current: AxisValues,
  next: AxisValues,
  nextGap: Gap,
  pitchCenter = 0,
  rotateOnly = false,
  pitchSpan = 8.5,
): Scored[] {
  const base = score(model, { pitchDeg: 0, rotateDeg: 0 }, current, next, nextGap);
  if (base === null) return [];
  const out: Scored[] = [];
  const pitchStart = rotateOnly ? 0 : -pitchSpan;
  const pitchEnd = rotateOnly ? 0 : pitchSpan;
  for (let localPitch = pitchStart; localPitch <= pitchEnd + 1e-9; localPitch += 0.25) {
    for (let rotateDeg = -2.5; rotateDeg <= 2.5 + 1e-9; rotateDeg += 0.5) {
      if (Math.abs(localPitch) < 0.25 && Math.abs(rotateDeg) < 0.25) continue;
      const value = score(model, { pitchDeg: localPitch, rotateDeg }, current, next, nextGap);
      if (value !== null && value > base + 1e-4) out.push({ knobs: { pitchDeg: pitchCenter + localPitch, rotateDeg }, value });
    }
  }
  return out;
}
function exact(selected: Scored[], engine: any, gap: Gap, ctx: SpecContext, source: Candidate, lineId: number, measureEnd: number): Policy {
  const probe = getCandidateProbe(engine, gap, ctx);
  let emitted = 0;
  for (const candidate of selected) {
    const lines = applyArcKnobs(source.lines, candidate.knobs).map((line, index) => ({ ...line, id: lineId + index }));
    if (tryCandidateLines(engine, gap, lines, lineId, ctx.allContactFrames, measureEnd, gap.targets, true, "normal", probe.preTargetSledTrace) !== null) emitted++;
  }
  return { selected, emitted };
}

const totals = {
  states: 0, skippedIncomplete: 0,
  pitchFirstConditionalProbeGateRows: 0, pitchFirstConditionalProbeGatePasses: 0,
  rotationFirstConditionalProbeGateRows: 0, rotationFirstConditionalProbeGatePasses: 0,
  crossSelected: 0, crossEmitted: 0, crossAny: 0,
  sequentialSelected: 0, sequentialEmitted: 0, sequentialAny: 0,
  rotationFirstSelected: 0, rotationFirstEmitted: 0, rotationFirstAny: 0,
  pitchFirstRecoveredStates: 0, pitchFirstLostStates: 0,
  rotationFirstRecoveredStates: 0, rotationFirstLostStates: 0,
  pStarMeanAbs: 0, pStarNonzero: 0, rStarMeanAbs: 0, rStarNonzero: 0,
};

for (const id of ids) for (const seed of seeds) {
  const userSpec = applyJolt(cases.get(id)!, benchmarkPolicy.transform.joltMs);
  let winner: HandoffNode | null = null;
  let winnerKey: LeafKey | null = null;
  const started = Date.now();
  compileHandoff(userSpec, seed, { budget, onNode: (node, key, event) => {
    if (event.fullDuration && (winnerKey === null || isStrictlyBetter(key, winnerKey))) { winner = node; winnerKey = key; }
  }});
  if (winner === null) { totals.skippedIncomplete++; continue; }
  const setup = prepare(userSpec, seed);
  let entry = initialEntry(winner, setup.gaps);
  let done = 0;
  for (let index = 0; index + 1 < setup.gaps.length; index++) {
    const gap = setup.gaps[index];
    const nextGap = setup.gaps[index + 1];
    const source = winner.search.prefixFits[index] as Candidate | null | undefined;
    if (source !== null && source !== undefined && gap.endsWithContact &&
      (nextGap.targets.speed !== undefined || nextGap.targets.impact !== undefined) && done < maxGaps) {
      const measureEnd = axisLookaheadEndFrame(gap, setup.ctx.allContactFrames);
      const current = setup.ctx.gapAxisTargets?.[gap.index] ?? gap.targets;
      const next = setup.ctx.gapAxisTargets?.[nextGap.index] ?? nextGap.targets;
      const observe = (knobs: ArcKnobs) => evaluateJointArcKnobs(
        entry.prefixEngine, source.lines, knobs, gap, setup.ctx.allContactFrames, measureEnd, nextGap.endFrame,
        { mode: probeMode },
      );
      const crossRows = arcProbeDesign("cross5").map(observe);
      const cross = fitJointArcResponseModel(crossRows.map((row): JointArcProbeRow => ({
        knobs: row.knobs, outputs: row.outputs,
        ...(row.latentOutputs === undefined ? {} : { latentOutputs: row.latentOutputs }),
      })), "cross5", "hybrid", {
        context: { gap, axisMeasureEnd: measureEnd, nextFrame: nextGap.endFrame },
      });
      const crossPolicy = exact(choose(scan(cross, current, next, nextGap)), entry.prefixEngine, gap, setup.ctx, source, entry.prefixNextLineId, measureEnd);

      const pitchRows = arcProbeDesign("pitch3").map(observe);
      const pitchModel = fitJointArcResponseModel(pitchRows.map((row): JointArcProbeRow => ({
        knobs: row.knobs, outputs: row.outputs,
        ...(row.latentOutputs === undefined ? {} : { latentOutputs: row.latentOutputs }),
      })), "pitch3", "hybrid", {
        context: { gap, axisMeasureEnd: measureEnd, nextFrame: nextGap.endFrame },
      });
      const pitchCandidates = scan(pitchModel, current, next, nextGap)
        .filter((candidate) => candidate.knobs.rotateDeg === 0)
        .sort((a, b) => b.value - a.value || Math.abs(a.knobs.pitchDeg) - Math.abs(b.knobs.pitchDeg));
      const pStar = pitchCandidates[0]?.knobs.pitchDeg ?? 0;
      let sequentialPolicy: Policy = { selected: [], emitted: 0 };
      {
        const virtualCenter = predictJointArcOutputs(pitchModel, { pitchDeg: pStar, rotateDeg: 0 });
        const conditionals = [-2.5, 2.5].map((rotateDeg) => observe({ pitchDeg: pStar, rotateDeg }));
        for (const row of conditionals) {
          totals.pitchFirstConditionalProbeGateRows++;
          if (row.gate.currentOk) totals.pitchFirstConditionalProbeGatePasses++;
        }
        // Re-center the pitch curve at p*.  The center is a model prediction;
        // the signed rotation rows are actual combined observations.
        const rows: JointArcProbeRow[] = [
          ...pitchRows.map((row) => ({
            knobs: { pitchDeg: row.knobs.pitchDeg - pStar, rotateDeg: 0 }, outputs: row.outputs,
            ...(row.latentOutputs === undefined ? {} : { latentOutputs: row.latentOutputs }),
          })),
          { knobs: { pitchDeg: 0, rotateDeg: 0 }, outputs: virtualCenter },
          ...conditionals.map((row) => ({
            knobs: { pitchDeg: 0, rotateDeg: row.knobs.rotateDeg }, outputs: row.outputs,
            ...(row.latentOutputs === undefined ? {} : { latentOutputs: row.latentOutputs }),
          })),
        ];
        const conditionalModel = fitJointArcResponseModel(rows, "cross5", "hybrid", {
          context: { gap, axisMeasureEnd: measureEnd, nextFrame: nextGap.endFrame },
        });
        const allowedSigns = new Set(conditionals.filter((row) => row.gate.currentOk).map((row) => Math.sign(row.knobs.rotateDeg)));
        const local = scan(conditionalModel, current, next, nextGap, pStar, true).filter((candidate) =>
          candidate.knobs.rotateDeg === 0 || allowedSigns.has(Math.sign(candidate.knobs.rotateDeg)),
        );
        // The selected pitch itself occupies an ordinary final slot when it
        // improved over raw base; the rotation scan is a refinement around it,
        // not a replacement for it.
        const withPitch = [...pitchCandidates.slice(0, 2), ...local];
        sequentialPolicy = exact(choose(withPitch), entry.prefixEngine, gap, setup.ctx, source, entry.prefixNextLineId, measureEnd);
        totals.pStarMeanAbs += Math.abs(pStar);
        if (Math.abs(pStar) >= 0.25) totals.pStarNonzero++;
      }

      // The decision-order mirror is deliberately not a re-label of the
      // physical transform: all combined shapes still apply whole-arc
      // rotation first and tail pitch second.  Only the information sequence
      // changes.  The first three raw rides identify an r*; the two remaining
      // rides measure pitch on that new, rotated physical arc.
      const rotationRows = [0, -2.5, 2.5].map((rotateDeg) => observe({ pitchDeg: 0, rotateDeg }));
      const rotationModel = fitJointArcResponseModel(rotationRows.map((row): JointArcProbeRow => ({
        knobs: { pitchDeg: row.knobs.rotateDeg, rotateDeg: 0 }, outputs: row.outputs,
        ...(row.latentOutputs === undefined ? {} : { latentOutputs: row.latentOutputs }),
      })), "pitch3", "hybrid", {
        context: { gap, axisMeasureEnd: measureEnd, nextFrame: nextGap.endFrame },
      });
      const rotationCandidates = scan(rotationModel, current, next, nextGap, 0, false, 2.5)
        .filter((candidate) => candidate.knobs.rotateDeg === 0)
        .sort((a, b) => b.value - a.value || Math.abs(a.knobs.pitchDeg) - Math.abs(b.knobs.pitchDeg));
      const rStar = rotationCandidates[0]?.knobs.pitchDeg ?? 0;
      let rotationFirstPolicy: Policy = { selected: [], emitted: 0 };
      {
        const actualCenter = rotationRows.find((row) => row.knobs.rotateDeg === 0);
        const virtualCenter = rStar === 0 && actualCenter !== undefined
          ? actualCenter.outputs
          : predictJointArcOutputs(rotationModel, { pitchDeg: rStar, rotateDeg: 0 });
        const conditionals = [-8.5, 8.5].map((pitchDeg) => observe({ pitchDeg, rotateDeg: rStar }));
        for (const row of conditionals) {
          totals.rotationFirstConditionalProbeGateRows++;
          if (row.gate.currentOk) totals.rotationFirstConditionalProbeGatePasses++;
        }
        // In this local model `pitchDeg` is the physical tail-pitch offset
        // around r*. Rotation has already been selected; it is reattached
        // only when an exact candidate is emitted below.
        const pitchAtRotationModel = fitJointArcResponseModel([
          { knobs: { pitchDeg: 0, rotateDeg: 0 }, outputs: virtualCenter },
          ...conditionals.map((row): JointArcProbeRow => ({
            knobs: { pitchDeg: row.knobs.pitchDeg, rotateDeg: 0 }, outputs: row.outputs,
            ...(row.latentOutputs === undefined ? {} : { latentOutputs: row.latentOutputs }),
          })),
        ], "pitch3", "hybrid", {
          context: { gap, axisMeasureEnd: measureEnd, nextFrame: nextGap.endFrame },
        });
        const pitchCandidates = scan(pitchAtRotationModel, current, next, nextGap)
          .filter((candidate) => candidate.knobs.rotateDeg === 0)
          .map((candidate) => ({
            knobs: { pitchDeg: candidate.knobs.pitchDeg, rotateDeg: rStar },
            value: candidate.value,
          }));
        const selectedRotation = rotationCandidates.slice(0, 1).map((candidate) => ({
          knobs: { pitchDeg: 0, rotateDeg: candidate.knobs.pitchDeg },
          value: candidate.value,
        }));
        rotationFirstPolicy = exact(
          choose([...selectedRotation, ...pitchCandidates]),
          entry.prefixEngine, gap, setup.ctx, source, entry.prefixNextLineId, measureEnd,
        );
        totals.rStarMeanAbs += Math.abs(rStar);
        if (Math.abs(rStar) >= 0.25) totals.rStarNonzero++;
      }
      totals.states++;
      totals.crossSelected += crossPolicy.selected.length; totals.crossEmitted += crossPolicy.emitted; if (crossPolicy.emitted > 0) totals.crossAny++;
      totals.sequentialSelected += sequentialPolicy.selected.length; totals.sequentialEmitted += sequentialPolicy.emitted; if (sequentialPolicy.emitted > 0) totals.sequentialAny++;
      totals.rotationFirstSelected += rotationFirstPolicy.selected.length; totals.rotationFirstEmitted += rotationFirstPolicy.emitted; if (rotationFirstPolicy.emitted > 0) totals.rotationFirstAny++;
      if (crossPolicy.emitted === 0 && sequentialPolicy.emitted > 0) totals.pitchFirstRecoveredStates++;
      if (crossPolicy.emitted > 0 && sequentialPolicy.emitted === 0) totals.pitchFirstLostStates++;
      if (crossPolicy.emitted === 0 && rotationFirstPolicy.emitted > 0) totals.rotationFirstRecoveredStates++;
      if (crossPolicy.emitted > 0 && rotationFirstPolicy.emitted === 0) totals.rotationFirstLostStates++;
      done++;
    }
    entry = extendNodeCached(entry, source ?? null);
  }
  console.error(`  ${id}/s${seed}: ${done} paired states, ${Date.now() - started} ms`);
}
const result = {
  study: "arc-sequential-probe-v2-v2", budget, ids, seeds, maxGaps, probeMode,
  totals: { ...totals, pStarMeanAbs: totals.states === 0 ? null : totals.pStarMeanAbs / totals.states,
    rStarMeanAbs: totals.states === 0 ? null : totals.rStarMeanAbs / totals.states,
    pitchFirstConditionalProbeGateRate: totals.pitchFirstConditionalProbeGateRows === 0 ? null :
      totals.pitchFirstConditionalProbeGatePasses / totals.pitchFirstConditionalProbeGateRows,
    rotationFirstConditionalProbeGateRate: totals.rotationFirstConditionalProbeGateRows === 0 ? null :
      totals.rotationFirstConditionalProbeGatePasses / totals.rotationFirstConditionalProbeGateRows },
};
console.log(JSON.stringify(result, null, 2));
if (outPath !== undefined) { mkdirSync(dirname(outPath), { recursive: true }); writeFileSync(outPath, `${JSON.stringify(result, null, 2)}\n`); }
