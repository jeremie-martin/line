/**
 * V2-native counterfactual for a probe-certified rotation domain.
 *
 * Current cross5 already pays for +/-2.5 degree whole-arc rotation probes. If
 * the extreme probe in one signed direction fails the ordinary current gate,
 * this study removes only proposals with rotation in that direction before the
 * existing top-2 exact evaluations. The incumbent policy and the restricted
 * policy otherwise share the same probes, hybrid model, scan, and evaluator.
 *
 * This is a read-only economic test.  It deliberately asks only whether the
 * restriction recovers exact candidate slots; it does not claim a score lift.
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
  arcKnobSpan,
  arcProbeDesign,
  fitJointArcResponseModel,
  jointArcCurrentScoreAxes,
  predictJointArcScoreReadout,
  type ArcKnobs,
  type JointArcProbeRow,
  type JointArcResponseModel,
} from "./optimizer/arc_model.ts";
import { evaluateJointArcKnobs } from "./optimizer/arc_probe.ts";
import { isStrictlyBetter, type LeafKey } from "./optimizer/register.ts";
import { scoreProjectedOutgoingSurrogate } from "./optimizer/objective.ts";
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
const outPath = arg("out");
if (!Number.isInteger(budget) || budget <= 0) throw new Error(`invalid --budget=${budget}`);
if (!Number.isInteger(maxGaps) || maxGaps <= 0) throw new Error(`invalid --max-gaps=${maxGaps}`);

const cases = new Map(developmentCases.map((entry) => [entry.case.metadata.id, entry.case.spec] as const));
for (const id of ids) if (!cases.has(id)) throw new Error(`unknown V2 development case "${id}"`);

type Setup = { gaps: Gap[]; ctx: SpecContext };
type Scored = { knobs: ArcKnobs; value: number };
type PolicyResult = { selected: number; emitted: number; rotateSelected: number; anyEmitted: boolean };

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

function score(model: JointArcResponseModel, knobs: ArcKnobs, currentTargets: AxisValues, nextTargets: AxisValues, nextGap: Gap): number | null {
  const readout = predictJointArcScoreReadout(model, knobs, currentTargets, jointArcCurrentScoreAxes(currentTargets));
  if (Number.isFinite(readout.exitFrame) && readout.exitFrame > nextGap.endFrame) return null;
  if (readout.state === null) return null;
  return scoreProjectedOutgoingSurrogate(
    readout.currentQuality,
    nextTargets,
    {
      meanSpeedPx: readout.nextMeanSpeedPx,
      airFraction: readout.nextAirFraction,
      ...(Number.isFinite(readout.nextElevation)
        ? { elevation: readout.nextElevation }
        : {}),
    },
  )?.value ?? null;
}

function distinct(a: ArcKnobs, b: ArcKnobs): boolean {
  const pitch = Math.abs(a.pitchDeg - b.pitchDeg) / 1.5;
  const rotate = Math.abs(a.rotateDeg - b.rotateDeg) / 0.5;
  return pitch * pitch + rotate * rotate >= 1;
}

function ranked(model: JointArcResponseModel, currentTargets: AxisValues, nextTargets: AxisValues, nextGap: Gap): Scored[] {
  const span = arcKnobSpan(arcProbeDesign("cross5"));
  const base = score(model, { pitchDeg: 0, rotateDeg: 0 }, currentTargets, nextTargets, nextGap);
  if (base === null) return [];
  const out: Scored[] = [];
  for (let pitchDeg = -Math.min(10, span.pitchDeg); pitchDeg <= Math.min(10, span.pitchDeg) + 1e-9; pitchDeg += 0.25) {
    for (let rotateDeg = -span.rotateDeg; rotateDeg <= span.rotateDeg + 1e-9; rotateDeg += 0.5) {
      if (Math.abs(pitchDeg) < 0.25 && Math.abs(rotateDeg) < 0.25) continue;
      const value = score(model, { pitchDeg, rotateDeg }, currentTargets, nextTargets, nextGap);
      if (value !== null && value > base + 1e-4) out.push({ knobs: { pitchDeg, rotateDeg }, value });
    }
  }
  return out.sort((a, b) => b.value - a.value || Math.abs(a.knobs.rotateDeg) - Math.abs(b.knobs.rotateDeg) || Math.abs(a.knobs.pitchDeg) - Math.abs(b.knobs.pitchDeg));
}

function select(scored: Scored[], allowed: (knobs: ArcKnobs) => boolean): Scored[] {
  const chosen: Scored[] = [];
  for (const candidate of scored) {
    if (!allowed(candidate.knobs) || !chosen.every((previous) => distinct(previous.knobs, candidate.knobs))) continue;
    chosen.push(candidate);
    if (chosen.length === 2) break;
  }
  return chosen;
}

function evaluatePolicy(
  selected: Scored[], engine: any, gap: Gap, ctx: SpecContext, source: Candidate, lineIdStart: number, axisMeasureEnd: number,
): PolicyResult {
  const probe = getCandidateProbe(engine, gap, ctx);
  let emitted = 0;
  let rotateSelected = 0;
  for (const candidate of selected) {
    if (candidate.knobs.rotateDeg !== 0) rotateSelected++;
    const lines = applyArcKnobs(source.lines, candidate.knobs).map((line, index) => ({ ...line, id: lineIdStart + index }));
    if (tryCandidateLines(engine, gap, lines, lineIdStart, ctx.allContactFrames, axisMeasureEnd, gap.targets, true, "normal", probe.preTargetSledTrace) !== null) emitted++;
  }
  return { selected: selected.length, emitted, rotateSelected, anyEmitted: emitted > 0 };
}

const totals = {
  states: 0, skippedIncomplete: 0,
  incumbentSelected: 0, incumbentEmitted: 0, incumbentRotateSelected: 0, incumbentAny: 0,
  restrictedSelected: 0, restrictedEmitted: 0, restrictedRotateSelected: 0, restrictedAny: 0,
  recoveredStates: 0, lostStates: 0, changedStates: 0,
};

for (const id of ids) for (const seed of seeds) {
  const started = Date.now();
  const userSpec = applyJolt(cases.get(id)!, benchmarkPolicy.transform.joltMs);
  let winner: HandoffNode | null = null;
  let winnerKey: LeafKey | null = null;
  compileHandoff(userSpec, seed, { budget, onNode: (node, key, event) => {
    if (event.fullDuration && (winnerKey === null || isStrictlyBetter(key, winnerKey))) { winner = node; winnerKey = key; }
  }});
  if (winner === null) { totals.skippedIncomplete++; continue; }
  const setup = prepare(userSpec, seed);
  let entry = initialEntry(winner, setup.gaps);
  let done = 0;
  for (let index = 0; index + 1 < setup.gaps.length; index++) {
    const gap = setup.gaps[index];
    const next = setup.gaps[index + 1];
    const source = winner.search.prefixFits[index] as Candidate | null | undefined;
    if (source !== null && source !== undefined && gap.endsWithContact &&
      (next.targets.speed !== undefined || next.targets.impact !== undefined) && done < maxGaps) {
      const axisMeasureEnd = axisLookaheadEndFrame(gap, setup.ctx.allContactFrames);
      const probes = arcProbeDesign("cross5").map((knobs) => evaluateJointArcKnobs(
        entry.prefixEngine, source.lines, knobs, gap, setup.ctx.allContactFrames, axisMeasureEnd, next.endFrame,
      ));
      const model = fitJointArcResponseModel(probes.map((row): JointArcProbeRow => ({
        knobs: row.knobs, outputs: row.outputs,
      })), "cross5", "hybrid", { context: { gap, axisMeasureEnd, nextFrame: next.endFrame } });
      const all = ranked(model, setup.ctx.gapAxisTargets?.[gap.index] ?? gap.targets, setup.ctx.gapAxisTargets?.[next.index] ?? next.targets, next);
      const negProbe = probes.find((row) => row.knobs.rotateDeg < 0);
      const posProbe = probes.find((row) => row.knobs.rotateDeg > 0);
      const incumbent = evaluatePolicy(select(all, () => true), entry.prefixEngine, gap, setup.ctx, source, entry.prefixNextLineId, axisMeasureEnd);
      const restricted = evaluatePolicy(select(all, (knobs) =>
        knobs.rotateDeg === 0 || (knobs.rotateDeg < 0 ? negProbe?.gate.currentOk === true : posProbe?.gate.currentOk === true),
      ), entry.prefixEngine, gap, setup.ctx, source, entry.prefixNextLineId, axisMeasureEnd);
      totals.states++;
      totals.incumbentSelected += incumbent.selected; totals.incumbentEmitted += incumbent.emitted; totals.incumbentRotateSelected += incumbent.rotateSelected;
      totals.restrictedSelected += restricted.selected; totals.restrictedEmitted += restricted.emitted; totals.restrictedRotateSelected += restricted.rotateSelected;
      if (incumbent.anyEmitted) totals.incumbentAny++;
      if (restricted.anyEmitted) totals.restrictedAny++;
      if (!incumbent.anyEmitted && restricted.anyEmitted) totals.recoveredStates++;
      if (incumbent.anyEmitted && !restricted.anyEmitted) totals.lostStates++;
      if (JSON.stringify(select(all, () => true).map((x) => x.knobs)) !== JSON.stringify(select(all, (knobs) =>
        knobs.rotateDeg === 0 || (knobs.rotateDeg < 0 ? negProbe?.gate.currentOk === true : posProbe?.gate.currentOk === true),
      ).map((x) => x.knobs))) totals.changedStates++;
      done++;
    }
    entry = extendNodeCached(entry, source ?? null);
  }
  console.error(`  ${id}/s${seed}: ${done} paired states, ${Date.now() - started} ms`);
}

const result = { study: "arc-rotation-fallback-v2-v1", budget, ids, seeds, maxGaps, totals };
console.log(JSON.stringify(result, null, 2));
if (outPath !== undefined) { mkdirSync(dirname(outPath), { recursive: true }); writeFileSync(outPath, `${JSON.stringify(result, null, 2)}\n`); }
