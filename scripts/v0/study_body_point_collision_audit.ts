/**
 * Read-only body-point collision audit for ordinary normal pools.
 *
 * Replays generation-time raw normal pools at 24 current V2 frontier states
 * and reads native engine collision identities for candidate-owned lines.
 * This is an observation study, never a compiler lane or selector.
 *
 *   LR_ENGINE=wasm node --expose-gc --import tsx scripts/v0/study_body_point_collision_audit.ts \
 *     [--out=generated/studies/body-point-collision-audit/v1/result.json]
 */
import { createHash } from "node:crypto";
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
import { compileHandoff, setHandoffFrontierNodeProbeHook, type HandoffNode } from "./optimizer/handoff.ts";
import { setNormalPoolSnapshotHook } from "./optimizer/node.ts";
import { sampleOneCandidate, type Candidate, type SpecContext } from "./optimizer/sample.ts";
import { axisLookaheadEndFrame } from "./core/candidate.ts";
import { effectiveAxes, engineLineFromTrackLine, sampleGapTargets, sliceTimeline } from "./core/substrate.ts";
import { postimpactEngineCollisionWitnessesForLineIds } from "./trajectory/postimpact_trace.ts";
import { CALIB, secToFrame, type AxisValues, type Gap, type Spec } from "./types.ts";

const BUDGET = 500_000;
const SEEDS = [28, 29] as const;
const CASES = [
  { id: "frontier_dense_recovery", regime: "capability_dense", spec: dense },
  { id: "dense_dialogue_impact_contrast_10", regime: "representative_dense", spec: denseDialogueImpact },
  { id: "countercurrent", regime: "representative", spec: countercurrent },
  { id: "believer_56_6s", regime: "development_music", spec: believer },
  { id: "frontier_low_air_endurance_4s", regime: "capability_low_air", spec: lowAir },
  { id: "offgrid_conversation", regime: "representative_pickup", spec: offgrid },
] as const satisfies readonly { id: string; regime: string; spec: Spec }[];
const BODY_POINTS = new Set(["BUTT", "SHOULDER", "RHAND", "LHAND", "LFOOT", "RFOOT"]);
const SLED_POINTS = new Set(["PEG", "TAIL", "NOSE", "STRING"]);

const argv = process.argv.slice(2);
if (argv.includes("--help") || argv.includes("-h")) {
  process.stdout.write(
    "Usage: study_body_point_collision_audit.ts [--out=PATH]\n" +
    "Replays the fixed 6-case × 2-seed normal-pool panel at two frozen frontier checkpoints per run. Observation only.\n",
  );
  process.exit(0);
}
const argument = (name: string): string | undefined =>
  argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const outPath = argument("out") ?? "generated/studies/body-point-collision-audit/v1/result.json";
const unknown = argv.filter((value) => !value.startsWith("--out="));
if (unknown.length > 0) throw new Error(`unknown argument(s): ${unknown.join(", ")}`);

type Regime = typeof CASES[number]["regime"];
type Checkpoint = "one_third" | "two_thirds";
type Captured = { checkpoint: Checkpoint; gapIndex: number; node: HandoffNode };
type RawPool = { seed: number; gapIndex: number; count: number; candidates: Array<{ attempt: number; hash: string }> };
type CandidateRow = {
  attempt: number;
  hash: string;
  impactAbsError: number | null;
  objective: number | null;
  cost: number;
  bodyPoints: string[];
  sledPoints: string[];
  firstOwnedCollisionFrame: number | null;
  firstCollisionBodyPoints: string[];
  firstCollisionSledPoints: string[];
};
type StateRow = {
  caseId: string;
  regime: Regime;
  seed: number;
  checkpoint: Checkpoint;
  gapIndex: number;
  rawCandidateCount: number | null;
  replayEquivalent: boolean | null;
  replayMessage: string | null;
  candidates: CandidateRow[];
  summary: {
    viable: number;
    withOwnedCollision: number;
    bodyContact: number;
    firstBodyContact: number;
    sledOnly: number;
    bodyAndSled: number;
    bodyDominatesSled: boolean | null;
    bodyDominancePairs: number;
  };
};
type Setup = { gaps: Gap[]; ctx: SpecContext };

