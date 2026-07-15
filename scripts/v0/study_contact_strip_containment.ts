/**
 * Target-frame contact-strip containment study.
 *
 * This is deliberately not a compiler candidate source. It asks a narrow,
 * falsifiable question: can an explicit target-frame coordinate losslessly
 * represent known exact dense-contact geometries, and what local admission
 * basin does the exact evaluator expose around them?
 */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import dense from "../../benchmark/v2/cases/normative/capability/frontier_dense_recovery.ts";
import dense240 from "../../benchmark/v2/cases/variants/capability/frontier_dense_recovery_240ms_figures.ts";
import { benchmarkPolicy } from "../../benchmark/v2/policy.ts";
import { makeRng } from "../lib/rng.ts";
import { getRiderMetered } from "../lib/detector.ts";
import { clearImpactTemplateMarker, readTargetStateFromRider, snapshotArcPlacementStats } from "./arc_placement.ts";
import { axisLookaheadEndFrame, tryCandidateLines } from "./core/candidate.ts";
import { effectiveAxes, sampleGapTargets, sliceTimeline } from "./core/substrate.ts";
import { compilerCandidateIdentity } from "./benchmark_v2/compiler_identity.ts";
import { fingerprintFiles } from "./benchmark_v2/suite_model.ts";
import {
  disableLandingWindowProbe,
  drainLandingWindowProbe,
  enableLandingWindowProbe,
  type LandingWindowProbeRecord,
} from "./landing_probe.ts";
import {
  compileHandoff,
  setForwardEvalContext,
  type HandoffNode,
  type HandoffNodeEvent,
} from "./optimizer/handoff.ts";
import { getCandidateProbe, type SpecContext } from "./optimizer/sample.ts";
import { applyJolt } from "../produce/seed.ts";
import { scoreDriftReport } from "./score.ts";
import {
  CALIB,
  FPS,
  secToFrame,
  type AxisValues,
  type Gap,
  type Spec,
  type TrackLine,
} from "./types.ts";
import {
  extractContactStrip,
  extractExactContactStripProfile,
  maximumLineCoordinateError,
  realizeContactStrip,
  realizeExactContactStripProfile,
  type ContactFrame,
  type ContactStripControl,
} from "./trajectory/contact_strip.ts";
import {
  makePhysicalPrefixFixture,
  rebuildPhysicalPrefixEngine,
  type PhysicalPrefixFixture,
} from "./trajectory/study_fixture.ts";
import type { LeafKey } from "./optimizer/register.ts";

const argv = process.argv.slice(2);
const argument = (name: string): string | undefined =>
  argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);

if (argv.includes("--help") || argv.includes("-h")) {
  process.stdout.write([
    "Usage: study_contact_strip_containment.ts [--case=dense|dense240|all] [--budget=500000] [--out=FILE]",
    "",
    "Runs a study-only target-frame replay of seven previously observed dense",
    "witnesses. The witnesses prove representation containment only; they are",
    "never sampled or imported by production compiler code.",
  ].join("\n") + "\n");
  process.exit(0);
}

type Witness = { id: string; attempt: number; phaseFrames: number };
type CaseDefinition = {
  id: "dense" | "dense240";
  sourcePath: string;
  spec: Spec;
  seed: number;
  targetGap: number;
  witnesses: Witness[];
};

// These are historic witness *indices*, not generator inputs. Reconstructing
// their geometry makes the containment test repeatable without handing a
// production lane any case-specific numeric tuple.
const CASES: Record<CaseDefinition["id"], CaseDefinition> = {
  dense: {
    id: "dense",
    sourcePath: "benchmark/v2/cases/normative/capability/frontier_dense_recovery.ts",
    spec: dense,
    seed: 3057130498,
    targetGap: 69,
    witnesses: [
      { id: "g69-a1387", attempt: 1387, phaseFrames: 3 },
      { id: "g69-a3342", attempt: 3342, phaseFrames: 6 },
      { id: "g69-a915", attempt: 915, phaseFrames: 3 },
    ],
  },
  dense240: {
    id: "dense240",
    sourcePath: "benchmark/v2/cases/variants/capability/frontier_dense_recovery_240ms_figures.ts",
    spec: dense240,
    seed: 3057130496,
    targetGap: 86,
    witnesses: [
      { id: "g86-a1369", attempt: 1369, phaseFrames: 1 },
      { id: "g86-a535", attempt: 535, phaseFrames: 7 },
      { id: "g86-a2705", attempt: 2705, phaseFrames: 1 },
      { id: "g86-a1162", attempt: 1162, phaseFrames: 2 },
    ],
  },
};

