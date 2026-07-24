/**
 * Feasibility assay for a state-realized bridge between two ordinary normal
 * contacts. This is observation-only: it never changes compiler selection.
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
import { compileHandoff, type HandoffNode, type HandoffNodeEvent } from "./optimizer/handoff.ts";
import { extendNodeCached } from "./optimizer/node.ts";
import { getSimFrames } from "./optimizer/sim_frames.ts";
import { getCandidateProbe, observeOneCandidate, type Candidate, type SpecContext } from "./optimizer/sample.ts";
import { axisLookaheadEndFrame, tryCandidateLines } from "./core/candidate.ts";
import { effectiveAxes, engineLineFromTrackLine, sampleGapTargets, sliceTimeline } from "./core/substrate.ts";
import { CALIB, secToFrame, type AxisName, type Gap, type Spec, type TrackLine } from "./types.ts";

const CASES = [
  { id: "frontier_dense_recovery", regime: "dense", spec: dense },
  { id: "dense_dialogue_impact_contrast_10", regime: "dense", spec: denseDialogueImpact },
  { id: "countercurrent", regime: "representative", spec: countercurrent },
  { id: "believer_56_6s", regime: "development_music", spec: believer },
  { id: "frontier_low_air_endurance_4s", regime: "low_air", spec: lowAir },
  { id: "offgrid_conversation", regime: "pickup", spec: offgrid },
] as const satisfies readonly { id: string; regime: string; spec: Spec }[];

const argv = process.argv.slice(2);
if (argv.includes("--help") || argv.includes("-h")) {
  process.stdout.write("Usage: study_joint_normal_bridge.ts [--out=PATH] [--case=ID ...] [--early-compound]\n");
  process.exit(0);
}
const argument = (name: string): string | undefined =>
  argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const argumentsOf = (name: string): string[] =>
  argv.filter((value) => value.startsWith(`--${name}=`)).map((value) => value.slice(name.length + 3));
const EARLY_COMPOUND = argv.includes("--early-compound");
const selectedCases = argumentsOf("case");
const unknown = argv.filter((value) => value !== "--early-compound" && !value.startsWith("--out=") && !value.startsWith("--case="));
if (unknown.length > 0) throw new Error(`unknown argument(s): ${unknown.join(", ")}`);
const BUDGET = EARLY_COMPOUND ? 500_000 : 250_000;
const SEEDS = EARLY_COMPOUND ? [40, 41] as const : [30, 31] as const;
const RAW_ATTEMPTS = 32;
const CURRENT_VIABLE_PREFIX = 4;
const NEXT_ATTEMPTS = 8;
const BRIDGE_SEGMENTS = 3;
const MIN_RMS_IMPROVEMENT = 0.005;
const outPath = argument("out") ?? (EARLY_COMPOUND
  ? "generated/studies/joint-normal-compound/v1/result.json"
  : "generated/studies/joint-normal-bridge/v1/result.json");
if (selectedCases.some((id) => !CASES.some((definition) => definition.id === id))) {
  throw new Error(`unknown --case: ${selectedCases.filter((id) => !CASES.some((definition) => definition.id === id)).join(", ")}`);
}
const ACTIVE_CASES = selectedCases.length === 0 ? CASES : CASES.filter((definition) => selectedCases.includes(definition.id));

type Regime = typeof CASES[number]["regime"];
type Visit = { node: HandoffNode; event: HandoffNodeEvent };
type Setup = { gaps: Gap[]; ctx: SpecContext };
type PairMetrics = { rms: number | null; impactAbsError: number | null; activeAxes: number };
type BridgeGeometry = {
  available: boolean;
  reason: string | null;
  chordPx: number | null;
  tangentPx: number | null;
  lines: TrackLine[] | null;
};
type PairRow = {
  currentAttempt: number;
  nextAttempt: number | null;
  direct: { available: boolean; metrics: PairMetrics | null; reason: string | null };
  bridge: { geometry: BridgeGeometry; valid: boolean; metrics: PairMetrics | null; frames: number; reason: string | null };
  compound?: {
    currentValid: boolean;
    currentAxesExact: boolean;
    metrics: PairMetrics | null;
    returnAttempt: number | null;
    returnValid: boolean;
    earlyFrames: number;
    returnFrames: number;
    reason: string | null;
  };
};
type StateRow = {
  caseId: string;
  regime: Regime;
  seed: number;
  checkpointGapIndex: number | null;
  nextGapIndex: number | null;
  currentRawViable: number;
  rows: PairRow[];
};

const started = performance.now();
const rows: StateRow[] = [];
for (const seed of SEEDS) {
  for (const definition of ACTIVE_CASES) {
    rows.push(runCase(definition, seed));
    (globalThis as { gc?: () => void }).gc?.();
  }
}
const output = {
  schema: EARLY_COMPOUND ? "line.study-joint-normal-compound.v1" : "line.study-joint-normal-bridge.v1",
  purpose: EARLY_COMPOUND
    ? [
      "Test whether two sequentially engine-admitted ordinary normal fits remain exact when the next fit is materialized with the current fit.",
      "This is an observation-only admission and normal-return assay; it changes no candidate source, traversal, selector, ranker, or V2 decision.",
    ]
    : [
      "Test one endpoint/tangent-derived bridge between two sequentially engine-admitted ordinary normal contacts.",
      "No source-default behavior, selector, ranker, response-pitch family, or V2 decision is changed.",
    ],
  frozenConfig: {
    budget: BUDGET,
    seeds: SEEDS,
    joltMs: benchmarkPolicy.transform.joltMs,
    cases: ACTIVE_CASES.map(({ id, regime }) => ({ id, regime })),
    checkpoint: "last ordinary winner ancestor at one-third of authored contact boundaries",
    currentPopulation: `first ${CURRENT_VIABLE_PREFIX} viable ordinary fits in raw attempts 0..${RAW_ATTEMPTS - 1}`,
    nextPopulation: `first viable ordinary fit in a fixed ${NEXT_ATTEMPTS}-attempt stream`,
    ...(EARLY_COMPOUND
      ? {
        compound: "current ordinary fit plus the first viable next ordinary fit from its exact child state, materialized as one immutable line-set at the current contact",
        return: "fixed eight-attempt ordinary-normal stream at the third contact from the full compound engine; diagnostic only and never a source selection",
      }
      : { bridge: "three-segment cubic Hermite polyline from exact normal endpoints and tangents; tangent extent is continuous in release speed, literal inter-contact frames, and endpoint chord" }),
    evaluator: "existing exact next-contact gate, uniformly with ride-out polish disabled",
    discard: {
      minimumMeanComparableRmsImprovement: MIN_RMS_IMPROVEMENT,
      requiredComparableRegimes: ["dense", "pickup", "low_air"],
      perSeedBroadAvailability: "a material share of every six-regime panel must be bridge-valid",
    },
  },
  elapsedMs: round(performance.now() - started),
  rows,
  summary: summarize(rows),
};
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ schema: output.schema, output: outPath, summary: output.summary }, null, 2)}\n`);

function runCase(definition: typeof CASES[number], seed: number): StateRow {
  const spec = applyJolt(definition.spec, benchmarkPolicy.transform.joltMs);
  const setup = buildSetup(spec, seed);
  const visits: Visit[] = [];
  let winner: HandoffNode | null = null;
  compileHandoff(spec, seed, {
    budget: BUDGET,
    onNode(node, _key, event) {
      visits.push({ node, event });
      if (event.improved) winner = node;
    },
  });
  if (winner === null) throw new Error(`${definition.id}/s${seed}: compile produced no winner`);
  const parent = winnerParentAtOneThird(visits, winner, setup.gaps);
  if (parent === null) return emptyState(definition, seed, null, null);
  const current = setup.gaps[parent.node.search.gapIndex];
  const next = current === undefined ? undefined : setup.gaps[current.index + 1];
  if (current === undefined || next === undefined || !current.endsWithContact || !next.endsWithContact) {
    return emptyState(definition, seed, current?.index ?? null, next?.index ?? null);
  }
  const candidates = firstRawViableCandidates(parent.node, current, setup);
  const pairRows = candidates.map((candidate) => evaluatePair(parent.node, candidate, current, next, setup));
  process.stderr.write(
    `${definition.id}/s${seed}: g${current.index}->g${next.index}, current=${candidates.length}/${CURRENT_VIABLE_PREFIX}, ` +
    `direct=${pairRows.filter((row) => row.direct.available).length}, bridge=${pairRows.filter((row) => row.bridge.valid).length}\n`,
  );
  return {
    caseId: definition.id,
    regime: definition.regime,
    seed,
    checkpointGapIndex: current.index,
    nextGapIndex: next.index,
    currentRawViable: candidates.length,
    rows: pairRows,
  };
}

function emptyState(
  definition: typeof CASES[number],
  seed: number,
  checkpointGapIndex: number | null,
  nextGapIndex: number | null,
): StateRow {
  return { caseId: definition.id, regime: definition.regime, seed, checkpointGapIndex, nextGapIndex, currentRawViable: 0, rows: [] };
}

function evaluatePair(node: HandoffNode, current: Candidate, currentGap: Gap, nextGap: Gap, setup: Setup): PairRow {
  const child = extendNodeCached(node.search, current);
  const next = firstViableNext(child.prefixEngine, child.prefixNextLineId, nextGap, setup, node.searchSeed, current.sampleAttempt ?? -1);
  if (next === null) {
    const reason = "no viable next ordinary fit in fixed stream";
    return {
      currentAttempt: current.sampleAttempt ?? -1,
      nextAttempt: null,
      direct: { available: false, metrics: null, reason },
      bridge: { geometry: unavailableBridge(reason), valid: false, metrics: null, frames: 0, reason },
    };
  }
  if (EARLY_COMPOUND) return evaluateEarlyCompound(node, current, next, currentGap, nextGap, setup);
  const bridge = buildBridge(current, next, currentGap, nextGap, child.prefixNextLineId);
  if (bridge.lines === null) {
    return {
      currentAttempt: current.sampleAttempt ?? -1,
      nextAttempt: next.sampleAttempt ?? null,
      direct: { available: true, metrics: pairMetrics(current, next, currentGap, nextGap), reason: null },
      bridge: { geometry: bridge, valid: false, metrics: null, frames: 0, reason: bridge.reason },
    };
  }
  const before = getSimFrames();
  const bridgeFit = evaluateBridgeNext(child.prefixEngine, child.prefixNextLineId, nextGap, setup, bridge.lines);
  const frames = getSimFrames() - before;
  return {
    currentAttempt: current.sampleAttempt ?? -1,
    nextAttempt: next.sampleAttempt ?? null,
    direct: { available: true, metrics: pairMetrics(current, next, currentGap, nextGap), reason: null },
    bridge: {
      geometry: bridge,
      valid: bridgeFit !== null,
      metrics: bridgeFit === null ? null : pairMetrics(current, bridgeFit, currentGap, nextGap),
      frames,
      reason: bridgeFit === null ? "exact next-contact gate rejected bridge plus normal entry" : null,
    },
  };
}

/**
 * The direct-pair control already admits `next` against an engine containing
 * `current`. The only untested physical fact is whether exposing that exact
 * next surface from the current proposal changes the earlier collision. This
 * check keeps the complete line set identical in both gate observations.
 */
