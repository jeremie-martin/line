/**
 * Exact local contact-response envelope for ordinary normal geometry.
 *
 * This is a physics audit, not an optimizer source.  It begins with fixed raw
 * normal proposals at immutable winner-prefix states and asks whether small,
 * contact-local deformations expose a response direction that repairs impact
 * without buying it through immediate speed error or predicted readiness.
 *
 * The fixed deformation basis is deliberately not a new hand-designed catch:
 * whole-catch normal offset, entry-branch pitch, and post-contact-branch
 * pitch, each at both signs.  All proposed geometry goes through the current
 * exact candidate gates.  A positive result would justify a separately
 * declared engine-measured transition-source assay; it cannot promote a
 * selector or a compiler change by itself.
 *
 *   LR_ENGINE=wasm node --expose-gc --import tsx \
 *     scripts/v0/study_impact_response_envelope.ts [--out=PATH]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import dense from "../../benchmark/v2/cases/normative/capability/frontier_dense_recovery.ts";
import lowAir from "../../benchmark/v2/cases/variants/capability/frontier_low_air_endurance_4s.ts";
import believer from "../../benchmark/v2/cases/normative/development_music/believer_56_6s.ts";
import countercurrent from "../../benchmark/v2/cases/normative/representative/countercurrent.ts";
import denseDialogueImpact from "../../benchmark/v2/cases/variants/representative/dense_dialogue_impact_contrast_10.ts";
import offgrid from "../../benchmark/v2/cases/normative/representative/offgrid_conversation.ts";
import { benchmarkPolicy } from "../../benchmark/v2/policy.ts";
import { makeRng } from "../lib/rng.ts";
import { applyJolt } from "../produce/seed.ts";
import { candidateQualityObjective } from "./optimizer/aim.ts";
import {
  compileHandoff,
  compileHandoffFromSnapshot,
  snapshotHandoffNode,
  type HandoffNode,
  type HandoffNodeEvent,
} from "./optimizer/handoff.ts";
import type { LeafKey } from "./optimizer/register.ts";
import { extendNodeCached, getCandidatesSorted } from "./optimizer/node.ts";
import { getCandidateProbe, sampleOneCandidate, type Candidate, type SpecContext } from "./optimizer/sample.ts";
import { axisLookaheadEndFrame, tryCandidateLines } from "./core/candidate.ts";
import { effectiveAxes, sampleGapTargets, sliceTimeline } from "./core/substrate.ts";
import { scoreDriftReport } from "./score.ts";
import { CALIB, FPS, secToFrame, type AxisName, type AxisValues, type Gap, type Spec, type TrackLine } from "./types.ts";

const BUDGET = 250_000;
const RESPONSE_SEEDS = [28, 29] as const;
const RAW_ATTEMPTS = 32;
const RAW_VIABLE_PREFIX = 8;
const SUFFIX_BUDGET = 50_000;
const OFFSET_PX = 2;
const PITCH_DEG = 3;
const MATERIAL_IMPACT_REPAIR = 0.025;
const CASES = [
  { id: "frontier_dense_recovery", regime: "capability_dense", spec: dense },
  { id: "dense_dialogue_impact_contrast_10", regime: "representative_dense", spec: denseDialogueImpact },
  { id: "countercurrent", regime: "representative", spec: countercurrent },
  { id: "believer_56_6s", regime: "development_music", spec: believer },
  { id: "frontier_low_air_endurance_4s", regime: "capability_low_air", spec: lowAir },
  { id: "offgrid_conversation", regime: "representative_pickup", spec: offgrid },
] as const satisfies readonly { id: string; regime: string; spec: Spec }[];

const argv = process.argv.slice(2);
if (argv.includes("--help") || argv.includes("-h")) {
  process.stdout.write(
    "Usage: study_impact_response_envelope.ts [--seed=28|29] [--continuation] [--suffix] [--out=PATH]\n" +
    "Runs one fixed six-regime local-response envelope seed. Observation only.\n",
  );
  process.exit(0);
}
const argument = (name: string): string | undefined =>
  argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const selectedSeed = Number(argument("seed") ?? "28");
if (!(RESPONSE_SEEDS as readonly number[]).includes(selectedSeed)) {
  throw new Error(`--seed must be one of ${RESPONSE_SEEDS.join(", ")}`);
}
const SEED = selectedSeed;
const suffix = argv.includes("--suffix");
const continuation = argv.includes("--continuation") || suffix;
const outPath = argument("out") ?? "generated/studies/impact-response-envelope/v1/result.json";
const unknown = argv.filter((value) =>
  value !== "--continuation" && value !== "--suffix" && !value.startsWith("--out=") && !value.startsWith("--seed=")
);
if (unknown.length > 0) throw new Error(`unknown argument(s): ${unknown.join(", ")}`);

type Regime = typeof CASES[number]["regime"];
type Visit = { node: HandoffNode; key: LeafKey; event: HandoffNodeEvent };
type Setup = { gaps: Gap[]; ctx: SpecContext };
type Direction =
  | "baseline"
  | "normal_offset_negative"
  | "normal_offset_positive"
  | "entry_pitch_negative"
  | "entry_pitch_positive"
  | "post_pitch_negative"
  | "post_pitch_positive";
type Metrics = {
  impactAbsError: number | null;
  speedAbsError: number | null;
  airAbsError: number | null;
  elevationAbsError: number | null;
  qualityObjective: number | null;
  cost: number;
};
type DeformationRow = {
  attempt: number;
  direction: Direction;
  geometry: {
    incomingAngleDeg: number | null;
    entryAngleDeg: number | null;
    postAngleDeg: number | null;
    postMinusIncomingDeg: number | null;
  };
  available: boolean;
  viable: boolean;
  reason: string | null;
  metrics: Metrics | null;
  delta: {
    impactGain: number | null;
    speedCost: number | null;
    airCost: number | null;
    elevationCost: number | null;
    readinessObjectiveDelta: number | null;
  } | null;
};
type StateRow = {
  caseId: string;
  regime: Regime;
  seed: number;
  checkpointGapIndex: number | null;
  rawViablePrefix: number;
  responseRows: DeformationRow[];
  continuationPairs: ContinuationPair[];
};
type ContinuationSummary = {
  nextGapIndex: number | null;
  viable: number;
  bestQualityObjective: number | null;
};
type ContinuationPair = {
  attempt: number;
  direction: Exclude<Direction, "baseline">;
  base: ContinuationSummary;
  response: ContinuationSummary;
  suffix: { base: SuffixOutcome; response: SuffixOutcome } | null;
};
type SuffixOutcome = {
  valid: boolean;
  score: number;
  hardFailures: string[];
  contactsHit: number;
  contactsMissing: number;
  deepestGap: number | null;
};

const rows: StateRow[] = [];
for (const definition of CASES) {
  const spec = applyJolt(definition.spec, benchmarkPolicy.transform.joltMs);
  const setup = buildSetup(spec, SEED);
  const visits: Visit[] = [];
  let winner: HandoffNode | null = null;
  const started = performance.now();
  compileHandoff(spec, SEED, {
    budget: BUDGET,
    onNode(node, key, event) {
      visits.push({ node, key, event });
      if (event.improved) winner = node;
    },
  });
  if (winner === null) throw new Error(`${definition.id}: full compile produced no best node`);
  const parent = winnerParentAtOneThird(visits, winner, setup.gaps);
  if (parent === null) {
    rows.push({
      caseId: definition.id,
      regime: definition.regime,
      seed: SEED,
      checkpointGapIndex: null,
      rawViablePrefix: 0,
      responseRows: [],
      continuationPairs: [],
    });
    continue;
  }
  const gap = setup.gaps[parent.node.search.gapIndex];
  if (gap === undefined || !gap.endsWithContact) {
    rows.push({
      caseId: definition.id,
      regime: definition.regime,
      seed: SEED,
      checkpointGapIndex: parent.node.search.gapIndex,
      rawViablePrefix: 0,
      responseRows: [],
      continuationPairs: [],
    });
    continue;
  }
  const raw = firstRawViableCandidates(parent.node, gap, setup);
  const evaluations = raw.map((candidate) => evaluateEnvelope(candidate, parent.node, gap, setup));
  const responseRows = evaluations.flatMap((evaluation) => evaluation.rows);
  const continuationPairs = continuation
    ? evaluations.flatMap((evaluation) => continuationPair(evaluation, parent, setup, spec))
    : [];
  rows.push({
    caseId: definition.id,
    regime: definition.regime,
    seed: SEED,
    checkpointGapIndex: parent.node.search.gapIndex,
    rawViablePrefix: raw.length,
    responseRows,
    continuationPairs,
  });
  process.stderr.write(
    `${definition.id}/s${SEED}: g${parent.node.search.gapIndex}, raw=${raw.length}/${RAW_VIABLE_PREFIX}, ` +
    `rows=${responseRows.length}, certificates=${continuationPairs.length} ` +
    `(${((performance.now() - started) / 1000).toFixed(1)}s)\n`,
  );
  (globalThis as { gc?: () => void }).gc?.();
}

const output = {
  schema: "line.study-impact-response-envelope.v1",
  purpose: [
    "Engine-exact local response envelope around fixed ordinary raw normal proposals.",
    "The independent variables are fixed contact-local geometry deformations, not a selector, a source lane, or case-specific tuning.",
    "A result is a physical-basis observation only; V2 remains the sole promotion gate.",
  ],
  frozenConfig: {
    budget: BUDGET,
    seed: SEED,
    joltMs: benchmarkPolicy.transform.joltMs,
    cases: CASES.map(({ id, regime }) => ({ id, regime })),
    checkpoint: "last ordinary ancestor on the full-budget winner prefix at one-third of authored contact boundaries",
    rawNormalPopulation: `first ${RAW_VIABLE_PREFIX} viable candidates in exact raw attempt order within attempts 0..${RAW_ATTEMPTS - 1}`,
    evaluator: "current exact candidate gate with post-fit ride-out polish disabled for every baseline and perturbation",
    continuationCertificate: continuation
      ? "for each strict local response dominator, exact width-8 ordinary pool at the actual next contact from both base and response prefix"
      : null,
    suffixCertificate: suffix
      ? `for each pair passing the one-step certificate, independent equal ${SUFFIX_BUDGET}-frame suffixes from the same child prefix`
      : null,
    basis: {
      normalOffsetPx: [-OFFSET_PX, OFFSET_PX],
      entryPitchDeg: [-PITCH_DEG, PITCH_DEG],
      postPitchDeg: [-PITCH_DEG, PITCH_DEG],
    },
    materialImpactRepair: MATERIAL_IMPACT_REPAIR,
  },
  rows,
  summary: summarize(rows),
};
const json = `${JSON.stringify(output, null, 2)}\n`;
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, json);
process.stdout.write(`${JSON.stringify({ schema: output.schema, output: outPath, summary: output.summary }, null, 2)}\n`);

function firstRawViableCandidates(node: HandoffNode, gap: Gap, setup: Setup): Candidate[] {
  const rngSeed = (Math.imul(node.searchSeed | 0, 1_000_003) + gap.index + 1) | 0;
  const rng = makeRng(rngSeed);
  const candidates: Candidate[] = [];
  for (let attempt = 0; attempt < RAW_ATTEMPTS && candidates.length < RAW_VIABLE_PREFIX; attempt++) {
    const candidate = sampleOneCandidate(
      node.search.prefixEngine,
      gap,
      rng,
      setup.ctx,
      node.search.prefixNextLineId,
      attempt,
    );
    if (candidate !== null) candidates.push(candidate);
  }
  return candidates;
}

function evaluateEnvelope(
  candidate: Candidate,
  node: HandoffNode,
  gap: Gap,
  setup: Setup,
): { rows: DeformationRow[]; baseline: Candidate | null; bestDominator: { direction: Exclude<Direction, "baseline">; candidate: Candidate } | null } {
  const probe = getCandidateProbe(node.search.prefixEngine, gap, setup.ctx);
  const baseline = evaluateLines(candidate.lines, candidate.sampleAttempt ?? -1, node, gap, setup, probe.preTargetSledTrace);
  const contactVertex = nearestInteriorVertex(candidate.lines, probe.targetState.sledX, probe.targetState.sledY);
  const geometry = geometryFrame(candidate.lines, contactVertex, probe.targetState.velocity.x, probe.targetState.velocity.y);
  const rows: DeformationRow[] = [{
    attempt: candidate.sampleAttempt ?? -1,
    direction: "baseline",
    geometry,
    available: true,
    viable: baseline !== null,
    reason: baseline === null ? "baseline did not survive exact no-polish re-evaluation" : null,
    metrics: baseline === null ? null : metrics(baseline, node, gap, setup),
    delta: null,
  }];
  if (baseline === null) return { rows, baseline: null, bestDominator: null };
  const normal = contactNormal(probe.targetState.velocity.x, probe.targetState.velocity.y);
  const variants: Array<{ direction: Exclude<Direction, "baseline">; lines: TrackLine[] | null; reason: string | null }> = [
    {
      direction: "normal_offset_negative",
      lines: normal === null ? null : translate(candidate.lines, -OFFSET_PX * normal.x, -OFFSET_PX * normal.y),
      reason: normal === null ? "incoming velocity has no finite normal" : null,
    },
    {
      direction: "normal_offset_positive",
      lines: normal === null ? null : translate(candidate.lines, OFFSET_PX * normal.x, OFFSET_PX * normal.y),
      reason: normal === null ? "incoming velocity has no finite normal" : null,
    },
    {
      direction: "entry_pitch_negative",
      lines: contactVertex === null ? null : rotateBranch(candidate.lines, contactVertex, -PITCH_DEG, "entry"),
      reason: contactVertex === null ? "could not identify an interior contact vertex" : null,
    },
    {
      direction: "entry_pitch_positive",
      lines: contactVertex === null ? null : rotateBranch(candidate.lines, contactVertex, PITCH_DEG, "entry"),
      reason: contactVertex === null ? "could not identify an interior contact vertex" : null,
    },
    {
      direction: "post_pitch_negative",
      lines: contactVertex === null ? null : rotateBranch(candidate.lines, contactVertex, -PITCH_DEG, "post"),
      reason: contactVertex === null ? "could not identify an interior contact vertex" : null,
    },
    {
      direction: "post_pitch_positive",
      lines: contactVertex === null ? null : rotateBranch(candidate.lines, contactVertex, PITCH_DEG, "post"),
      reason: contactVertex === null ? "could not identify an interior contact vertex" : null,
    },
  ];
  const baseMetrics = metrics(baseline, node, gap, setup);
  const dominators: Array<{ direction: Exclude<Direction, "baseline">; candidate: Candidate; metrics: Metrics }> = [];
  for (const variant of variants) {
    const fit = variant.lines === null
      ? null
      : evaluateLines(variant.lines, candidate.sampleAttempt ?? -1, node, gap, setup, probe.preTargetSledTrace);
    const candidateMetrics = fit === null ? null : metrics(fit, node, gap, setup);
    if (fit !== null && candidateMetrics !== null && dominatesMetrics(baseMetrics, candidateMetrics)) {
      dominators.push({ direction: variant.direction, candidate: fit, metrics: candidateMetrics });
    }
    rows.push({
      attempt: candidate.sampleAttempt ?? -1,
      direction: variant.direction,
      geometry,
      available: variant.lines !== null,
      viable: fit !== null,
      reason: variant.lines === null ? variant.reason : fit === null ? "exact candidate gate rejected deformation" : null,
      metrics: candidateMetrics,
      delta: candidateMetrics === null ? null : deltas(baseMetrics, candidateMetrics),
    });
  }
  const bestDominator = dominators.sort((a, b) =>
    (a.metrics.impactAbsError ?? Infinity) - (b.metrics.impactAbsError ?? Infinity) ||
    (b.metrics.qualityObjective ?? -Infinity) - (a.metrics.qualityObjective ?? -Infinity) ||
    a.metrics.cost - b.metrics.cost
  )[0] ?? null;
  return { rows, baseline, bestDominator };
}

function continuationPair(
  evaluation: ReturnType<typeof evaluateEnvelope>,
  parent: Visit,
  setup: Setup,
  spec: Spec,
): ContinuationPair[] {
  if (evaluation.baseline === null || evaluation.bestDominator === null) return [];
  const pair: ContinuationPair = {
    attempt: evaluation.baseline.sampleAttempt ?? -1,
    direction: evaluation.bestDominator.direction,
    base: nextPool(parent.node, evaluation.baseline, setup),
    response: nextPool(parent.node, evaluation.bestDominator.candidate, setup),
    suffix: null,
  };
  if (suffix && continuationCertifies(pair)) {
    pair.suffix = {
      base: suffixOutcome(parent, evaluation.baseline, spec, setup),
      response: suffixOutcome(parent, evaluation.bestDominator.candidate, spec, setup),
    };
  }
  return [pair];
}

function suffixOutcome(parent: Visit, candidate: Candidate, spec: Spec, setup: Setup): SuffixOutcome {
  const child: HandoffNode = {
    ...parent.node,
    search: extendNodeCached(parent.node.search, candidate),
    deferExpansion: false,
    rankTrace: [...parent.node.rankTrace, { rank: -1, source: "pool" }],
  };
  const checkpoint = compileHandoffFromSnapshot(
    spec,
    SEED,
    snapshotHandoffNode(child, parent.key, parent.event),
    { budget: SUFFIX_BUDGET, searchSeed: parent.node.searchSeed },
  );
  const score = scoreDriftReport(checkpoint.report, { totalFrames: Math.round(spec.duration * FPS) });
  return {
    valid: score.contract_passed,
    score: round(score.score),
    hardFailures: score.hard_failures,
    contactsHit: checkpoint.report.contacts.filter((contact) => contact.status === "hit").length,
    contactsMissing: checkpoint.report.contacts.filter((contact) => contact.status === "missing").length,
    deepestGap: checkpoint.stats.handoff_deepest_seen_gap ?? null,
  };
}

function continuationCertifies(pair: ContinuationPair): boolean {
  return pair.base.nextGapIndex !== null && pair.base.nextGapIndex === pair.response.nextGapIndex &&
    pair.response.viable >= pair.base.viable &&
    pair.base.bestQualityObjective !== null && pair.response.bestQualityObjective !== null &&
    pair.response.bestQualityObjective >= pair.base.bestQualityObjective - 1e-12;
}

function nextPool(node: HandoffNode, candidate: Candidate, setup: Setup): ContinuationSummary {
  const child = extendNodeCached(node.search, candidate);
  const nextGap = setup.gaps[child.gapIndex];
  if (nextGap === undefined || !nextGap.endsWithContact) {
    return { nextGapIndex: null, viable: 0, bestQualityObjective: null };
  }
  const candidates = getCandidatesSorted(child, setup.gaps, setup.ctx, node.searchSeed, 8);
  const objectives = candidates.flatMap((entry) => {
    const objective = candidateQualityObjective(child.prefixEngine, entry, nextGap, setup.gaps, setup.ctx);
    return objective === null ? [] : [objective];
  });
  return {
    nextGapIndex: nextGap.index,
    viable: candidates.length,
    bestQualityObjective: nullableRound(objectives.length === 0 ? null : Math.max(...objectives)),
  };
}

function evaluateLines(
  lines: TrackLine[],
  attempt: number,
  node: HandoffNode,
  gap: Gap,
  setup: Setup,
  preTargetSledTrace: () => number[],
): Candidate | null {
  const fit = tryCandidateLines(
    node.search.prefixEngine,
    gap,
    lines,
    node.search.prefixNextLineId,
    setup.ctx.allContactFrames,
    axisLookaheadEndFrame(gap, setup.ctx.allContactFrames),
    setup.ctx.gapAxisTargets?.[gap.index] ?? gap.targets,
    true,
    "normal",
    preTargetSledTrace,
    { allowRideOutPolish: false },
  ) as Candidate | null;
  if (fit !== null) fit.sampleAttempt = attempt;
  return fit;
}

function metrics(candidate: Candidate, node: HandoffNode, gap: Gap, setup: Setup): Metrics {
  const targets = setup.ctx.gapAxisTargets?.[gap.index] ?? gap.targets;
  const values = candidate.achieved;
  const error = (axis: AxisName): number | null => finite(targets[axis]) && finite(values[axis])
    ? round(Math.abs(values[axis]! - targets[axis]!))
    : null;
  return {
    impactAbsError: error("impact"),
    speedAbsError: error("speed"),
    airAbsError: error("air"),
    elevationAbsError: error("elevation"),
    qualityObjective: nullableRound(candidateQualityObjective(node.search.prefixEngine, candidate, gap, setup.gaps, setup.ctx)),
    cost: round(candidate.cost),
  };
}

function deltas(base: Metrics, next: Metrics): DeformationRow["delta"] {
  const difference = (before: number | null, after: number | null, sign = 1): number | null =>
    before === null || after === null ? null : round(sign * (before - after));
  return {
    impactGain: difference(base.impactAbsError, next.impactAbsError),
    speedCost: difference(base.speedAbsError, next.speedAbsError, -1),
    airCost: difference(base.airAbsError, next.airAbsError, -1),
    elevationCost: difference(base.elevationAbsError, next.elevationAbsError, -1),
    readinessObjectiveDelta: base.qualityObjective === null || next.qualityObjective === null
      ? null
      : round(next.qualityObjective - base.qualityObjective),
  };
}

function dominatesMetrics(base: Metrics, next: Metrics): boolean {
  if (base.impactAbsError === null || next.impactAbsError === null || next.impactAbsError >= base.impactAbsError - 1e-12) return false;
  for (const axis of ["speedAbsError", "airAbsError", "elevationAbsError"] as const) {
    if (base[axis] !== null && next[axis] !== null && next[axis]! > base[axis]! + 1e-12) return false;
  }
  return base.qualityObjective !== null && next.qualityObjective !== null &&
    next.qualityObjective >= base.qualityObjective - 1e-12;
}

function nearestInteriorVertex(lines: readonly TrackLine[], x: number, y: number): number | null {
  const points = polylinePoints(lines);
  if (points === null || points.length < 3) return null;
  let bestIndex = -1;
  let bestDistance = Infinity;
  for (let index = 1; index + 1 < points.length; index++) {
    const point = points[index];
    const distance = Math.hypot(point.x - x, point.y - y);
    if (distance < bestDistance) {
      bestIndex = index;
      bestDistance = distance;
    }
  }
  return bestIndex < 0 ? null : bestIndex;
}

function translate(lines: readonly TrackLine[], dx: number, dy: number): TrackLine[] {
  return lines.map((line) => ({
    ...line,
    x1: line.x1 + dx,
    y1: line.y1 + dy,
    x2: line.x2 + dx,
    y2: line.y2 + dy,
  }));
}

function rotateBranch(
  lines: readonly TrackLine[],
  contactIndex: number,
  deg: number,
  branch: "entry" | "post",
): TrackLine[] | null {
  const points = polylinePoints(lines);
  if (points === null || contactIndex <= 0 || contactIndex + 1 >= points.length) return null;
  const pivot = points[contactIndex];
  const radians = deg * Math.PI / 180;
  const rotated = points.map((point, index) =>
    (branch === "entry" ? index < contactIndex : index > contactIndex)
      ? rotate(point, pivot, radians)
      : point
  );
  return lines.map((line, index) => ({
    ...line,
    x1: rotated[index].x,
    y1: rotated[index].y,
    x2: rotated[index + 1].x,
    y2: rotated[index + 1].y,
  }));
}

function polylinePoints(lines: readonly TrackLine[]): Array<{ x: number; y: number }> | null {
  if (lines.length === 0) return null;
  const points = [{ x: lines[0].x1, y: lines[0].y1 }];
  for (const line of lines) {
    const last = points.at(-1)!;
    if (line.x1 !== last.x || line.y1 !== last.y) return null;
    points.push({ x: line.x2, y: line.y2 });
  }
  return points;
}

function rotate(point: { x: number; y: number }, pivot: { x: number; y: number }, radians: number) {
  const x = point.x - pivot.x;
  const y = point.y - pivot.y;
  return {
    x: pivot.x + x * Math.cos(radians) - y * Math.sin(radians),
    y: pivot.y + x * Math.sin(radians) + y * Math.cos(radians),
  };
}

function contactNormal(vx: number, vy: number): { x: number; y: number } | null {
  const speed = Math.hypot(vx, vy);
  return Number.isFinite(speed) && speed > 1e-9 ? { x: -vy / speed, y: vx / speed } : null;
}

function geometryFrame(
  lines: readonly TrackLine[],
  contactIndex: number | null,
  vx: number,
  vy: number,
): DeformationRow["geometry"] {
  const incomingAngleDeg = Math.hypot(vx, vy) > 1e-9 ? Math.atan2(vy, vx) * 180 / Math.PI : null;
  if (contactIndex === null || contactIndex <= 0 || contactIndex >= lines.length) {
    return { incomingAngleDeg, entryAngleDeg: null, postAngleDeg: null, postMinusIncomingDeg: null };
  }
  const angle = (line: TrackLine): number => Math.atan2(line.y2 - line.y1, line.x2 - line.x1) * 180 / Math.PI;
  const entryAngleDeg = angle(lines[contactIndex - 1]);
  const postAngleDeg = angle(lines[contactIndex]);
  return {
    incomingAngleDeg,
    entryAngleDeg,
    postAngleDeg,
    postMinusIncomingDeg: incomingAngleDeg === null ? null : wrapDegrees(postAngleDeg - incomingAngleDeg),
  };
}

function wrapDegrees(value: number): number {
  return ((value + 180) % 360 + 360) % 360 - 180;
}

function winnerParentAtOneThird(
  visits: readonly Visit[],
  winner: HandoffNode,
  gaps: readonly Gap[],
): Visit | null {
  const contacts = gaps.filter((gap) => gap.endsWithContact).map((gap) => gap.index);
  const target = contacts[Math.floor((contacts.length - 1) / 3)];
  if (target === undefined) return null;
  return visits.filter((visit) =>
    visit.node.skippedContacts === 0 &&
    visit.node.search.gapIndex === target &&
    isPrefix(visit.node.search.prefixFits, winner.search.prefixFits)
  ).at(-1) ?? null;
}

function isPrefix(prefix: readonly (Candidate | null)[], whole: readonly (Candidate | null)[]): boolean {
  return prefix.every((candidate, index) => candidate === whole[index]);
}

function buildSetup(userSpec: Spec, seed: number): Setup {
  const spec: Spec = {
    ...userSpec,
    preroll: undefined,
    contacts: userSpec.contacts.filter((contact) => secToFrame(contact.t) >= 5),
  };
  const allContactFrames = spec.contacts.map((contact) => secToFrame(contact.t)).sort((a, b) => a - b);
  const gaps = sliceTimeline(allContactFrames, secToFrame(spec.duration));
  const gapAxisTargets = gaps.map((gap) => effectiveAxes(gap, spec));
  const rng = makeRng(seed);
  for (const gap of gaps) gap.targets = sampleGapTargets(gapAxisTargets[gap.index], spec.jitter ?? CALIB.SIGMA, rng);
  const impactByFrame = new Map(spec.contacts.flatMap((contact) => contact.impact === undefined
    ? []
    : [[secToFrame(contact.t), contact.impact] as const]));
  for (const gap of gaps) {
    const impact = impactByFrame.get(gap.endFrame);
    if (gap.endsWithContact && impact !== undefined) {
      gap.targets.impact = impact;
      gapAxisTargets[gap.index].impact = impact;
    }
  }
  for (let index = 0; index + 1 < gaps.length; index++) {
    const current = gaps[index];
    const next = gaps[index + 1];
    if (current.endsWithContact && next.endsWithContact && next.targets.impact !== undefined) {
      current.nextImpact = next.targets.impact;
    }
  }
  return { gaps, ctx: { allContactFrames, durationFrames: secToFrame(spec.duration), gapAxisTargets } };
}

function summarize(rows: readonly StateRow[]) {
  const response = rows.flatMap((row) => row.responseRows.filter((entry) => entry.direction !== "baseline"));
  const viable = response.filter((entry) => entry.viable && entry.delta !== null);
  const noSpeedRepair = viable.filter((entry) =>
    entry.delta!.impactGain !== null && entry.delta!.impactGain >= MATERIAL_IMPACT_REPAIR &&
    entry.delta!.speedCost !== null && entry.delta!.speedCost <= 1e-12
  );
  const preservedReadinessRepair = noSpeedRepair.filter((entry) =>
    entry.delta!.readinessObjectiveDelta !== null && entry.delta!.readinessObjectiveDelta >= -1e-12
  );
  const continuationPairs = rows.flatMap((row) => row.continuationPairs);
  const continuationComparable = continuationPairs.filter((pair) =>
    pair.base.nextGapIndex !== null && pair.base.nextGapIndex === pair.response.nextGapIndex
  );
  const continuationCertified = continuationPairs.filter(continuationCertifies);
  const suffixPairs = continuationCertified.flatMap((pair) => pair.suffix === null ? [] : [pair.suffix]);
  const suffixComparable = suffixPairs.filter((pair) => pair.base.valid && pair.response.valid);
  const byDirection = Object.fromEntries(([
    "normal_offset_negative",
    "normal_offset_positive",
    "entry_pitch_negative",
    "entry_pitch_positive",
    "post_pitch_negative",
    "post_pitch_positive",
  ] as const).map((direction) => {
    const entries = viable.filter((entry) => entry.direction === direction);
    return [direction, {
      viable: entries.length,
      materialNoSpeedImpactRepairs: entries.filter((entry) =>
        entry.delta!.impactGain !== null && entry.delta!.impactGain >= MATERIAL_IMPACT_REPAIR &&
        entry.delta!.speedCost !== null && entry.delta!.speedCost <= 1e-12
      ).length,
      impactGainMean: mean(entries.flatMap((entry) => entry.delta!.impactGain === null ? [] : [entry.delta!.impactGain])),
      speedCostMean: mean(entries.flatMap((entry) => entry.delta!.speedCost === null ? [] : [entry.delta!.speedCost])),
      readinessObjectiveDeltaMean: mean(entries.flatMap((entry) =>
        entry.delta!.readinessObjectiveDelta === null ? [] : [entry.delta!.readinessObjectiveDelta]
      )),
    }];
  }));
  return {
    declaredStates: rows.length,
    statesWithRawPrefix: rows.filter((row) => row.rawViablePrefix > 0).length,
    baselineCandidates: rows.reduce((sum, row) => sum + row.responseRows.filter((entry) => entry.direction === "baseline" && entry.viable).length, 0),
    deformationAttempts: response.length,
    viableDeformations: viable.length,
    materialNoSpeedImpactRepairs: noSpeedRepair.length,
    materialNoSpeedImpactRepairsWithNonworseReadiness: preservedReadinessRepair.length,
    continuationCertificate: continuation
      ? {
        pairs: continuationPairs.length,
        comparablePairs: continuationComparable.length,
        responseNoWorseViable: continuationComparable.filter((pair) => pair.response.viable >= pair.base.viable).length,
        responseNoWorseBestObjective: continuationComparable.filter((pair) =>
          pair.base.bestQualityObjective !== null && pair.response.bestQualityObjective !== null &&
          pair.response.bestQualityObjective >= pair.base.bestQualityObjective - 1e-12
        ).length,
        responseNoWorseViableAndBestObjective: continuationCertified.length,
      }
      : null,
    actualSuffixCertificate: suffix
      ? {
        certifiedPairs: suffixPairs.length,
        comparableValidPairs: suffixComparable.length,
        responseScoreGainMean: mean(suffixComparable.map((pair) => pair.response.score - pair.base.score)),
        strictResponseScoreWins: suffixComparable.filter((pair) => pair.response.score > pair.base.score + 1e-12).length,
        validityRegressions: suffixPairs.filter((pair) => pair.base.valid && !pair.response.valid).length,
      }
      : null,
    byDirection,
  };
}

function finite(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value);
}

function nullableRound(value: number | null): number | null {
  return value === null || !Number.isFinite(value) ? null : round(value);
}

function mean(values: readonly number[]): number | null {
  return values.length === 0 ? null : round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