const STUDY_SOURCE_FILES = [
  "scripts/v0/study_contact_strip_containment.ts",
  "scripts/v0/trajectory/contact_strip.ts",
  "scripts/v0/trajectory/study_fixture.ts",
  "scripts/v0/arc_placement.ts",
  "scripts/v0/core/candidate.ts",
  "scripts/v0/core/substrate.ts",
  "scripts/v0/optimizer/handoff.ts",
  "scripts/v0/optimizer/sample.ts",
  "scripts/v0/landing_probe.ts",
  "scripts/produce/seed.ts",
  "benchmark/v2/policy.ts",
  ...Object.values(CASES).map((definition) => definition.sourcePath),
] as const;

const requestedCase = argument("case") ?? "all";
if (requestedCase !== "all" && !(requestedCase in CASES)) {
  throw new Error(`unknown --case=${requestedCase}`);
}
const budget = integerArgument("budget", 500_000);
if (budget <= 0) throw new Error(`invalid --budget=${budget}`);
const outPath = argument("out");
const selectedCases = requestedCase === "all"
  ? Object.values(CASES)
  : [CASES[requestedCase as CaseDefinition["id"]]];

const started = performance.now();
const cases = selectedCases.map((definition) => runCase(definition, budget));
const output = {
  schema: "line.study-contact-strip-containment.v1",
  purpose: [
    "Prove or falsify target-frame coordinate containment for known exact contact geometry.",
    "This is not a generator comparison, performance claim, or selection policy.",
  ],
  argv: [...argv],
  elapsedMs: round(performance.now() - started),
  cases,
  interpretation: {
    exactReplayRequirement: "Each reconstructed witness and its target-frame replay must pass exact current-gap admission.",
    compactRequirement: "Compact endpoint-turn replay must match every raw coordinate within 1e-8 pixels.",
    smoothReplayMeaning: "Tangent-continuous rows are new geometry, never presented as a replay equivalence.",
    localPerturbationMeaning: "A perturbation describes only local exact admission, not continuation quality or production value.",
  },
};
const json = `${JSON.stringify(output, null, 2)}\n`;
if (outPath === undefined) process.stdout.write(json);
else {
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, json);
  console.error(`study -> ${outPath}`);
}

type Visit = { node: HandoffNode; key: LeafKey; event: HandoffNodeEvent };

