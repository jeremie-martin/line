/**
 * Frozen observation-only comparison of production normal geometry against
 * the same raw proposals with either every one-way collision side inverted,
 * the final post-contact collision endpoint extended, or forward type-1
 * acceleration encoding over the same active collision surfaces, or a final
 * type-2 non-collidable release segment.
 *
 *   LR_ENGINE=wasm npx tsx scripts/v0/study_collision_side_normal_pool.ts \
 *     --terminal-end-extension --out=generated/studies/terminal-endpoint-normal-pool/v1/result.json
 */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { developmentCases } from "../../benchmark/v2/catalog.ts";
import { benchmarkPolicy } from "../../benchmark/v2/policy.ts";
import { makeRng } from "../lib/rng.ts";
import { getRiderMetered } from "../lib/detector.ts";
import { applyJolt } from "../produce/seed.ts";
import { sampleArcPlacementGeometry, type ImpactFrameTargetState } from "./arc_placement.ts";
import { candidateQualityObjective } from "./optimizer/aim.ts";
import { compileHandoff, setHandoffFrontierNodeProbeHook, type HandoffNode } from "./optimizer/handoff.ts";
import { setNormalPoolSnapshotHook } from "./optimizer/node.ts";
import { getCandidateProbe, sampleOneCandidate, type Candidate, type SpecContext } from "./optimizer/sample.ts";
import { axisLookaheadEndFrame, tryCandidateGeometry } from "./core/candidate.ts";
import { effectiveAxes, sampleGapTargets, sliceTimeline } from "./core/substrate.ts";
import { getSimFrames } from "./optimizer/sim_frames.ts";
import { CALIB, secToFrame, type AxisValues, type Gap, type Spec } from "./types.ts";

const argv = process.argv.slice(2);
if (argv.includes("--help") || argv.includes("-h")) {
  process.stdout.write("Usage: study_collision_side_normal_pool.ts [--terminal-end-extension|--forward-acceleration|--terminal-scenery-release|--contact-patch-release|--all-body-support-anchor|--surface-normal-body-support-anchor] [--case=ID ...] [--out=PATH]\n");
  process.exit(0);
}
const argument = (name: string): string | undefined =>
  argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const outPath = argument("out");
const terminalEndExtension = argv.includes("--terminal-end-extension");
const forwardAcceleration = argv.includes("--forward-acceleration");
const terminalSceneryRelease = argv.includes("--terminal-scenery-release");
const contactPatchRelease = argv.includes("--contact-patch-release");
const allBodySupportAnchor = argv.includes("--all-body-support-anchor");
const surfaceNormalBodySupportAnchor = argv.includes("--surface-normal-body-support-anchor");
const requestedCaseIds = argv.filter((value) => value.startsWith("--case=")).map((value) => value.slice("--case=".length));
const unknown = argv.filter((value) => value !== "--terminal-end-extension" && value !== "--forward-acceleration" && value !== "--terminal-scenery-release" && value !== "--contact-patch-release" && value !== "--all-body-support-anchor" && value !== "--surface-normal-body-support-anchor" && !value.startsWith("--out=") && !value.startsWith("--case="));
if (unknown.length > 0) throw new Error(`unknown argument(s): ${unknown.join(", ")}`);
if ([terminalEndExtension, forwardAcceleration, terminalSceneryRelease, contactPatchRelease, allBodySupportAnchor, surfaceNormalBodySupportAnchor].filter(Boolean).length > 1) {
  throw new Error("normal-pool comparator modes are mutually exclusive");
}

const BUDGET = 500_000;
const SEEDS = [28, 29] as const;
const CASES = [
  { id: "frontier_dense_recovery", regime: "dense" },
  { id: "dense_dialogue_impact_contrast_10", regime: "dense" },
  { id: "countercurrent", regime: "representative" },
  { id: "offgrid_conversation", regime: "pickup" },
  { id: "frontier_low_air_endurance_4s", regime: "low_air" },
  { id: "believer_56_6s", regime: "development_music" },
] as const;
const COMPLETE_COLLISION_POINTS = [
  "PEG", "TAIL", "NOSE", "STRING",
  "BUTT", "SHOULDER", "RHAND", "LHAND", "LFOOT", "RFOOT",
] as const;
type BodyCollisionPoint = { name: string; x: number; y: number };
type SurfaceNormalAnchorTelemetry = {
  geometries: number;
  readableContactVertices: number;
  shiftedGeometries: number;
  meanAbsNormalShiftPx: number | null;
  maxAbsNormalShiftPx: number | null;
  supportPointCounts: Record<string, number>;
};
type ContactPatchTelemetry = {
  geometries: number;
  patchAvailable: number;
  releasedGeometries: number;
  splitGeometries: number;
  releasedLines: number;
  meanPatchLengthPx: number | null;
  meanCollidablePostLengthPx: number | null;
};
const ACTIVE_CASES = requestedCaseIds.length === 0
  ? CASES
  : CASES.filter((entry) => requestedCaseIds.includes(entry.id));
if (new Set(requestedCaseIds).size !== requestedCaseIds.length || ACTIVE_CASES.length !== requestedCaseIds.length) {
  throw new Error(`unknown or duplicate --case selection: ${requestedCaseIds.join(", ")}`);
}