const rows: StateRow[] = [];
for (const definition of CASES) {
  for (const seed of SEEDS) {
    const setup = buildSetup(applyJolt(definition.spec, benchmarkPolicy.transform.joltMs), seed);
    const checkpoints = checkpointGapIndices(setup.gaps);
    const captured = new Map<number, Captured>();
    const rawPools = new WeakMap<object, RawPool>();
    setHandoffFrontierNodeProbeHook(({ selected }) => {
      if (selected.skippedContacts !== 0 || selected.search.gapIndex === setup.gaps.length) return;
      const checkpoint = checkpoints.get(selected.search.gapIndex);
      if (checkpoint !== undefined && !captured.has(selected.search.gapIndex)) {
        captured.set(selected.search.gapIndex, { checkpoint, gapIndex: selected.search.gapIndex, node: selected });
      }
    });
    setNormalPoolSnapshotHook((record) => snapshotRawPool(rawPools, record));
    const started = performance.now();
    try {
      compileHandoff(applyJolt(definition.spec, benchmarkPolicy.transform.joltMs), seed, { budget: BUDGET });
    } finally {
      setHandoffFrontierNodeProbeHook(null);
      setNormalPoolSnapshotHook(null);
    }
    for (const [gapIndex, checkpoint] of checkpoints) {
      const state = captured.get(gapIndex);
      const raw = state === undefined ? null : rawPools.get(state.node.search) ?? null;
      rows.push(state === undefined || raw === null
        ? unavailable(definition.id, definition.regime, seed, checkpoint, gapIndex, state === undefined
          ? "frontier state unavailable"
          : "generation-time normal-pool snapshot unavailable")
        : auditState(definition.id, definition.regime, seed, state, raw, setup));
    }
    process.stderr.write(
      `${definition.id}/s${seed}: ${captured.size}/${checkpoints.size} checkpoints in ` +
      `${((performance.now() - started) / 1000).toFixed(1)}s\n`,
    );
    (globalThis as { gc?: () => void }).gc?.();
  }
}

const output = {
  schema: "line.study-body-point-collision-audit.v1",
  purpose: [
    "Observation-only replay of generation-time ordinary normal pools from immutable frontier states.",
    "Native engine collision updates are restricted to candidate-owned line ids; no candidate, line, or source form is selected.",
    "Body contact is a physical-topology signal, not a claim that it should be promoted or preferred.",
  ],
  frozenConfig: {
    budget: BUDGET,
    joltMs: benchmarkPolicy.transform.joltMs,
    seeds: SEEDS,
    cases: CASES.map(({ id, regime }) => ({ id, regime })),
    checkpoints: "first ordinary frontier state at one-third and two-thirds authored-contact gap indices",
    collisionWindow: "one frame before current authored contact through existing axis-measurement horizon",
    comparison: "body-contact candidate weakly dominates sled-only candidate on impact absolute residual (lower) and current-quality × predicted-next-readiness objective (higher), one strict",
  },
  rows,
  summary: summarize(rows),
};
const json = `${JSON.stringify(output, null, 2)}\n`;
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, json);
process.stdout.write(`${JSON.stringify({ schema: output.schema, output: outPath, summary: output.summary }, null, 2)}\n`);

function snapshotRawPool(
  pools: WeakMap<object, RawPool>,
  record: { node: object; seed: number; gapIndex: number; nCand: number; sampleOrder: readonly Candidate[] },
): void {
  const prior = pools.get(record.node);
  if (prior === undefined || prior.seed !== record.seed || prior.gapIndex !== record.gapIndex || record.nCand < prior.count) {
    pools.set(record.node, {
      seed: record.seed,
      gapIndex: record.gapIndex,
      count: record.nCand,
      candidates: record.sampleOrder.map((candidate) => ({ attempt: candidate.sampleAttempt ?? -1, hash: geometryHash(candidate) })),
    });
    return;
  }
  if (record.nCand > prior.count) {
    prior.candidates.push(...record.sampleOrder
      .filter((candidate) => (candidate.sampleAttempt ?? -1) >= prior.count)
      .map((candidate) => ({ attempt: candidate.sampleAttempt ?? -1, hash: geometryHash(candidate) })));
    prior.count = record.nCand;
  }
}