function evaluateEarlyCompound(
  node: HandoffNode,
  current: Candidate,
  next: Candidate,
  currentGap: Gap,
  nextGap: Gap,
  setup: Setup,
): PairRow {
  const lines = [...current.lines, ...next.lines];
  const ids = new Set(lines.map((line) => line.id));
  if (ids.size !== lines.length) throw new Error("compound normal pair has duplicate line ids");
  const beforeEarly = getSimFrames();
  const early = tryCandidateLines(
    node.search.prefixEngine,
    currentGap,
    lines,
    node.search.prefixNextLineId,
    setup.ctx.allContactFrames,
    axisLookaheadEndFrame(currentGap, setup.ctx.allContactFrames),
    setup.ctx.gapAxisTargets?.[currentGap.index] ?? currentGap.targets,
    true,
    "normal",
    getCandidateProbe(node.search.prefixEngine, currentGap, setup.ctx).preTargetSledTrace,
    { allowRideOutPolish: false },
  ) as Candidate | null;
  const earlyFrames = getSimFrames() - beforeEarly;
  const axesExact = early !== null && sameGapAxes(current, early, currentGap);
  const thirdGap = setup.gaps[nextGap.index + 1];
  let returnAttempt: number | null = null;
  let returnValid = false;
  let returnFrames = 0;
  if (early !== null && thirdGap?.endsWithContact) {
    const fullEngine = node.search.prefixEngine.addLine(lines.map((line) => engineLineFromTrackLine(line)));
    const beforeReturn = getSimFrames();
    const returned = firstViableReturn(
      fullEngine,
      node.search.prefixNextLineId + lines.length,
      thirdGap,
      setup,
      node.searchSeed,
      current.sampleAttempt ?? -1,
      next.sampleAttempt ?? -1,
    );
    returnFrames = getSimFrames() - beforeReturn;
    returnAttempt = returned?.sampleAttempt ?? null;
    returnValid = returned !== null;
  }
  const reason = early === null
    ? "early materialization changed the current exact contact gate"
    : thirdGap === undefined || !thirdGap.endsWithContact
    ? "no third authored contact for normal-return diagnostic"
    : returnValid ? null : "no viable third-contact normal fit in fixed return stream";
  return {
    currentAttempt: current.sampleAttempt ?? -1,
    nextAttempt: next.sampleAttempt ?? null,
    direct: { available: true, metrics: pairMetrics(current, next, currentGap, nextGap), reason: null },
    bridge: { geometry: unavailableBridge("not evaluated in early-compound mode"), valid: false, metrics: null, frames: 0, reason: "not evaluated in early-compound mode" },
    compound: {
      currentValid: early !== null,
      currentAxesExact: axesExact,
      metrics: early === null ? null : pairMetrics(early, next, currentGap, nextGap),
      returnAttempt,
      returnValid,
      earlyFrames,
      returnFrames,
      reason,
    },
  };
}