type Regime = typeof CASES[number]["regime"];
type Checkpoint = "one_third" | "two_thirds";
type Captured = { checkpoint: Checkpoint; gapIndex: number; node: HandoffNode };
type RawPool = { seed: number; count: number; candidates: Array<{ attempt: number; hash: string }> };
type Digest = { attempt: number; hash: string; cost: number; axisRms: number; objective: number | null; simFrames: number };
type Arm = {
  attempts: number;
  viable: number;
  admissionFrames: number;
  bestCost: number | null;
  bestAxisRms: number | null;
  bestObjective: number | null;
  candidates: Digest[];
};
type Row = {
  caseId: string;
  regime: Regime;
  seed: number;
  checkpoint: Checkpoint;
  gapIndex: number;
  candidateCount: number | null;
  captureAvailable: boolean;
  allBodySupportAnchor: { point: string; deltaX: number; deltaY: number } | null;
  surfaceNormalBodySupportAnchor: SurfaceNormalAnchorTelemetry | null;
  contactPatchRelease: ContactPatchTelemetry | null;
  replayEquivalent: boolean | null;
  replayMessage: string | null;
  production: Arm | null;
  alternative: Arm | null;
  deltas: { viable: number | null; admissionFrames: number | null; bestAxisRms: number | null; bestObjective: number | null; bestCost: number | null } | null;
};

const catalog = new Map(developmentCases.map((entry) => [entry.case.metadata.id, entry.case]));
const definitions = ACTIVE_CASES.map((entry) => {
  const found = catalog.get(entry.id);
  if (found === undefined) throw new Error(`frozen case ${entry.id} is absent from development catalog`);
  return { ...entry, spec: found.spec };
});

const rows: Row[] = [];
for (const definition of definitions) {
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
      rows.push(state === undefined
        ? unavailable(definition.id, definition.regime, seed, checkpoint, gapIndex, "frontier state unavailable")
        : replay(definition.id, definition.regime, seed, state, rawPools.get(state.node.search) ?? null, setup));
    }
    process.stderr.write(`${definition.id}/s${seed}: ${captured.size}/${checkpoints.size} checkpoints captured in ${((performance.now() - started) / 1000).toFixed(1)}s\n`);
    (globalThis as { gc?: () => void }).gc?.();
  }
}

const result = {
  schema: surfaceNormalBodySupportAnchor
    ? "line.study-surface-normal-body-support-anchor-normal-pool.v1"
    : allBodySupportAnchor
    ? "line.study-all-body-support-anchor-normal-pool.v1"
    : terminalSceneryRelease
    ? "line.study-terminal-noncollidable-release-normal-pool.v1"
    : contactPatchRelease
    ? "line.study-contact-patch-release-normal-pool.v1"
    : forwardAcceleration
    ? "line.study-forward-tangential-acceleration-normal-pool.v1"
    : terminalEndExtension
    ? "line.study-terminal-endpoint-continuation-normal-pool.v1"
    : "line.study-collision-side-normal-pool.v1",
  purpose: [
    "observation-only exact normal-pool replay from immutable frontier states",
    surfaceNormalBodySupportAnchor
      ? "same PRNG coordinates, attempts, candidate count, exact gates, and scoring; each raw candidate is translated only along its own gravity-facing contact normal until its plane is supported by the complete collision body"
      : contactPatchRelease
      ? "same PRNG coordinates, attempts, candidate count, gates, and scoring; a finite post-contact collision patch spans one whole sled width plus one incoming-speed frame, while the identical visible remainder becomes type-2 scenery"
      : allBodySupportAnchor
      ? "same PRNG coordinates, attempts, candidate count, exact gates, and scoring; only the gravity support anchor changes from the lowest sled collision point to the lowest point on the complete collision body"
      : terminalSceneryRelease
      ? "same PRNG coordinates, attempts, candidate count, gates, and scoring; only the final post-contact normal segment becomes a type-2 non-collidable release while every other line and flag remains identical"
      : forwardAcceleration
      ? "same PRNG coordinates, attempts, candidate count, gates, and scoring; each solid normal segment becomes a reversed/flipped type-1 line that preserves its active collision normal and receives the engine's fixed forward tangential impulse"
      : terminalEndExtension
      ? "same PRNG coordinates, attempts, candidate count, gates, and scoring; production bounded endpoints versus only the final post-contact line with its right endpoint extended"
      : "same PRNG coordinates, attempts, candidate count, gates, and scoring; production collision side versus every-line inverted side",
    "no alternate compiler run, normal-source change, or V2 evaluation",
  ],
  frozenConfig: {
    budget: BUDGET,
    joltMs: benchmarkPolicy.transform.joltMs,
    seeds: SEEDS,
    cases: ACTIVE_CASES,
    checkpoints: "first ordinary frontier state at one-third and two-thirds authored-contact gap indices",
    comparator: surfaceNormalBodySupportAnchor
      ? "for each unchanged raw normal geometry, find its contact vertex and gravity-facing surface normal, then translate every line by the complete body's maximum support projection minus the ordinary sled anchor projection; retain all tangents, raw draws, COM velocity, gates, and scorer"
      : contactPatchRelease
      ? "find the ordered post-contact line whose start is nearest the exact ordinary sled anchor; retain solid collision for one maximum sled span plus one target-state speed frame of downstream arclength, split at that physical length when needed, and encode every later unchanged segment as type-2 scenery"
      : allBodySupportAnchor
      ? "read all ten engine collision points at the target frame and replace only the sampled geometry's anchor with their maximum-y gravity support point; retain the ordinary COM velocity, raw draws, candidate gates, and scorer"
      : terminalSceneryRelease
      ? "set type=2 only on the final proposed normal line after identical raw geometry generation"
      : forwardAcceleration
      ? "replace every raw normal line with its reverse-endpoint, inverted-flip type-1 equivalent; swap endpoint extension flags with the reversed endpoints so the physical surface, active normal, and bounded extent remain identical"
      : terminalEndExtension
      ? "set rightExtended=true only on the final proposed normal line after identical raw geometry generation"
      : "invert the flipped bit on every proposed normal line after identical raw geometry generation",
  },
  rows,
  summary: summarize(rows),
};
const json = `${JSON.stringify(result, null, 2)}\n`;
if (outPath === undefined) process.stdout.write(json);
else {
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, json);
  process.stdout.write(`${JSON.stringify({ ...result, rows: undefined }, null, 2)}\n`);
}