function auditState(
  caseId: string,
  regime: Regime,
  seed: number,
  captured: Captured,
  raw: RawPool,
  setup: Setup,
): StateRow {
  const gap = setup.gaps[captured.gapIndex];
  if (gap === undefined || !gap.endsWithContact) {
    return unavailable(caseId, regime, seed, captured.checkpoint, captured.gapIndex, "checkpoint is not a contact gap");
  }
  const rngSeed = (Math.imul(raw.seed | 0, 1_000_003) + gap.index + 1) | 0;
  const rng = makeRng(rngSeed);
  const axisEnd = axisLookaheadEndFrame(gap, setup.ctx.allContactFrames);
  const target = (setup.ctx.gapAxisTargets?.[gap.index] ?? gap.targets).impact;
  // Keep the raw proposal replay completely isolated from collision telemetry.
  // The established normal-pool comparator first recreates the full candidate
  // prefix and only then observes it; doing the same here proves that a native
  // engine read cannot perturb an as-yet-unreplayed sample.
  const sampled: Candidate[] = [];
  for (let attempt = 0; attempt < raw.count; attempt++) {
    const candidate = sampleOneCandidate(
      captured.node.search.prefixEngine, gap, rng, setup.ctx, captured.node.search.prefixNextLineId, attempt,
    );
    if (candidate !== null) sampled.push(candidate);
  }
  const check = compareRawReplay(raw.candidates, sampled.map((candidate) => ({
    attempt: candidate.sampleAttempt ?? -1,
    hash: geometryHash(candidate),
  })));
  const candidates: CandidateRow[] = [];
  for (const candidate of sampled) {
    const engine = captured.node.search.prefixEngine.addLine(candidate.lines.map(engineLineFromTrackLine));
    const lineIds = new Set(candidate.lines.map((line) => line.id));
    const body = new Set<string>();
    const sled = new Set<string>();
    let firstOwnedCollisionFrame: number | null = null;
    const firstBody = new Set<string>();
    const firstSled = new Set<string>();
    for (let frame = Math.max(0, gap.endFrame - 1); frame <= axisEnd; frame++) {
      const hits = postimpactEngineCollisionWitnessesForLineIds(engine, frame, lineIds);
      const isFirst = hits.length > 0 && firstOwnedCollisionFrame === null;
      if (isFirst) firstOwnedCollisionFrame = frame;
      for (const hit of hits) {
        for (const point of hit.pointIds) {
          if (BODY_POINTS.has(point)) body.add(point);
          if (SLED_POINTS.has(point)) sled.add(point);
          if (isFirst && BODY_POINTS.has(point)) firstBody.add(point);
          if (isFirst && SLED_POINTS.has(point)) firstSled.add(point);
        }
      }
    }
    const achieved = candidate.achievedAtEnd ?? candidate.achieved;
    const impact = target === undefined || achieved.impact === undefined
      ? null
      : Math.abs(achieved.impact - target);
    candidates.push({
      attempt: candidate.sampleAttempt ?? -1,
      hash: geometryHash(candidate),
      impactAbsError: impact === null ? null : round(impact),
      objective: nullableRound(candidateQualityObjective(captured.node.search.prefixEngine, candidate, gap, setup.gaps, setup.ctx)),
      cost: round(candidate.cost),
      bodyPoints: [...body].sort(),
      sledPoints: [...sled].sort(),
      firstOwnedCollisionFrame,
      firstCollisionBodyPoints: [...firstBody].sort(),
      firstCollisionSledPoints: [...firstSled].sort(),
    });
  }
  // The strict physical-topology comparison uses a body point in the FIRST
  // candidate-owned collision frame. Later body contact is retained as a
  // diagnostic but cannot claim to redirect the incoming state.
  const bodyCandidates = candidates.filter((candidate) => candidate.firstCollisionBodyPoints.length > 0);
  const sledOnly = candidates.filter((candidate) => candidate.sledPoints.length > 0 && candidate.bodyPoints.length === 0);
  const dominancePairs = bodyCandidates.reduce((count, body) => count + sledOnly.filter((sled) => dominates(body, sled)).length, 0);
  return {
    caseId,
    regime,
    seed,
    checkpoint: captured.checkpoint,
    gapIndex: captured.gapIndex,
    rawCandidateCount: raw.count,
    replayEquivalent: check.ok,
    replayMessage: check.message,
    candidates,
    summary: {
      viable: candidates.length,
      withOwnedCollision: candidates.filter((candidate) => candidate.firstOwnedCollisionFrame !== null).length,
      bodyContact: candidates.filter((candidate) => candidate.bodyPoints.length > 0).length,
      firstBodyContact: bodyCandidates.length,
      sledOnly: sledOnly.length,
      bodyAndSled: candidates.filter((candidate) => candidate.bodyPoints.length > 0 && candidate.sledPoints.length > 0).length,
      bodyDominatesSled: bodyCandidates.length === 0 || sledOnly.length === 0 ? null : dominancePairs > 0,
      bodyDominancePairs: dominancePairs,
    },
  };
}

function dominates(body: CandidateRow, sled: CandidateRow): boolean {
  if (body.impactAbsError === null || sled.impactAbsError === null || body.objective === null || sled.objective === null) return false;
  const impactNoWorse = body.impactAbsError <= sled.impactAbsError + 1e-9;
  const objectiveNoWorse = body.objective >= sled.objective - 1e-9;
  const strict = body.impactAbsError < sled.impactAbsError - 1e-9 || body.objective > sled.objective + 1e-9;
  return impactNoWorse && objectiveNoWorse && strict;
}

