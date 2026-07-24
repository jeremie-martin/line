/**
 * V2-native held-out interaction audit for the incumbent five-probe arc model.
 *
 * The production cross5 design observes (0,0), (+/-P,0), and (0,+/-R).  Its
 * surface fallback is additive: F(p,r) = F(p,0) + F(0,r) - F(0,0).  This study
 * holds ordinary committed V2 prefixes fixed, fits the production hybrid
 * output model on those five full observations, then tests the four unseen
 * pitch x rotation corners.  It answers whether a conditional sequential
 * second probe is warranted before changing the physical actuator.
 *
 * This is read-only.  A corner is never offered to production selection.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { developmentCases } from "../../benchmark/v2/catalog.ts";
import { benchmarkPolicy } from "../../benchmark/v2/policy.ts";
import { K_BOUNCE_LANDING } from "../lib/detector.ts";
import { makeRng } from "../lib/rng.ts";
import {
  effectiveAxes,
  engineLineFromTrackLine,
  makeBaseEngine,
  sampleGapTargets,
  sliceTimeline,
} from "./core/substrate.ts";
import { axisLookaheadEndFrame } from "./core/candidate.ts";
import { applyJolt } from "../produce/seed.ts";
import { compileHandoff, type HandoffNode } from "./optimizer/handoff.ts";
import { extendNodeCached, makeRootNode, type SearchNode } from "./optimizer/node.ts";
import {
  arcKnobGrid,
  arcKnobKey,
  arcProbeDesign,
  fitJointArcResponseModel,
  predictJointArcOutputs,
  type ArcKnobs,
  type JointArcProbeRow,
} from "./optimizer/arc_model.ts";
import { evaluateJointArcKnobs } from "./optimizer/arc_probe.ts";
import { isStrictlyBetter, type LeafKey } from "./optimizer/register.ts";
import { CALIB, secToFrame, type Gap } from "./types.ts";
import type { Candidate, SpecContext } from "./optimizer/sample.ts";
import type { Spec } from "./optimizer/types.ts";

const argv = process.argv.slice(2);
const arg = (name: string): string | undefined =>
  argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
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
type ErrorRow = { output: string; modelAbsError: number; additiveAbsError: number };

function prepare(userSpec: Spec, seed: number): Setup {
  const contacts = userSpec.contacts.filter((contact) => secToFrame(contact.t) >= K_BOUNCE_LANDING);
  const spec = { ...userSpec, preroll: undefined, contacts };
  const durationFrames = secToFrame(spec.duration);
  const frames = contacts.map((contact) => secToFrame(contact.t)).sort((a, b) => a - b);
  const gaps = sliceTimeline(frames, durationFrames);
  const targets = gaps.map((gap) => effectiveAxes(gap, spec));
  const rng = makeRng(seed);
  for (const gap of gaps) gap.targets = sampleGapTargets(targets[gap.index], spec.jitter ?? CALIB.SIGMA, rng);
  const impactByFrame = new Map(contacts.flatMap((contact) =>
    contact.impact === undefined ? [] : [[secToFrame(contact.t), contact.impact] as const],
  ));
  for (const gap of gaps) {
    const impact = gap.endsWithContact ? impactByFrame.get(gap.endFrame) : undefined;
    if (impact !== undefined) {
      gap.targets.impact = impact;
      targets[gap.index].impact = impact;
    }
  }
  for (let index = 0; index + 1 < gaps.length; index++) {
    if (gaps[index].endsWithContact && gaps[index + 1].endsWithContact) {
      gaps[index].nextImpact = gaps[index + 1].targets.impact;
    }
  }
  return { gaps, ctx: { allContactFrames: frames, durationFrames, gapAxisTargets: targets } };
}

function initialEntry(node: HandoffNode, gaps: Gap[]): SearchNode {
  let engine = makeBaseEngine(node.startState);
  if (node.startLines.length > 0) engine = engine.addLine(node.startLines.map(engineLineFromTrackLine));
  return { ...makeRootNode(engine, gaps.length), prefixNextLineId: 1 + node.startLines.length };
}

function value(row: ReturnType<typeof evaluateJointArcKnobs>, output: string): number | null {
  const candidate = row.outputs[output];
  return typeof candidate === "number" && Number.isFinite(candidate) ? candidate : null;
}
function p90(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.9))];
}
function mean(values: number[]): number | null {
  return values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;
}

const probeKnobs = arcProbeDesign("cross5");
const corners = arcKnobGrid([-8.5, 8.5], [-2.5, 2.5]);
const outputs = [
  "current.axis.impact", "current.error.impact",
  "next.speed", "next.comAngleDeg", "next.sledPoseDeg", "next.sledPoseRateDegPerFrame",
] as const;
const errors: ErrorRow[] = [];
let states = 0;
let probeGatePasses = 0;
let probeRows = 0;
let cornerGatePasses = 0;
let cornerRows = 0;
let skippedIncomplete = 0;

for (const id of ids) {
  for (const seed of seeds) {
    const started = Date.now();
    const userSpec = applyJolt(cases.get(id)!, benchmarkPolicy.transform.joltMs);
    let winner: HandoffNode | null = null;
    let winnerKey: LeafKey | null = null;
    compileHandoff(userSpec, seed, {
      budget,
      onNode: (node, key, event) => {
        if (event.fullDuration && (winnerKey === null || isStrictlyBetter(key, winnerKey))) {
          winner = node;
          winnerKey = key;
        }
      },
    });
    if (winner === null) {
      skippedIncomplete++;
      console.error(`  ${id}/s${seed}: no full-duration prefix at ${budget} frames`);
      continue;
    }
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
        const read = (knobs: ArcKnobs) => evaluateJointArcKnobs(
          entry.prefixEngine, source.lines, knobs, gap, setup.ctx.allContactFrames,
          axisMeasureEnd, next.endFrame, { mode: "full" },
        );
        const probes = probeKnobs.map(read);
        const byKnob = new Map(probes.map((row) => [arcKnobKey(row.knobs), row]));
        const model = fitJointArcResponseModel(
          probes.map((row): JointArcProbeRow => ({
            knobs: row.knobs, outputs: row.outputs,
          })),
          "cross5", "hybrid", { context: { gap, axisMeasureEnd, nextFrame: next.endFrame } },
        );
        for (const probe of probes) {
          probeRows++;
          if (probe.gate.currentOk) probeGatePasses++;
        }
        for (const corner of corners) {
          const actual = read(corner);
          cornerRows++;
          if (actual.gate.currentOk) cornerGatePasses++;
          const pitch = byKnob.get(arcKnobKey({ pitchDeg: corner.pitchDeg, rotateDeg: 0 }));
          const rotate = byKnob.get(arcKnobKey({ pitchDeg: 0, rotateDeg: corner.rotateDeg }));
          const center = byKnob.get(arcKnobKey({ pitchDeg: 0, rotateDeg: 0 }));
          if (pitch === undefined || rotate === undefined || center === undefined) continue;
          const predicted = predictJointArcOutputs(model, corner);
          for (const output of outputs) {
            const truth = value(actual, output);
            const modelValue = predicted[output];
            const pitchValue = value(pitch, output);
            const rotateValue = value(rotate, output);
            const centerValue = value(center, output);
            if (truth === null || !Number.isFinite(modelValue) || pitchValue === null || rotateValue === null || centerValue === null) continue;
            errors.push({
              output,
              modelAbsError: Math.abs(modelValue - truth),
              additiveAbsError: Math.abs((pitchValue + rotateValue - centerValue) - truth),
            });
          }
        }
        states++;
        done++;
      }
      entry = extendNodeCached(entry, source ?? null);
    }
    console.error(`  ${id}/s${seed}: ${done} paired states, ${Date.now() - started} ms`);
  }
}

const summary = outputs.map((output) => {
  const rows = errors.filter((row) => row.output === output);
  const model = rows.map((row) => row.modelAbsError);
  const additive = rows.map((row) => row.additiveAbsError);
  return {
    output, n: rows.length,
    hybridModelMae: mean(model), hybridModelP90: p90(model),
    directAdditiveMae: mean(additive), directAdditiveP90: p90(additive),
  };
});
const result = {
  study: "arc-cross-additivity-v2-v1",
  mechanism: "held-out pitch x whole-arc-rotation interaction audit of cross5",
  budget, ids, seeds, maxGaps,
  counts: {
    states, probeRows, probeGateRate: probeRows === 0 ? null : probeGatePasses / probeRows,
    cornerRows, cornerGateRate: cornerRows === 0 ? null : cornerGatePasses / cornerRows,
    skippedIncomplete,
  },
  summary,
};
console.log(JSON.stringify(result, null, 2));
if (outPath !== undefined) {
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(result, null, 2)}\n`);
}
