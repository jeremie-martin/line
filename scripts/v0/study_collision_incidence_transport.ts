/**
 * Observation-only normal-basis study. It transports an exact previous
 * collision incidence into the next contact's normal-coordinate frame.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
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
import { effectiveAxes, sampleGapTargets, sliceTimeline } from "./core/substrate.ts";
import { CALIB, secToFrame, type AxisName, type Gap, type Spec, type TrackLine } from "./types.ts";

const BUDGET = 500_000;
const DISCOVERY_SEED = 34;
const HELD_OUT_SEED = 35;
const RAW_ATTEMPTS = 32;
const CURRENT_VIABLE_PREFIX = 4;
const MIN_RMS_IMPROVEMENT = 0.005;
const CONTACT_ANGLE_ROLL = 1;
const CONTACT_ANGLE_ROLL_SCALE_DEG = 12;
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
  process.stdout.write("Usage: study_collision_incidence_transport.ts --case=ID --seed=34|35 [--out=PATH] | --batch=0|1 [--seed=34|35] | --aggregate [--seed=34|35]\n");
  process.exit(0);
}
const argument = (name: string): string | undefined => argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const caseId = argument("case");
const seed = Number(argument("seed") ?? DISCOVERY_SEED);
const batchArg = argument("batch");
const aggregate = argv.includes("--aggregate");
const unknown = argv.filter((value) => value !== "--aggregate" && !value.startsWith("--case=") && !value.startsWith("--seed=") && !value.startsWith("--batch=") && !value.startsWith("--out="));
if (unknown.length > 0) throw new Error(`unknown argument(s): ${unknown.join(", ")}`);
if (seed !== DISCOVERY_SEED && seed !== HELD_OUT_SEED) throw new Error(`--seed must be ${DISCOVERY_SEED} or ${HELD_OUT_SEED}`);
if (caseId !== undefined && !CASES.some((definition) => definition.id === caseId)) throw new Error(`unknown --case=${caseId}`);
const outPath = argument("out") ?? `generated/studies/collision-incidence-transport/v1/seed-${seed}/result.json`;
if (aggregate) {
  if (caseId !== undefined || batchArg !== undefined) throw new Error("--aggregate accepts neither --case nor --batch");
  aggregateStates(seed, outPath);
  process.exit(0);
}
if (batchArg !== undefined) {
  if (caseId !== undefined) throw new Error("--batch cannot combine with --case");
  const batch = Number(batchArg);
  if (!Number.isSafeInteger(batch) || batch < 0 || batch > 1) throw new Error("--batch must be 0 or 1");
  runBatch(seed, batch, outPath);
  process.exit(0);
}
if (caseId === undefined) throw new Error("require --case, --batch, or --aggregate");

type Regime = typeof CASES[number]["regime"];
type Visit = { node: HandoffNode; event: HandoffNodeEvent };
type Setup = { gaps: Gap[]; ctx: SpecContext };
type RawEntry = { candidate: Candidate; attempt: number; draws: number[]; incidenceDeg: number | null };
type PairMetrics = { rms: number | null; impactAbsError: number | null; activeAxes: number };
type Row = {
  attempt: number;
  incidenceDeg: number | null;
  desiredNextAngleDeg: number | null;
  baseNextAngleDeg: number | null;
  requestedAngleDeltaDeg: number | null;
  appliedRollDelta: number | null;
  direct: { valid: boolean; metrics: PairMetrics | null; frames: number; reason: string | null };
  transported: { valid: boolean; metrics: PairMetrics | null; frames: number; reason: string | null };
};
type State = { caseId: string; regime: Regime; seed: number; checkpointGapIndex: number | null; nextGapIndex: number | null; rawViable: number; rows: Row[] };

const definition = CASES.find((entry) => entry.id === caseId)!;
const started = performance.now();
const state = runCase(definition, seed);
const output = {
  schema: "line.study-collision-incidence-transport.v1",
  purpose: [
    "Test a continuous collision-incidence transport in the next normal contact coordinate frame.",
    "The existing exact candidate gates decide validity; this is not a source lane, selector, or local response-pitch experiment.",
  ],
  frozenConfig: config(seed),
  elapsedMs: round(performance.now() - started),
  rows: [state],
  summary: summarize([state]),
};
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ schema: output.schema, output: outPath, summary: output.summary }, null, 2)}\n`);

function runCase(definition: typeof CASES[number], seed: number): State {
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
  if (winner === null) throw new Error(`${definition.id}/s${seed}: no winner`);
  const parent = winnerParentAtOneThird(visits, winner, setup.gaps);
  if (parent === null) return emptyState(definition, seed, null, null);
  const current = setup.gaps[parent.node.search.gapIndex];
  const next = current === undefined ? undefined : setup.gaps[current.index + 1];
  if (current === undefined || next === undefined || !current.endsWithContact || !next.endsWithContact) return emptyState(definition, seed, current?.index ?? null, next?.index ?? null);
  const raw = captureRaw(parent.node, current, setup);
  const rows = raw.map((entry) => evaluateTransport(parent.node, entry, current, next, setup));
  process.stderr.write(`${definition.id}/s${seed}: g${current.index}->g${next.index}, raw=${raw.length}/${CURRENT_VIABLE_PREFIX}, direct=${rows.filter((row) => row.direct.valid).length}, transported=${rows.filter((row) => row.transported.valid).length}\n`);
  return { caseId: definition.id, regime: definition.regime, seed, checkpointGapIndex: current.index, nextGapIndex: next.index, rawViable: raw.length, rows };
}

function emptyState(definition: typeof CASES[number], seed: number, checkpointGapIndex: number | null, nextGapIndex: number | null): State {
  return { caseId: definition.id, regime: definition.regime, seed, checkpointGapIndex, nextGapIndex, rawViable: 0, rows: [] };
}

function captureRaw(node: HandoffNode, gap: Gap, setup: Setup): RawEntry[] {
  const rng = makeRng((Math.imul(node.searchSeed | 0, 1_000_003) + gap.index + 1) | 0);
  const probe = getCandidateProbe(node.search.prefixEngine, gap, setup.ctx);
  const incomingAngle = angleOf(probe.targetState.velocity.x, probe.targetState.velocity.y);
  const entries: RawEntry[] = [];
  for (let attempt = 0; attempt < RAW_ATTEMPTS && entries.length < CURRENT_VIABLE_PREFIX; attempt++) {
    const draws: number[] = [];
    const observed = observeOneCandidate(node.search.prefixEngine, gap, () => { const value = rng(); draws.push(value); return value; }, setup.ctx, node.search.prefixNextLineId, attempt, "normal", gap.targets, undefined, { allowRideOutPolish: false });
    if (draws.length !== 8) throw new Error(`normal attempt ${attempt} consumed ${draws.length} draws, expected 8`);
    if (observed.fit !== null) {
      const contactAngle = nearestLineAngle(observed.fit.lines, probe.targetState.sledX, probe.targetState.sledY);
      entries.push({ candidate: observed.fit, attempt, draws, incidenceDeg: incomingAngle === null || contactAngle === null ? null : wrapDeg(contactAngle - incomingAngle) });
    }
  }
  return entries;
}

function evaluateTransport(node: HandoffNode, entry: RawEntry, currentGap: Gap, nextGap: Gap, setup: Setup): Row {
  const child = extendNodeCached(node.search, entry.candidate);
  const nextProbe = getCandidateProbe(child.prefixEngine, nextGap, setup.ctx);
  const nextIncomingAngle = angleOf(nextProbe.targetState.velocity.x, nextProbe.targetState.velocity.y);
  const directBefore = getSimFrames();
  const directObserved = sampleFromDraws(child.prefixEngine, child.prefixNextLineId, nextGap, setup, entry.attempt, entry.draws);
  const directFrames = getSimFrames() - directBefore;
  // `observeOneCandidate` exposes a geometry only once its standard gates
  // accept it.  A rejected control therefore cannot define a trustworthy
  // normal-frame incidence to transport.
  const baseNextAngle = directObserved.fit === null ? null : nearestLineAngle(directObserved.fit.lines, nextProbe.targetState.sledX, nextProbe.targetState.sledY);
  const desiredNextAngle = entry.incidenceDeg === null || nextIncomingAngle === null ? null : wrapDeg(nextIncomingAngle + entry.incidenceDeg);
  const requestedAngleDelta = desiredNextAngle === null || baseNextAngle === null ? null : wrapDeg(desiredNextAngle - baseNextAngle);
  const rollDelta = requestedAngleDelta === null ? null : clamp(-0.5, 0.5, requestedAngleDelta / CONTACT_ANGLE_ROLL_SCALE_DEG);
  const transportedDraws = rollDelta === null ? null : entry.draws.map((value, index) => index === CONTACT_ANGLE_ROLL ? clamp(0, 1, value + rollDelta) : value);
  const transportedBefore = getSimFrames();
  const transportedObserved = transportedDraws === null ? null : sampleFromDraws(child.prefixEngine, child.prefixNextLineId, nextGap, setup, entry.attempt, transportedDraws);
  const transportedFrames = getSimFrames() - transportedBefore;
  return {
    attempt: entry.attempt,
    incidenceDeg: nullable(entry.incidenceDeg),
    desiredNextAngleDeg: nullable(desiredNextAngle),
    baseNextAngleDeg: nullable(baseNextAngle),
    requestedAngleDeltaDeg: nullable(requestedAngleDelta),
    appliedRollDelta: nullable(rollDelta),
    direct: { valid: directObserved.fit !== null, metrics: directObserved.fit === null ? null : pairMetrics(entry.candidate, directObserved.fit, currentGap, nextGap), frames: directFrames, reason: directObserved.fit === null ? "exact next normal control rejected" : null },
    transported: { valid: transportedObserved?.fit !== null && transportedObserved !== null, metrics: transportedObserved?.fit === null || transportedObserved === null ? null : pairMetrics(entry.candidate, transportedObserved.fit, currentGap, nextGap), frames: transportedFrames, reason: transportedDraws === null ? "unreadable collision incidence" : transportedObserved?.fit === null ? "exact incidence-transported normal rejected" : null },
  };
}

function sampleFromDraws(engine: unknown, lineIdStart: number, gap: Gap, setup: Setup, attempt: number, draws: readonly number[]) {
  let index = 0;
  const observed = observeOneCandidate(engine, gap, () => {
    if (index >= draws.length) throw new Error("normal coordinate replay requested an undeclared draw");
    return draws[index++];
  }, setup.ctx, lineIdStart, attempt, "normal", gap.targets, undefined, { allowRideOutPolish: false });
  if (index !== draws.length) throw new Error(`normal coordinate replay consumed ${index}/${draws.length} draws`);
  return observed;
}

function nearestLineAngle(lines: readonly TrackLine[], x: number, y: number): number | null {
  let best: TrackLine | null = null;
  let bestDistance = Infinity;
  for (const line of lines) {
    const distance = squaredDistanceToSegment(x, y, line.x1, line.y1, line.x2, line.y2);
    if (distance < bestDistance) { best = line; bestDistance = distance; }
  }
  return best === null ? null : angleOf(best.x2 - best.x1, best.y2 - best.y1);
}

function squaredDistanceToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const denom = dx * dx + dy * dy;
  const t = denom <= 1e-12 ? 0 : clamp(0, 1, ((px - x1) * dx + (py - y1) * dy) / denom);
  const rx = px - (x1 + t * dx);
  const ry = py - (y1 + t * dy);
  return rx * rx + ry * ry;
}

function pairMetrics(current: Candidate, next: Candidate, currentGap: Gap, nextGap: Gap): PairMetrics {
  const first = gapMetrics(current, currentGap);
  const second = gapMetrics(next, nextGap);
  const squares = [...first.errors, ...second.errors].map((value) => value * value);
  const impacts = [first.impactAbsError, second.impactAbsError].filter((value): value is number => value !== null);
  return { rms: squares.length === 0 ? null : round(Math.sqrt(squares.reduce((sum, value) => sum + value, 0) / squares.length)), impactAbsError: impacts.length === 0 ? null : round(impacts.reduce((sum, value) => sum + value, 0) / impacts.length), activeAxes: squares.length };
}

function gapMetrics(candidate: Candidate, gap: Gap): { errors: number[]; impactAbsError: number | null } {
  const achieved = candidate.achievedAtEnd ?? candidate.achieved;
  const errors = (Object.keys(gap.targets) as AxisName[]).flatMap((axis) => finite(gap.targets[axis]) && finite(achieved[axis]) ? [achieved[axis]! - gap.targets[axis]!] : []);
  const impactAbsError = finite(gap.targets.impact) && finite(achieved.impact) ? round(Math.abs(achieved.impact - gap.targets.impact)) : null;
  return { errors, impactAbsError };
}

function winnerParentAtOneThird(visits: readonly Visit[], winner: HandoffNode, gaps: readonly Gap[]): Visit | null {
  const contacts = gaps.filter((gap) => gap.endsWithContact).map((gap) => gap.index);
  const target = contacts[Math.floor((contacts.length - 1) / 3)];
  if (target === undefined) return null;
  return visits.filter((visit) => visit.node.skippedContacts === 0 && visit.node.search.gapIndex === target && isPrefix(visit.node.search.prefixFits, winner.search.prefixFits)).at(-1) ?? null;
}

function isPrefix(prefix: readonly (Candidate | null)[], whole: readonly (Candidate | null)[]): boolean { return prefix.every((candidate, index) => candidate === whole[index]); }

function buildSetup(userSpec: Spec, seed: number): Setup {
  const spec: Spec = { ...userSpec, preroll: undefined, contacts: userSpec.contacts.filter((contact) => secToFrame(contact.t) >= 5) };
  const allContactFrames = spec.contacts.map((contact) => secToFrame(contact.t)).sort((a, b) => a - b);
  const gaps = sliceTimeline(allContactFrames, secToFrame(spec.duration));
  const gapAxisTargets = gaps.map((gap) => effectiveAxes(gap, spec));
  const rng = makeRng(seed);
  for (const gap of gaps) gap.targets = sampleGapTargets(gapAxisTargets[gap.index], spec.jitter ?? CALIB.SIGMA, rng);
  const impacts = new Map(spec.contacts.flatMap((contact) => contact.impact === undefined ? [] : [[secToFrame(contact.t), contact.impact] as const]));
  for (const gap of gaps) {
    const impact = impacts.get(gap.endFrame);
    if (gap.endsWithContact && impact !== undefined) { gap.targets.impact = impact; gapAxisTargets[gap.index].impact = impact; }
  }
  for (let index = 0; index + 1 < gaps.length; index++) if (gaps[index].endsWithContact && gaps[index + 1].endsWithContact && gaps[index + 1].targets.impact !== undefined) gaps[index].nextImpact = gaps[index + 1].targets.impact;
  return { gaps, ctx: { allContactFrames, durationFrames: secToFrame(spec.duration), gapAxisTargets } };
}

function config(seed: number) {
  return { budget: BUDGET, seed, role: seed === DISCOVERY_SEED ? "discovery" : "held-out validation", joltMs: benchmarkPolicy.transform.joltMs, cases: CASES.map(({ id, regime }) => ({ id, regime })), currentPopulation: `first ${CURRENT_VIABLE_PREFIX} viable ordinary fits in attempts 0..${RAW_ATTEMPTS - 1}`, control: "same raw coordinate vector at the next exact child state", transport: "contactAngleRoll += clamp((previousIncidence - nextBaseIncidence) / 12 degrees, -0.5, 0.5)", evaluator: "exact candidate gates with ride-out polish disabled", discard: { minimumMeanComparableRmsImprovement: MIN_RMS_IMPROVEMENT, requiredComparableRegimes: ["dense", "pickup", "low_air"] } };
}

function runBatch(seed: number, batch: number, aggregateOut: string): void {
  const cases = CASES.slice(batch * 3, batch * 3 + 3);
  const stateDir = `${dirname(aggregateOut)}/states`;
  mkdirSync(stateDir, { recursive: true });
  for (const definition of cases) {
    const stateOut = `${stateDir}/${definition.id}-s${seed}.json`;
    execFileSync(process.execPath, ["--expose-gc", "--import", "tsx", process.argv[1], `--case=${definition.id}`, `--seed=${seed}`, `--out=${stateOut}`], { encoding: "utf8", env: { ...process.env, LR_ENGINE: "wasm" }, stdio: ["ignore", "pipe", "inherit"] });
  }
  process.stdout.write(`${JSON.stringify({ schema: "line.study-collision-incidence-transport.v1", seed, batch, states: cases.map((definition) => definition.id) }, null, 2)}\n`);
}

function aggregateStates(seed: number, aggregateOut: string): void {
  const stateDir = `${dirname(aggregateOut)}/states`;
  const states = CASES.map((definition) => {
    const path = `${stateDir}/${definition.id}-s${seed}.json`;
    const document = JSON.parse(readFileSync(path, "utf8")) as { rows: State[] };
    if (document.rows.length !== 1 || document.rows[0].caseId !== definition.id || document.rows[0].seed !== seed) throw new Error(`state artifact ${path} does not match frozen scope`);
    return document.rows[0];
  });
  const output = { schema: "line.study-collision-incidence-transport.v1", purpose: ["Aggregate of sealed memory-isolated collision-incidence transport discovery states."], frozenConfig: config(seed), rows: states, summary: summarize(states) };
  mkdirSync(dirname(aggregateOut), { recursive: true });
  writeFileSync(aggregateOut, `${JSON.stringify(output, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ schema: output.schema, output: aggregateOut, summary: output.summary }, null, 2)}\n`);
}

function summarize(states: readonly State[]) {
  const rows = states.flatMap((state) => state.rows);
  const comparable = rows.filter((row) => row.direct.metrics?.rms != null && row.transported.metrics?.rms != null);
  const byRegime = Object.fromEntries([...new Set(states.map((state) => state.regime))].map((regime) => {
    const entries = states.filter((state) => state.regime === regime).flatMap((state) => state.rows);
    const equal = entries.filter((row) => row.direct.metrics?.rms != null && row.transported.metrics?.rms != null);
    return [regime, { directValid: entries.filter((row) => row.direct.valid).length, transportedValid: entries.filter((row) => row.transported.valid).length, comparable: equal.length, meanRmsImprovement: mean(equal.map((row) => row.direct.metrics!.rms! - row.transported.metrics!.rms!)) }];
  }));
  return { declaredStates: states.length, statesWithRaw: states.filter((state) => state.rawViable > 0).length, rows: rows.length, directValid: rows.filter((row) => row.direct.valid).length, transportedValid: rows.filter((row) => row.transported.valid).length, comparablePairs: comparable.length, meanTwoGapRmsImprovement: mean(comparable.map((row) => row.direct.metrics!.rms! - row.transported.metrics!.rms!)), minimumRequiredMeanImprovement: MIN_RMS_IMPROVEMENT, meanDirectFrames: mean(rows.map((row) => row.direct.frames)), meanTransportedFrames: mean(rows.map((row) => row.transported.frames)), byRegime };
}

function angleOf(x: number, y: number): number | null { return Math.hypot(x, y) > 1e-9 ? Math.atan2(y, x) * 180 / Math.PI : null; }
function wrapDeg(value: number): number { return ((value + 180) % 360 + 360) % 360 - 180; }
function clamp(low: number, high: number, value: number): number { return Math.min(high, Math.max(low, value)); }
function nullable(value: number | null): number | null { return value === null || !Number.isFinite(value) ? null : round(value); }
function finite(value: number | undefined): value is number { return value !== undefined && Number.isFinite(value); }
function mean(values: readonly number[]): number | null { return values.length === 0 ? null : round(values.reduce((sum, value) => sum + value, 0) / values.length); }
function round(value: number): number { return Math.round(value * 1_000_000) / 1_000_000; }