function runCase(definition: CaseDefinition, runBudget: number) {
  const spec = applyJolt(definition.spec, benchmarkPolicy.transform.joltMs);
  const setup = buildSetup(spec, definition.seed);
  setForwardEvalContext(setup.spec, setup.gapAxisTargets);
  const visits: Visit[] = [];
  const startedCase = performance.now();
  const baseline = compileHandoff(spec, definition.seed, {
    budget: runBudget,
    onNode(node, key, event) {
      visits.push({ node, key, event });
    },
  });
  const deepest = deepestUnskippedVisit(visits);
  if (deepest === null) throw new Error(`${definition.id}: baseline produced no unskipped prefix`);
  const parent = exactVisitOnDeepestPath(visits, deepest, definition.targetGap);
  if (parent === null) {
    throw new Error(`${definition.id}: missing requested target prefix g${definition.targetGap}`);
  }
  const gap = setup.gaps[parent.node.search.gapIndex];
  if (gap === undefined || !gap.endsWithContact) {
    throw new Error(`${definition.id}: g${definition.targetGap} is not a contact gap`);
  }

  const fixture = makePhysicalPrefixFixture(parent.node);
  const fixtureFingerprint = sha256(stableJson(fixture));
  const originalProbe = getCandidateProbe(parent.node.search.prefixEngine, gap, setup.ctx);
  const rebuiltEngine = rebuildPhysicalPrefixEngine(fixture);
  const rebuiltProbe = getCandidateProbe(rebuiltEngine, gap, setup.ctx);
  assertSameTargetCheckpoint(definition.id, originalProbe.targetState, rebuiltProbe.targetState);
  const targetFrame: ContactFrame = {
    reference: { x: originalProbe.targetState.sledX, y: originalProbe.targetState.sledY },
    headingDeg: originalProbe.targetState.angleDeg,
  };

  enableLandingWindowProbe();
  let witnesses: unknown[];
  try {
    witnesses = definition.witnesses.map((witness) => evaluateWitness({
      definition,
      witness,
      gap,
      setup,
      targetFrame,
      engine: rebuiltEngine,
      lineIdStart: fixture.prefixNextLineId,
      preTargetSledTrace: rebuiltProbe.preTargetSledTrace,
    }));
  } finally {
    disableLandingWindowProbe();
  }

  const baselineScore = scoreDriftReport(baseline.report, { totalFrames: Math.round(spec.duration * FPS) });
  const materialized = materializedInput(setup);
  const provenance = makeProvenance({
    definition,
    runBudget,
    materialized,
    fixture,
    fixtureFingerprint,
  });
  return {
    id: definition.id,
    seed: definition.seed,
    budget: runBudget,
    elapsedMs: round(performance.now() - startedCase),
    baseline: {
      valid: baselineScore.contract_passed,
      score: round(baselineScore.score),
      deepestGap: baseline.stats.handoff_deepest_seen_gap ?? null,
      targetGap: gap.index,
      targetPrefixSimFrames: parent.event.simFrames,
    },
    provenance,
    physicalPrefix: fixture,
    physicalPrefixFingerprint: fixtureFingerprint,
    materialized,
    targetFrame: summarizeTargetFrame(originalProbe.targetState),
    fixtureReplay: {
      targetFrameMatches: true,
      rebuiltTargetFrame: summarizeTargetFrame(rebuiltProbe.targetState),
    },
    witnesses,
  };
}

