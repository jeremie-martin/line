/**
 * V2-native first screen for a contact-preserving replacement for whole-arc
 * rotation.  This is an observation study: it replays ordinary committed arcs
 * from a frozen compile, applies one small suffix edit, then sends every edit
 * through the normal exact candidate evaluator.  It neither changes the
 * compiler's candidate space nor its selector.
 *
 * The comparison is deliberately narrow and symmetric:
 *   base; tail-pitch +/-8.5deg; whole-arc rotate +/-2.5deg; progressive
 *   exit-bend +/-8.5deg; and endpoint-preserving interior normal bows at
 *   fixed quarter, half, and rotation-equivalent +/-2.5deg scales.  The bow
 *   changes the contact-forming support interior without translating the
 *   entry or exit endpoint.  The two-sign "best" summaries are descriptive
 *   (and selection-biased); gate rate and all-sign averages are the primary
 *   evidence.
 *
 * Example cheap scope panel:
 *   LR_ENGINE=wasm node --expose-gc --import tsx scripts/v0/study_arc_knob_replacement_v2.ts \
 *     --specs=frontier_dense_recovery,frontier_dense_recovery_240ms_figures,frontier_pickup_progression,frontier_low_air_endurance,dense_dialogue,believer_56_6s \
 *     --seeds=0 --budget=200000 --max-gaps=4 --out=generated/studies/arc-knob-replacement-v2/v1/screen.json
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
import { axisLookaheadEndFrame, tryCandidateLines } from "./core/candidate.ts";
import { applyJolt } from "../produce/seed.ts";
import { compileHandoff, type HandoffNode } from "./optimizer/handoff.ts";
import { extendNodeCached, makeRootNode, type SearchNode } from "./optimizer/node.ts";
import { getCandidateProbe, type Candidate, type SpecContext } from "./optimizer/sample.ts";
import { applyArcActuatorPair } from "./optimizer/arc_actuator.ts";
import { isStrictlyBetter, type LeafKey } from "./optimizer/register.ts";
import { scoreCurrentTargetQuality } from "./optimizer/objective.ts";
import { CALIB, secToFrame, type AxisValues, type Gap, type TrackLine } from "./types.ts";
import type { Spec } from "./optimizer/types.ts";

const argv = process.argv.slice(2);
const arg = (name: string): string | undefined =>
  argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const ids = (arg("specs") ?? "frontier_dense_recovery,frontier_dense_recovery_240ms_figures,frontier_pickup_progression,frontier_low_air_endurance,dense_dialogue,believer_56_6s")
  .split(",").filter(Boolean);
const seeds = (arg("seeds") ?? "0").split(",").filter(Boolean).map(Number);
const budget = Number(arg("budget") ?? "200000");
const maxGaps = Number(arg("max-gaps") ?? "4");
const outPath = arg("out");

if (!Number.isInteger(budget) || budget <= 0) throw new Error(`invalid --budget=${budget}`);
if (!Number.isInteger(maxGaps) || maxGaps <= 0) throw new Error(`invalid --max-gaps=${maxGaps}`);
if (seeds.some((seed) => !Number.isSafeInteger(seed))) throw new Error("--seeds must contain safe integers");

const cases = new Map(developmentCases.map((entry) => [entry.case.metadata.id, entry.case.spec] as const));
for (const id of ids) if (!cases.has(id)) throw new Error(`unknown V2 development case "${id}"`);

type Setup = { gaps: Gap[]; ctx: SpecContext };
type Family = "base" | "pitch" | "rotate" | "bend" | "bow_quarter" | "bow_half" | "bow";
type Trial = {
  spec: string;
  seed: number;
  gapIndex: number;
  family: Family;
  deltaDeg: number;
  admitted: boolean;
  quality: number | null;
  cost: number | null;
  impactError: number | null;
  impactTargeted: boolean;
};

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

/** Study-only candidate for replacing whole-arc rotation: preserve the catch,
 * redistribute terminal heading change over the suffix, and keep each segment
 * length unchanged.  It is deliberately not a production geometry primitive. */