function unavailable(
  caseId: string,
  regime: Regime,
  seed: number,
  checkpoint: Checkpoint,
  gapIndex: number,
  message: string,
): StateRow {
  return {
    caseId, regime, seed, checkpoint, gapIndex,
    rawCandidateCount: null,
    replayEquivalent: null,
    replayMessage: message,
    candidates: [],
    summary: {
      viable: 0,
      withOwnedCollision: 0,
      bodyContact: 0,
      firstBodyContact: 0,
      sledOnly: 0,
      bodyAndSled: 0,
      bodyDominatesSled: null,
      bodyDominancePairs: 0,
    },
  };
}

function compareRawReplay(
  generated: readonly { attempt: number; hash: string }[],
  replayed: readonly { attempt: number; hash: string }[],
): { ok: boolean; message: string } {
  const expected = [...generated].sort((a, b) => a.attempt - b.attempt);
  const actual = [...replayed].sort((a, b) => a.attempt - b.attempt);
  if (expected.length !== actual.length) return { ok: false, message: `viable count ${actual.length} does not match generation-time ${expected.length}` };
  for (let index = 0; index < expected.length; index++) {
    if (expected[index].attempt !== actual[index].attempt || expected[index].hash !== actual[index].hash) {
      return { ok: false, message: `candidate mismatch at viable index ${index}` };
    }
  }
  return { ok: true, message: "sample attempts and geometry hashes match generation-time raw-normal pool" };
}

function checkpointGapIndices(gaps: readonly Gap[]): Map<number, Checkpoint> {
  const contacts = gaps.filter((gap) => gap.endsWithContact).map((gap) => gap.index);
  if (contacts.length < 3) throw new Error("frozen source has fewer than three contact gaps");
  const first = contacts[Math.floor((contacts.length - 1) / 3)];
  const second = contacts[Math.floor((2 * (contacts.length - 1)) / 3)];
  if (first === undefined || second === undefined || first === second) throw new Error("unable to derive distinct checkpoint gaps");
  return new Map([[first, "one_third"], [second, "two_thirds"]]);
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
  // This is part of the production normal sampler's physical context: it
  // shapes the current proposal from the next authored contact but does not
  // alter scoring. Omitting it made the initial audit a different sampler.
  for (let index = 0; index + 1 < gaps.length; index++) {
    const current = gaps[index];
    const next = gaps[index + 1];
    if (current.endsWithContact && next.endsWithContact && next.targets.impact !== undefined) {
      current.nextImpact = next.targets.impact;
    }
  }
  return { gaps, ctx: { allContactFrames, durationFrames: secToFrame(spec.duration), gapAxisTargets } };
}

function geometryHash(candidate: Candidate): string {
  return createHash("sha256").update(JSON.stringify(candidate.lines.map((line) => [
    round(line.x1), round(line.y1), round(line.x2), round(line.y2), Boolean(line.flipped),
  ]))).digest("hex");
}

function summarize(rows: readonly StateRow[]) {
  const usable = rows.filter((row) => row.replayEquivalent === true);
  const byRegime = Object.fromEntries([...new Set(CASES.map((entry) => entry.regime))].map((regime) => {
    const states = usable.filter((row) => row.regime === regime);
    return [regime, summarizeStates(states)];
  }));
  return {
    declaredStates: rows.length,
    usableStates: usable.length,
    replayFailures: rows.filter((row) => row.replayEquivalent === false).length,
    byRegime,
    overall: summarizeStates(usable),
  };
}

function summarizeStates(rows: readonly StateRow[]) {
  const positive = (field: keyof StateRow["summary"]) => rows.filter((row) => Number(row.summary[field]) > 0).length;
  const comparable = rows.filter((row) => row.summary.bodyDominatesSled !== null);
  return {
    states: rows.length,
    statesWithBodyContact: positive("bodyContact"),
    statesWithFirstBodyContact: positive("firstBodyContact"),
    statesWithSledOnlyContact: positive("sledOnly"),
    statesWithBodyAndSledContact: positive("bodyAndSled"),
    comparableStates: comparable.length,
    bodyDominatesSledStates: comparable.filter((row) => row.summary.bodyDominatesSled === true).length,
    viableCandidates: rows.reduce((sum, row) => sum + row.summary.viable, 0),
    bodyContactCandidates: rows.reduce((sum, row) => sum + row.summary.bodyContact, 0),
    firstBodyContactCandidates: rows.reduce((sum, row) => sum + row.summary.firstBodyContact, 0),
    sledOnlyCandidates: rows.reduce((sum, row) => sum + row.summary.sledOnly, 0),
    bodyDominancePairs: rows.reduce((sum, row) => sum + row.summary.bodyDominancePairs, 0),
  };
}

function nullableRound(value: number | null): number | null {
  return value === null || !Number.isFinite(value) ? null : round(value);
}

function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