function evaluateWitness(input: {
  definition: CaseDefinition;
  witness: Witness;
  gap: Gap;
  setup: ReturnType<typeof buildSetup>;
  targetFrame: ContactFrame;
  // deno-lint-ignore no-explicit-any
  engine: any;
  lineIdStart: number;
  preTargetSledTrace: () => number[];
}) {
  const { witness, gap, setup, targetFrame } = input;
  if (witness.attempt % 8 !== witness.phaseFrames) {
    throw new Error(`${input.definition.id}:${witness.id} has inconsistent phase witness`);
  }
  const targetProbe = getCandidateProbe(input.engine, gap, setup.ctx);
  const phaseRider = getRiderMetered(input.engine, gap.endFrame - witness.phaseFrames);
  const phaseState = readTargetStateFromRider(
    phaseRider,
    targetProbe.targetState.sledX,
    targetProbe.targetState.sledY,
  );
  const reconstructed = legacyWitnessGeometry(witness.attempt, phaseState);
  const raw = realizeContactStrip(reconstructed.sourceFrame, reconstructed.sourceControl, input.lineIdStart, {
    postSegments: 8,
    mode: "endpoint_turn",
  });
  const exactProfile = extractExactContactStripProfile(targetFrame, raw.lines);
  const exactReplay = realizeExactContactStripProfile(targetFrame, exactProfile, input.lineIdStart);
  const compact = extractContactStrip(targetFrame, raw.lines);
  const compactReplay = realizeContactStrip(targetFrame, compact.control, input.lineIdStart, {
    postSegments: compact.postSegments,
    mode: "endpoint_turn",
  });
  const smoothReplay = realizeContactStrip(targetFrame, compact.control, input.lineIdStart, {
    postSegments: compact.postSegments,
    mode: "tangent_continuous",
  });
  const rawEvaluation = evaluateLines(
    input.engine, gap, raw.lines, input.lineIdStart, setup, input.preTargetSledTrace,
  );
  const exactEvaluation = evaluateLines(
    input.engine, gap, exactReplay, input.lineIdStart, setup, input.preTargetSledTrace,
  );
  const compactEvaluation = evaluateLines(
    input.engine, gap, compactReplay.lines, input.lineIdStart, setup, input.preTargetSledTrace,
  );
  if (rawEvaluation.stage !== "accepted" || exactEvaluation.stage !== "accepted" || compactEvaluation.stage !== "accepted") {
    throw new Error(
      `${input.definition.id}:${witness.id} failed containment ` +
      `(raw=${rawEvaluation.stage}, exact=${exactEvaluation.stage}, compact=${compactEvaluation.stage})`,
    );
  }
  const perturbations = localPerturbations(compact.control).map((perturbation) => ({
    label: perturbation.label,
    control: roundControl(perturbation.control),
    result: evaluateLines(
      input.engine,
      gap,
      realizeContactStrip(targetFrame, perturbation.control, input.lineIdStart, {
        postSegments: compact.postSegments,
        mode: "endpoint_turn",
      }).lines,
      input.lineIdStart,
      setup,
      input.preTargetSledTrace,
    ),
  }));
  return {
    id: witness.id,
    reconstructionWitness: {
      attempt: witness.attempt,
      phaseFrames: witness.phaseFrames,
      phaseOrigin: roundPoint({ x: phaseState.sledX, y: phaseState.sledY }),
      phaseSpeed: round(phaseState.speed),
      phaseHeadingDeg: round(phaseState.angleDeg),
      phaseOriginMatchesTarget: samePoint(
        { x: phaseState.sledX, y: phaseState.sledY },
        targetFrame.reference,
      ),
    },
    coordinateContainment: {
      rawLineHash: lineHash(raw.lines),
      exactProfileLineHash: lineHash(exactReplay),
      compactLineHash: lineHash(compactReplay.lines),
      exactProfileMaxCoordinateError: round(maximumLineCoordinateError(raw.lines, exactReplay)),
      compactMaxCoordinateError: round(maximumLineCoordinateError(raw.lines, compactReplay.lines)),
      compact: {
        control: roundControl(compact.control),
        postSegments: compact.postSegments,
      },
      exactProfile: {
        targetTangentOffsetPx: round(exactProfile.targetTangentOffsetPx),
        targetNormalOffsetPx: round(exactProfile.targetNormalOffsetPx),
        entryAngleRelativeDeg: round(exactProfile.entryAngleRelativeDeg),
        preReachPx: round(exactProfile.preReachPx),
        post: exactProfile.post.map((segment) => ({
          lengthPx: round(segment.lengthPx),
          angleRelativeDeg: round(segment.angleRelativeDeg),
        })),
      },
    },
    exactAdmission: {
      reconstructedGeometry: rawEvaluation,
      exactProfileReplay: exactEvaluation,
      compactReplay: compactEvaluation,
      tangentContinuousNewGeometry: evaluateLines(
        input.engine,
        gap,
        smoothReplay.lines,
        input.lineIdStart,
        setup,
        input.preTargetSledTrace,
      ),
    },
    localPerturbations: perturbations,
  };
}