function firstViableReturn(
  engine: unknown,
  lineIdStart: number,
  gap: Gap,
  setup: Setup,
  searchSeed: number,
  currentAttempt: number,
  nextAttempt: number,
): Candidate | null {
  const rng = makeRng(
    (Math.imul(searchSeed | 0, 1_000_037) + Math.imul(gap.index + 1, 65_537) + Math.imul(currentAttempt + 1, 257) + nextAttempt) | 0,
  );
  for (let attempt = 0; attempt < NEXT_ATTEMPTS; attempt++) {
    const observed = observeOneCandidate(
      engine, gap, rng, setup.ctx, lineIdStart, attempt, "normal", gap.targets, undefined, { allowRideOutPolish: false },
    );
    if (observed.fit !== null) return observed.fit;
  }
  return null;
}

function sameGapAxes(left: Candidate, right: Candidate, gap: Gap): boolean {
  const leftAchieved = left.achieved;
  const rightAchieved = right.achieved;
  return (Object.keys(gap.targets) as AxisName[]).every((axis) => {
    const a = leftAchieved[axis];
    const b = rightAchieved[axis];
    return a === undefined || b === undefined ? a === b : Math.abs(a - b) <= 1e-9;
  });
}

function firstRawViableCandidates(node: HandoffNode, gap: Gap, setup: Setup): Candidate[] {
  const rng = makeRng((Math.imul(node.searchSeed | 0, 1_000_003) + gap.index + 1) | 0);
  const candidates: Candidate[] = [];
  for (let attempt = 0; attempt < RAW_ATTEMPTS && candidates.length < CURRENT_VIABLE_PREFIX; attempt++) {
    const observed = observeOneCandidate(
      node.search.prefixEngine, gap, rng, setup.ctx, node.search.prefixNextLineId, attempt, "normal", gap.targets,
      undefined, { allowRideOutPolish: false },
    );
    if (observed.fit !== null) candidates.push(observed.fit);
  }
  return candidates;
}