function bendExitLines(lines: TrackLine[], deg: number): TrackLine[] {
  if (lines.length === 0 || deg === 0) return lines.map((line) => ({ ...line }));
  const m = Math.max(1, Math.ceil(lines.length / 3));
  if (m < 2) return lines.map((line) => ({ ...line }));
  const head = lines.slice(0, lines.length - m).map((line) => ({ ...line }));
  const tail = lines.slice(lines.length - m);
  const out = [...head];
  let x = tail[0].x1;
  let y = tail[0].y1;
  for (let index = 0; index < tail.length; index++) {
    const line = tail[index];
    const dx = line.x2 - line.x1;
    const dy = line.y2 - line.y1;
    const length = Math.hypot(dx, dy);
    if (!(length > 1e-9)) return lines.map((item) => ({ ...item }));
    const t = index / (tail.length - 1);
    const smooth = t * t * (3 - 2 * t);
    const angle = Math.atan2(dy, dx) + deg * smooth * Math.PI / 180;
    const x2 = x + length * Math.cos(angle);
    const y2 = y + length * Math.sin(angle);
    out.push({ ...line, x1: x, y1: y, x2, y2 });
    x = x2;
    y = y2;
  }
  return out;
}

function editedLines(lines: TrackLine[], family: Family, deltaDeg: number): TrackLine[] {
  switch (family) {
    case "base": return lines.map((line) => ({ ...line }));
    case "pitch": return applyArcActuatorPair(lines, "tail_pitch__whole_rotation", { pitchDeg: deltaDeg, rotateDeg: 0 });
    case "rotate": return applyArcActuatorPair(lines, "tail_pitch__whole_rotation", { pitchDeg: 0, rotateDeg: deltaDeg });
    case "bend": return bendExitLines(lines, deltaDeg);
    case "bow_quarter": return applyArcActuatorPair(lines, "tail_pitch__interior_normal_bow", { pitchDeg: 0, rotateDeg: deltaDeg });
    case "bow_half": return applyArcActuatorPair(lines, "tail_pitch__interior_normal_bow", { pitchDeg: 0, rotateDeg: deltaDeg });
    case "bow": return applyArcActuatorPair(lines, "tail_pitch__interior_normal_bow", { pitchDeg: 0, rotateDeg: deltaDeg });
  }
}

const variants: Array<{ family: Family; deltaDeg: number }> = [
  { family: "base", deltaDeg: 0 },
  { family: "pitch", deltaDeg: -8.5 }, { family: "pitch", deltaDeg: 8.5 },
  { family: "rotate", deltaDeg: -2.5 }, { family: "rotate", deltaDeg: 2.5 },
  { family: "bend", deltaDeg: -8.5 }, { family: "bend", deltaDeg: 8.5 },
  { family: "bow_quarter", deltaDeg: -0.625 }, { family: "bow_quarter", deltaDeg: 0.625 },
  { family: "bow_half", deltaDeg: -1.25 }, { family: "bow_half", deltaDeg: 1.25 },
  { family: "bow", deltaDeg: -2.5 }, { family: "bow", deltaDeg: 2.5 },
];
const trials: Trial[] = [];
let skippedIncomplete = 0;
let skippedNoAimTarget = 0;

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
        const probe = getCandidateProbe(entry.prefixEngine, gap, setup.ctx);
        const measureEnd = axisLookaheadEndFrame(gap, setup.ctx.allContactFrames);
        for (const variant of variants) {
          const lines = editedLines(source.lines, variant.family, variant.deltaDeg)
            .map((line, lineIndex) => ({ ...line, id: entry.prefixNextLineId + lineIndex }));
          const fit = tryCandidateLines(
            entry.prefixEngine, gap, lines, entry.prefixNextLineId, setup.ctx.allContactFrames,
            measureEnd, gap.targets, true, "normal", probe.preTargetSledTrace,
          );
          const achieved = fit?.achievedAtEnd ?? fit?.achieved;
          const impactTarget = gap.targets.impact;
          trials.push({
            spec: id, seed, gapIndex: index, family: variant.family, deltaDeg: variant.deltaDeg,
            admitted: fit !== null,
            quality: achieved === undefined ? null : scoreCurrentTargetQuality(gap.targets, achieved),
            cost: fit?.cost ?? null,
            impactError: impactTarget === undefined || achieved?.impact === undefined
              ? null : Math.abs(achieved.impact - impactTarget),
            impactTargeted: impactTarget !== undefined,
          });
        }
        done++;
      } else if (source !== null && source !== undefined && gap.endsWithContact &&
        next.targets.speed === undefined && next.targets.impact === undefined) {
        skippedNoAimTarget++;
      }
      entry = extendNodeCached(entry, source ?? null);
    }
    console.error(`  ${id}/s${seed}: ${done} aim-eligible committed arcs, ${Date.now() - started} ms`);
  }
}

