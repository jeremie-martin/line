/**
 * Observation-only two-contact basis study. It interpolates the normal
 * sampler's raw coordinate vectors, never terrain lines or response pitches.
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
import { observeOneCandidate, type Candidate, type SpecContext } from "./optimizer/sample.ts";
import { effectiveAxes, sampleGapTargets, sliceTimeline } from "./core/substrate.ts";
import { CALIB, secToFrame, type AxisName, type Gap, type Spec } from "./types.ts";

const BUDGET = 500_000;
const ALL_SEEDS = [32, 33] as const;
const RAW_ATTEMPTS = 32;
const CURRENT_VIABLE_PREFIX = 8;
const MIN_RMS_IMPROVEMENT = 0.005;
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
  process.stdout.write("Usage: study_joint_normal_coordinate_interpolation.ts [--case=ID --seed=32|33 --out=PATH] [--batch=0|1|2] [--aggregate]\n");
  process.exit(0);
}
const argument = (name: string): string | undefined =>
  argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const batchArg = argument("batch");
const aggregateOnly = argv.includes("--aggregate");
const selectedSeed = argument("seed") === undefined ? undefined : Number(argument("seed"));
const selectedCase = argument("case");
const unknown = argv.filter((value) =>
  value !== "--aggregate" && !value.startsWith("--out=") && !value.startsWith("--seed=") && !value.startsWith("--case=") && !value.startsWith("--batch=")
);
if (unknown.length > 0) throw new Error(`unknown argument(s): ${unknown.join(", ")}`);
const outPath = argument("out") ?? "generated/studies/joint-normal-coordinate-interpolation/v1/result.json";
if (selectedSeed !== undefined && !(ALL_SEEDS as readonly number[]).includes(selectedSeed)) {
  throw new Error(`--seed must be one of ${ALL_SEEDS.join(", ")}`);
}
if (selectedCase !== undefined && !CASES.some((definition) => definition.id === selectedCase)) {
  throw new Error(`unknown --case=${selectedCase}`);
}
const SEEDS = selectedSeed === undefined ? ALL_SEEDS : [selectedSeed];
const ACTIVE_CASES = selectedCase === undefined ? CASES : CASES.filter((definition) => definition.id === selectedCase);
if (aggregateOnly) {
  if (batchArg !== undefined || selectedSeed !== undefined || selectedCase !== undefined) throw new Error("--aggregate accepts no --batch, --seed, or --case");
  aggregateStateArtifacts(outPath);
  process.exit(0);
}
if (batchArg !== undefined) {
  if (selectedSeed !== undefined || selectedCase !== undefined) throw new Error("--batch cannot combine with --seed or --case");
  const batch = Number(batchArg);
  if (!Number.isSafeInteger(batch) || batch < 0 || batch > 2) throw new Error("--batch must be 0, 1, or 2");
  runBatch(batch, outPath);
  process.exit(0);
}

type Regime = typeof CASES[number]["regime"];
type Visit = { node: HandoffNode; event: HandoffNodeEvent };
type Setup = { gaps: Gap[]; ctx: SpecContext };
type RawEntry = { candidate: Candidate; attempt: number; draws: number[] };
type PairMetrics = { rms: number | null; impactAbsError: number | null; activeAxes: number };
type PairRow = {
  leftAttempt: number;
  rightAttempt: number;
  rawDraws: number;
  direct: { valid: boolean; metrics: PairMetrics | null; frames: number; reason: string | null };
  midpoint: { valid: boolean; metrics: PairMetrics | null; frames: number; reason: string | null };
};
type StateRow = {
  caseId: string;
  regime: Regime;
  seed: number;
  checkpointGapIndex: number | null;
  nextGapIndex: number | null;
  rawViable: number;
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
  schema: "line.study-joint-normal-coordinate-interpolation.v1",
  purpose: [
    "Test a two-contact midpoint basis over the normal sampler's own continuous raw coordinates.",
    "The control and midpoint use identical normal geometry machinery, exact gates, and no score-selected coordinate choice.",
  ],
  frozenConfig: {
    budget: BUDGET,
    seeds: SEEDS,
    joltMs: benchmarkPolicy.transform.joltMs,
    cases: CASES.map(({ id, regime }) => ({ id, regime })),
    checkpoint: "last ordinary winner ancestor at one-third of authored contacts",
    currentPopulation: `first ${CURRENT_VIABLE_PREFIX} viable ordinary raw candidates in attempts 0..${RAW_ATTEMPTS - 1}`,
    pairing: "consecutive viable raw coordinate vectors (0,1), (2,3), …; midpoint is the arithmetic coordinate mean and inherits the left attempt coordinate",
    continuation: "the same control or midpoint coordinate vector regenerates one next ordinary contact from the exact current-child engine",
    evaluator: "existing exact candidate gates with optional ride-out polish disabled uniformly",
    discard: { minimumMeanComparableRmsImprovement: MIN_RMS_IMPROVEMENT, requiredComparableRegimes: ["dense", "pickup", "low_air"] },
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
  const raw = captureRawViable(parent.node, current, setup);
  const pairRows: PairRow[] = [];
  for (let index = 0; index + 1 < raw.length; index += 2) {
    pairRows.push(evaluatePair(parent.node, current, next, setup, raw[index], raw[index + 1]));
  }
  process.stderr.write(
    `${definition.id}/s${seed}: g${current.index}->g${next.index}, raw=${raw.length}/${CURRENT_VIABLE_PREFIX}, ` +
    `direct=${pairRows.filter((row) => row.direct.valid).length}, midpoint=${pairRows.filter((row) => row.midpoint.valid).length}\n`,
  );
  return { caseId: definition.id, regime: definition.regime, seed, checkpointGapIndex: current.index, nextGapIndex: next.index, rawViable: raw.length, rows: pairRows };
}

function emptyState(definition: typeof CASES[number], seed: number, checkpointGapIndex: number | null, nextGapIndex: number | null): StateRow {
  return { caseId: definition.id, regime: definition.regime, seed, checkpointGapIndex, nextGapIndex, rawViable: 0, rows: [] };
}

function captureRawViable(node: HandoffNode, gap: Gap, setup: Setup): RawEntry[] {
  const base = makeRng((Math.imul(node.searchSeed | 0, 1_000_003) + gap.index + 1) | 0);
  const entries: RawEntry[] = [];
  for (let attempt = 0; attempt < RAW_ATTEMPTS && entries.length < CURRENT_VIABLE_PREFIX; attempt++) {
    const draws: number[] = [];
    const observed = observeOneCandidate(
      node.search.prefixEngine,
      gap,
      () => { const value = base(); draws.push(value); return value; },
      setup.ctx,
      node.search.prefixNextLineId,
      attempt,
      "normal",
      gap.targets,
      undefined,
      { allowRideOutPolish: false },
    );
    if (draws.length !== 8) throw new Error(`normal attempt ${attempt} consumed ${draws.length} draws, expected 8`);
    if (observed.fit !== null) entries.push({ candidate: observed.fit, attempt, draws });
  }
  return entries;
}

function evaluatePair(node: HandoffNode, currentGap: Gap, nextGap: Gap, setup: Setup, left: RawEntry, right: RawEntry): PairRow {
  const directBefore = getSimFrames();
  const directNext = nextFromDraws(node, left.candidate, nextGap, setup, left.attempt, left.draws);
  const directFrames = getSimFrames() - directBefore;
  const midpointDraws = left.draws.map((value, index) => (value + right.draws[index]) / 2);
  const midpointBefore = getSimFrames();
  const midpointCurrent = fromDraws(node.search.prefixEngine, node.search.prefixNextLineId, currentGap, setup, left.attempt, midpointDraws);
  const midpointNext = midpointCurrent === null ? null : nextFromDraws(node, midpointCurrent, nextGap, setup, left.attempt, midpointDraws);
  const midpointFrames = getSimFrames() - midpointBefore;
  return {
    leftAttempt: left.attempt,
    rightAttempt: right.attempt,
    rawDraws: left.draws.length,
    direct: {
      valid: directNext !== null,
      metrics: directNext === null ? null : pairMetrics(left.candidate, directNext, currentGap, nextGap),
      frames: directFrames,
      reason: directNext === null ? "exact next ordinary contact rejected" : null,
    },
    midpoint: {
      valid: midpointCurrent !== null && midpointNext !== null,
      metrics: midpointCurrent === null || midpointNext === null ? null : pairMetrics(midpointCurrent, midpointNext, currentGap, nextGap),
      frames: midpointFrames,
      reason: midpointCurrent === null ? "exact current midpoint contact rejected" : midpointNext === null ? "exact next midpoint contact rejected" : null,
    },
  };
}

function nextFromDraws(node: HandoffNode, current: Candidate, nextGap: Gap, setup: Setup, attempt: number, draws: readonly number[]): Candidate | null {
  const child = extendNodeCached(node.search, current);
  return fromDraws(child.prefixEngine, child.prefixNextLineId, nextGap, setup, attempt, draws);
}

function fromDraws(engine: unknown, lineIdStart: number, gap: Gap, setup: Setup, attempt: number, draws: readonly number[]): Candidate | null {
  let index = 0;
  const observed = observeOneCandidate(
    engine,
    gap,
    () => {
      if (index >= draws.length) throw new Error("normal coordinate replay requested an undeclared draw");
      return draws[index++];
    },
    setup.ctx,
    lineIdStart,
    attempt,
    "normal",
    gap.targets,
    undefined,
    { allowRideOutPolish: false },
  );
  if (index !== draws.length) throw new Error(`normal coordinate replay consumed ${index}/${draws.length} draws`);
  return observed.fit;
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
  const comparable = pairs.filter((row) => row.direct.metrics?.rms != null && row.midpoint.metrics?.rms != null);
  const byRegime = Object.fromEntries([...new Set(states.map((state) => state.regime))].map((regime) => {
    const entries = states.filter((state) => state.regime === regime).flatMap((state) => state.rows);
    const comparableEntries = entries.filter((row) => row.direct.metrics?.rms != null && row.midpoint.metrics?.rms != null);
    return [regime, {
      directValid: entries.filter((row) => row.direct.valid).length,
      midpointValid: entries.filter((row) => row.midpoint.valid).length,
      comparable: comparableEntries.length,
      meanRmsImprovement: mean(comparableEntries.map((row) => row.direct.metrics!.rms! - row.midpoint.metrics!.rms!)),
    }];
  }));
  const bySeed = Object.fromEntries(SEEDS.map((seed) => {
    const entries = states.filter((state) => state.seed === seed).flatMap((state) => state.rows);
    return [seed, {
      directValid: entries.filter((row) => row.direct.valid).length,
      midpointValid: entries.filter((row) => row.midpoint.valid).length,
      comparable: entries.filter((row) => row.direct.metrics?.rms != null && row.midpoint.metrics?.rms != null).length,
    }];
  }));
  return {
    declaredStates: states.length,
    statesWithRaw: states.filter((state) => state.rawViable > 0).length,
    pairs: pairs.length,
    directValid: pairs.filter((row) => row.direct.valid).length,
    midpointValid: pairs.filter((row) => row.midpoint.valid).length,
    comparablePairs: comparable.length,
    meanTwoGapRmsImprovement: mean(comparable.map((row) => row.direct.metrics!.rms! - row.midpoint.metrics!.rms!)),
    minimumRequiredMeanImprovement: MIN_RMS_IMPROVEMENT,
    meanDirectFrames: mean(pairs.map((row) => row.direct.frames)),
    meanMidpointFrames: mean(pairs.map((row) => row.midpoint.frames)),
    bySeed,
    byRegime,
  };
}

/** The host limits a long parent process even when its 500k WASM compiles are
 * children. Execute four sealed states per batch, each in a fresh Node process;
 * no batch output influences the next one. */