function legacyWitnessGeometry(
  attempt: number,
  phase: { sledX: number; sledY: number; speed: number; angleDeg: number },
): { sourceFrame: ContactFrame; sourceControl: ContactStripControl } {
  const approachDeltaDeg = lerp(-55, 35, sequence(attempt, 0));
  const entryAngleDeg = phase.angleDeg + approachDeltaDeg;
  const entryAngle = degreesToRadians(entryAngleDeg);
  const entryTangent = { x: Math.cos(entryAngle), y: Math.sin(entryAngle) };
  const entryNormal = { x: -entryTangent.y, y: entryTangent.x };
  const legacyTangentOffset = phase.speed * lerp(-2, 2, sequence(attempt, 3));
  const legacyNormalOffset = lerp(-10, 22, sequence(attempt, 2));
  const delta = {
    x: entryTangent.x * legacyTangentOffset + entryNormal.x * legacyNormalOffset,
    y: entryTangent.y * legacyTangentOffset + entryNormal.y * legacyNormalOffset,
  };
  const sourceFrame: ContactFrame = {
    reference: { x: phase.sledX, y: phase.sledY },
    headingDeg: phase.angleDeg,
  };
  const sourceHeading = degreesToRadians(sourceFrame.headingDeg);
  const sourceTangent = { x: Math.cos(sourceHeading), y: Math.sin(sourceHeading) };
  const sourceNormal = { x: -sourceTangent.y, y: sourceTangent.x };
  return {
    sourceFrame,
    sourceControl: {
      targetTangentOffsetPx: dot(delta, sourceTangent),
      targetNormalOffsetPx: dot(delta, sourceNormal),
      entryAngleRelativeDeg: approachDeltaDeg,
      preReachPx: lerp(8, 52, sequence(attempt, 4)),
      surfaceExtentPx: lerp(24, 180, sequence(attempt, 5)),
      totalTurnDeg: lerp(-65, 35, sequence(attempt, 1)),
      turnExponent: 1,
    },
  };
}

type EvaluationStage = "accepted" | "preclear" | "survival" | "landing" | "offbeat" | "unknown";

function evaluateLines(
  // deno-lint-ignore no-explicit-any
  engine: any,
  gap: Gap,
  lines: TrackLine[],
  lineIdStart: number,
  setup: ReturnType<typeof buildSetup>,
  preTargetSledTrace: () => number[],
) {
  clearImpactTemplateMarker();
  drainLandingWindowProbe();
  const before = snapshotArcPlacementStats().by_sample_mode.normal;
  const fit = tryCandidateLines(
    engine,
    gap,
    lines,
    lineIdStart,
    setup.ctx.allContactFrames,
    axisLookaheadEndFrame(gap, setup.ctx.allContactFrames),
    gap.targets,
    true,
    "normal",
    preTargetSledTrace,
    { allowRideOutPolish: false },
  );
  const after = snapshotArcPlacementStats().by_sample_mode.normal;
  const probe = drainLandingWindowProbe();
  const stage = fit === null ? failureStage(before, after) : "accepted";
  return {
    stage: stage satisfies EvaluationStage,
    proposedLineHash: lineHash(lines),
    proposedLineCount: lines.length,
    counters: counterDelta(before, after),
    landingProbe: summarizeLandingProbe(probe.records),
    landingProbeDropped: probe.dropped,
    finalCandidate: fit === null ? null : {
      cost: round(fit.cost),
      achieved: roundAxes(fit.achieved),
      finalLineCount: fit.lines.length,
      finalLineHash: lineHash(fit.lines),
      rideOutPolish: "disabled",
    },
  };
}

function failureStage(
  before: ReturnType<typeof snapshotArcPlacementStats>["by_sample_mode"]["normal"],
  after: ReturnType<typeof snapshotArcPlacementStats>["by_sample_mode"]["normal"],
): Exclude<EvaluationStage, "accepted"> {
  if (after.preclear_rejected > before.preclear_rejected) return "preclear";
  if (after.direct_survival_failed > before.direct_survival_failed) return "survival";
  if (after.direct_offbeat_failed > before.direct_offbeat_failed) return "offbeat";
  if (after.direct_landing_failed > before.direct_landing_failed) return "landing";
  return "unknown";
}

function localPerturbations(center: ContactStripControl): Array<{ label: string; control: ContactStripControl }> {
  const deltas: Array<[keyof ContactStripControl, number]> = [
    ["targetTangentOffsetPx", 2],
    ["targetNormalOffsetPx", 2],
    ["entryAngleRelativeDeg", 4],
    ["preReachPx", 4],
    ["surfaceExtentPx", 8],
    ["totalTurnDeg", 8],
    ["turnExponent", 0.25],
  ];
  return deltas.flatMap(([key, delta]) => [-1, 1].map((sign) => ({
    label: `${key}${sign < 0 ? "-" : "+"}`,
    control: { ...center, [key]: center[key] + sign * delta },
  })));
}

