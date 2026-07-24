/**
 * Frozen-prefix observation study for the event-aligned transition envelope.
 *
 * This is not a candidate source, selector, or family promotion command. It
 * submits a small predeclared normalized menu to the current exact evaluator,
 * then independently observes the physical outgoing interval. The comparison
 * baseline is an equal number of raw normal samples re-evaluated without
 * optional ride-out polish.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { PERSISTENCE_FRAMES } from "../lib/detector.ts";
import { makeRng } from "../lib/rng.ts";
import { clearImpactTemplateMarker, snapshotArcPlacementStats } from "./arc_placement.ts";
import { compilerCandidateIdentity } from "./benchmark_v2/compiler_identity.ts";
import { fingerprintFiles } from "./benchmark_v2/suite_model.ts";
import { detectWindow, axisLookaheadEndFrame, tryCandidateLines } from "./core/candidate.ts";
import { measureGapAxes } from "./core/measure.ts";
import {
  airborneAt,
  engineLineFromTrackLine,
  measurementLastFrame,
  offBeatLandingEvents,
} from "./core/substrate.ts";
import { getSimFrames } from "./optimizer/sim_frames.ts";
import { observeOneCandidate, type Candidate } from "./optimizer/sample.ts";
import { type AxisName, type AxisValues, type Gap, type TrackLine } from "./types.ts";
import {
  deriveSupportEnvelopeIntent,
  deriveMeanSpeedExitPrior,
  makeTransitionEnvelopeCenter,
  resolveSupportEnvelope,
  type IncomingTargetFrame,
  type SupportEnvelopeControl,
  type TransitionEnvelopeControl,
} from "./trajectory/envelope/model.ts";
import { realizeTransitionEnvelope } from "./trajectory/envelope/realizer.ts";
import {
  realizeCollisionStripTransition,
  resolveCollisionStrip,
  type CollisionStripControl,
} from "./trajectory/collision_strip.ts";
import {
  brakingImpactEntryPrior,
  oneFrameLagNeutralEntryPrior,
  targetNeutralEntryPrior,
  type CollisionEntryPrior,
} from "./trajectory/collision_prior.ts";
import {
  readFrozenTrajectoryFixture,
  sha256,
  stableJson,
} from "./trajectory/frozen_fixture.ts";
import { profilePolylineInTargetFrame } from "./trajectory/polyline_profile.ts";
import { observeOwnedContactTransition } from "./trajectory/contact_observation.ts";
import { assertCalibrationTrajectoryPanel, getTrajectoryPanelCase } from "./trajectory/panel.ts";
import { prepareFrozenTrajectoryFixture, type PreparedTrajectoryFixture } from "./trajectory/study_context.ts";

const argv = process.argv.slice(2);
const argument = (name: string): string | undefined =>
  argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);

if (argv.includes("--help") || argv.includes("-h")) {
  process.stdout.write([
    "Usage: study_transition_envelope.ts --fixture=FILE [--formulation=single-envelope|collision-strip] [--support-prior=neutral|mean-speed] [--contact-prior=target-neutral|one-frame-lag-neutral|braking-impact] [--menu=NAME] [--out=FILE]",
    "",
    "Replays a frozen trajectory prefix and compares a small predeclared physical",
    "menu against an equal count of raw normal samples. This is observation-only.",
  ].join("\n") + "\n");
  process.exit(0);
}

const STUDY_SOURCE_FILES = [
  "scripts/v0/study_transition_envelope.ts",
  "scripts/v0/trajectory/frozen_fixture.ts",
  "scripts/v0/trajectory/panel.ts",
  "scripts/v0/trajectory/state.ts",
  "scripts/v0/trajectory/target_frame.ts",
  "scripts/v0/trajectory/polyline_profile.ts",
  "scripts/v0/trajectory/contact_observation.ts",
  "scripts/v0/trajectory/study_context.ts",
  "scripts/v0/trajectory/curve_resolution.ts",
  "scripts/v0/trajectory/collision_strip.ts",
  "scripts/v0/trajectory/collision_prior.ts",
  "scripts/v0/trajectory/outgoing_interval.ts",
  "scripts/v0/trajectory/envelope/model.ts",
  "scripts/v0/trajectory/envelope/realizer.ts",
  "scripts/v0/trajectory/study_fixture.ts",
  "scripts/v0/core/candidate.ts",
  "scripts/v0/core/measure.ts",
  "scripts/v0/core/substrate.ts",
  "scripts/v0/optimizer/sample.ts",
  "scripts/v0/optimizer/handoff.ts",
  "scripts/lib/detector.ts",
  "benchmark/v2/policy.ts",
] as const;

const fixturePath = argument("fixture");
if (fixturePath === undefined) throw new Error("--fixture=FILE is required");
const formulation = argument("formulation") ?? "single-envelope";
if (formulation !== "single-envelope" && formulation !== "collision-strip") {
  throw new Error(`unknown --formulation=${formulation}; expected single-envelope or collision-strip`);
}
const menuName = argument("menu") ?? (formulation === "single-envelope" ? "screen" : "collision-screen");
if (
  (formulation === "single-envelope" && menuName !== "screen" && menuName !== "contact-basin") ||
  (formulation === "collision-strip" && menuName !== "collision-screen")
) {
  throw new Error(
    formulation === "single-envelope"
      ? `unknown --menu=${menuName}; expected screen or contact-basin`
      : `unknown --menu=${menuName}; expected collision-screen`,
  );
}
const supportPriorMode = argument("support-prior") ?? "neutral";
if (supportPriorMode !== "neutral" && supportPriorMode !== "mean-speed") {
  throw new Error(`unknown --support-prior=${supportPriorMode}; expected neutral or mean-speed`);
}
if (formulation !== "collision-strip" && supportPriorMode !== "neutral") {
  throw new Error("--support-prior=mean-speed is currently defined only for collision-strip studies");
}
const contactPriorMode = argument("contact-prior") ?? "target-neutral";
if (
  contactPriorMode !== "target-neutral" &&
  contactPriorMode !== "one-frame-lag-neutral" &&
  contactPriorMode !== "braking-impact"
) {
  throw new Error(
    `unknown --contact-prior=${contactPriorMode}; expected target-neutral, one-frame-lag-neutral, or braking-impact`,
  );
}
if (formulation !== "collision-strip" && contactPriorMode !== "target-neutral") {
  throw new Error("--contact-prior is currently defined only for collision-strip studies");
}
const fixture = readFrozenTrajectoryFixture(fixturePath);
assertCalibrationTrajectoryPanel(getTrajectoryPanelCase(fixture.panel.id), "transition-envelope study");
const started = performance.now();
const prepared = prepareFrozenTrajectoryFixture(fixture);
const meanSpeedExitPrior = deriveMeanSpeedExitPrior(prepared.intent, prepared.frame.speedPxPerFrame);
const contactEntryPrior = formulation === "collision-strip"
  ? collisionEntryPriorFor(contactPriorMode, prepared.frame, prepared.current.targets)
  : null;
const directControls = formulation === "single-envelope"
  ? predeclaredControls(menuName as EnvelopeMenuName, prepared.frame, prepared.intent)
  : predeclaredCollisionStripControls(prepared.frame, prepared.intent, supportPriorMode, contactEntryPrior!);
const normalCount = directControls.length;
const directRecords = formulation === "single-envelope"
  ? (directControls as EnvelopeControlEntry[]).map((entry, index) =>
    evaluateDirectControl(entry.label, entry.control, index, prepared))
  : (directControls as CollisionStripControlEntry[]).map((entry, index) =>
    evaluateCollisionStripControl(entry.label, entry.control, index, prepared));
const normalRecords = evaluateRawNormalAttempts(prepared, normalCount);

const output = {
  schema: "line.study-transition-envelope.v3",
  purpose: [
    "Observe a study-only, target-frame contact strip plus outgoing support envelope on a frozen physical prefix.",
    "Compare equal-count raw normal proposals with optional ride-out polish disabled on both primary paths.",
    "Retain ungated local owned-contact telemetry without selecting a winner, inferring a response model, or claiming ownership of the next contact.",
  ],
  status: {
    productionIntegration: "forbidden: this study does not add or rank a compiler candidate source",
    primaryEndpoint: "exact current-gap admission plus independent outgoing-window observation",
    nextContactMeaning: "telemetry only; ordinary next-contact search remains responsible for T_(i+1)",
    fixtureRole: "frozen physical prefix; source input and target checkpoints were revalidated before evaluation",
  },
  formulation,
  supportPriorMode,
  contactPriorMode: contactEntryPrior?.kind ?? null,
  argv: [...argv],
  elapsedMs: round(performance.now() - started),
  provenance: {
    fixturePath,
    fixtureFingerprint: fixture.fixtureFingerprint,
    captureCompiler: fixture.captureCompiler,
    observationCompiler: compilerCandidateIdentity(process.env.LR_ENGINE ?? "js"),
    runtime: { node: process.version, engine: process.env.LR_ENGINE ?? "js" },
    studySourceFingerprint: fingerprintFiles(STUDY_SOURCE_FILES),
  },
  panel: prepared.panel,
  fixtureReplay: prepared.replay,
  targetFrame: {
    reference: { x: round(prepared.frame.reference.x), y: round(prepared.frame.reference.y) },
    headingDeg: round(prepared.frame.headingDeg),
    speedPxPerFrame: round(prepared.frame.speedPxPerFrame),
    sledSpanPx: round(prepared.frame.sledSpanPx),
    anchorPoint: prepared.frame.anchorPoint,
    headingSource: prepared.frame.headingSource,
  },
  outgoingIntent: summarizeIntent(prepared.intent),
  meanSpeedExitPrior: meanSpeedExitPrior === null ? null : {
    targetMeanSpeedPxPerFrame: round(meanSpeedExitPrior.targetMeanSpeedPxPerFrame),
    impliedExitSpeedPxPerFrame: round(meanSpeedExitPrior.impliedExitSpeedPxPerFrame),
    exitSpeedRatio: round(meanSpeedExitPrior.exitSpeedRatio),
  },
  contactEntryPrior: contactEntryPrior === null ? null : summarizeCollisionEntryPrior(contactEntryPrior),
  menu: {
    name: menuName,
    controls: directControls.map((entry) => ({ label: entry.label, control: roundNumericRecord(entry.control) })),
    count: normalCount,
    declaration: menuName === "screen"
      ? "The same normalized nine-control contact screen is used for every frozen panel; no duration or case branch enters it."
      : menuName === "contact-basin"
      ? "The same one-factor, 21-control contact-basin sweep is used for every frozen panel; no duration or case branch enters it."
      : "The same normalized 15-control collision-strip screen is used for every frozen panel; each one-factor perturbation is centered on the named contact prior, with no duration or case branch.",
  },
  directEnvelope: directRecords,
  rawNormal: normalRecords,
  aggregate: {
    directEnvelope: aggregatePrimaryRecords(directRecords),
    rawNormal: aggregatePrimaryRecords(normalRecords),
  },
  caveats: [
    "The target-frame contact center is a falsifiable physical prior, not a fitted or legacy-replayed control.",
    "The braking-impact contact prior is a post-hoc exploratory hypothesis: its formula reads only the authored current speed/impact and incoming target frame, but its sign/share were suggested by this calibration panel. It requires a predeclared disjoint validation panel before it can count as evidence.",
    "Supported continuation and release-and-arrival are distinct regimes. A missing six-frame airborne run is not a failure for a low-air supported row.",
    "Outgoing axis observations use the outgoing scorer window only. Grain and impact are deliberately omitted because this study does not own a next-contact proposal.",
    "Local-contact telemetry is diagnostic only. It retains missed/early/late owned events for future bounded correction but cannot relax the exact candidate gate.",
    "The declared controls are a diagnostic coverage study, not an optimizer menu. A result here cannot justify source integration or family promotion.",
  ],
};

const outPath = argument("out") ?? `generated/studies/transition-envelope/${fixture.panel.id}-${fixture.fixtureFingerprint.slice(0, 12)}.json`;
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`);
process.stderr.write(
  `transition envelope ${fixture.panel.id}: ${aggregatePrimaryRecords(directRecords).accepted}/${normalCount} direct accepted, ` +
  `${aggregatePrimaryRecords(normalRecords).accepted}/${normalCount} raw-normal accepted -> ${outPath}\n`,
);

type PreparedFixture = PreparedTrajectoryFixture;
type EvaluationStage = "accepted" | "preclear" | "survival" | "landing" | "offbeat" | "invalid_geometry" | "error" | "unknown";
type Counter = ReturnType<typeof snapshotArcPlacementStats>["by_sample_mode"]["normal"];
type EnvelopeMenuName = "screen" | "contact-basin";
type CollisionEntryPriorMode = CollisionEntryPrior["kind"];
type EnvelopeControlEntry = { label: string; control: TransitionEnvelopeControl };
type CollisionStripTransitionControl = CollisionStripControl & SupportEnvelopeControl;
type CollisionStripControlEntry = { label: string; control: CollisionStripTransitionControl };

function predeclaredControls(
  menu: EnvelopeMenuName,
  frame: IncomingTargetFrame,
  intent: ReturnType<typeof deriveSupportEnvelopeIntent>,
): EnvelopeControlEntry[] {
  const center = makeTransitionEnvelopeCenter(frame, intent);
  const speed = frame.speedPxPerFrame;
  const screen = [
    { label: "center", control: center },
    { label: "tangent_early", control: { ...center, targetTangentOffsetPx: center.targetTangentOffsetPx - 0.75 * speed } },
    { label: "tangent_late", control: { ...center, targetTangentOffsetPx: center.targetTangentOffsetPx + 0.75 * speed } },
    { label: "normal_negative", control: { ...center, targetNormalOffsetPx: -0.75 * speed } },
    { label: "normal_positive", control: { ...center, targetNormalOffsetPx: 0.75 * speed } },
    { label: "entry_negative", control: { ...center, entryAngleRelativeDeg: center.entryAngleRelativeDeg - 12 } },
    { label: "entry_positive", control: { ...center, entryAngleRelativeDeg: center.entryAngleRelativeDeg + 12 } },
    { label: "contact_turn_negative", control: { ...center, contactTurnDeg: -12 } },
    { label: "contact_turn_positive", control: { ...center, contactTurnDeg: 12 } },
  ];
  if (menu === "screen") return screen;
  // A strictly one-factor sweep maps the physical contact basin without
  // confounding it with a tuned support policy. All values are normalized by
  // incoming speed or are angular residuals, and are identical on every case.
  return [
    { label: "center", control: center },
    ...[-1.5, -0.75, 0.75, 1.5].map((delta) => ({
      label: `tangent_${signedLabel(delta)}`,
      control: { ...center, targetTangentOffsetPx: center.targetTangentOffsetPx + delta * speed },
    })),
    ...[-1.5, -0.75, 0.75, 1.5].map((offset) => ({
      label: `normal_${signedLabel(offset)}`,
      control: { ...center, targetNormalOffsetPx: offset * speed },
    })),
    ...[-24, -12, 12, 24].map((offset) => ({
      label: `entry_${signedLabel(offset)}`,
      control: { ...center, entryAngleRelativeDeg: center.entryAngleRelativeDeg + offset },
    })),
    ...[0.5, 0.75, 1.25, 1.5].map((scale) => ({
      label: `pre_reach_x${scale}`,
      control: { ...center, preReachPx: center.preReachPx * scale },
    })),
    ...[-24, -12, 12, 24].map((turn) => ({
      label: `contact_turn_${signedLabel(turn)}`,
      control: { ...center, contactTurnDeg: turn },
    })),
  ];
}

function predeclaredCollisionStripControls(
  frame: IncomingTargetFrame,
  intent: ReturnType<typeof deriveSupportEnvelopeIntent>,
  supportPriorMode: "neutral" | "mean-speed",
  contactPrior: CollisionEntryPrior,
): CollisionStripControlEntry[] {
  const envelopeCenter = makeTransitionEnvelopeCenter(frame, intent);
  const support: SupportEnvelopeControl = {
    supportScale: envelopeCenter.supportScale,
    exitSpeedRatio: supportPriorMode === "mean-speed"
      ? requireMeanSpeedExitPrior(intent, frame.speedPxPerFrame).exitSpeedRatio
      : envelopeCenter.exitSpeedRatio,
    gradeBiasDeg: envelopeCenter.gradeBiasDeg,
    curvatureSkew: envelopeCenter.curvatureSkew,
  };
  const center: CollisionStripTransitionControl = {
    targetTangentOffsetFrames: contactPrior.targetTangentOffsetFrames,
    targetNormalOffsetSledSpans: 0,
    entryAngleRelativeDeg: contactPrior.entryAngleRelativeDeg,
    preReachFrames: 2,
    collisionTurnDeg: 0,
    stripTurnDeg: 0,
    stripSupportFrames: 2,
    stripCurvatureSkew: 0,
    ...support,
  };
  // This is a topology screen, not a fitted candidate family: every row is a
  // symmetric one-factor perturbation in named physical units. The same menu
  // is used on every frozen panel row.
  return [
    { label: "center", control: center },
    { label: "tangent_minus0_75f", control: { ...center, targetTangentOffsetFrames: center.targetTangentOffsetFrames - 0.75 } },
    { label: "tangent_plus0_75f", control: { ...center, targetTangentOffsetFrames: center.targetTangentOffsetFrames + 0.75 } },
    { label: "normal_minus0_75span", control: { ...center, targetNormalOffsetSledSpans: -0.75 } },
    { label: "normal_plus0_75span", control: { ...center, targetNormalOffsetSledSpans: 0.75 } },
    { label: "entry_minus24", control: { ...center, entryAngleRelativeDeg: center.entryAngleRelativeDeg - 24 } },
    { label: "entry_plus24", control: { ...center, entryAngleRelativeDeg: center.entryAngleRelativeDeg + 24 } },
    { label: "collision_turn_minus24", control: { ...center, collisionTurnDeg: -24 } },
    { label: "collision_turn_plus24", control: { ...center, collisionTurnDeg: 24 } },
    { label: "strip_turn_minus30", control: { ...center, stripTurnDeg: -30 } },
    { label: "strip_turn_plus30", control: { ...center, stripTurnDeg: 30 } },
    { label: "pre_reach_1f", control: { ...center, preReachFrames: 1 } },
    { label: "pre_reach_3f", control: { ...center, preReachFrames: 3 } },
    { label: "strip_support_1f", control: { ...center, stripSupportFrames: 1 } },
    { label: "strip_support_4f", control: { ...center, stripSupportFrames: 4 } },
  ];
}

function collisionEntryPriorFor(
  mode: CollisionEntryPriorMode,
  frame: IncomingTargetFrame,
  currentTargets: AxisValues,
): CollisionEntryPrior {
  switch (mode) {
    case "target-neutral":
      return targetNeutralEntryPrior();
    case "one-frame-lag-neutral":
      return oneFrameLagNeutralEntryPrior();
    case "braking-impact":
      return brakingImpactEntryPrior(frame, currentTargets);
  }
}

function requireMeanSpeedExitPrior(
  intent: ReturnType<typeof deriveSupportEnvelopeIntent>,
  incomingSpeedPxPerFrame: number,
) {
  const prior = deriveMeanSpeedExitPrior(intent, incomingSpeedPxPerFrame);
  if (prior === null) {
    throw new Error("mean-speed support prior is unavailable for this outgoing interval");
  }
  return prior;
}

function signedLabel(value: number): string {
  const magnitude = Math.abs(value);
  const text = Number.isInteger(magnitude) ? String(magnitude) : String(magnitude).replace(".", "_");
  return `${value < 0 ? "minus" : "plus"}${text}`;
}

function evaluateDirectControl(
  label: string,
  control: TransitionEnvelopeControl,
  index: number,
  prepared: PreparedFixture,
) {
  const envelope = resolveSupportEnvelope(prepared.intent, prepared.frame.speedPxPerFrame, control);
  let realization: ReturnType<typeof realizeTransitionEnvelope>;
  try {
    realization = realizeTransitionEnvelope(
      prepared.frame,
      control,
      envelope,
      prepared.lineIdStart,
    );
  } catch (error) {
    return failedRealizationRecord(label, index, control, envelope, error);
  }
  return {
    family: "transition_envelope" as const,
    label,
    index,
    control: roundControl(control),
    envelope: summarizeEnvelope(envelope),
    realization: summarizeRealization(realization.lines, realization),
    primary: evaluatePrimaryLines(realization.lines, prepared),
  };
}

function evaluateCollisionStripControl(
  label: string,
  control: CollisionStripTransitionControl,
  index: number,
  prepared: PreparedFixture,
) {
  const envelope = resolveSupportEnvelope(prepared.intent, prepared.frame.speedPxPerFrame, control);
  let resolved: ReturnType<typeof resolveCollisionStrip>;
  let realization: ReturnType<typeof realizeCollisionStripTransition>;
  try {
    resolved = resolveCollisionStrip(prepared.frame, envelope, control);
    realization = realizeCollisionStripTransition(resolved, envelope, prepared.lineIdStart);
  } catch (error) {
    return {
      family: "collision_strip_envelope" as const,
      label,
      index,
      control: roundNumericRecord(control),
      envelope: summarizeEnvelope(envelope),
      collisionStrip: null,
      realization: null,
      primary: failedPrimaryRecord(error),
    };
  }
  return {
    family: "collision_strip_envelope" as const,
    label,
    index,
    control: roundNumericRecord(control),
    envelope: summarizeEnvelope(envelope),
    collisionStrip: summarizeCollisionStrip(resolved),
    realization: summarizeCollisionStripRealization(realization),
    primary: evaluatePrimaryLines(realization.lines, prepared),
  };
}

function failedPrimaryRecord(error: unknown) {
  return {
    stage: "error" as const,
    error: errorMessage(error),
    proposed: null,
    currentAdmission: null,
    localContact: null,
    outbound: null,
    elapsedMs: 0,
    simFrames: 0,
  };
}

function failedRealizationRecord(
  label: string,
  index: number,
  control: TransitionEnvelopeControl,
  envelope: ReturnType<typeof resolveSupportEnvelope>,
  error: unknown,
) {
  return {
    family: "transition_envelope" as const,
    label,
    index,
    control: roundControl(control),
    envelope: summarizeEnvelope(envelope),
    realization: null,
    primary: {
      stage: "error" as const,
      error: errorMessage(error),
      proposed: null,
      currentAdmission: null,
      localContact: null,
      outbound: null,
      elapsedMs: 0,
      simFrames: 0,
    },
  };
}

function evaluateRawNormalAttempts(prepared: PreparedFixture, count: number) {
  const rng = makeRng((Math.imul(prepared.panel.seed | 0, 1_000_003) + prepared.current.index + 1) | 0);
  const records = [];
  for (let attempt = 0; attempt < count; attempt++) {
    clearImpactTemplateMarker();
    const started = performance.now();
    const simBefore = getSimFrames();
    const before = snapshotArcPlacementStats().by_sample_mode.normal;
    let observation: ReturnType<typeof observeOneCandidate>;
    try {
      observation = observeOneCandidate(
        prepared.engine,
        prepared.current,
        rng,
        prepared.ctx,
        prepared.lineIdStart,
        attempt,
        "normal",
        prepared.current.targets,
        undefined,
        { allowRideOutPolish: false },
      );
    } catch (error) {
      records.push({
        family: "raw_normal" as const,
        label: `normal_${attempt}`,
        index: attempt,
        primary: errorPrimaryRecord(error, null, started, simBefore),
        productionNormalWithPolish: null,
      });
      continue;
    }
    const after = snapshotArcPlacementStats().by_sample_mode.normal;
    const primary = primaryRecordFromFit(
      observation.geometry.lines,
      observation.fit,
      before,
      after,
      prepared,
      started,
      simBefore,
    );
    records.push({
      family: "raw_normal" as const,
      label: `normal_${attempt}`,
      index: attempt,
      generatedGeometry: summarizePolylineProfile(observation.geometry.lines, prepared.frame),
      primary,
      productionNormalWithPolish: evaluateNormalWithPolish(observation.geometry.lines, prepared),
    });
  }
  return records;
}

function summarizePolylineProfile(lines: readonly TrackLine[], frame: IncomingTargetFrame) {
  const profile = profilePolylineInTargetFrame(frame, lines);
  return {
    connected: profile.connected,
    lineCount: profile.lineCount,
    totalLengthPx: round(profile.totalLengthPx),
    targetJunction: profile.targetJunction === null ? null : {
      vertexIndex: profile.targetJunction.vertexIndex,
      distanceToTargetPx: round(profile.targetJunction.distanceToTargetPx),
      tangentOffsetPx: round(profile.targetJunction.tangentOffsetPx),
      normalOffsetPx: round(profile.targetJunction.normalOffsetPx),
    },
    entry: profile.entry === null ? null : {
      lengthPx: round(profile.entry.lengthPx),
      angleRelativeDeg: round(profile.entry.angleRelativeDeg),
    },
    post: profile.post.map((segment) => ({
      lengthPx: round(segment.lengthPx),
      angleRelativeDeg: round(segment.angleRelativeDeg),
    })),
  };
}

function evaluatePrimaryLines(lines: TrackLine[], prepared: PreparedFixture) {
  clearImpactTemplateMarker();
  const started = performance.now();
  const simBefore = getSimFrames();
  const before = snapshotArcPlacementStats().by_sample_mode.normal;
  let fit: Candidate | null = null;
  try {
    fit = tryCandidateLines(
      prepared.engine,
      prepared.current,
      lines,
      prepared.lineIdStart,
      prepared.ctx.allContactFrames,
      axisLookaheadEndFrame(prepared.current, prepared.ctx.allContactFrames),
      prepared.current.targets,
      true,
      "normal",
      prepared.probe.preTargetSledTrace,
      { allowRideOutPolish: false },
    ) as Candidate | null;
  } catch (error) {
    return errorPrimaryRecord(error, lines, started, simBefore);
  }
  const after = snapshotArcPlacementStats().by_sample_mode.normal;
  return primaryRecordFromFit(lines, fit, before, after, prepared, started, simBefore);
}

function primaryRecordFromFit(
  lines: TrackLine[],
  fit: Candidate | null,
  before: Counter,
  after: Counter,
  prepared: PreparedFixture,
  started: number,
  simBefore: number,
) {
  const proposed = summarizeLines(lines);
  if (!proposed.valid) {
    return {
      stage: "invalid_geometry" as const,
      proposed,
      currentAdmission: null,
      localContact: null,
      outbound: null,
      elapsedMs: round(performance.now() - started),
      simFrames: getSimFrames() - simBefore,
    };
  }
  let outbound: ReturnType<typeof observeOutgoing> | { error: string } | null;
  let localContact: ReturnType<typeof observeCurrentContact> | { error: string } | null;
  try {
    localContact = observeCurrentContact(lines, prepared);
  } catch (error) {
    localContact = { error: errorMessage(error) };
  }
  try {
    outbound = observeOutgoing(lines, prepared);
  } catch (error) {
    outbound = { error: errorMessage(error) };
  }
  return {
    stage: fit === null ? failureStage(before, after) : "accepted" as const,
    proposed,
    currentAdmission: fit === null ? {
      counters: counterDelta(before, after),
      candidate: null,
      rideOutPolish: "disabled",
    } : {
      counters: counterDelta(before, after),
      candidate: summarizeCandidate(fit),
      rideOutPolish: "disabled",
    },
    localContact,
    outbound,
    elapsedMs: round(performance.now() - started),
    simFrames: getSimFrames() - simBefore,
  };
}

function evaluateNormalWithPolish(lines: TrackLine[], prepared: PreparedFixture) {
  try {
    const fit = tryCandidateLines(
      prepared.engine,
      prepared.current,
      lines,
      prepared.lineIdStart,
      prepared.ctx.allContactFrames,
      axisLookaheadEndFrame(prepared.current, prepared.ctx.allContactFrames),
      prepared.current.targets,
      true,
      "normal",
      prepared.probe.preTargetSledTrace,
    ) as Candidate | null;
    return fit === null ? { candidate: null, geometryChanged: null } : {
      candidate: summarizeCandidate(fit),
      geometryChanged: !sameLineGeometry(lines, fit.lines),
    };
  } catch (error) {
    return { candidate: null, geometryChanged: null, error: errorMessage(error) };
  }
}

function observeCurrentContact(lines: TrackLine[], prepared: PreparedFixture) {
  // Stop before the next authored contact. This is intentionally a cheap local
  // probe; complete outgoing behavior is observed separately below.
  const observationEndFrame = Math.max(
    prepared.current.endFrame,
    Math.min(prepared.current.endFrame + 16, prepared.outgoing.endFrame - 1),
  );
  const engine = prepared.engine.addLine(lines.map((line) => engineLineFromTrackLine(line)));
  const det = detectWindow(engine, prepared.current.startFrame, observationEndFrame);
  const observation = observeOwnedContactTransition(det, {
    targetFrame: prepared.current.endFrame,
    gapFrames: prepared.current.endFrame - prepared.current.startFrame,
    observationEndFrame,
    ownedLineIds: new Set(lines.map((line) => line.id)),
  });
  return {
    targetFrame: observation.targetFrame,
    observationEndFrame: observation.observationEndFrame,
    terminus: observation.terminus,
    ownedEvents: observation.ownedEvents,
    closestOwnedEvent: observation.closestOwnedEvent,
    targetState: summarizeLocalContactState(observation.targetState),
    handoffState: summarizeLocalContactState(observation.handoffState),
  };
}

function summarizeLocalContactState(
  state: ReturnType<typeof observeOwnedContactTransition>["targetState"],
) {
  return state === null ? null : {
    frame: state.frame,
    position: { x: round(state.position.x), y: round(state.position.y) },
    velocity: { x: round(state.velocity.x), y: round(state.velocity.y) },
    speedPxPerFrame: round(state.speedPxPerFrame),
    airborne: state.airborne,
  };
}

function observeOutgoing(lines: TrackLine[], prepared: PreparedFixture) {
  const horizon = prepared.outgoing.endFrame + PERSISTENCE_FRAMES - 1;
  const engine = prepared.engine.addLine(lines.map((line) => engineLineFromTrackLine(line)));
  const det = detectWindow(engine, prepared.outgoing.startFrame, horizon);
  const lastFrame = measurementLastFrame(det);
  const completeThroughPersistence = lastFrame >= horizon &&
    (det.terminus.reason === "endOfSpec" || det.terminus.frame >= horizon);
  const occupancy = occupancySummary(det, prepared.outgoing.startFrame, prepared.outgoing.endFrame);
  const measured = lastFrame >= prepared.outgoing.endFrame
    ? measureGapAxes(det, prepared.outgoing, lines, prepared.outgoing.endFrame)
    : {};
  const axes = Object.fromEntries(([
    "air", "speed", "elevation", "amplitude",
  ] as AxisName[]).map((axis) => {
    const target = prepared.outgoing.targets[axis];
    const actual = measured[axis];
    return [axis, {
      target: target === undefined ? null : round(target),
      actual: actual === undefined ? null : round(actual),
      residual: target === undefined || actual === undefined ? null : round(actual - target),
    }];
  }));
  return {
    observationStartFrame: prepared.outgoing.startFrame,
    observationEndFrame: horizon,
    scorerEndFrame: prepared.outgoing.endFrame,
    completeThroughPersistence,
    lastMeasuredFrame: lastFrame,
    terminus: det.terminus,
    occupancy,
    axes,
    events: det.events
      .filter((event) => event.frame >= prepared.outgoing.startFrame && event.frame <= horizon)
      .map((event) => ({ type: event.type, frame: event.frame })),
    offBeatLandings: offBeatLandingEvents(det, prepared.ctx.allContactFrames)
      .filter((event) => event.frame >= prepared.outgoing.startFrame && event.frame <= horizon)
      .map((event) => event.frame),
  };
}

function occupancySummary(det: ReturnType<typeof detectWindow>, start: number, end: number) {
  let samples = 0;
  let airborneSamples = 0;
  let groundedSamples = 0;
  let firstAirborneFrame: number | null = null;
  let lastGroundedFrame: number | null = null;
  let longestAirborneRun = 0;
  let longestGroundedRun = 0;
  let currentAirborneRun = 0;
  let currentGroundedRun = 0;
  let firstSustainedAirborneFrame: number | null = null;
  for (let frame = start; frame <= end; frame++) {
    const airborne = airborneAt(det, frame);
    if (airborne === undefined) break;
    samples++;
    if (airborne) {
      airborneSamples++;
      currentAirborneRun++;
      currentGroundedRun = 0;
      if (firstAirborneFrame === null) firstAirborneFrame = frame;
      if (currentAirborneRun > longestAirborneRun) longestAirborneRun = currentAirborneRun;
      if (currentAirborneRun === MIN_LANDING_AIRBORNE_FRAMES && firstSustainedAirborneFrame === null) {
        firstSustainedAirborneFrame = frame - MIN_LANDING_AIRBORNE_FRAMES + 1;
      }
    } else {
      groundedSamples++;
      currentGroundedRun++;
      currentAirborneRun = 0;
      lastGroundedFrame = frame;
      if (currentGroundedRun > longestGroundedRun) longestGroundedRun = currentGroundedRun;
    }
  }
  return {
    samples,
    airborneSamples,
    groundedSamples,
    airFraction: samples === 0 ? null : round(airborneSamples / samples),
    firstAirborneFrame,
    firstSustainedAirborneFrame,
    lastGroundedFrame,
    longestAirborneRun,
    longestGroundedRun,
  };
}

function summarizeCandidate(fit: Candidate) {
  return {
    cost: round(fit.cost),
    achievedLookahead: roundAxes(fit.achieved),
    achievedCurrentScorerWindow: roundAxes(fit.achieved),
    finalLineCount: fit.lines.length,
    finalLineHash: sha256(stableJson(fit.lines)),
    release: fit.ballisticLaunch === undefined ? null : {
      frame: fit.ballisticLaunch.anchorFrame,
      vx: round(fit.ballisticLaunch.state.vx),
      vy: round(fit.ballisticLaunch.state.vy),
      grounded: fit.ballisticLaunch.groundedFrames,
      airborne: fit.ballisticLaunch.airborne,
    },
  };
}

function summarizeLines(lines: readonly TrackLine[]) {
  const lengths = lines.map((line) => Math.hypot(line.x2 - line.x1, line.y2 - line.y1));
  const valid = lines.length > 0 && lines.every((line, index) =>
    Number.isSafeInteger(line.id) &&
      [line.x1, line.y1, line.x2, line.y2].every(Number.isFinite) &&
      lengths[index] > 1e-9,
  );
  return {
    lineCount: lines.length,
    lineHash: sha256(stableJson(lines)),
    totalLengthPx: round(lengths.reduce((sum, length) => sum + length, 0)),
    minLengthPx: lengths.length === 0 ? null : round(Math.min(...lengths)),
    maxLengthPx: lengths.length === 0 ? null : round(Math.max(...lengths)),
    valid,
  };
}

function summarizeRealization(
  lines: TrackLine[],
  realized: ReturnType<typeof realizeTransitionEnvelope>,
) {
  return {
    ...summarizeLines(lines),
    contactPoint: { x: round(realized.contactPoint.x), y: round(realized.contactPoint.y) },
    entryAngleDeg: round(realized.entryAngleDeg),
    supportEntryAngleDeg: round(realized.supportEntryAngleDeg),
    supportExitAngleDeg: round(realized.supportExitAngleDeg),
    supportSegmentCount: realized.supportSegmentCount,
  };
}

function summarizeCollisionStrip(
  strip: ReturnType<typeof resolveCollisionStrip>,
) {
  return {
    contactPoint: { x: round(strip.contactPoint.x), y: round(strip.contactPoint.y) },
    entryAngleDeg: round(strip.entryAngleDeg),
    postEntryAngleDeg: round(strip.postEntryAngleDeg),
    stripExitAngleDeg: round(strip.stripExitAngleDeg),
    preReachPx: round(strip.preReachPx),
    stripExtentPx: round(strip.stripExtentPx),
    stripSupportFrames: round(strip.stripSupportFrames),
    remainingSupportFrames: round(strip.remainingSupportFrames),
    remainingSupportExtentPx: round(strip.remainingSupportExtentPx),
    stripCurvaturePower: round(strip.stripCurvaturePower),
  };
}

function summarizeCollisionStripRealization(
  realized: ReturnType<typeof realizeCollisionStripTransition>,
) {
  return {
    ...summarizeLines(realized.lines),
    contactPoint: { x: round(realized.contactPoint.x), y: round(realized.contactPoint.y) },
    stripExitPoint: { x: round(realized.stripExitPoint.x), y: round(realized.stripExitPoint.y) },
    entryAngleDeg: round(realized.entryAngleDeg),
    postEntryAngleDeg: round(realized.postEntryAngleDeg),
    stripExitAngleDeg: round(realized.stripExitAngleDeg),
    stripSegmentCount: realized.stripSegmentCount,
    supportSegmentCount: realized.supportSegmentCount,
  };
}

function summarizeEnvelope(envelope: ReturnType<typeof resolveSupportEnvelope>) {
  return {
    intervalFrames: envelope.intervalFrames,
    supportIntervals: round(envelope.supportIntervals),
    plannedAirborneIntervals: round(envelope.plannedAirborneIntervals),
    plannedExtentPx: round(envelope.plannedExtentPx),
    desiredExitSpeedPxPerFrame: round(envelope.desiredExitSpeedPxPerFrame),
    kinematicGradeDeg: round(envelope.kinematicGradeDeg),
    meanGradeDeg: round(envelope.meanGradeDeg),
    curvaturePower: round(envelope.curvaturePower),
  };
}

function summarizeCollisionEntryPrior(prior: CollisionEntryPrior) {
  return {
    kind: prior.kind,
    targetTangentOffsetFrames: round(prior.targetTangentOffsetFrames),
    entryAngleRelativeDeg: round(prior.entryAngleRelativeDeg),
    diagnostics: {
      targetSpeedPxPerFrame: nullableRound(prior.diagnostics.targetSpeedPxPerFrame),
      brakingSpeedDeficitPxPerFrame: nullableRound(prior.diagnostics.brakingSpeedDeficitPxPerFrame),
      impact: nullableRound(prior.diagnostics.impact),
      requiredRedirectionTurnDeg: nullableRound(prior.diagnostics.requiredRedirectionTurnDeg),
      entryTurnShare: nullableRound(prior.diagnostics.entryTurnShare),
    },
  };
}

function summarizeIntent(intent: ReturnType<typeof deriveSupportEnvelopeIntent>) {
  return {
    outgoing: {
      gapIndex: intent.outgoing.gapIndex,
      startFrame: intent.outgoing.startFrame,
      endFrame: intent.outgoing.endFrame,
      intervalFrames: intent.outgoing.intervalFrames,
      measurementSamples: intent.outgoing.measurementSamples,
      targets: roundAxes(intent.outgoing.targets),
    },
    supportPrior: intent.supportPrior,
    air: {
      targetAir: intent.air.targetAir,
      minimumAirborneSamples: intent.air.minimumAirborneSamples,
      minimumAirFraction: round(intent.air.minimumAirFraction),
      authoredAirMeetsMinimumRun: intent.air.authoredAirMeetsMinimumRun,
      nominalAirborneSamples: nullableRound(intent.air.nominalAirborneSamples),
      nominalAirborneIntervals: nullableRound(intent.air.nominalAirborneIntervals),
      nominalSupportIntervals: nullableRound(intent.air.nominalSupportIntervals),
    },
    authoredMeanSpeedPxPerFrame: nullableRound(intent.authoredMeanSpeedPxPerFrame),
    maximumSupportIntervals: intent.maximumSupportIntervals,
  };
}

function aggregatePrimaryRecords(records: readonly { primary: { stage: EvaluationStage } }[]) {
  const count = (stage: EvaluationStage) => records.filter((record) => record.primary.stage === stage).length;
  return {
    attempted: records.length,
    accepted: count("accepted"),
    preclear: count("preclear"),
    survival: count("survival"),
    landing: count("landing"),
    offbeat: count("offbeat"),
    invalidGeometry: count("invalid_geometry"),
    errors: count("error"),
    unknown: count("unknown"),
  };
}

function primaryRecordFromError(
  error: unknown,
  lines: TrackLine[] | null = null,
  started = performance.now(),
  simBefore = getSimFrames(),
) {
  return {
    stage: "error" as const,
    error: errorMessage(error),
    proposed: lines === null ? null : summarizeLines(lines),
    currentAdmission: null,
    localContact: null,
    outbound: null,
    elapsedMs: round(performance.now() - started),
    simFrames: getSimFrames() - simBefore,
  };
}

const errorPrimaryRecord = primaryRecordFromError;

function failureStage(before: Counter, after: Counter): Exclude<EvaluationStage, "accepted" | "invalid_geometry" | "error"> {
  if (after.preclear_rejected > before.preclear_rejected) return "preclear";
  if (after.direct_survival_failed > before.direct_survival_failed) return "survival";
  if (after.direct_offbeat_failed > before.direct_offbeat_failed) return "offbeat";
  if (after.direct_landing_failed > before.direct_landing_failed) return "landing";
  return "unknown";
}

function counterDelta(before: Counter, after: Counter): Record<string, number> {
  return Object.fromEntries(Object.keys(after).map((key) => [
    key,
    (after as Record<string, number>)[key] - (before as Record<string, number>)[key],
  ]));
}

function roundControl(control: TransitionEnvelopeControl): Record<string, number> {
  return roundNumericRecord(control);
}

function roundNumericRecord(control: object): Record<string, number> {
  return Object.fromEntries(Object.entries(control).map(([key, value]) => {
    if (typeof value !== "number") throw new Error(`control ${key} must be numeric`);
    return [key, round(value)];
  }));
}

function roundAxes(axes: AxisValues): AxisValues {
  return Object.fromEntries(Object.entries(axes).flatMap(([axis, value]) =>
    typeof value === "number" ? [[axis, round(value)]] : [],
  ));
}

function sameLineGeometry(left: readonly TrackLine[], right: readonly TrackLine[]): boolean {
  return left.length === right.length && left.every((line, index) => {
    const other = right[index];
    return other !== undefined &&
      line.x1 === other.x1 && line.y1 === other.y1 && line.x2 === other.x2 && line.y2 === other.y2;
  });
}

function nullableRound(value: number | null): number | null {
  return value === null ? null : round(value);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