function runBatch(batch: number, aggregateOut: string): void {
  const states = ALL_SEEDS.flatMap((seed) => CASES.map((definition) => ({ seed, definition })));
  const selected = states.slice(batch * 4, batch * 4 + 4);
  const stateDir = `${dirname(aggregateOut)}/states`;
  mkdirSync(stateDir, { recursive: true });
  for (const { seed, definition } of selected) runChildState(seed, definition, stateDir);
  process.stdout.write(`${JSON.stringify({ schema: "line.study-joint-normal-coordinate-interpolation.v1", batch, states: selected.map(({ seed, definition }) => `${definition.id}/s${seed}`) }, null, 2)}\n`);
}

function runChildState(seed: number, definition: typeof CASES[number], stateDir: string): void {
  const stateOut = `${stateDir}/${definition.id}-s${seed}.json`;
  execFileSync(
    process.execPath,
    ["--expose-gc", "--import", "tsx", process.argv[1], `--seed=${seed}`, `--case=${definition.id}`, `--out=${stateOut}`],
    { encoding: "utf8", env: { ...process.env, LR_ENGINE: "wasm" }, stdio: ["ignore", "pipe", "inherit"] },
  );
}

function aggregateStateArtifacts(aggregateOut: string): void {
  const stateDir = `${dirname(aggregateOut)}/states`;
  const documents: Array<{ elapsedMs: number; rows: StateRow[] }> = [];
  for (const seed of ALL_SEEDS) {
    for (const definition of CASES) {
      const path = `${stateDir}/${definition.id}-s${seed}.json`;
      const document = JSON.parse(readFileSync(path, "utf8")) as { elapsedMs: number; rows: StateRow[] };
      if (document.rows.length !== 1 || document.rows[0].caseId !== definition.id || document.rows[0].seed !== seed) {
        throw new Error(`state artifact ${path} does not match the frozen ${definition.id}/s${seed} scope`);
      }
      documents.push(document);
    }
  }
  const aggregateRows = documents.flatMap((document) => document.rows);
  const aggregate = {
    schema: "line.study-joint-normal-coordinate-interpolation.v1",
    purpose: [
      "Aggregate of memory-isolated executions of the frozen two-contact normal-coordinate interpolation assay.",
      "Every child uses the same candidate basis, exact gates, scope, and decision boundary; isolation is operational only.",
    ],
    frozenConfig: {
      budget: BUDGET,
      seeds: ALL_SEEDS,
      joltMs: benchmarkPolicy.transform.joltMs,
      cases: CASES.map(({ id, regime }) => ({ id, regime })),
      currentPopulation: `first ${CURRENT_VIABLE_PREFIX} viable ordinary raw candidates in attempts 0..${RAW_ATTEMPTS - 1}`,
      pairing: "consecutive viable raw coordinate vectors, arithmetic midpoint, left attempt coordinate",
      continuation: "same coordinate vector regenerates the next normal contact from the exact current-child engine",
      evaluator: "existing exact candidate gates with optional ride-out polish disabled uniformly",
      discard: { minimumMeanComparableRmsImprovement: MIN_RMS_IMPROVEMENT, requiredComparableRegimes: ["dense", "pickup", "low_air"] },
      execution: "one process per frozen state; no state output informs another",
    },
    elapsedMs: documents.reduce((sum, document) => sum + document.elapsedMs, 0),
    rows: aggregateRows,
    summary: summarize(aggregateRows),
  };
  mkdirSync(dirname(aggregateOut), { recursive: true });
  writeFileSync(aggregateOut, `${JSON.stringify(aggregate, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ schema: aggregate.schema, output: aggregateOut, summary: aggregate.summary }, null, 2)}\n`);
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