function buildSetup(userSpec: Spec, publicSeed: number): {
  spec: Spec;
  gaps: Gap[];
  gapAxisTargets: AxisValues[];
  ctx: SpecContext;
} {
  const feasibleContacts = userSpec.contacts.filter((contact) => secToFrame(contact.t) >= 5);
  const normalized: Spec = { ...userSpec, preroll: undefined, contacts: feasibleContacts };
  const durationFrames = secToFrame(normalized.duration);
  const contactFrames = normalized.contacts.map((contact) => secToFrame(contact.t)).sort((a, b) => a - b);
  const gaps = sliceTimeline(contactFrames, durationFrames);
  const gapAxisTargets = gaps.map((candidate) => effectiveAxes(candidate, normalized));
  const rng = makeRng(publicSeed);
  for (const candidate of gaps) {
    candidate.targets = sampleGapTargets(gapAxisTargets[candidate.index], normalized.jitter ?? CALIB.SIGMA, rng);
  }
  const impactByFrame = new Map(
    normalized.contacts.flatMap((contact) => contact.impact === undefined
      ? []
      : [[secToFrame(contact.t), contact.impact] as const]),
  );
  for (const candidate of gaps) {
    const impact = impactByFrame.get(candidate.endFrame);
    if (!candidate.endsWithContact || impact === undefined) continue;
    candidate.targets.impact = impact;
    gapAxisTargets[candidate.index].impact = impact;
  }
  return {
    spec: normalized,
    gaps,
    gapAxisTargets,
    ctx: { allContactFrames: contactFrames, durationFrames, gapAxisTargets },
  };
}

function materializedInput(setup: ReturnType<typeof buildSetup>) {
  return {
    contactFrames: [...setup.ctx.allContactFrames],
    durationFrames: setup.ctx.durationFrames,
    gaps: setup.gaps.map((gap) => ({
      index: gap.index,
      startFrame: gap.startFrame,
      endFrame: gap.endFrame,
      endsWithContact: gap.endsWithContact,
      targets: { ...gap.targets },
    })),
    gapAxisTargets: setup.gapAxisTargets.map((targets) => ({ ...targets })),
  };
}

function makeProvenance(input: {
  definition: CaseDefinition;
  runBudget: number;
  materialized: ReturnType<typeof materializedInput>;
  fixture: PhysicalPrefixFixture;
  fixtureFingerprint: string;
}) {
  const engine = process.env.LR_ENGINE ?? "js";
  const compiler = compilerCandidateIdentity(engine);
  const materializedFingerprint = sha256(stableJson(input.materialized));
  const sourceFingerprint = fingerprintFiles(STUDY_SOURCE_FILES);
  const identity = {
    argv: [...argv],
    runtime: { node: process.version, engine },
    budget: input.runBudget,
    case: {
      id: input.definition.id,
      sourcePath: input.definition.sourcePath,
      sourceFingerprint: fingerprintFiles([input.definition.sourcePath]),
    },
    transform: {
      value: benchmarkPolicy.transform,
      fingerprint: sha256(stableJson(benchmarkPolicy.transform)),
    },
    materializedFingerprint,
    fixtureFingerprint: input.fixtureFingerprint,
    compiler: {
      head: compiler.head,
      compilerDiffSha256: compiler.compilerDiffSha256,
      compilerSourceFingerprint: compiler.compilerSourceFingerprint,
      candidateFingerprint: compiler.candidateFingerprint,
      engineArtifactFingerprint: compiler.engineArtifactFingerprint,
      compilerEnvironment: compiler.compilerEnvironment,
      trackedChanges: compiler.trackedChanges,
    },
    studySourceFingerprint: sourceFingerprint,
  };
  return {
    ...identity,
    fixtureSchema: input.fixture.schema,
    fingerprint: sha256(stableJson(identity)),
  };
}

function deepestUnskippedVisit(visits: readonly Visit[]): Visit | null {
  return visits.reduce<Visit | null>((best, record) =>
    record.node.skippedContacts === 0 &&
      (best === null || record.node.search.gapIndex > best.node.search.gapIndex)
      ? record
      : best,
  null);
}