function firstViableNext(
  engine: unknown,
  lineIdStart: number,
  gap: Gap,
  setup: Setup,
  searchSeed: number,
  currentAttempt: number,
): Candidate | null {
  const rng = makeRng((Math.imul(searchSeed | 0, 1_000_033) + Math.imul(gap.index + 1, 65_537) + currentAttempt) | 0);
  for (let attempt = 0; attempt < NEXT_ATTEMPTS; attempt++) {
    const observed = observeOneCandidate(
      engine, gap, rng, setup.ctx, lineIdStart, attempt, "normal", gap.targets, undefined, { allowRideOutPolish: false },
    );
    if (observed.fit !== null) return observed.fit;
  }
  return null;
}

function evaluateBridgeNext(engine: unknown, lineIdStart: number, gap: Gap, setup: Setup, lines: TrackLine[]): Candidate | null {
  const probe = getCandidateProbe(engine, gap, setup.ctx);
  return tryCandidateLines(
    engine, gap, lines, lineIdStart, setup.ctx.allContactFrames,
    axisLookaheadEndFrame(gap, setup.ctx.allContactFrames), setup.ctx.gapAxisTargets?.[gap.index] ?? gap.targets,
    true, "normal", probe.preTargetSledTrace, { allowRideOutPolish: false },
  ) as Candidate | null;
}