function snapshotRawPool(
  pools: WeakMap<object, RawPool>,
  record: { node: object; seed: number; nCand: number; sampleOrder: readonly Candidate[] },
): void {
  const prior = pools.get(record.node);
  if (prior === undefined || prior.seed !== record.seed || record.nCand < prior.count) {
    pools.set(record.node, {
      seed: record.seed,
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

function replay(caseId: string, regime: Regime, seed: number, captured: Captured, rawPool: RawPool | null, setup: Setup): Row {
  if (rawPool === null || rawPool.count <= 0) {
    return unavailable(caseId, regime, seed, captured.checkpoint, captured.gapIndex, "generation-time ordinary pool snapshot unavailable");
  }
  const gap = setup.gaps[captured.gapIndex];
  if (gap === undefined || !gap.endsWithContact) {
    return unavailable(caseId, regime, seed, captured.checkpoint, captured.gapIndex, "checkpoint is not a contact gap");
  }
  const rngSeed = (Math.imul(rawPool.seed | 0, 1_000_003) + gap.index + 1) | 0;
  const production = sampleProduction(captured.node, gap, setup.ctx, setup.gaps, rawPool.count, rngSeed);
  const supportAnchor = allBodySupportAnchor
    ? allBodyGravitySupportState(captured.node, gap, setup.ctx)
    : null;
  const surfaceNormalSupport = surfaceNormalBodySupportAnchor
    ? sampleSurfaceNormalBodySupportAnchored(captured.node, gap, setup.ctx, setup.gaps, rawPool.count, rngSeed)
    : null;
  const contactPatch = contactPatchRelease
    ? sampleContactPatchReleased(captured.node, gap, setup.ctx, setup.gaps, rawPool.count, rngSeed)
    : null;
  const alternative = terminalSceneryRelease
    ? sampleTerminalSceneryRelease(captured.node, gap, setup.ctx, setup.gaps, rawPool.count, rngSeed)
    : forwardAcceleration
    ? sampleForwardAccelerated(captured.node, gap, setup.ctx, setup.gaps, rawPool.count, rngSeed)
    : terminalEndExtension
      ? sampleTerminalEndpointExtended(captured.node, gap, setup.ctx, setup.gaps, rawPool.count, rngSeed)
      : contactPatch !== null
        ? contactPatch.arm
      : allBodySupportAnchor
        ? sampleAllBodySupportAnchored(captured.node, gap, setup.ctx, setup.gaps, rawPool.count, rngSeed, supportAnchor!.targetState)
        : surfaceNormalSupport !== null
          ? surfaceNormalSupport.arm
          : sampleFlipped(captured.node, gap, setup.ctx, setup.gaps, rawPool.count, rngSeed);
  const check = compareRawReplay(rawPool.candidates, production.candidates);
  return {
    caseId, regime, seed, checkpoint: captured.checkpoint, gapIndex: captured.gapIndex,
    candidateCount: rawPool.count, captureAvailable: true,
    allBodySupportAnchor: supportAnchor === null ? null : {
      point: supportAnchor.point,
      deltaX: round(supportAnchor.targetState.sledX - supportAnchor.ordinary.sledX),
      deltaY: round(supportAnchor.targetState.sledY - supportAnchor.ordinary.sledY),
    },
    surfaceNormalBodySupportAnchor: surfaceNormalSupport?.telemetry ?? null,
    contactPatchRelease: contactPatch?.telemetry ?? null,
    replayEquivalent: check.ok, replayMessage: check.message, production, alternative,
    deltas: {
      viable: alternative.viable - production.viable,
      admissionFrames: improvement(production.admissionFrames, alternative.admissionFrames, false),
      bestAxisRms: improvement(production.bestAxisRms, alternative.bestAxisRms, false),
      bestObjective: improvement(production.bestObjective, alternative.bestObjective, true),
      bestCost: improvement(production.bestCost, alternative.bestCost, false),
    },
  };
}

function unavailable(caseId: string, regime: Regime, seed: number, checkpoint: Checkpoint, gapIndex: number, message: string): Row {
  return {
    caseId, regime, seed, checkpoint, gapIndex, candidateCount: null,
    captureAvailable: false, allBodySupportAnchor: null, surfaceNormalBodySupportAnchor: null, contactPatchRelease: null, replayEquivalent: null, replayMessage: message,
    production: null, alternative: null, deltas: null,
  };
}

function sampleProduction(node: HandoffNode, gap: Gap, ctx: SpecContext, gaps: Gap[], count: number, seed: number): Arm {
  const rng = makeRng(seed);
  const candidates: Digest[] = [];
  let admissionFrames = 0;
  for (let attempt = 0; attempt < count; attempt++) {
    const before = getSimFrames();
    const candidate = sampleOneCandidate(node.search.prefixEngine, gap, rng, ctx, node.search.prefixNextLineId, attempt);
    const simFrames = getSimFrames() - before;
    admissionFrames += simFrames;
    if (candidate !== null) candidates.push(digest(candidate, node, gap, gaps, ctx, simFrames));
  }
  return summarizeArm(count, candidates, admissionFrames);
}

function sampleFlipped(node: HandoffNode, gap: Gap, ctx: SpecContext, gaps: Gap[], count: number, seed: number): Arm {
  const rng = makeRng(seed);
  const probe = getCandidateProbe(node.search.prefixEngine, gap, ctx);
  const axisMeasureEnd = axisLookaheadEndFrame(gap, ctx.allContactFrames);
  const candidates: Digest[] = [];
  let admissionFrames = 0;
  for (let attempt = 0; attempt < count; attempt++) {
    const rawGeometry = sampleArcPlacementGeometry(
      rng, probe.refX, probe.refY, gap.targets, probe.targetState, attempt, gap,
      node.search.prefixNextLineId, "normal", ctx.allContactFrames,
    );
    const geometry = { ...rawGeometry, lines: rawGeometry.lines.map((line) => ({ ...line, flipped: !line.flipped })) };
    const before = getSimFrames();
    const fit = tryCandidateGeometry(
      node.search.prefixEngine, gap, geometry, node.search.prefixNextLineId,
      ctx.allContactFrames, axisMeasureEnd, gap.targets, true, "normal", probe.preTargetSledTrace,
    ) as Candidate | null;
    const simFrames = getSimFrames() - before;
    admissionFrames += simFrames;
    if (fit !== null) {
      fit.ref = { x: probe.targetState.sledX, y: probe.targetState.sledY };
      fit.sampleAttempt = attempt;
      candidates.push(digest(fit, node, gap, gaps, ctx, simFrames));
    }
  }
  return summarizeArm(count, candidates, admissionFrames);
}

/**
 * The current normal source defines its collision placement anchor from four
 * sled points only.  The engine, however, resolves the complete articulated
 * collision body.  This observation uses the gravity support point of that
 * complete body: the point that would first meet a flat floor at the exact
 * target frame.  It intentionally retains the current COM velocity and every
 * raw normal coordinate, so this changes a physical collision coordinate
 * rather than creating a pose score, a named-body-point lane, or a control
 * menu.
 */
function allBodyGravitySupportState(
  node: HandoffNode,
  gap: Gap,
  ctx: SpecContext,
): { ordinary: ImpactFrameTargetState; targetState: ImpactFrameTargetState; point: string } {
  const ordinary = getCandidateProbe(node.search.prefixEngine, gap, ctx);
  const rider = getRiderMetered(node.search.prefixEngine, gap.endFrame);
  let supportX = ordinary.targetState.sledX;
  let supportY = ordinary.targetState.sledY;
  let point = "sled";
  for (const name of COMPLETE_COLLISION_POINTS) {
    const position = rider.get(name)?.pos;
    if (position !== undefined && Number.isFinite(position.x) && Number.isFinite(position.y) && position.y > supportY) {
      supportX = position.x;
      supportY = position.y;
      point = name;
    }
  }
  return { ordinary: ordinary.targetState, targetState: { ...ordinary.targetState, sledX: supportX, sledY: supportY }, point };
}

function sampleAllBodySupportAnchored(
  node: HandoffNode,
  gap: Gap,
  ctx: SpecContext,
  gaps: Gap[],
  count: number,
  seed: number,
  targetState: ImpactFrameTargetState,
): Arm {
  const rng = makeRng(seed);
  const probe = getCandidateProbe(node.search.prefixEngine, gap, ctx);
  const axisMeasureEnd = axisLookaheadEndFrame(gap, ctx.allContactFrames);
  const candidates: Digest[] = [];
  let admissionFrames = 0;
  for (let attempt = 0; attempt < count; attempt++) {
    const geometry = sampleArcPlacementGeometry(
      rng, probe.refX, probe.refY, gap.targets, targetState, attempt, gap,
      node.search.prefixNextLineId, "normal", ctx.allContactFrames,
    );
    const before = getSimFrames();
    const fit = tryCandidateGeometry(
      node.search.prefixEngine,
      gap,
      geometry,
      node.search.prefixNextLineId,
      ctx.allContactFrames,
      axisMeasureEnd,
      gap.targets,
      true,
      "normal",
      probe.preTargetSledTrace,
    ) as Candidate | null;
    const simFrames = getSimFrames() - before;
    admissionFrames += simFrames;
    if (fit !== null) {
      fit.ref = { x: targetState.sledX, y: targetState.sledY };
      fit.sampleAttempt = attempt;
      candidates.push(digest(fit, node, gap, gaps, ctx, simFrames));
    }
  }
  return summarizeArm(count, candidates, admissionFrames);
}

/**
 * Unlike the gravity-envelope control above, this basis uses each generated
 * candidate's own contact-plane normal.  A tilted plane can expose a different
 * leading point even when the body's vertical support point is the sled.
 */
function sampleSurfaceNormalBodySupportAnchored(
  node: HandoffNode,
  gap: Gap,
  ctx: SpecContext,
  gaps: Gap[],
  count: number,
  seed: number,
): { arm: Arm; telemetry: SurfaceNormalAnchorTelemetry } {
  const rng = makeRng(seed);
  const probe = getCandidateProbe(node.search.prefixEngine, gap, ctx);
  const rider = getRiderMetered(node.search.prefixEngine, gap.endFrame);
  const body = COMPLETE_COLLISION_POINTS.flatMap((name): BodyCollisionPoint[] => {
    const position = rider.get(name)?.pos;
    return position !== undefined && Number.isFinite(position.x) && Number.isFinite(position.y)
      ? [{ name, x: position.x, y: position.y }]
      : [];
  });
  if (body.length !== COMPLETE_COLLISION_POINTS.length) {
    throw new Error(`surface-normal support anchor requires ${COMPLETE_COLLISION_POINTS.length} readable collision points, got ${body.length}`);
  }
  const axisMeasureEnd = axisLookaheadEndFrame(gap, ctx.allContactFrames);
  const candidates: Digest[] = [];
  let admissionFrames = 0;
  let readableContactVertices = 0;
  let shiftedGeometries = 0;
  const shifts: number[] = [];
  const supportPointCounts: Record<string, number> = {};
  for (let attempt = 0; attempt < count; attempt++) {
    const rawGeometry = sampleArcPlacementGeometry(
      rng, probe.refX, probe.refY, gap.targets, probe.targetState, attempt, gap,
      node.search.prefixNextLineId, "normal", ctx.allContactFrames,
    );
    const support = surfaceNormalSupportOffset(rawGeometry, probe.targetState, body);
    const geometry = support === null
      ? rawGeometry
      : {
        ...rawGeometry,
        lines: rawGeometry.lines.map((line) => ({
          ...line,
          x1: line.x1 + support.deltaX,
          y1: line.y1 + support.deltaY,
          x2: line.x2 + support.deltaX,
          y2: line.y2 + support.deltaY,
        })),
      };
    if (support !== null) {
      readableContactVertices++;
      shifts.push(Math.abs(support.normalShiftPx));
      supportPointCounts[support.point] = (supportPointCounts[support.point] ?? 0) + 1;
      if (Math.abs(support.normalShiftPx) > 1e-9) shiftedGeometries++;
    }
    const before = getSimFrames();
    const fit = tryCandidateGeometry(
      node.search.prefixEngine,
      gap,
      geometry,
      node.search.prefixNextLineId,
      ctx.allContactFrames,
      axisMeasureEnd,
      gap.targets,
      true,
      "normal",
      probe.preTargetSledTrace,
    ) as Candidate | null;
    const simFrames = getSimFrames() - before;
    admissionFrames += simFrames;
    if (fit !== null) {
      fit.ref = support === null
        ? { x: probe.targetState.sledX, y: probe.targetState.sledY }
        : { x: probe.targetState.sledX + support.deltaX, y: probe.targetState.sledY + support.deltaY };
      fit.sampleAttempt = attempt;
      candidates.push(digest(fit, node, gap, gaps, ctx, simFrames));
    }
  }
  return {
    arm: summarizeArm(count, candidates, admissionFrames),
    telemetry: {
      geometries: count,
      readableContactVertices,
      shiftedGeometries,
      meanAbsNormalShiftPx: mean(shifts),
      maxAbsNormalShiftPx: shifts.length === 0 ? null : round(Math.max(...shifts)),
      supportPointCounts,
    },
  };
}

function surfaceNormalSupportOffset(
  geometry: ReturnType<typeof sampleArcPlacementGeometry>,
  ordinary: ImpactFrameTargetState,
  body: readonly BodyCollisionPoint[],
): { point: string; deltaX: number; deltaY: number; normalShiftPx: number } | null {
  let contactLine: typeof geometry.lines[number] | null = null;
  let closest = Infinity;
  for (const line of geometry.lines) {
    const length = Math.hypot(line.x2 - line.x1, line.y2 - line.y1);
    if (!(length > 1e-9)) continue;
    const distance = (line.x1 - ordinary.sledX) ** 2 + (line.y1 - ordinary.sledY) ** 2;
    if (distance < closest) {
      closest = distance;
      contactLine = line;
    }
  }
  if (contactLine === null) return null;
  const dx = contactLine.x2 - contactLine.x1;
  const dy = contactLine.y2 - contactLine.y1;
  const length = Math.hypot(dx, dy);
  if (!(length > 1e-9)) return null;
  let normalX = -dy / length;
  let normalY = dx / length;
  if (normalY < 0) {
    normalX *= -1;
    normalY *= -1;
  }
  const ordinaryProjection = ordinary.sledX * normalX + ordinary.sledY * normalY;
  let point = "";
  let supportProjection = -Infinity;
  for (const candidate of body) {
    const projection = candidate.x * normalX + candidate.y * normalY;
    if (projection > supportProjection) {
      supportProjection = projection;
      point = candidate.name;
    }
  }
  if (!Number.isFinite(supportProjection) || point === "") return null;
  const normalShiftPx = supportProjection - ordinaryProjection;
  return {
    point,
    deltaX: normalX * normalShiftPx,
    deltaY: normalY * normalShiftPx,
    normalShiftPx,
  };
}

function sampleTerminalEndpointExtended(
  node: HandoffNode,
  gap: Gap,
  ctx: SpecContext,
  gaps: Gap[],
  count: number,
  seed: number,
): Arm {
  const rng = makeRng(seed);
  const probe = getCandidateProbe(node.search.prefixEngine, gap, ctx);
  const axisMeasureEnd = axisLookaheadEndFrame(gap, ctx.allContactFrames);
  const candidates: Digest[] = [];
  let admissionFrames = 0;
  for (let attempt = 0; attempt < count; attempt++) {
    const rawGeometry = sampleArcPlacementGeometry(
      rng, probe.refX, probe.refY, gap.targets, probe.targetState, attempt, gap,
      node.search.prefixNextLineId, "normal", ctx.allContactFrames,
    );
    const lines = rawGeometry.lines.map((line, index) => ({
      ...line,
      rightExtended: index === rawGeometry.lines.length - 1 ? true : line.rightExtended,
    }));
    if (lines.length === 0) throw new Error("normal proposal has no terminal line to extend");
    const before = getSimFrames();
    const fit = tryCandidateGeometry(
      node.search.prefixEngine,
      gap,
      { ...rawGeometry, lines },
      node.search.prefixNextLineId,
      ctx.allContactFrames,
      axisMeasureEnd,
      gap.targets,
      true,
      "normal",
      probe.preTargetSledTrace,
    ) as Candidate | null;
    const simFrames = getSimFrames() - before;
    admissionFrames += simFrames;
    if (fit !== null) {
      fit.ref = { x: probe.targetState.sledX, y: probe.targetState.sledY };
      fit.sampleAttempt = attempt;
      candidates.push(digest(fit, node, gap, gaps, ctx, simFrames));
    }
  }
  return summarizeArm(count, candidates, admissionFrames);
}

/**
 * Type 2 is scenery in lr-core: it leaves the proposed terminal geometry and
 * its bookkeeping intact, but the engine does not collide with that segment.
 * The preceding normal lines remain solid, so this isolates a terminal release
 * boundary rather than changing the capture surface or normal-pool sampling.
 */
function sampleTerminalSceneryRelease(
  node: HandoffNode,
  gap: Gap,
  ctx: SpecContext,
  gaps: Gap[],
  count: number,
  seed: number,
): Arm {
  const rng = makeRng(seed);
  const probe = getCandidateProbe(node.search.prefixEngine, gap, ctx);
  const axisMeasureEnd = axisLookaheadEndFrame(gap, ctx.allContactFrames);
  const candidates: Digest[] = [];
  let admissionFrames = 0;
  for (let attempt = 0; attempt < count; attempt++) {
    const rawGeometry = sampleArcPlacementGeometry(
      rng, probe.refX, probe.refY, gap.targets, probe.targetState, attempt, gap,
      node.search.prefixNextLineId, "normal", ctx.allContactFrames,
    );
    const lines = rawGeometry.lines.map((line, index) => ({
      ...line,
      type: index === rawGeometry.lines.length - 1 ? 2 : line.type,
    }));
    if (lines.length === 0) throw new Error("normal proposal has no terminal line to release");
    const before = getSimFrames();
    const fit = tryCandidateGeometry(
      node.search.prefixEngine,
      gap,
      { ...rawGeometry, lines },
      node.search.prefixNextLineId,
      ctx.allContactFrames,
      axisMeasureEnd,
      gap.targets,
      true,
      "normal",
      probe.preTargetSledTrace,
    ) as Candidate | null;
    const simFrames = getSimFrames() - before;
    admissionFrames += simFrames;
    if (fit !== null) {
      fit.ref = { x: probe.targetState.sledX, y: probe.targetState.sledY };
      fit.sampleAttempt = attempt;
      candidates.push(digest(fit, node, gap, gaps, ctx, simFrames));
    }
  }
  return summarizeArm(count, candidates, admissionFrames);
}

/**
 * A Line Rider line is an infinitely thin one-way collision surface, whereas
 * the rider's sled has a finite physical span.  This comparator materializes a
 * minimal contact patch: after the candidate's target-adjacent post-contact
 * vertex, collision remains enabled for exactly one full measured sled span
 * plus one target-state travel frame.  The unchanged visible remainder is
 * scenery.  It is intentionally neither the retired terminal aperture nor a
 * length/angle tune: its length is determined entirely by the instantaneous
 * collision body and velocity.
 */
function sampleContactPatchReleased(
  node: HandoffNode,
  gap: Gap,
  ctx: SpecContext,
  gaps: Gap[],
  count: number,
  seed: number,
): { arm: Arm; telemetry: ContactPatchTelemetry } {
  const rng = makeRng(seed);
  const probe = getCandidateProbe(node.search.prefixEngine, gap, ctx);
  const sledSpan = measuredSledSpan(node.search.prefixEngine, gap.endFrame);
  const axisMeasureEnd = axisLookaheadEndFrame(gap, ctx.allContactFrames);
  const candidates: Digest[] = [];
  let admissionFrames = 0;
  let patchAvailable = 0;
  let releasedGeometries = 0;
  let splitGeometries = 0;
  let releasedLines = 0;
  const patchLengths: number[] = [];
  const collidableLengths: number[] = [];
  for (let attempt = 0; attempt < count; attempt++) {
    const rawGeometry = sampleArcPlacementGeometry(
      rng, probe.refX, probe.refY, gap.targets, probe.targetState, attempt, gap,
      node.search.prefixNextLineId, "normal", ctx.allContactFrames,
    );
    const patch = contactPatchReleaseGeometry(rawGeometry, probe.targetState, sledSpan, node.search.prefixNextLineId);
    if (patch !== null) {
      patchAvailable++;
      patchLengths.push(patch.patchLengthPx);
      collidableLengths.push(patch.collidablePostLengthPx);
      if (patch.releasedLines > 0) releasedGeometries++;
      if (patch.split) splitGeometries++;
      releasedLines += patch.releasedLines;
    }
    const geometry = patch === null ? rawGeometry : { ...rawGeometry, lines: patch.lines };
    const before = getSimFrames();
    const fit = tryCandidateGeometry(
      node.search.prefixEngine,
      gap,
      geometry,
      node.search.prefixNextLineId,
      ctx.allContactFrames,
      axisMeasureEnd,
      gap.targets,
      true,
      "normal",
      probe.preTargetSledTrace,
    ) as Candidate | null;
    const simFrames = getSimFrames() - before;
    admissionFrames += simFrames;
    if (fit !== null) {
      fit.ref = { x: probe.targetState.sledX, y: probe.targetState.sledY };
      fit.sampleAttempt = attempt;
      candidates.push(digest(fit, node, gap, gaps, ctx, simFrames));
    }
  }
  return {
    arm: summarizeArm(count, candidates, admissionFrames),
    telemetry: {
      geometries: count,
      patchAvailable,
      releasedGeometries,
      splitGeometries,
      releasedLines,
      meanPatchLengthPx: mean(patchLengths),
      meanCollidablePostLengthPx: mean(collidableLengths),
    },
  };
}

function measuredSledSpan(engine: unknown, frame: number): number {
  const rider = getRiderMetered(engine, frame);
  const points = ["PEG", "TAIL", "NOSE", "STRING"].flatMap((name): Array<{ x: number; y: number }> => {
    const position = rider.get(name)?.pos;
    return position !== undefined && Number.isFinite(position.x) && Number.isFinite(position.y)
      ? [{ x: position.x, y: position.y }]
      : [];
  });
  if (points.length < 2) throw new Error(`contact patch requires at least two readable sled points, got ${points.length}`);
  let span = 0;
  for (let left = 0; left < points.length; left++) {
    for (let right = left + 1; right < points.length; right++) {
      span = Math.max(span, Math.hypot(points[left].x - points[right].x, points[left].y - points[right].y));
    }
  }
  if (!(span > 0) || !Number.isFinite(span)) throw new Error(`contact patch received invalid sled span ${span}`);
  return span;
}

function contactPatchReleaseGeometry(
  geometry: ReturnType<typeof sampleArcPlacementGeometry>,
  targetState: ImpactFrameTargetState,
  sledSpan: number,
  lineIdStart: number,
): {
  lines: ReturnType<typeof sampleArcPlacementGeometry>["lines"];
  patchLengthPx: number;
  collidablePostLengthPx: number;
  split: boolean;
  releasedLines: number;
} | null {
  let postStart = -1;
  let closest = Infinity;
  for (let index = 0; index < geometry.lines.length; index++) {
    const line = geometry.lines[index];
    const distance = (line.x1 - targetState.sledX) ** 2 + (line.y1 - targetState.sledY) ** 2;
    if (distance < closest) {
      closest = distance;
      postStart = index;
    }
  }
  if (postStart < 0 || postStart >= geometry.lines.length) return null;
  const patchLengthPx = sledSpan + Math.max(0, targetState.speed);
  if (!(patchLengthPx > 0) || !Number.isFinite(patchLengthPx)) return null;
  let remaining = patchLengthPx;
  let collidablePostLengthPx = 0;
  let split = false;
  let releasedLines = 0;
  const lines: ReturnType<typeof sampleArcPlacementGeometry>["lines"] = [];
  let id = lineIdStart;
  for (let index = 0; index < geometry.lines.length; index++) {
    const line = geometry.lines[index];
    if (index < postStart) {
      lines.push({ ...line, id: id++ });
      continue;
    }
    const dx = line.x2 - line.x1;
    const dy = line.y2 - line.y1;
    const length = Math.hypot(dx, dy);
    if (!(length > 1e-9)) {
      lines.push({ ...line, id: id++, type: 2 });
      releasedLines++;
      continue;
    }
    if (remaining >= length - 1e-9) {
      lines.push({ ...line, id: id++ });
      remaining -= length;
      collidablePostLengthPx += length;
      continue;
    }
    if (remaining > 1e-9) {
      const fraction = remaining / length;
      const splitPoint = { x: line.x1 + dx * fraction, y: line.y1 + dy * fraction };
      lines.push({ ...line, id: id++, x2: splitPoint.x, y2: splitPoint.y, rightExtended: false });
      lines.push({ ...line, id: id++, type: 2, x1: splitPoint.x, y1: splitPoint.y, leftExtended: false });
      collidablePostLengthPx += remaining;
      remaining = 0;
      split = true;
      releasedLines++;
      continue;
    }
    lines.push({ ...line, id: id++, type: 2 });
    releasedLines++;
  }
  return { lines, patchLengthPx, collidablePostLengthPx, split, releasedLines };
}

/**
 * lr-core's type-1 acceleration points opposite the stored tangent. Reversing
 * the segment and toggling `flipped` keeps the original active normal while
 * changing the force to the physical forward tangent. Swapping extension bits
 * preserves each bounded physical endpoint after the representation reversal.
 */
function forwardAccelerationLine(line: ReturnType<typeof sampleArcPlacementGeometry>["lines"][number]) {
  return {
    ...line,
    type: 1,
    x1: line.x2,
    y1: line.y2,
    x2: line.x1,
    y2: line.y1,
    flipped: !line.flipped,
    leftExtended: line.rightExtended,
    rightExtended: line.leftExtended,
  };
}

function sampleForwardAccelerated(
  node: HandoffNode,
  gap: Gap,
  ctx: SpecContext,
  gaps: Gap[],
  count: number,
  seed: number,
): Arm {
  const rng = makeRng(seed);
  const probe = getCandidateProbe(node.search.prefixEngine, gap, ctx);
  const axisMeasureEnd = axisLookaheadEndFrame(gap, ctx.allContactFrames);
  const candidates: Digest[] = [];
  let admissionFrames = 0;
  for (let attempt = 0; attempt < count; attempt++) {
    const rawGeometry = sampleArcPlacementGeometry(
      rng, probe.refX, probe.refY, gap.targets, probe.targetState, attempt, gap,
      node.search.prefixNextLineId, "normal", ctx.allContactFrames,
    );
    const geometry = { ...rawGeometry, lines: rawGeometry.lines.map(forwardAccelerationLine) };
    const before = getSimFrames();
    const fit = tryCandidateGeometry(
      node.search.prefixEngine,
      gap,
      geometry,
      node.search.prefixNextLineId,
      ctx.allContactFrames,
      axisMeasureEnd,
      gap.targets,
      true,
      "normal",
      probe.preTargetSledTrace,
    ) as Candidate | null;
    const simFrames = getSimFrames() - before;
    admissionFrames += simFrames;
    if (fit !== null) {
      fit.ref = { x: probe.targetState.sledX, y: probe.targetState.sledY };
      fit.sampleAttempt = attempt;
      candidates.push(digest(fit, node, gap, gaps, ctx, simFrames));
    }
  }
  return summarizeArm(count, candidates, admissionFrames);
}

function summarizeArm(attempts: number, candidates: Digest[], admissionFrames: number): Arm {
  const finiteAxis = candidates.filter((candidate) => Number.isFinite(candidate.axisRms));
  const finiteObjective = candidates.filter((candidate) => candidate.objective !== null);
  return {
    attempts,
    viable: candidates.length,
    admissionFrames,
    bestCost: minOrNull(candidates.map((candidate) => candidate.cost)),
    bestAxisRms: minOrNull(finiteAxis.map((candidate) => candidate.axisRms)),
    bestObjective: maxOrNull(finiteObjective.map((candidate) => candidate.objective!)),
    candidates,
  };
}

function digest(candidate: Candidate, node: HandoffNode, gap: Gap, gaps: Gap[], ctx: SpecContext, simFrames: number): Digest {
  return {
    attempt: candidate.sampleAttempt ?? -1,
    hash: geometryHash(candidate),
    cost: round(candidate.cost),
    axisRms: round(axisRms(candidate, ctx.gapAxisTargets?.[gap.index] ?? gap.targets)),
    objective: nullableRound(candidateQualityObjective(node.search.prefixEngine, candidate, gap, gaps, ctx)),
    simFrames,
  };
}

function axisRms(candidate: Candidate, targets: AxisValues): number {
  const achieved = candidate.achievedAtEnd ?? candidate.achieved;
  const errors = Object.entries(targets).flatMap(([axis, target]) => {
    const value = achieved[axis as keyof AxisValues];
    return typeof target === "number" && typeof value === "number" && Number.isFinite(value) ? [(value - target) ** 2] : [];
  });
  return errors.length === 0 ? Infinity : Math.sqrt(errors.reduce((sum, value) => sum + value, 0) / errors.length);
}

function compareRawReplay(generated: readonly { attempt: number; hash: string }[], replayed: readonly Digest[]): { ok: boolean; message: string } {
  const expected = [...generated].sort((a, b) => a.attempt - b.attempt);
  const actual = [...replayed].map(({ attempt, hash }) => ({ attempt, hash })).sort((a, b) => a.attempt - b.attempt);
  if (expected.length !== actual.length) return { ok: false, message: `viable count ${actual.length} does not match generation-time ${expected.length}` };
  for (let index = 0; index < expected.length; index++) {
    if (expected[index].attempt !== actual[index].attempt || expected[index].hash !== actual[index].hash) {
      return { ok: false, message: `candidate mismatch at viable index ${index}: expected a${expected[index].attempt}/${expected[index].hash.slice(0, 12)}, got a${actual[index].attempt}/${actual[index].hash.slice(0, 12)}` };
    }
  }
  return { ok: true, message: "sample attempts and coordinate-plus-side hashes match generation-time raw-normal pool" };
}

function checkpointGapIndices(gaps: readonly Gap[]): Map<number, Checkpoint> {
  const contacts = gaps.filter((gap) => gap.endsWithContact).map((gap) => gap.index);
  if (contacts.length < 3) throw new Error("frozen source has fewer than three contact gaps");
  const first = contacts[Math.floor((contacts.length - 1) / 3)];
  const second = contacts[Math.floor((2 * (contacts.length - 1)) / 3)];
  if (first === undefined || second === undefined || first === second) throw new Error("unable to derive distinct one-third/two-thirds checkpoint gaps");
  return new Map([[first, "one_third"], [second, "two_thirds"]]);
}

type Setup = { gaps: Gap[]; ctx: SpecContext };
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

function geometryHash(candidate: Candidate): string {
  return createHash("sha256").update(JSON.stringify(candidate.lines.map((line) => [
    round(line.x1), round(line.y1), round(line.x2), round(line.y2), Boolean(line.flipped),
  ]))).digest("hex");
}

function summarize(rows: readonly Row[]) {
  const usable = rows.filter((row) => row.replayEquivalent === true && row.deltas !== null);
  const byRegime = Object.fromEntries([...new Set(ACTIVE_CASES.map((entry) => entry.regime))].map((regime) =>
    [regime, summarizeRows(usable.filter((row) => row.regime === regime))]
  ));
  const summaries = Object.values(byRegime) as ReturnType<typeof summarizeRows>[];
  return {
    declaredRows: rows.length,
    captureAvailable: rows.filter((row) => row.captureAvailable).length,
    replayEquivalent: rows.filter((row) => row.replayEquivalent === true).length,
    replayFailures: rows.filter((row) => row.replayEquivalent === false).length,
    usableRows: usable.length,
    alternativeViableRows: usable.filter((row) => (row.alternative?.viable ?? 0) > 0).length,
    byRegime,
    regimeBalanced: {
      viableDelta: mean(summaries.map((row) => row.viableDelta).filter(isFiniteNumber)),
      admissionFramesImprovement: mean(summaries.map((row) => row.admissionFramesImprovement).filter(isFiniteNumber)),
      bestAxisRmsImprovement: mean(summaries.map((row) => row.bestAxisRmsImprovement).filter(isFiniteNumber)),
      bestObjectiveImprovement: mean(summaries.map((row) => row.bestObjectiveImprovement).filter(isFiniteNumber)),
      bestCostImprovement: mean(summaries.map((row) => row.bestCostImprovement).filter(isFiniteNumber)),
    },
  };
}

function summarizeRows(rows: readonly Row[]) {
  return {
    rows: rows.length,
    viableDelta: mean(rows.map((row) => row.deltas!.viable)),
    admissionFramesImprovement: mean(rows.map((row) => row.deltas!.admissionFrames).filter(isFiniteNumber)),
    bestAxisRmsImprovement: mean(rows.map((row) => row.deltas!.bestAxisRms).filter(isFiniteNumber)),
    bestObjectiveImprovement: mean(rows.map((row) => row.deltas!.bestObjective).filter(isFiniteNumber)),
    bestCostImprovement: mean(rows.map((row) => row.deltas!.bestCost).filter(isFiniteNumber)),
  };
}

function improvement(production: number | null, comparator: number | null, higherIsBetter: boolean): number | null {
  return production === null || comparator === null ? null : round(higherIsBetter ? comparator - production : production - comparator);
}
function minOrNull(values: readonly number[]): number | null { return values.length === 0 ? null : round(Math.min(...values)); }
function maxOrNull(values: readonly number[]): number | null { return values.length === 0 ? null : round(Math.max(...values)); }
function mean(values: readonly number[]): number | null { return values.length === 0 ? null : round(values.reduce((sum, value) => sum + value, 0) / values.length); }
function nullableRound(value: number | null): number | null { return value === null || !Number.isFinite(value) ? null : round(value); }
function isFiniteNumber(value: number | null): value is number { return value !== null && Number.isFinite(value); }
function round(value: number): number { return Math.round(value * 1_000_000) / 1_000_000; }