function exactVisitOnDeepestPath(
  visits: readonly Visit[],
  deepest: Visit,
  targetGap: number,
): Visit | null {
  return visits.filter((record) =>
    record.node.skippedContacts === 0 &&
    record.node.search.gapIndex === targetGap &&
    isPrefix(record.node.search.prefixFits, deepest.node.search.prefixFits),
  ).at(-1) ?? null;
}

function isPrefix<T>(prefix: readonly T[], whole: readonly T[]): boolean {
  return prefix.length <= whole.length && prefix.every((item, index) => item === whole[index]);
}

function assertSameTargetCheckpoint(
  label: string,
  left: { sledX: number; sledY: number; speed: number; angleDeg: number },
  right: { sledX: number; sledY: number; speed: number; angleDeg: number },
): void {
  for (const key of ["sledX", "sledY", "speed", "angleDeg"] as const) {
    if (Math.abs(left[key] - right[key]) > 1e-9) {
      throw new Error(`${label}: physical-prefix fixture replay changed ${key}`);
    }
  }
}

function summarizeTargetFrame(value: { sledX: number; sledY: number; speed: number; angleDeg: number; velocity: { x: number; y: number } }) {
  return {
    reference: roundPoint({ x: value.sledX, y: value.sledY }),
    speed: round(value.speed),
    headingDeg: round(value.angleDeg),
    velocity: roundPoint(value.velocity),
  };
}

function summarizeLandingProbe(records: readonly LandingWindowProbeRecord[]) {
  return records.map((record) => ({
    failure: record.failure ?? null,
    acceptedAtW: record.acceptedAtW,
    offset: record.offset,
    entryAngleDeg: record.entryAngleDeg === null ? null : round(record.entryAngleDeg),
    turnDeg: record.turnDeg === null ? null : round(record.turnDeg),
  }));
}

function counterDelta<T extends Record<string, number>>(before: T, after: T): Record<string, number> {
  return Object.fromEntries(Object.keys(before).map((key) => [key, after[key] - before[key]]));
}

function roundControl(control: ContactStripControl) {
  return Object.fromEntries(Object.entries(control).map(([key, value]) => [key, round(value)]));
}

function roundAxes(axes: AxisValues): AxisValues {
  return Object.fromEntries(Object.entries(axes).map(([key, value]) => [key, round(value)]));
}

function lineHash(lines: readonly TrackLine[]): string {
  return sha256(stableJson(lines.map((line) => ({
    id: line.id,
    type: line.type,
    x1: line.x1,
    y1: line.y1,
    x2: line.x2,
    y2: line.y2,
    flipped: Boolean(line.flipped),
    leftExtended: Boolean(line.leftExtended),
    rightExtended: Boolean(line.rightExtended),
  }))));
}

function sequence(attempt: number, dimension: number): number {
  const strides = [0.6180339887498949, 0.7548776662466927, 0.5698402909980532,
    0.4384471871911697, 0.328173343614748, 0.2797659434150245];
  return fract((attempt + 1) * (strides[dimension] ?? 0.5) + (dimension + 1) * 0.137503523749935);
}

function fract(value: number): number {
  return value - Math.floor(value);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function degreesToRadians(value: number): number {
  return value * Math.PI / 180;
}

function dot(left: { x: number; y: number }, right: { x: number; y: number }): number {
  return left.x * right.x + left.y * right.y;
}

function samePoint(left: { x: number; y: number }, right: { x: number; y: number }): boolean {
  return Math.abs(left.x - right.x) <= 1e-9 && Math.abs(left.y - right.y) <= 1e-9;
}

function roundPoint(value: { x: number; y: number }) {
  return { x: round(value.x), y: round(value.y) };
}

function round(value: number): number {
  return Math.round(value * 1e9) / 1e9;
}

function integerArgument(name: string, fallback: number): number {
  const raw = argument(name);
  const value = raw === undefined ? fallback : Number(raw);
  if (!Number.isSafeInteger(value)) throw new Error(`invalid --${name}=${raw}`);
  return value;
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) =>
    `${JSON.stringify(key)}:${stableJson(record[key])}`
  ).join(",")}}`;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