function buildBridge(current: Candidate, next: Candidate, currentGap: Gap, nextGap: Gap, lineIdStart: number): BridgeGeometry {
  const last = current.lines.at(-1);
  const first = next.lines[0];
  if (last === undefined || first === undefined) return unavailableBridge("ordinary geometry has no terminal or entry segment");
  const start = { x: last.x2, y: last.y2 };
  const end = { x: first.x1, y: first.y1 };
  const chord = Math.hypot(end.x - start.x, end.y - start.y);
  const outbound = unit(last.x2 - last.x1, last.y2 - last.y1);
  const inbound = unit(first.x2 - first.x1, first.y2 - first.y1);
  if (!Number.isFinite(chord) || chord < 1e-6 || outbound === null || inbound === null) {
    return unavailableBridge("normal endpoints have a degenerate chord or tangent");
  }
  const frames = nextGap.endFrame - currentGap.endFrame;
  const releaseDistance = Math.max(0, current.releaseSpeed ?? 0) * Math.max(1, frames);
  const tangent = clamp(chord * 0.2, chord * 0.8, releaseDistance / 3);
  const p1 = { x: start.x + outbound.x * tangent, y: start.y + outbound.y * tangent };
  const p2 = { x: end.x - inbound.x * tangent, y: end.y - inbound.y * tangent };
  const points = [start];
  for (let index = 1; index <= BRIDGE_SEGMENTS; index++) points.push(cubicPoint(start, p1, p2, end, index / BRIDGE_SEGMENTS));
  const bridge = points.slice(1).map((point, index): TrackLine => ({
    id: lineIdStart + index,
    type: 0,
    x1: points[index].x,
    y1: points[index].y,
    x2: point.x,
    y2: point.y,
    flipped: false,
    leftExtended: false,
    rightExtended: false,
  }));
  const shiftedNext = next.lines.map((line, index) => ({ ...line, id: lineIdStart + bridge.length + index }));
  return { available: true, reason: null, chordPx: round(chord), tangentPx: round(tangent), lines: [...bridge, ...shiftedNext] };
}

function unavailableBridge(reason: string): BridgeGeometry {
  return { available: false, reason, chordPx: null, tangentPx: null, lines: null };
}

function cubicPoint(
  p0: { x: number; y: number }, p1: { x: number; y: number }, p2: { x: number; y: number }, p3: { x: number; y: number }, t: number,
): { x: number; y: number } {
  const u = 1 - t;
  return {
    x: u ** 3 * p0.x + 3 * u ** 2 * t * p1.x + 3 * u * t ** 2 * p2.x + t ** 3 * p3.x,
    y: u ** 3 * p0.y + 3 * u ** 2 * t * p1.y + 3 * u * t ** 2 * p2.y + t ** 3 * p3.y,
  };
}