function mean(values: number[]): number | null {
  return values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;
}
function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}
function keyOf(trial: Trial): string { return `${trial.spec}\0${trial.seed}\0${trial.gapIndex}`; }

const summaries = (["base", "pitch", "rotate", "bend", "bow_quarter", "bow_half", "bow"] as const).map((family) => {
  const rows = trials.filter((trial) => trial.family === family);
  const valid = rows.filter((trial) => trial.admitted);
  const quality = valid.flatMap((trial) => trial.quality === null ? [] : [trial.quality]);
  const impact = valid.flatMap((trial) => trial.impactError === null ? [] : [trial.impactError]);
  return {
    family,
    attempts: rows.length,
    admitted: valid.length,
    gateRate: rows.length === 0 ? null : valid.length / rows.length,
    meanQuality: mean(quality),
    medianQuality: median(quality),
    impactSamples: impact.length,
    meanImpactError: mean(impact),
    medianImpactError: median(impact),
  };
});

const paired = (["pitch", "rotate", "bend", "bow_quarter", "bow_half", "bow"] as const).map((family) => {
  const byState = new Map<string, Trial[]>();
  for (const trial of trials) {
    const list = byState.get(keyOf(trial)) ?? [];
    list.push(trial);
    byState.set(keyOf(trial), list);
  }
  const qualityDeltas: number[] = [];
  const impactDeltas: number[] = [];
  for (const state of byState.values()) {
    const base = state.find((trial) => trial.family === "base" && trial.admitted);
    const alternatives = state.filter((trial) => trial.family === family && trial.admitted);
    if (base?.quality !== null && base?.quality !== undefined && alternatives.length > 0) {
      const best = Math.max(...alternatives.flatMap((trial) => trial.quality === null ? [] : [trial.quality]));
      if (Number.isFinite(best)) qualityDeltas.push(best - base.quality);
    }
    if (base?.impactError !== null && base?.impactError !== undefined) {
      const best = alternatives.flatMap((trial) => trial.impactError === null ? [] : [trial.impactError])
        .reduce<number | null>((best, value) => best === null ? value : Math.min(best, value), null);
      if (best !== null) impactDeltas.push(best - base.impactError);
    }
  }
  return {
    family,
    pairedStates: Math.max(qualityDeltas.length, impactDeltas.length),
    // Best-of-two sign summaries are explicitly descriptive, not promotion evidence.
    bestOfTwoMeanQualityDelta: mean(qualityDeltas),
    bestOfTwoMedianQualityDelta: median(qualityDeltas),
    bestOfTwoMeanImpactErrorDelta: mean(impactDeltas),
    bestOfTwoMedianImpactErrorDelta: median(impactDeltas),
  };
});

const result = {
  study: "arc-knob-replacement-v2-v3",
  mechanism: "contact-preserving exit bend and endpoint-preserving interior normal bow amplitude envelope vs incumbent whole-arc rotation",
  budget, ids, seeds, maxGaps,
  counts: { trials: trials.length, states: new Set(trials.map(keyOf)).size, skippedIncomplete, skippedNoAimTarget },
  summaries, paired, trials,
};
console.log(JSON.stringify(result, null, 2));
if (outPath !== undefined) {
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(result, null, 2)}\n`);
}