function unit(x: number, y: number): { x: number; y: number } | null {
  const length = Math.hypot(x, y);
  return Number.isFinite(length) && length > 1e-9 ? { x: x / length, y: y / length } : null;
}

function pairMetrics(current: Candidate, next: Candidate, currentGap: Gap, nextGap: Gap): PairMetrics {
  const first = gapMetrics(current, currentGap);
  const second = gapMetrics(next, nextGap);
  const squares = [...first.errors, ...second.errors].map((value) => value * value);
  const impacts = [first.impactAbsError, second.impactAbsError].filter((value): value is number => value !== null);
  return {
    rms: squares.length === 0 ? null : round(Math.sqrt(squares.reduce((sum, value) => sum + value, 0) / squares.length)),
    impactAbsError: impacts.length === 0 ? null : round(impacts.reduce((sum, value) => sum + value, 0) / impacts.length),
    activeAxes: squares.length,
  };
}

function gapMetrics(candidate: Candidate, gap: Gap): { errors: number[]; impactAbsError: number | null } {
  const achieved = candidate.achieved;
  const errors = (Object.keys(gap.targets) as AxisName[]).flatMap((axis) =>
    finite(gap.targets[axis]) && finite(achieved[axis]) ? [achieved[axis]! - gap.targets[axis]!] : []
  );
  const impactAbsError = finite(gap.targets.impact) && finite(achieved.impact)
    ? round(Math.abs(achieved.impact - gap.targets.impact))
    : null;
  return { errors, impactAbsError };
}

function winnerParentAtOneThird(visits: readonly Visit[], winner: HandoffNode, gaps: readonly Gap[]): Visit | null {
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
  const spec: Spec = { ...userSpec, preroll: undefined, contacts: userSpec.contacts.filter((contact) => secToFrame(contact.t) >= 5) };
  const allContactFrames = spec.contacts.map((contact) => secToFrame(contact.t)).sort((a, b) => a - b);
  const gaps = sliceTimeline(allContactFrames, secToFrame(spec.duration));
  const gapAxisTargets = gaps.map((gap) => effectiveAxes(gap, spec));
  const rng = makeRng(seed);
  for (const gap of gaps) gap.targets = sampleGapTargets(gapAxisTargets[gap.index], spec.jitter ?? CALIB.SIGMA, rng);
  const impactByFrame = new Map(spec.contacts.flatMap((contact) => contact.impact === undefined ? [] : [[secToFrame(contact.t), contact.impact] as const]));
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
    if (current.endsWithContact && next.endsWithContact && next.targets.impact !== undefined) current.nextImpact = next.targets.impact;
  }
  return { gaps, ctx: { allContactFrames, durationFrames: secToFrame(spec.duration), gapAxisTargets } };
}

function summarize(states: readonly StateRow[]) {
  const pairs = states.flatMap((state) => state.rows);
  if (EARLY_COMPOUND) return summarizeEarlyCompound(states, pairs);
  const comparable = pairs.filter((row) => row.direct.metrics?.rms != null && row.bridge.metrics?.rms != null);
  const rmsImprovements = comparable.map((row) => row.direct.metrics!.rms! - row.bridge.metrics!.rms!);
  const byRegime = Object.fromEntries([...new Set(states.map((state) => state.regime))].map((regime) => {
    const regimeRows = states.filter((state) => state.regime === regime).flatMap((state) => state.rows);
    const regimeComparable = regimeRows.filter((row) => row.direct.metrics?.rms != null && row.bridge.metrics?.rms != null);
    return [regime, {
      direct: regimeRows.filter((row) => row.direct.available).length,
      bridgeGeometry: regimeRows.filter((row) => row.bridge.geometry.available).length,
      bridgeValid: regimeRows.filter((row) => row.bridge.valid).length,
      comparable: regimeComparable.length,
      meanRmsImprovement: mean(regimeComparable.map((row) => row.direct.metrics!.rms! - row.bridge.metrics!.rms!)),
    }];
  }));
  const bySeed = Object.fromEntries(SEEDS.map((seed) => {
    const seedRows = states.filter((state) => state.seed === seed).flatMap((state) => state.rows);
    return [seed, {
      direct: seedRows.filter((row) => row.direct.available).length,
      bridgeGeometry: seedRows.filter((row) => row.bridge.geometry.available).length,
      bridgeValid: seedRows.filter((row) => row.bridge.valid).length,
      comparable: seedRows.filter((row) => row.direct.metrics?.rms != null && row.bridge.metrics?.rms != null).length,
    }];
  }));
  return {
    declaredStates: states.length,
    statesWithCurrentRaw: states.filter((state) => state.currentRawViable > 0).length,
    pairs: pairs.length,
    directPairs: pairs.filter((row) => row.direct.available).length,
    bridgeGeometryAvailable: pairs.filter((row) => row.bridge.geometry.available).length,
    bridgeValid: pairs.filter((row) => row.bridge.valid).length,
    comparablePairs: comparable.length,
    meanTwoGapRmsImprovement: mean(rmsImprovements),
    minimumRequiredMeanImprovement: MIN_RMS_IMPROVEMENT,
    meanAdditionalBridgeFrames: mean(pairs.filter((row) => row.bridge.valid).map((row) => row.bridge.frames)),
    bySeed,
    byRegime,
  };
}

function summarizeEarlyCompound(states: readonly StateRow[], pairs: readonly PairRow[]) {
  const compounds = pairs.map((pair) => pair.compound).filter((compound): compound is NonNullable<PairRow["compound"]> => compound !== undefined);
  const comparable = pairs.filter((pair) => pair.direct.metrics?.rms != null && pair.compound?.metrics?.rms != null);
  const improvements = comparable.map((pair) => pair.direct.metrics!.rms! - pair.compound!.metrics!.rms!);
  const byRegime = Object.fromEntries([...new Set(states.map((state) => state.regime))].map((regime) => {
    const regimePairs = states.filter((state) => state.regime === regime).flatMap((state) => state.rows);
    const regimeCompounds = regimePairs.map((pair) => pair.compound).filter((compound): compound is NonNullable<PairRow["compound"]> => compound !== undefined);
    return [regime, {
      direct: regimePairs.filter((pair) => pair.direct.available).length,
      earlyCurrentValid: regimeCompounds.filter((compound) => compound.currentValid).length,
      earlyCurrentAxesExact: regimeCompounds.filter((compound) => compound.currentAxesExact).length,
      normalReturn: regimeCompounds.filter((compound) => compound.returnValid).length,
      comparable: regimePairs.filter((pair) => pair.direct.metrics?.rms != null && pair.compound?.metrics?.rms != null).length,
      meanTwoGapRmsImprovement: mean(regimePairs.flatMap((pair) =>
        pair.direct.metrics?.rms != null && pair.compound?.metrics?.rms != null ? [pair.direct.metrics.rms - pair.compound.metrics.rms] : [],
      )),
    }];
  }));
  return {
    declaredStates: states.length,
    statesWithCurrentRaw: states.filter((state) => state.currentRawViable > 0).length,
    pairs: pairs.length,
    directPairs: pairs.filter((pair) => pair.direct.available).length,
    earlyCurrentValid: compounds.filter((compound) => compound.currentValid).length,
    earlyCurrentAxesExact: compounds.filter((compound) => compound.currentAxesExact).length,
    normalReturn: compounds.filter((compound) => compound.returnValid).length,
    comparablePairs: comparable.length,
    meanTwoGapRmsImprovement: mean(improvements),
    meanEarlyFrames: mean(compounds.map((compound) => compound.earlyFrames)),
    meanReturnFrames: mean(compounds.map((compound) => compound.returnFrames)),
    byRegime,
  };
}

function clamp(low: number, high: number, value: number): number {
  return Math.min(high, Math.max(low, value));
}

function finite(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value);
}

function mean(values: readonly number[]): number | null {
  return values.length === 0 ? null : round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
