/**
 * The aiming layer — probe, fit, propose (docs/ARC_STATE_CONTROL.md).
 *
 * Turns arc placement from sample-and-hope into aim. The concept: a LOCAL
 * PREDICTIVE MODEL whose inputs are the current state plus controllable arc
 * modifications (knobs), whose outputs are predicted quantities of interest
 * (rider state, sled pose, in principle score components), fitted per gap,
 * per arc, at compile time from a few probe rides — then inverted to propose
 * aimed candidates, which the unchanged search measures and ranks. What is
 * implemented here is one deliberately simple instance of that concept; the
 * structure is meant to make richer instances (more outputs, more knobs,
 * several aimed candidates, multi-target solves, learned priors) additive
 * rather than rewrites.
 *
 * There is ONE lane: the enumerative proposer (makeEnumAimedCandidates) —
 * configured knob vectors → local response model over current axes and
 * outgoing-gap aggregates → a two-layer proposal objective swept in-model →
 * top-k proposals through exact production evaluation. Its
 * hand-tuned predecessors (V3 speed-aim, V4 angle-aim +
 * arrival-conditioned scoop, rotate fallback, climb defer) were each
 * subsumed and deleted once their ablation priced at ~zero.
 * The file is organized as the layers of the idea:
 *
 *   1. flags            — per-call env reads (tests pin them dynamically)
 *   2. telemetry        — proposer funnel + live prediction-accuracy stats
 *   3. knob transforms  — chain-continuity-preserving line edits (inputs)
 *   4. probes           — one forked metered ride = current-axis outputs
 *                         plus next-arrival rider state
 *   5. local models     — per-output joint pitch/rotate response fits
 *   6. the lane         — the enumerative proposer
 *
 * INVARIANTS (architecture rules, each bought with a measured failure):
 *
 *   I1 PROPOSER, NEVER JUDGE. Predictions only choose what to propose; every
 *      proposal is simulated exactly (tryCandidateLines: survival, landing
 *      ±1f, off-beat, axis measurement, cost); ranking and commits consume
 *      only measurements. A wrong prediction costs one wasted candidate
 *      evaluation, never a wrong track.
 *   I2 DETERMINISM. Lanes consume ZERO rng draws; lane candidates carry no
 *      sampleAttempt and live outside sampleOrder, so the attempt-prefix
 *      property of the candidate cache stays intact.
 *   I3 BUDGET HONESTY. Probe simulation and launch reads are metered.
 *   I4 NO HIDDEN CHARGED-ROLLOUT COST. A lane must not silently multiply the
 *      evals billed inside forward-eval rollouts (v4-01 −3.8; scoop-rollout
 *      −9.0; attempt-0 −29.5). This is NOT "don't simulate more".
 *   I5 DON'T COLLAPSE POOL DIVERSITY. Aiming refines sampled families; the
 *      rest of the pool still competes.
 *
 * CURRENT-INSTANCE CHOICES (defaults, not rules — revisitable with evidence):
 * two knobs (tail pitch + post-contact pitch; whole-arc rotation was replaced in 5d71efb); fixed 5-probe cross design; a
 * shared hybrid joint response model also used by the study harness; top-2
 * emitted proposals per refined base. The local response fit scores only the
 * settled incoming and projected outgoing layers it actually predicts. Once a
 * proposal is simulated, pool ranking evaluates the full articulated
 * next-arc readiness model.
 */

import { getPhysicsFrameCount, K_BOUNCE_LANDING } from "../../lib/detector.ts";
import { compileScopedEnv } from "../env_flags.ts";
import {
  axisLookaheadEndFrame,
  POOL_MODE,
  tryCandidateLines,
} from "../core/candidate.ts";
import { registerCompileReset } from "../core/compile_lifecycle.ts";
import {
  AXES,
  type AxisName,
  type AxisValues,
  type TrackLine,
} from "../types.ts";
import { getCandidateProbe, type Candidate, type SpecContext } from "./sample.ts";
import {
  adjustArcTailLength,
  jointArcCurrentScoreAxes,
  predictedCurrentAxes,
  scoreCompletedArcPrediction,
  type JointArcCurrentScoreAxes,
} from "./arc_model.ts";
import {
  fitArcVectorResponseModel,
  predictArcVectorOutputs,
  predictArcVectorScoreReadout,
  type ArcVectorProbeRow,
  type ArcVectorResponseModel,
} from "./arc_vector_model.ts";
import {
  evaluateArcKnobSequence,
  projectJointArcBaseFit,
  type JointArcProbeObservation,
} from "./arc_probe.ts";
import {
  ARC_CONTROL_DEFAULT,
  ARC_PROBE_LAYOUTS,
  ARC_TRAINING_METHODS,
  arcControlProposalValues,
  arcControlProbeVectors,
  arcControlStageProbeValues,
  type ArcProbeLayoutId,
  type ArcTrainingMethod,
} from "./arc_control.ts";
import {
  applyArcKnobSequence,
  arcKnobProbeSpan,
  arcKnobProposalSeparation,
  arcKnobSequenceNeedsContactPoint,
  getArcKnob,
  type ArcKnobId,
  type ArcKnobSequence,
} from "./arc_actuator.ts";
import {
  nextContactGap,
  projectOutgoingScorerGap,
  proposalUtility,
  type GapObjectiveScore,
  scoreCandidateProposal,
  projectedOutgoingSurrogateQuality,
  scoreProjectedOutgoingSurrogate,
  scorerGapFrameCount,
} from "./objective.ts";
import {
  PRODUCTION_ARC_PROPOSAL_POLICY_ID,
  successorScorerGapAfter,
} from "./arc_proposal.ts";
import {
  readinessScorerGapContext,
} from "./readiness_features.ts";
import {
  scoreDistilledAimImpactFeasibility,
  scoreImpactFeasibility,
} from "./readiness.ts";
import type {
  BallisticState,
  IncomingKinematics,
} from "../core/ballistic_projection.ts";
import {
  AIR_DELIVERABILITY_DEADBAND,
  airDeliverabilityAsk,
} from "./air_policy.ts";
import type { Gap } from "../types.ts";

// ───────────────────────────── 1 · Flags ─────────────────────────────
// Keep one top-level ablation switch; production aim policy constants are frozen.

/** The enumerative proposer — the aiming lane.
 *  Fit scorer-facing outputs from shared probes, enumerate the configured
 *  knob space inside the model, score each variation by settled incoming
 *  quality × projected outgoing quality × distilled next-contact impact
 *  feasibility, and propose the top candidates through the unchanged exact
 *  evaluator. Full next-arc readiness enters only after that exact evaluation,
 *  in canonical pool ranking. This lane subsumed every
 *  hand-tuned predecessor:
 *  V3 speed-aim + V4 angle-aim triggers (ACCEPT Δ+3.3 → 600.71), the
 *  elevation climb-defer (removed at parity Δ−0.1 → 600.57), and the V4
 *  arrival-conditioned scoop lane (ablation priced at Δ−0.0 under this
 *  lane — deleted 2026-06-10; its deep-catch geometry can return as a
 *  sampler template if the impact axis ever wants it back).
 *  LR_AIM_ENUM=0 disables (ablation; also the budget-arithmetic test pin). */
export function aimEnumEnabled(): boolean {
  return (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env?.LR_AIM_ENUM !== "0";
}

const aimModelImpactFeasibilityEnv = compileScopedEnv(
  "LR_AIM_MODEL_IMPACT_FEASIBILITY",
);

/** Production fixed-count controller. The distilled model changes which fitted
 * knob vectors are proposed, but neither the probe grid nor proposal count.
 * `off` and the much heavier full readiness forest remain explicit diagnostic
 * ablations. */
type AimModelImpactPolicy = "off" | "full" | "distilled";

function aimModelImpactPolicy(): AimModelImpactPolicy {
  const value = aimModelImpactFeasibilityEnv();
  if (value === undefined || value === "" || value === "distilled") {
    return "distilled";
  }
  if (value === "0" || value === "off") return "off";
  if (value === "1" || value === "full") return "full";
  throw new Error(
    `LR_AIM_MODEL_IMPACT_FEASIBILITY must be off, full, or distilled; got ${value}`,
  );
}

function aimModelImpactFeasibilityEnabled(): boolean {
  return aimModelImpactPolicy() !== "off";
}

/** Study calibration for the distilled factor's log-weight inside the fixed
 * proposal ranking. One is the production policy and preserves the exact
 * multiplication path. This is intentionally aim-specific: the global
 * readiness power also changes ordinary pool ranking and would confound the
 * question being measured here. */
export function aimModelImpactPower(
  environment: Record<string, string | undefined> =
    (globalThis as { process?: { env?: Record<string, string | undefined> } })
      .process?.env ?? {},
): number {
  const raw = environment.LR_AIM_MODEL_IMPACT_POWER;
  if (raw === undefined || raw === "") return 1;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0.25 || value > 4) {
    throw new Error(`LR_AIM_MODEL_IMPACT_POWER must be in [0.25, 4]; got ${raw}`);
  }
  return value;
}

/** Below this |predicted base air − effective ask| the air-matched variant is
 *  not worth a candidate evaluation (blast-radius gate: inert where the base
 *  already lands near the ask). Probe-tuned: 0.18 priced out most emissions
 *  and lost the scarce-tier gain; 0.10 carries it. */
const AIR_KNOB_MIN_MISMATCH = 0.10;
/** Don't bother editing for less than this many frames of release shift. */
const AIR_KNOB_MIN_SHIFT_FRAMES = 2;

let aimRepairLaneActive = false;
let aimRepairIterationIndex: number | null = null;

export function setAimRepairLaneActive(
  active: boolean,
  iterationIndex: number | null = null,
): void {
  if (active && (iterationIndex === null || !Number.isSafeInteger(iterationIndex) || iterationIndex < 0)) {
    throw new Error(`active aim repair lane requires a non-negative iteration index`);
  }
  aimRepairLaneActive = active;
  aimRepairIterationIndex = active ? iterationIndex : null;
}

export function aimControlPhase(
  environment: Record<string, string | undefined> =
    (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {},
): "all" | "repair" {
  const value = environment.LR_AIM_CONTROL_PHASE;
  if (value === undefined || value === "" || value === "all") return "all";
  if (value === "repair") return "repair";
  throw new Error(`LR_AIM_CONTROL_PHASE must be all or repair; got ${value}`);
}

export function aimControlOverrideActive(
  phase: "all" | "repair" = aimControlPhase(),
): boolean {
  return phase === "all" || aimRepairLaneActive;
}

/**
 * The normal compiler's two response coordinates are positional: first knob
 * value = `rotateDeg`, second = `pitchDeg`. `LR_AIM_KNOB_SEQUENCE=a,b` is the
 * generic ordered-knob study override.  The no-environment path deliberately
 * reads ARC_CONTROL_DEFAULT so a selected sequence is truly source-baked
 * before confirmation.
 */
function aimKnobSequence(): ArcKnobSequence {
  const requested = aimControlOverrideActive()
    ? (globalThis as { process?: { env?: Record<string, string | undefined> } })
      .process?.env?.LR_AIM_KNOB_SEQUENCE
    : undefined;
  if (requested !== undefined && requested !== "") {
    const sequence = requested.split(",").map((id) => id.trim()).filter(Boolean) as ArcKnobId[];
    if (sequence.length < 1) {
      throw new Error(`LR_AIM_KNOB_SEQUENCE must name at least one knob`);
    }
    for (const id of sequence) getArcKnob(id);
    return sequence;
  }
  return [...ARC_CONTROL_DEFAULT.sequence];
}

/** The observation/model-construction axis is independent from the physical
 * knob sequence.  It is intentionally an exploration override only: any
 * selected behavior has to become the source default before confirmation. */
function aimTrainingMethod(): ArcTrainingMethod {
  const requested = aimControlOverrideActive()
    ? (globalThis as { process?: { env?: Record<string, string | undefined> } })
      .process?.env?.LR_AIM_TRAINING_METHOD
    : undefined;
  if (requested === undefined || requested === "") return ARC_CONTROL_DEFAULT.trainingMethod;
  if (!(ARC_TRAINING_METHODS as readonly string[]).includes(requested)) {
    throw new Error(`unknown LR_AIM_TRAINING_METHOD=${requested}`);
  }
  return requested as ArcTrainingMethod;
}

function aimProbeLayout(): ArcProbeLayoutId {
  const requested = aimControlOverrideActive()
    ? (globalThis as { process?: { env?: Record<string, string | undefined> } })
      .process?.env?.LR_AIM_PROBE_LAYOUT
    : undefined;
  if (requested === undefined || requested === "") return ARC_CONTROL_DEFAULT.probeLayout;
  if (!(requested in ARC_PROBE_LAYOUTS)) throw new Error(`unknown LR_AIM_PROBE_LAYOUT=${requested}`);
  return requested as ArcProbeLayoutId;
}

function aimProposalCount(): number {
  const requested = aimControlOverrideActive()
    ? (globalThis as { process?: { env?: Record<string, string | undefined> } })
      .process?.env?.LR_AIM_PROPOSAL_COUNT
    : undefined;
  if (requested === undefined || requested === "") return ARC_CONTROL_DEFAULT.proposalCount;
  const value = Number(requested);
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`invalid LR_AIM_PROPOSAL_COUNT=${requested}`);
  }
  return value;
}

function aimPositiveRangeScale(
  variable: "LR_AIM_PROBE_RANGE_SCALE" | "LR_AIM_PROPOSAL_RANGE_SCALE",
  fallback: number,
): number {
  const requested = aimControlOverrideActive()
    ? (globalThis as { process?: { env?: Record<string, string | undefined> } })
      .process?.env?.[variable]
    : undefined;
  if (requested === undefined || requested === "") return fallback;
  const value = Number(requested);
  if (!Number.isFinite(value) || value <= 0) throw new Error(`invalid ${variable}=${requested}`);
  return value;
}

type AimControl = Readonly<{
  sequence: ArcKnobSequence;
  trainingMethod: ArcTrainingMethod;
  probeLayout: ArcProbeLayoutId;
  probeRangeScale: number;
  proposalRangeScale: number;
  proposalCount: number;
}>;

type AimAuxAdmission =
  | "impact-speed-pareto"
  | "impact-speed-air-outgoing-pareto";

export function impactSpeedParetoImproves(
  base: AxisValues,
  candidate: AxisValues,
  targets: AxisValues,
): boolean {
  const targetImpact = targets.impact;
  const targetSpeed = targets.speed;
  const baseImpact = base.impact;
  const baseSpeed = base.speed;
  const candidateImpact = candidate.impact;
  const candidateSpeed = candidate.speed;
  if (
    targetImpact === undefined || targetSpeed === undefined ||
    baseImpact === undefined || baseSpeed === undefined ||
    candidateImpact === undefined || candidateSpeed === undefined
  ) return false;
  const baseImpactError = Math.abs(baseImpact - targetImpact);
  const baseSpeedError = Math.abs(baseSpeed - targetSpeed);
  const candidateImpactError = Math.abs(candidateImpact - targetImpact);
  const candidateSpeedError = Math.abs(candidateSpeed - targetSpeed);
  return candidateImpactError < baseImpactError - 1e-9 &&
    candidateSpeedError <= baseSpeedError + 1e-9;
}

/** Conservative repair-only admission.  Impact remains the strict improvement
 * axis, while every other exactly observed layer that this local actuator can
 * disturb must be non-worse.  This is intentionally stronger than the pool's
 * later scalar rank: a small gain on one layer may not buy debt on another. */
export function impactSpeedAirOutgoingParetoImproves(
  base: AxisValues,
  candidate: AxisValues,
  targets: AxisValues,
  baseOutgoingQuality: number,
  candidateOutgoingQuality: number,
): boolean {
  if (!impactSpeedParetoImproves(base, candidate, targets)) return false;
  if (
    !Number.isFinite(baseOutgoingQuality) ||
    !Number.isFinite(candidateOutgoingQuality) ||
    candidateOutgoingQuality < baseOutgoingQuality - 1e-9
  ) return false;
  if (targets.air === undefined) return true;
  if (base.air === undefined || candidate.air === undefined) return false;
  return Math.abs(candidate.air - targets.air) <=
    Math.abs(base.air - targets.air) + 1e-9;
}

function aimControl(): AimControl {
  return {
    sequence: aimKnobSequence(),
    trainingMethod: aimTrainingMethod(),
    probeLayout: aimProbeLayout(),
    probeRangeScale: aimPositiveRangeScale("LR_AIM_PROBE_RANGE_SCALE", ARC_CONTROL_DEFAULT.probeRangeScale),
    proposalRangeScale: aimPositiveRangeScale("LR_AIM_PROPOSAL_RANGE_SCALE", ARC_CONTROL_DEFAULT.proposalRangeScale),
    proposalCount: aimProposalCount(),
  };
}

function aimRepairAuxControl(): { control: AimControl; admission: AimAuxAdmission | null } | null {
  if (!aimRepairLaneActive) return null;
  const environment =
    (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};
  const requested = environment.LR_AIM_REPAIR_AUX_KNOB_SEQUENCE;
  if (requested === undefined || requested === "" || requested === "off") return null;
  const sequence = requested.split(",").map((id) => id.trim()).filter(Boolean) as ArcKnobId[];
  if (sequence.length < 1) {
    throw new Error(`LR_AIM_REPAIR_AUX_KNOB_SEQUENCE must name at least one knob`);
  }
  for (const id of sequence) getArcKnob(id);
  const trainingMethod = environment.LR_AIM_REPAIR_AUX_TRAINING_METHOD ??
    ARC_CONTROL_DEFAULT.trainingMethod;
  if (!(ARC_TRAINING_METHODS as readonly string[]).includes(trainingMethod)) {
    throw new Error(`unknown LR_AIM_REPAIR_AUX_TRAINING_METHOD=${trainingMethod}`);
  }
  const probeLayout = environment.LR_AIM_REPAIR_AUX_PROBE_LAYOUT ??
    ARC_CONTROL_DEFAULT.probeLayout;
  if (!(probeLayout in ARC_PROBE_LAYOUTS)) {
    throw new Error(`unknown LR_AIM_REPAIR_AUX_PROBE_LAYOUT=${probeLayout}`);
  }
  const positive = (name: string, fallback: number): number => {
    const raw = environment[name];
    if (raw === undefined || raw === "") return fallback;
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0) throw new Error(`invalid ${name}=${raw}`);
    return value;
  };
  const proposalCountRaw = environment.LR_AIM_REPAIR_AUX_PROPOSAL_COUNT;
  const proposalCount = proposalCountRaw === undefined || proposalCountRaw === ""
    ? ARC_CONTROL_DEFAULT.proposalCount
    : Number(proposalCountRaw);
  if (!Number.isSafeInteger(proposalCount) || proposalCount < 1) {
    throw new Error(`invalid LR_AIM_REPAIR_AUX_PROPOSAL_COUNT=${proposalCountRaw}`);
  }
  const admissionRaw = environment.LR_AIM_REPAIR_AUX_ADMISSION;
  const admission = admissionRaw === undefined || admissionRaw === "" || admissionRaw === "off"
    ? null
    : admissionRaw === "impact-speed-pareto" ||
        admissionRaw === "impact-speed-air-outgoing-pareto"
    ? admissionRaw
    : (() => {
      throw new Error(`unknown LR_AIM_REPAIR_AUX_ADMISSION=${admissionRaw}`);
    })();
  return {
    control: {
      sequence,
      trainingMethod: trainingMethod as ArcTrainingMethod,
      probeLayout: probeLayout as ArcProbeLayoutId,
      probeRangeScale: positive(
        "LR_AIM_REPAIR_AUX_PROBE_RANGE_SCALE",
        ARC_CONTROL_DEFAULT.probeRangeScale,
      ),
      proposalRangeScale: positive(
        "LR_AIM_REPAIR_AUX_PROPOSAL_RANGE_SCALE",
        ARC_CONTROL_DEFAULT.proposalRangeScale,
      ),
      proposalCount,
    },
    admission,
  };
}

function aimStudyStatsEnabled(): boolean {
  return (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env?.LR_AIM_STUDY_STATS === "1";
}

function repairAuxStudyCertificateEnabled(): boolean {
  return (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env?.LR_AIM_STUDY_REPAIR_AUX_CERTIFICATE === "1";
}

const AIM_OUTGOING_AMPLITUDE_ONSET = 0.30;
const AIM_OUTGOING_AMPLITUDE_MATURE_BUDGET = 500_000;
const AIM_OUTGOING_AMPLITUDE_PROFILE_MEAN_MIN = 0.25;
const AIM_OUTGOING_AMPLITUDE_PROFILE_AIR_MAX = 0.60;

type OutgoingAmplitudeProfile = {
  meanAmplitude: number | null;
  meanAir: number | null;
};

const outgoingAmplitudeProfileCache = new WeakMap<SpecContext, OutgoingAmplitudeProfile>();

function outgoingAmplitudeProfile(ctx: SpecContext): OutgoingAmplitudeProfile {
  const cached = outgoingAmplitudeProfileCache.get(ctx);
  if (cached !== undefined) return cached;
  const targets = ctx.gapAxisTargets ?? ctx.gaps?.map((gap) => gap.targets) ?? [];
  const mean = (axis: "amplitude" | "air"): number | null => {
    const values = targets.map((target) => target[axis]).filter((value): value is number =>
      value !== undefined && Number.isFinite(value)
    );
    return values.length === 0
      ? null
      : values.reduce((sum, value) => sum + value, 0) / values.length;
  };
  const profile = { meanAmplitude: mean("amplitude"), meanAir: mean("air") };
  outgoingAmplitudeProfileCache.set(ctx, profile);
  return profile;
}

export function aimOutgoingAmplitudeEligible(
  target: number | undefined,
  environment: Record<string, string | undefined> =
    (globalThis as { process?: { env?: Record<string, string | undefined> } })
      .process?.env ?? {},
  budgetFrames = 0,
  profile: OutgoingAmplitudeProfile = { meanAmplitude: null, meanAir: null },
): boolean {
  if (target === undefined) return false;
  // Promoted after a seven-seed paired validation: only mature sources with a
  // substantive amplitude program and non-high mean air get the fourth
  // outgoing model output.  `off` remains the exact pre-promotion control.
  const requested = environment.LR_AIM_OUTGOING_AMPLITUDE;
  const mode = requested === undefined || requested === ""
    ? "mature-distinct"
    : requested;
  if (mode === "0" || mode === "off") return false;
  if (mode === "1" || mode === "all") return true;
  if (mode === "commanded") return target >= AIM_OUTGOING_AMPLITUDE_ONSET;
  if (mode === "mature") return budgetFrames >= AIM_OUTGOING_AMPLITUDE_MATURE_BUDGET;
  if (mode === "mature-commanded") {
    return budgetFrames >= AIM_OUTGOING_AMPLITUDE_MATURE_BUDGET &&
      target >= AIM_OUTGOING_AMPLITUDE_ONSET;
  }
  if (mode === "mature-distinct") {
    return budgetFrames >= AIM_OUTGOING_AMPLITUDE_MATURE_BUDGET &&
      profile.meanAmplitude !== null &&
      profile.meanAmplitude >= AIM_OUTGOING_AMPLITUDE_PROFILE_MEAN_MIN &&
      profile.meanAir !== null &&
      profile.meanAir <= AIM_OUTGOING_AMPLITUDE_PROFILE_AIR_MAX;
  }
  throw new Error(`unknown LR_AIM_OUTGOING_AMPLITUDE=${mode}`);
}

function exactAxisSse(targets: AxisValues, achieved: AxisValues): number {
  let sse = 0;
  for (const axis of Object.keys(targets) as AxisName[]) {
    const target = targets[axis];
    const value = achieved[axis];
    if (target === undefined || value === undefined) continue;
    const error = value - target;
    sse += error * error;
  }
  return sse;
}

let aimBaseFitReuseAllowed = false;

/** Scoped by the handoff ranker: exact base-fit reuse is a quality-phase
 * optimization only, after the compile already owns a complete valid track. */
export function setAimBaseFitReuseAllowed(allowed: boolean): void {
  aimBaseFitReuseAllowed = allowed;
}

function aimReuseBaseFitEnabled(): boolean {
  return aimBaseFitReuseAllowed &&
    (globalThis as { process?: { env?: Record<string, string | undefined> } })
      .process?.env?.LR_AIM_REUSE_BASE_FIT !== "0";
}

/** Accepted mature aim-base count. K=1 runs the lane on `sorted[0]` only; K>1
 *  runs it on the first K distinct candidates, accumulating each base's lane
 *  extras into the pool so the search refines more than just the quality-best
 *  base. Low-air gaps cap the effective mature K at 3 below. */
export const AIM_TOPK_BASES = 4;

/** Maturity gate for K>1. The extra bases find good variants but cost ~2.5×
 *  more probe frames per pool build; at small budgets that probe cost starves
 *  the compile (validity collapses, the per-budget curve goes deeply negative
 *  at 50k/100k and only turns positive at 200k/300k). So gate K>1 on the
 *  compile TARGET budget — the same per-compile-constant maturity signal the
 *  forward-eval gate (usesForwardEvalAtBudget) uses. Target budget is fixed for
 *  the whole compile, so K_effective never changes mid-node and the per-node
 *  _candidatesCache (which may rebuild a node at a larger nCand) stays
 *  deterministic — exactly why
 *  consumed-frame signals are unusable here.
 *
 *  Each golden checkpoint is an INDEPENDENT full compile at its own target budget
 *  (golden.ts: "Each budget is an INDEPENDENT full run"), NOT a snapshot of one
 *  300k compile — so this gate makes the 50k/100k compiles run fully at K=1
 *  (byte-identical to the K=1 default) while the 200k/300k compiles run fully at
 *  K>1 and collect the late-budget gain.
 *
 *  Threshold 100k: after start max-width and tighter repair feasibility, the accepted
 *  top-4 non-low-air aim lane pays even at the canonical scarce tier. Canonical
 *  2026-06-23 accepted the 150k -> 100k gate move (+2.9 headline, entirely at 100k).
 */
const AIM_TOPK_MATURE_BUDGET_FRAMES = 100_000;
const AIM_LOW_AIR_TOPK_MAX = 3;
const AIM_LOW_AIR_TOPK_AIR_MAX = 0.30;
// High-budget aim-base count, anchored at the accepted six bases at 250k.
// As with per-gap sampling breadth, a compile with twice the frames can afford
// twice as many fixed-cost local refinements per visited gap. Keeping K fixed
// while sampled breadth grows 27/54/81 would refine a shrinking fraction of
// the exact pool as budget rises.
const AIM_TOPK_BASES_AT_REF = 6;
const AIM_TOPK_BASES_REF_FRAMES = 250_000;
const AIM_TOPK_HIGH_BUDGET_FRAMES = 200_000;

/** Study control for the previously unfitted mature breadth exponent.  The
 * production value is exactly linear; every arm remains anchored at K=6 at
 * 250k and changes only how refinement breadth scales above that point. */
export function aimTopKScaleExponent(
  environment: Record<string, string | undefined> =
    (globalThis as { process?: { env?: Record<string, string | undefined> } })
      .process?.env ?? {},
): number {
  const raw = environment.LR_AIM_TOPK_SCALE_EXPONENT;
  if (raw === undefined || raw === "") return 1;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0 || value > 2) {
    throw new Error(`invalid LR_AIM_TOPK_SCALE_EXPONENT=${raw}`);
  }
  return value;
}

/** Study scope for the mature aim-base exponent. `all` is the production and
 * historical-study behavior. `repair` keeps initial and resumed pools on the
 * production exponent and changes only independently marked repair restarts. */
export function aimTopKScaleScope(
  environment: Record<string, string | undefined> =
    (globalThis as { process?: { env?: Record<string, string | undefined> } })
      .process?.env ?? {},
): "all" | "repair" {
  const raw = environment.LR_AIM_TOPK_SCALE_SCOPE;
  if (raw === undefined || raw === "" || raw === "all") return "all";
  if (raw === "repair") return "repair";
  throw new Error(`invalid LR_AIM_TOPK_SCALE_SCOPE=${raw}`);
}

/** Study-only increment for the highest-yield repair iteration. The default is
 *  deliberately inert; accepted production behavior remains source-baked. */
export function aimTopKFirstRepairExtra(
  environment: Record<string, string | undefined> =
    (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {},
): number {
  const raw = environment.LR_AIM_TOPK_FIRST_REPAIR_EXTRA;
  if (raw === undefined || raw === "") return 0;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 0 || value > 8) {
    throw new Error(`LR_AIM_TOPK_FIRST_REPAIR_EXTRA must be an integer in [0, 8]; got ${raw}`);
  }
  return value;
}

let aimCompileBudgetFrames = 0;
/** Set the compile target budget for the K>1 maturity gate. Called once per
 *  compile at compileHandoff entry, alongside the other budget setters. */
export function setAimCompileBudgetFrames(frames: number): void {
  aimCompileBudgetFrames = Math.max(0, frames | 0);
}

/** Effective lane-base count for the current compile/gap: K below the maturity
 *  threshold collapses to 1 (byte-identical to the K=1 default). Mature low-air
 *  gaps keep the accepted top-3 behavior; other mature gaps use the accepted
 *  top-4 policy, rising to the accepted high-budget top-6 policy. */
export function aimTopKBasesEffective(gap?: Gap, _gaps?: readonly Gap[], _ctx?: SpecContext): number {
  if (aimCompileBudgetFrames < AIM_TOPK_MATURE_BUDGET_FRAMES) return 1;
  // High-budget uniform bump: at mature TARGET budgets the broader base count pays
  // (canonical: K=6 at 250k/375k/500k = +0.5/+1.6/+0.8) but starves 125k (-18.9), so
  // gate the rise on the compile budget.
  const highBudget = aimCompileBudgetFrames >= AIM_TOPK_HIGH_BUDGET_FRAMES;
  const exponent = aimTopKScaleScope() === "repair" && !aimRepairLaneActive
    ? 1
    : aimTopKScaleExponent();
  const policyBaseK = highBudget
    ? Math.max(
      AIM_TOPK_BASES,
      Math.round(AIM_TOPK_BASES_AT_REF *
        Math.pow(
          aimCompileBudgetFrames / AIM_TOPK_BASES_REF_FRAMES,
          exponent,
        )),
    )
    : AIM_TOPK_BASES;
  const baseK = policyBaseK +
    (aimRepairLaneActive && aimRepairIterationIndex === 0 ? aimTopKFirstRepairExtra() : 0);
  if (gap?.targets.air !== undefined && gap.targets.air <= AIM_LOW_AIR_TOPK_AIR_MAX) {
    return Math.min(baseK, AIM_LOW_AIR_TOPK_MAX);
  }
  return baseK;
}

function targetForGap(gap: Gap, ctx: SpecContext, axis: AxisName): number | null {
  const target = objectiveTargetsForGap(gap, ctx)[axis];
  return typeof target === "number" && Number.isFinite(target) ? target : null;
}

/** Telemetry: a requested top-K base was skipped (duplicate of an
 *  already-refined base, or the pool was shorter than K). */
export function recordLaneBaseSkip(): void {
  aimTotals.enum_lane_base_skips++;
}

/** Quality-objective pool ranking (LR_RANK_QUALITY): make the shared objective
 *  — settled incoming quality × projected outgoing quality × next-arc
 *  readiness — the
 *  JUDGE of the per-gap pool sort (node.ts), so the aim lane refines the
 *  quality-best base instead of the cost-best one. The per-gap pool sort ranks
 *  by the objective; handoff branch selection still uses mature forward eval
 *  or the measured handoff score. (The former LR_RANK_QUALITY=off escape
 *  hatch was deleted after the pool sort soaked as the sole production path.)
 *  The constant lives in core/candidate.ts (single owner, shared with the
 *  predict-arrival capture gate there). */
export function rankQualityEnabled(): boolean {
  return POOL_MODE;
}

// ─────────────────────────── 2 · Telemetry ───────────────────────────

/** Study-only aim telemetry (`compile_stats.aim.study`, opt-in via
 *  LR_AIM_STUDY_STATS=1). Default production stats keep only the proposer
 *  funnel and probe cost; these fields answer campaign-analysis questions. */
export type AimStudyStats = {
  /** Mean |predicted − achieved| projected outgoing quality. */
  enum_projection_pairs: number;
  enum_projection_err_mean: number;
  /** Mean surrogate-objective gain over δ=0, over emitted. */
  enum_objective_gain_mean: number;
  model_impact_policy: AimModelImpactPolicy;
  /** Production distilled controller (or full-model diagnostic): modeled
   *  knob-grid evaluations whose next-contact impact feasibility was inferred, grids
   *  where that extra factor changed the best improving knob vector, missing
   *  modeled arrivals, and the inferred factor's level/spread. The arm does
   *  not add probes or emitted proposals. */
  enum_model_impact_scores: number;
  enum_model_impact_grids: number;
  enum_model_impact_top1_changed: number;
  enum_model_impact_state_missing: number;
  enum_model_impact_mean: number;
  enum_model_impact_spread_mean: number;
  /** Where the full impact-aware top two lie in the ordinary objective order.
   *  `within_K` counts grids whose BOTH selected proposals are in its top K;
   *  this directly sizes a cheaper shortlist without guessing. */
  enum_model_impact_selected_rank_observations: number;
  enum_model_impact_selected_max_ordinary_rank_mean: number;
  enum_model_impact_selected_within_4: number;
  enum_model_impact_selected_within_8: number;
  enum_model_impact_selected_within_16: number;
  enum_model_impact_selected_within_32: number;
  enum_model_impact_selected_within_64: number;
  /** Deferred additive rotate-knob split: rotate recruit rate, rotate-probe failures
   *  (lane falls back to pitch-only), and how rotated (dr≠0) proposals
   *  fare at the production gates vs emitted. */
  enum_rot_probe_crash: number;
  enum_rot_recruited: number;
  enum_rot_emitted: number;
  enum_rot_gate_fail: number;
  /** Joint short-probe telemetry. Means are frame numbers/counts over production
   *  `joint_probe_rows`; estimated saved frames are relative to the former full
   *  next-gap observation horizon. A clean suffix stays airborne from suffixFrame
   *  through horizonFrame; dirty rows are still modeled and audited. */
  joint_probe_clean_suffix: number;
  joint_probe_horizon_mean: number;
  joint_probe_suffix_mean: number;
  joint_probe_full_horizon_mean: number;
  joint_probe_saved_frames_mean: number;
  joint_probe_suffix_after_current_mean: number;
  joint_probe_suffix_after_next: number;
  /** Per-row hard-gate outcomes over short probe rows. Gate-failed rows carry
   *  no current-gap outputs, which thins the per-output fit data — the
   *  upstream cause of every degradation counter below. */
  joint_probe_current_ok: number;
  joint_probe_next_state_ok: number;
  /** Output models the hybrid identifiability ladder fitted BELOW their
   *  first-choice functional form (too few gate-clean rows). The model still
   *  exists — the ladder floor is linear — but with less curvature. */
  joint_fit_degraded_outputs: number;
  /** Per-sweep current-gap term coverage: of the gap's targeted axes, how
   *  many had a model prediction at the base knobs (sums), and how many
   *  sweeps had NONE — i.e. the objective degraded to next-gap readiness
   *  with current axis quality pinned at its empty-default 1. Before the
   *  identifiability ladder this
   *  degradation was silent; it must stay observable. */
  enum_current_axes_targeted: number;
  enum_current_axes_modeled: number;
  enum_current_term_missing: number;
  /** Quality-objective pool ranking (LR_RANK_QUALITY; absent when off).
   *  Pool builds where the cost-rank and quality-rank top-3 sets differ, and
   *  where the top-1 differs; candidates with a defined objective vs total scored
   *  (fallback rate = (scored − defined) / scored). All arrivals are served by
   *  ballistic prediction (rank_quality_pred_used). */
  rank_quality_pools: number;
  rank_quality_top3_disagree: number;
  rank_quality_top1_disagree: number;
  rank_quality_candidates_scored: number;
  rank_quality_objective_defined: number;
  /** Prediction bails on the PREDICT path (predict couldn't produce a state →
   *  null objective → cost order). */
  rank_quality_pred_bail: number;
  /** Candidates ranked via a ballistic PREDICTION: the prediction-only objective
   *  path (now every scored candidate that produces an arrival). */
  rank_quality_pred_used: number;
  /** M4 pool air-substrate telemetry (law #1: judge pressure needs pool
   *  substrate). Over pool builds whose NEXT contact gap has an air target:
   *  per-candidate predicted next-gap air (release frame → airborne fraction),
   *  the per-pool spread (max − min), and how many pools contain at least one
   *  candidate at/below the effective (floor-clamped) ask + deadband — i.e.
   *  pools where an air-delivering candidate EXISTS for the judge to pick. */
  rank_air_pools: number;
  rank_air_cands: number;
  rank_air_pred_mean: number;
  rank_air_ask_mean: number;
  rank_air_spread_mean: number;
  rank_air_deliverable_pools: number;
  /** M4 Part B funnel: air-matched ride-out variants considered (mismatch
   *  beyond gate), gate-failed at production evaluation, and emitted. */
  enum_air_considered: number;
  enum_air_gate_fail: number;
  enum_air_emitted: number;
};

/** Lane telemetry (compile_stats.aim — lab-queryable via json_extract).
 *  Production block: considered → (no_target | probe_crash | on_target) →
 *  (gate_fail | emitted), plus the probe volume charged to get there. */
export type AimStats = {
  /** The configured probe layout used by the active controller. */
  probe_design: ArcProbeLayoutId;
  enum_considered: number;
  enum_no_target: number;
  enum_probe_crash: number;
  enum_model_unscoreable: number;
  enum_next_before_exit: number;
  enum_on_target: number;
  enum_gate_fail: number;
  enum_emitted: number;
  /** Probe workload for the lane's fitted local models. */
  joint_probe_rows: number;
  joint_probe_frames_charged: number;
  /** Distinct bases actually refined by the aim lane, and requested bases skipped
   *  because the pool was short or already refined. */
  enum_lane_bases: number;
  enum_lane_base_skips: number;
  /** Where every lane proposal landed in the exact pool it entered, recorded
   *  once per pool build (rank 0 = pool best). These are pool-yield counters;
   *  `handoff_aimed_selected` instead counts aimed fits in the final output. */
  aimed_pool_entries: number;
  aimed_rank0: number;
  aimed_top3: number;
  aimed_rank_sum: number;
  aimed_pool_size_sum: number;
  study?: AimStudyStats;
};

const aimTotals = {
  enum_considered: 0, enum_no_target: 0,
  enum_probe_crash: 0, enum_on_target: 0, enum_gate_fail: 0, enum_emitted: 0,
  enum_model_unscoreable: 0, enum_next_before_exit: 0,
  enumProjectionErrSum: 0, enumObjectiveGainSum: 0, enumAchieved: 0,
  enum_model_impact_scores: 0, enum_model_impact_grids: 0,
  enum_model_impact_top1_changed: 0, enum_model_impact_state_missing: 0,
  enumModelImpactSum: 0, enumModelImpactSpreadSum: 0,
  enum_model_impact_selected_rank_observations: 0,
  enumModelImpactSelectedMaxOrdinaryRankSum: 0,
  enum_model_impact_selected_within_4: 0,
  enum_model_impact_selected_within_8: 0,
  enum_model_impact_selected_within_16: 0,
  enum_model_impact_selected_within_32: 0,
  enum_model_impact_selected_within_64: 0,
  enum_rot_probe_crash: 0, enum_rot_recruited: 0, enum_rot_emitted: 0,
  enum_rot_gate_fail: 0,
  // Selection-rank telemetry (recordLanePoolRank).
  aimed_pool_entries: 0, aimed_rank0: 0, aimed_top3: 0,
  aimed_rank_sum: 0, aimed_pool_size_sum: 0,
  // Joint short-probe telemetry.
  joint_probe_rows: 0, joint_probe_clean_suffix: 0,
  jointProbeHorizonSum: 0, jointProbeSuffixSum: 0, jointProbeSuffixRows: 0,
  jointProbeFullHorizonSum: 0, jointProbeSavedFramesSum: 0,
  jointProbeSuffixAfterCurrentSum: 0, jointProbeSuffixAfterNext: 0,
  joint_probe_current_ok: 0, joint_probe_next_state_ok: 0,
  joint_probe_frames_charged: 0,
  // Top-K base refinement.
  enum_lane_bases: 0, enum_lane_base_skips: 0,
  // Fit/objective degradation telemetry (recordJointModelCoverage).
  joint_fit_degraded_outputs: 0,
  enum_current_axes_targeted: 0, enum_current_axes_modeled: 0,
  enum_current_term_missing: 0,
  // Quality-objective pool ranking (recordRankQualityPool / candidateQualityObjective).
  rank_quality_pools: 0, rank_quality_top3_disagree: 0,
  rank_quality_top1_disagree: 0,
  rank_quality_candidates_scored: 0, rank_quality_objective_defined: 0,
  // Predicted-arrival usage.
  rank_quality_pred_bail: 0, rank_quality_pred_used: 0,
  // M4 pool air-substrate telemetry (recordPoolAirSpread).
  rank_air_pools: 0, rank_air_cands: 0,
  rankAirPredSum: 0, rankAirAskSum: 0, rankAirSpreadSum: 0,
  rank_air_deliverable_pools: 0,
  // M4 Part B air-matched variant funnel.
  enum_air_considered: 0, enum_air_gate_fail: 0, enum_air_emitted: 0,
};

/** Record where a lane proposal ranked in the cost-sorted pool it entered,
 *  and that pool's size. Called by node.ts once per pool build (cache hits
 *  do not re-record; one lane candidate can therefore be ranked in several
 *  rebuilt pools — same semantics as the funnel counters). */
export function recordLanePoolRank(
  _kind: "aimed",
  rank: number,
  poolSize: number,
): void {
  aimTotals.aimed_pool_entries++;
  if (rank === 0) aimTotals.aimed_rank0++;
  if (rank < 3) aimTotals.aimed_top3++;
  aimTotals.aimed_rank_sum += rank;
  aimTotals.aimed_pool_size_sum += poolSize;
}

function recordJointProbeRows(
  rows: readonly JointArcProbeObservation[],
  gap: Gap,
  axisMeasureEnd: number,
  nextFrame: number,
): void {
  const fullHorizon = Math.max(gap.endFrame + 20, axisMeasureEnd + 20, nextFrame + 2);
  for (const row of rows) {
    if (row.mode !== "short") continue;
    aimTotals.joint_probe_rows++;
    if (row.gate.currentOk) aimTotals.joint_probe_current_ok++;
    if (row.gate.nextStateOk) aimTotals.joint_probe_next_state_ok++;
    if (row.cleanAirborneSuffix === true) aimTotals.joint_probe_clean_suffix++;
    aimTotals.jointProbeHorizonSum += row.horizonFrame;
    aimTotals.jointProbeFullHorizonSum += fullHorizon;
    aimTotals.jointProbeSavedFramesSum += Math.max(0, fullHorizon - row.horizonFrame);
    if (row.suffixFrame !== null) {
      aimTotals.jointProbeSuffixRows++;
      aimTotals.jointProbeSuffixSum += row.suffixFrame;
      aimTotals.jointProbeSuffixAfterCurrentSum += row.suffixFrame - gap.endFrame;
      if (row.suffixFrame >= nextFrame) aimTotals.jointProbeSuffixAfterNext++;
    }
  }
}

/** Record, once per joint sweep, how much of the objective's current-gap term
 *  the fitted model actually covers at the base knobs, plus how many output
 *  models the identifiability ladder fitted below first choice. A sweep whose
 *  targeted axes have NO model prediction ranks on composite next-gap
 *  readiness alone (axis quality defaults to 1 on an empty error set —
 *  score.ts axisQualityFromErrors); that is a
 *  legitimate degraded mode, but it must never again be invisible. */
function recordJointModelCoverage(
  model: Readonly<{
    outputModels: ReadonlyMap<string, Readonly<{ model: Readonly<{ degraded: boolean }> }>>;
  }>,
  baseOutputs: Record<string, number>,
  gap: Gap,
): void {
  const axes = predictedCurrentAxes(baseOutputs);
  let targeted = 0;
  let modeled = 0;
  for (const axis of AXES) {
    if (gap.targets[axis] === undefined) continue;
    targeted++;
    if (axes[axis] !== undefined) modeled++;
  }
  aimTotals.enum_current_axes_targeted += targeted;
  aimTotals.enum_current_axes_modeled += modeled;
  if (targeted > 0 && modeled === 0) aimTotals.enum_current_term_missing++;
  let degraded = 0;
  for (const fitted of model.outputModels.values()) {
    if (fitted.model.degraded) degraded++;
  }
  aimTotals.joint_fit_degraded_outputs += degraded;
}

export function resetAimStats(): void {
  aimRepairLaneActive = false;
  aimRepairIterationIndex = null;
  for (const key of Object.keys(aimTotals) as (keyof typeof aimTotals)[]) {
    aimTotals[key] = 0;
  }
  layerSpread = {
    pools: 0,
    settledSpread: 0,
    projectedSpread: 0,
    readinessSpread: 0,
    valueSpread: 0,
    settledMean: 0,
    projectedMean: 0,
    readinessMean: 0,
    valueMean: 0,
  };
}

/**
 * Mean per-pool spread and level of each objective layer. Non-scoring; the
 * question it answers is "which layer is actually deciding the ranking", which
 * no other counter can answer. Null when no pool was scored.
 */
export function snapshotObjectiveLayerSpread(): {
  pools: number;
  settled_spread_mean: number;
  projected_spread_mean: number;
  readiness_spread_mean: number;
  value_spread_mean: number;
  settled_level_mean: number;
  projected_level_mean: number;
  readiness_level_mean: number;
  value_level_mean: number;
} | null {
  const n = layerSpread.pools;
  if (n === 0) return null;
  const r3 = (v: number) => Math.round(v * 1000) / 1000;
  return {
    pools: n,
    settled_spread_mean: r3(layerSpread.settledSpread / n),
    projected_spread_mean: r3(layerSpread.projectedSpread / n),
    readiness_spread_mean: r3(layerSpread.readinessSpread / n),
    value_spread_mean: r3(layerSpread.valueSpread / n),
    settled_level_mean: r3(layerSpread.settledMean / n),
    projected_level_mean: r3(layerSpread.projectedMean / n),
    readiness_level_mean: r3(layerSpread.readinessMean / n),
    value_level_mean: r3(layerSpread.valueMean / n),
  };
}
registerCompileReset(resetAimStats);

/** Snapshot for compile stats; null when the lane never ran (flag off /
 *  no pools) so ablation archives carry no aim key at all. */
export function snapshotAimStats(): AimStats | null {
  if (aimTotals.enum_considered === 0) return null;
  const round3 = (x: number): number => Math.round(x * 1000) / 1000;
  const stats: AimStats = {
    probe_design: aimProbeLayout(),
    enum_considered: aimTotals.enum_considered,
    enum_no_target: aimTotals.enum_no_target,
    enum_probe_crash: aimTotals.enum_probe_crash,
    enum_model_unscoreable: aimTotals.enum_model_unscoreable,
    enum_next_before_exit: aimTotals.enum_next_before_exit,
    enum_on_target: aimTotals.enum_on_target,
    enum_gate_fail: aimTotals.enum_gate_fail,
    enum_emitted: aimTotals.enum_emitted,
    joint_probe_rows: aimTotals.joint_probe_rows,
    joint_probe_frames_charged: aimTotals.joint_probe_frames_charged,
    enum_lane_bases: aimTotals.enum_lane_bases,
    enum_lane_base_skips: aimTotals.enum_lane_base_skips,
    aimed_pool_entries: aimTotals.aimed_pool_entries,
    aimed_rank0: aimTotals.aimed_rank0,
    aimed_top3: aimTotals.aimed_top3,
    aimed_rank_sum: aimTotals.aimed_rank_sum,
    aimed_pool_size_sum: aimTotals.aimed_pool_size_sum,
  };
  if (!aimStudyStatsEnabled()) return stats;
  stats.study = {
    enum_projection_pairs: aimTotals.enumAchieved,
    enum_projection_err_mean: aimTotals.enumAchieved > 0
      ? round3(aimTotals.enumProjectionErrSum / aimTotals.enumAchieved) : 0,
    enum_objective_gain_mean: aimTotals.enum_emitted > 0
      ? round3(aimTotals.enumObjectiveGainSum / aimTotals.enum_emitted) : 0,
    model_impact_policy: aimModelImpactPolicy(),
    enum_model_impact_scores: aimTotals.enum_model_impact_scores,
    enum_model_impact_grids: aimTotals.enum_model_impact_grids,
    enum_model_impact_top1_changed: aimTotals.enum_model_impact_top1_changed,
    enum_model_impact_state_missing: aimTotals.enum_model_impact_state_missing,
    enum_model_impact_mean: aimTotals.enum_model_impact_scores > 0
      ? round3(aimTotals.enumModelImpactSum / aimTotals.enum_model_impact_scores)
      : 0,
    enum_model_impact_spread_mean: aimTotals.enum_model_impact_grids > 0
      ? round3(aimTotals.enumModelImpactSpreadSum / aimTotals.enum_model_impact_grids)
      : 0,
    enum_model_impact_selected_rank_observations:
      aimTotals.enum_model_impact_selected_rank_observations,
    enum_model_impact_selected_max_ordinary_rank_mean:
      aimTotals.enum_model_impact_selected_rank_observations > 0
        ? round3(
          aimTotals.enumModelImpactSelectedMaxOrdinaryRankSum /
            aimTotals.enum_model_impact_selected_rank_observations,
        )
        : 0,
    enum_model_impact_selected_within_4:
      aimTotals.enum_model_impact_selected_within_4,
    enum_model_impact_selected_within_8:
      aimTotals.enum_model_impact_selected_within_8,
    enum_model_impact_selected_within_16:
      aimTotals.enum_model_impact_selected_within_16,
    enum_model_impact_selected_within_32:
      aimTotals.enum_model_impact_selected_within_32,
    enum_model_impact_selected_within_64:
      aimTotals.enum_model_impact_selected_within_64,
    enum_rot_probe_crash: aimTotals.enum_rot_probe_crash,
    enum_rot_recruited: aimTotals.enum_rot_recruited,
    enum_rot_emitted: aimTotals.enum_rot_emitted,
    enum_rot_gate_fail: aimTotals.enum_rot_gate_fail,
    joint_probe_clean_suffix: aimTotals.joint_probe_clean_suffix,
    joint_probe_horizon_mean: aimTotals.joint_probe_rows > 0
      ? round3(aimTotals.jointProbeHorizonSum / aimTotals.joint_probe_rows) : 0,
    joint_probe_suffix_mean: aimTotals.jointProbeSuffixRows > 0
      ? round3(aimTotals.jointProbeSuffixSum / aimTotals.jointProbeSuffixRows) : 0,
    joint_probe_full_horizon_mean: aimTotals.joint_probe_rows > 0
      ? round3(aimTotals.jointProbeFullHorizonSum / aimTotals.joint_probe_rows) : 0,
    joint_probe_saved_frames_mean: aimTotals.joint_probe_rows > 0
      ? round3(aimTotals.jointProbeSavedFramesSum / aimTotals.joint_probe_rows) : 0,
    joint_probe_suffix_after_current_mean: aimTotals.jointProbeSuffixRows > 0
      ? round3(aimTotals.jointProbeSuffixAfterCurrentSum / aimTotals.jointProbeSuffixRows) : 0,
    joint_probe_suffix_after_next: aimTotals.jointProbeSuffixAfterNext,
    joint_probe_current_ok: aimTotals.joint_probe_current_ok,
    joint_probe_next_state_ok: aimTotals.joint_probe_next_state_ok,
    joint_fit_degraded_outputs: aimTotals.joint_fit_degraded_outputs,
    enum_current_axes_targeted: aimTotals.enum_current_axes_targeted,
    enum_current_axes_modeled: aimTotals.enum_current_axes_modeled,
    enum_current_term_missing: aimTotals.enum_current_term_missing,
    rank_quality_pools: aimTotals.rank_quality_pools,
    rank_quality_top3_disagree: aimTotals.rank_quality_top3_disagree,
    rank_quality_top1_disagree: aimTotals.rank_quality_top1_disagree,
    rank_quality_candidates_scored: aimTotals.rank_quality_candidates_scored,
    rank_quality_objective_defined: aimTotals.rank_quality_objective_defined,
    rank_quality_pred_bail: aimTotals.rank_quality_pred_bail,
    rank_quality_pred_used: aimTotals.rank_quality_pred_used,
    rank_air_pools: aimTotals.rank_air_pools,
    rank_air_cands: aimTotals.rank_air_cands,
    rank_air_pred_mean: aimTotals.rank_air_cands > 0
      ? round3(aimTotals.rankAirPredSum / aimTotals.rank_air_cands) : 0,
    rank_air_ask_mean: aimTotals.rank_air_pools > 0
      ? round3(aimTotals.rankAirAskSum / aimTotals.rank_air_pools) : 0,
    rank_air_spread_mean: aimTotals.rank_air_pools > 0
      ? round3(aimTotals.rankAirSpreadSum / aimTotals.rank_air_pools) : 0,
    rank_air_deliverable_pools: aimTotals.rank_air_deliverable_pools,
    enum_air_considered: aimTotals.enum_air_considered,
    enum_air_gate_fail: aimTotals.enum_air_gate_fail,
    enum_air_emitted: aimTotals.enum_air_emitted,
  };
  return stats;
}

// ───────────────────────────── 4 · Probes ────────────────────────────

// ───────────────────────────── 6 · Lanes ─────────────────────────────

// ──────────────── R2 · Enumerative proposer (LR_AIM_ENUM) ────────────────

// FALSIFIED SHAPES (2026-06-10, both vs aim-enum-r2-03 = 600.71):
//  · elevation climb-defer: removal = exact parity
//    (Δ−0.1, CI [−0.6, 0.2]) — the speed-fit and impact-feasibility terms
//    already steer demanding climbs; the defer was dead weight (deleted).
//  · sigmoid-reshaped readiness (σ((r−0.55)/0.10), the "smooth veto"):
//    REJECT Δ−2.0, negative every budget. Flattening the plateau discards
//    the surface's high-end gradient — the very signal that pushes steep
//    fast arrivals (v2→v3 lesson). The raw surface IS the right shape:
//    veto at the low end (0.2–0.4), informative slope at the top.

/** The enumerative proposer. A shared response model fitted from the
 *  configured probe layout predicts current-gap axes and scorer-compatible
 *  outgoing-gap aggregates. Its cheap local objective is deliberately only:
 *
 *    objective(δp, δr) = current-axis-quality(predictedCurrentAxes, targets)
 *                      × projected-outgoing-quality(predictedAggregates)
 *
 *  This is a proposal heuristic, not the canonical candidate judge. The exact
 *  candidate evaluation and pool rank later apply the full three-layer
 *  objective, including next-arc readiness from the exact candidate launch. */
export function makeEnumAimedCandidates(
  // deno-lint-ignore no-explicit-any
  engine: any,
  gap: Gap,
  gaps: Gap[],
  ctx: SpecContext,
  base: Candidate,
  lineIdStart: number,
  /** M4 Part B: emit the air-matched ride-out variant for this base. The
   *  caller enables it on the FIRST (quality-best) refined base only — the
   *  variant is per-pool generation insurance, and one per pool is enough
   *  (per-base emission at K=4–6 priced out mature budgets in probe cycle 1). */
  airKnobBase: boolean,
  /** The repair-only auxiliary model is per-pool exploration insurance, so
   *  the caller offers it only on the quality-best refined base. */
  repairAuxBase = true,
): Candidate[] {
  aimTotals.enum_considered++;
  aimTotals.enum_lane_bases++; // one base actually refined
  const nextGap = successorScorerGapAfter(gap, gaps);
  if (nextGap === null) {
    aimTotals.enum_no_target++;
    return [];
  }
  const nextTargets = objectiveTargetsForGap(nextGap, ctx);
  if (
    nextTargets.speed === undefined &&
    nextTargets.air === undefined &&
    nextTargets.elevation === undefined
  ) {
    aimTotals.enum_no_target++;
    return [];
  }
  const control = aimControl();
  const readinessOutgoingGap = successorScorerGapAfter(nextGap, gaps);
  const primary = makeConfiguredAimedCandidates(
    engine, gap, nextGap, readinessOutgoingGap, ctx, base, lineIdStart,
    airKnobBase, control,
  );
  const repairAux = repairAuxBase ? aimRepairAuxControl() : null;
  if (repairAux === null) return primary;
  // Additive means additive: retain the complete production controller and
  // offer the auxiliary geometry beside it.  The air insurance variant belongs
  // to the primary base and must not be duplicated by the second model.
  return [
    ...primary,
    ...makeConfiguredAimedCandidates(
      engine, gap, nextGap, readinessOutgoingGap, ctx, base, lineIdStart,
      false, repairAux.control,
      repairAux.admission,
    ),
  ];
}

/** A candidate in the explicit ordered physical-coordinate space. */
type ConfiguredScoredKnobs = Readonly<{
  values: number[];
  val: number;
  ordinaryVal: number;
  modelImpactFeasibility: number;
  projectedOutgoingQuality: number;
  currentQuality: number;
}>;

type ConfiguredScoreResult = ConfiguredScoredKnobs | "next_before_exit" | "model_unscoreable";

function zeroKnobValues(dimensions: number): number[] {
  return Array.from({ length: dimensions }, () => 0);
}

/** The fitted response model owns next-contact velocity/pose, but not absolute
 * position or articulated point state. Readiness marks articulation missing;
 * the zero positions below are therefore deliberately non-semantic and cannot
 * enter its feature vector. */
function modeledImpactFeasibility(
  state: IncomingKinematics | null,
  incomingGap: Gap,
  outgoingGap: Gap | null,
  gapAxisTargets?: readonly AxisValues[],
): number {
  if (
    !aimModelImpactFeasibilityEnabled() ||
    (gapAxisTargets?.[incomingGap.index] ?? incomingGap.targets).impact === undefined
  ) return 1;
  if (state === null) {
    aimTotals.enum_model_impact_state_missing++;
    return 1;
  }
  const projectedContact: BallisticState = {
    x: 0,
    y: 0,
    vx: state.vx,
    vy: state.vy,
    speed: state.speed,
    comAngleDeg: state.comAngleDeg,
    sledPoseDeg: state.sledPoseDeg,
    sledPoseRateDegPerFrame: state.sledPoseRateDegPerFrame,
  };
  const incomingTargets = gapAxisTargets?.[incomingGap.index] ?? incomingGap.targets;
  const outgoingTargets = outgoingGap === null
    ? undefined
    : gapAxisTargets?.[outgoingGap.index] ?? outgoingGap.targets;
  const input = {
    incomingBoundary: {
      targetFrame: incomingGap.endFrame,
      preContactFrame: incomingGap.endFrame - 1,
      preContact: projectedContact,
      incomingVelocityFrame: incomingGap.endFrame,
      incoming: state,
      projectedContactFrame: incomingGap.endFrame,
      projectedContact,
    },
    incomingGap: readinessScorerGapContext(incomingGap, incomingTargets),
    outgoingGap: outgoingGap === null
      ? null
      : readinessScorerGapContext(outgoingGap, outgoingTargets),
    generatorPolicyId: PRODUCTION_ARC_PROPOSAL_POLICY_ID,
  };
  const impactFeasibility = aimModelImpactPolicy() === "distilled"
    ? scoreDistilledAimImpactFeasibility(input)
    : scoreImpactFeasibility(input);
  aimTotals.enum_model_impact_scores++;
  aimTotals.enumModelImpactSum += impactFeasibility;
  return impactFeasibility;
}

function scoreConfiguredKnobs(
  model: ArcVectorResponseModel,
  values: readonly number[],
  currentTargets: AxisValues,
  currentScoreAxes: JointArcCurrentScoreAxes,
  nextTargets: AxisValues,
  nextGap: Gap,
  readinessOutgoingGap: Gap | null,
  gapAxisTargets?: readonly AxisValues[],
): ConfiguredScoreResult {
  const readout = predictArcVectorScoreReadout(model, values, currentTargets, currentScoreAxes);
  if (!Number.isFinite(readout.currentQuality)) {
    return "model_unscoreable";
  }
  if (
    Number.isFinite(readout.exitFrame) &&
    readout.exitFrame >= nextGap.endFrame
  ) return "next_before_exit";
  const projectedOutgoingQuality = projectedReadoutQuality(
    readout,
    nextTargets,
  );
  if (projectedOutgoingQuality === null) return "model_unscoreable";
  const ordinaryVal = proposalUtility(
    readout.currentQuality,
    projectedOutgoingQuality,
    { readiness: 1 },
  );
  const modelImpactFeasibility = modeledImpactFeasibility(
    readout.state,
    nextGap,
    readinessOutgoingGap,
    gapAxisTargets,
  );
  const impactPower = aimModelImpactPower();
  const weightedImpactFeasibility = impactPower === 1
    ? modelImpactFeasibility
    : Math.max(0, Math.min(1, modelImpactFeasibility)) ** impactPower;
  return {
    values: [...values],
    val: proposalUtility(
      readout.currentQuality,
      projectedOutgoingQuality,
      { readiness: weightedImpactFeasibility },
    ),
    ordinaryVal,
    modelImpactFeasibility,
    projectedOutgoingQuality,
    currentQuality: readout.currentQuality,
  };
}

function scoreConfiguredKnobGrid(
  model: ArcVectorResponseModel,
  sequence: ArcKnobSequence,
  proposalRangeScale: number,
  baseScore: ConfiguredScoredKnobs,
  currentTargets: AxisValues,
  currentScoreAxes: JointArcCurrentScoreAxes,
  nextTargets: AxisValues,
  nextGap: Gap,
  readinessOutgoingGap: Gap | null,
  gapAxisTargets?: readonly AxisValues[],
): ConfiguredScoredKnobs[] {
  const valuesByAxis = sequence.map((knob) => arcControlProposalValues(knob, proposalRangeScale));
  const out: ConfiguredScoredKnobs[] = [];
  const scoredGrid: ConfiguredScoredKnobs[] = [];
  const visit = (values: number[], index: number): void => {
    if (index === sequence.length) {
      if (values.every((value) => Math.abs(value) < 1e-9)) return;
      const scored = scoreConfiguredKnobs(
        model, values, currentTargets, currentScoreAxes, nextTargets, nextGap,
        readinessOutgoingGap, gapAxisTargets,
      );
      if (typeof scored !== "string") {
        scoredGrid.push(scored);
        // Preserve the production admission set and exact-evaluation count.
        // The study arm may only reorder knob vectors that the ordinary
        // two-layer proposer already considers improving.
        if (scored.ordinaryVal > baseScore.ordinaryVal + 1e-4) out.push(scored);
      }
      return;
    }
    for (const value of valuesByAxis[index]) {
      values.push(value);
      visit(values, index + 1);
      values.pop();
    }
  };
  visit([], 0);
  if (
    aimModelImpactFeasibilityEnabled() &&
    nextTargets.impact !== undefined &&
    scoredGrid.length > 0
  ) {
    aimTotals.enum_model_impact_grids++;
    const factors = scoredGrid.map((candidate) => candidate.modelImpactFeasibility);
    aimTotals.enumModelImpactSpreadSum += Math.max(...factors) - Math.min(...factors);
    const ordinaryOrder = out.slice()
      .sort((a, b) => compareConfiguredKnobs(a, b, "ordinaryVal"));
    const activeOrder = out.slice()
      .sort((a, b) => compareConfiguredKnobs(a, b, "val"));
    const ordinaryBest = ordinaryOrder[0];
    const activeBest = activeOrder[0];
    if (
      ordinaryBest !== undefined && activeBest !== undefined &&
      ordinaryBest.values.some((value, index) => Math.abs(value - activeBest.values[index]) > 1e-9)
    ) aimTotals.enum_model_impact_top1_changed++;
    const selected = activeOrder.slice(0, Math.min(2, activeOrder.length));
    if (selected.length > 0) {
      const maxOrdinaryRank = Math.max(
        ...selected.map((candidate) => ordinaryOrder.indexOf(candidate) + 1),
      );
      aimTotals.enum_model_impact_selected_rank_observations++;
      aimTotals.enumModelImpactSelectedMaxOrdinaryRankSum += maxOrdinaryRank;
      for (const threshold of [4, 8, 16, 32, 64] as const) {
        if (maxOrdinaryRank <= threshold) {
          aimTotals[`enum_model_impact_selected_within_${threshold}`]++;
        }
      }
    }
  }
  return out.sort((a, b) => compareConfiguredKnobs(a, b, "val"));
}

function compareConfiguredKnobs(
  a: ConfiguredScoredKnobs,
  b: ConfiguredScoredKnobs,
  key: "val" | "ordinaryVal",
): number {
  return (
    b[key] - a[key] ||
    b.currentQuality - a.currentQuality ||
    a.values.reduce((sum, value) => sum + Math.abs(value), 0) -
      b.values.reduce((sum, value) => sum + Math.abs(value), 0)
  );
}

function chooseConfiguredKnobs(
  sequence: ArcKnobSequence,
  candidates: readonly ConfiguredScoredKnobs[],
  proposalCount: number,
): ConfiguredScoredKnobs[] {
  const chosen: ConfiguredScoredKnobs[] = [];
  for (const candidate of candidates) {
    if (chosen.length >= proposalCount) break;
    const distinct = chosen.every((prior) => candidate.values.reduce((distance, value, index) => {
      const scale = arcKnobProposalSeparation(sequence[index]);
      return distance + ((value - prior.values[index]) / scale) ** 2;
    }, 0) >= 1);
    if (distinct) chosen.push(candidate);
  }
  return chosen;
}

function recordUnscoreableControlBase<T>(result: T | "next_before_exit" | "model_unscoreable"): T | null {
  if (result === "next_before_exit") {
    aimTotals.enum_next_before_exit++;
    return null;
  }
  if (result === "model_unscoreable") {
    aimTotals.enum_model_unscoreable++;
    return null;
  }
  return result;
}

/** Generic experimental controller.  Its method names describe how probes are
 * obtained and fitted; they never encode a physical knob order.  Every chosen
 * vector still traverses the ordinary exact candidate evaluator below. */
function makeConfiguredAimedCandidates(
  // deno-lint-ignore no-explicit-any
  engine: any,
  gap: Gap,
  nextGap: Gap,
  readinessOutgoingGap: Gap | null,
  ctx: SpecContext,
  base: Candidate,
  lineIdStart: number,
  airKnobBase: boolean,
  control: AimControl,
  admission: AimAuxAdmission | null = null,
): Candidate[] {
  const sequence = control.sequence;
  const axisMeasureEnd = axisLookaheadEndFrame(gap, ctx.allContactFrames);
  const nextFrame = nextGap.endFrame;
  const currentTargets = objectiveTargetsForGap(gap, ctx);
  const nextTargets = objectiveTargetsForGap(nextGap, ctx);
  const includeElevation =
    nextTargets.elevation !== undefined;
  const includeAmplitude = aimOutgoingAmplitudeEligible(
    nextTargets.amplitude,
    undefined,
    aimCompileBudgetFrames,
    outgoingAmplitudeProfile(ctx),
  );
  const framesBeforeProbes = getPhysicsFrameCount();
  const actuatorContext = arcKnobSequenceNeedsContactPoint(sequence)
    ? (() => {
      const target = getCandidateProbe(engine, gap, ctx).targetState;
      return {
        contactPoint: { x: target.sledX, y: target.sledY },
        contactSpeedPx: target.speed,
      };
    })()
    : undefined;
  const currentScoreAxes = jointArcCurrentScoreAxes(currentTargets);
  const observe = (
    appliedSequence: ArcKnobSequence,
    values: readonly number[],
  ): JointArcProbeObservation => evaluateArcKnobSequence(
    engine,
    base.lines,
    appliedSequence,
    values,
    { pitchDeg: 0, rotateDeg: 0 },
    gap,
    ctx.allContactFrames,
    axisMeasureEnd,
    nextFrame,
    {
      includeElevation,
      includeAmplitude,
      targetEndsWithContact: nextGap.endsWithContact,
    },
    actuatorContext,
  );

  const modelContext = { gap, axisMeasureEnd, nextFrame };
  const vectorRow = (values: readonly number[], row: JointArcProbeObservation): ArcVectorProbeRow => ({
    values: [...values],
    outputs: row.outputs,
  });
  let baseOutputs: Record<string, number> = {};
  let baseScore: ConfiguredScoredKnobs | null = null;
  let offered: ConfiguredScoredKnobs[] = [];
  let coverageModel: ArcVectorResponseModel | null = null;

  if (control.trainingMethod === "sequential_conditional") {
    let prefix: number[] = [];
    for (let stage = 0; stage < sequence.length; stage++) {
      const knob = sequence[stage];
      const appliedSequence = sequence.slice(0, stage + 1);
      // The center and signed observations are real probes on the materialized
      // prefix.  This stays true for every stage, not just the former second.
      const rows = arcControlStageProbeValues(knob, control.probeLayout, control.probeRangeScale).map((value) => {
        const values = [...prefix, value];
        return { values, observation: observe(appliedSequence, values) };
      });
      const observations = rows.map((row) => row.observation);
      recordJointProbeRows(observations, gap, axisMeasureEnd, nextFrame);
      const model = fitArcVectorResponseModel(
        rows.map((row) => vectorRow([row.values[row.values.length - 1]], row.observation)),
        [arcKnobProbeSpan(knob)],
        "additive",
        modelContext,
      );
      coverageModel = model;
      const stageBase = recordUnscoreableControlBase(scoreConfiguredKnobs(
        model,
        [0],
        currentTargets,
        currentScoreAxes,
        nextTargets,
        nextGap,
        readinessOutgoingGap,
        ctx.gapAxisTargets,
      ));
      if (stage === 0) {
        baseOutputs = predictArcVectorOutputs(model, [0]);
        baseScore = stageBase;
      }
      const candidates = stageBase === null ? [] : scoreConfiguredKnobGrid(
        model,
        [knob],
        control.proposalRangeScale,
        stageBase,
        currentTargets,
        currentScoreAxes,
        nextTargets,
        nextGap,
        readinessOutgoingGap,
        ctx.gapAxisTargets,
      );
      const remaining = zeroKnobValues(sequence.length - stage - 1);
      offered.push(...candidates.map((candidate) => ({
        ...candidate,
        values: [...prefix, candidate.values[0], ...remaining],
      })));
      prefix = [...prefix, candidates[0]?.values[0] ?? 0];
    }
  } else {
    const vectors = arcControlProbeVectors(control);
    const reusableBaseFit = aimReuseBaseFitEnabled() &&
        base.ballisticLaunch !== undefined
      ? {
        achieved: base.achieved,
        cost: base.cost,
        ballisticLaunch: base.ballisticLaunch,
      }
      : null;
    const probeRows = vectors.map((values) => ({
      values,
      observation: reusableBaseFit !== null &&
          values.every((value) => Math.abs(value) < 1e-12)
        ? projectJointArcBaseFit(reusableBaseFit, gap, nextFrame, {
          includeElevation,
          includeAmplitude,
          targetEndsWithContact: nextGap.endsWithContact,
        })
        : observe(sequence, values),
    }));
    const observations = probeRows.map((row) => row.observation);
    recordJointProbeRows(observations, gap, axisMeasureEnd, nextFrame);
    const model = fitArcVectorResponseModel(
      probeRows.map((row) => vectorRow(row.values, row.observation)),
      sequence.map(arcKnobProbeSpan),
      control.trainingMethod === "base_joint" ? "joint" : "additive",
      modelContext,
    );
    coverageModel = model;
    baseOutputs = predictArcVectorOutputs(model, zeroKnobValues(sequence.length));
    baseScore = recordUnscoreableControlBase(scoreConfiguredKnobs(
      model,
      zeroKnobValues(sequence.length),
      currentTargets,
      currentScoreAxes,
      nextTargets,
      nextGap,
      readinessOutgoingGap,
      ctx.gapAxisTargets,
    ));
    if (baseScore !== null) {
      offered = scoreConfiguredKnobGrid(
        model,
        sequence,
        control.proposalRangeScale,
        baseScore,
        currentTargets,
        currentScoreAxes,
        nextTargets,
        nextGap,
        readinessOutgoingGap,
        ctx.gapAxisTargets,
      );
    }
  }

  aimTotals.joint_probe_frames_charged += Math.max(0, getPhysicsFrameCount() - framesBeforeProbes);
  if (coverageModel !== null) recordJointModelCoverage(coverageModel, baseOutputs, gap);
  if (baseScore === null) return [];
  const chosen = chooseConfiguredKnobs(sequence, offered, control.proposalCount);
  if (chosen.length === 0 && !airKnobBase) {
    aimTotals.enum_on_target++;
    return [];
  }
  const probe = getCandidateProbe(engine, gap, ctx);
  const out: Candidate[] = [];
  if (airKnobBase) {
    const airCand = makeAirMatchedCandidate(
      engine, gap, nextGap, ctx, base, lineIdStart, axisMeasureEnd, probe,
    );
    if (airCand !== null) out.push(airCand);
  }
  for (const candidate of chosen) {
    const aimedLines = applyArcKnobSequence(base.lines, sequence, candidate.values, actuatorContext)
      .map((line, index) => ({ ...line, id: lineIdStart + index }));
    const fit = tryCandidateLines(
      engine, gap, aimedLines, lineIdStart, ctx.allContactFrames,
      axisMeasureEnd, gap.targets, true,
      "normal", probe.preTargetSledTrace,
    ) as Candidate | null;
    if (fit === null) {
      aimTotals.enum_gate_fail++;
      continue;
    }
    if (
      admission === "impact-speed-pareto" &&
      !impactSpeedParetoImproves(base.achieved, fit.achieved, currentTargets)
    ) {
      aimTotals.enum_gate_fail++;
      continue;
    }
    if (admission === "impact-speed-air-outgoing-pareto") {
      const baseOutgoing = projectOutgoingScorerGap(base, nextGap, ctx.gapAxisTargets);
      const candidateOutgoing = projectOutgoingScorerGap(fit, nextGap, ctx.gapAxisTargets);
      if (
        baseOutgoing === null || candidateOutgoing === null ||
        !impactSpeedAirOutgoingParetoImproves(
          base.achieved,
          fit.achieved,
          currentTargets,
          baseOutgoing.quality,
          candidateOutgoing.quality,
        )
      ) {
        aimTotals.enum_gate_fail++;
        continue;
      }
    }
    aimTotals.enum_emitted++;
    aimTotals.enumObjectiveGainSum += candidate.val - baseScore.val;
    if (aimStudyStatsEnabled()) {
      const achievedProjection = projectOutgoingScorerGap(
        fit,
        nextGap,
        ctx.gapAxisTargets,
      );
      if (achievedProjection !== null) {
        aimTotals.enumAchieved++;
        aimTotals.enumProjectionErrSum += Math.abs(
          candidate.projectedOutgoingQuality - achievedProjection.quality,
        );
      }
    }
    if (admission !== null && repairAuxStudyCertificateEnabled()) {
      // Everything captured here is already available at the admission point:
      // two exact current-gap measurements and two uncharged outgoing
      // projections.  The tag is copied with the fit but is never consulted by
      // proposal, ranking, traversal, repair, or register logic.
      const baseOutgoing = projectOutgoingScorerGap(
        base,
        nextGap,
        ctx.gapAxisTargets,
      );
      const candidateOutgoing = projectOutgoingScorerGap(
        fit,
        nextGap,
        ctx.gapAxisTargets,
      );
      fit.repairAuxStudyCertificate = {
        schema: "line.handoff.repair-aux-study-certificate.v1",
        gapIndex: gap.index,
        nextGapIndex: nextGap.index,
        admission,
        currentTargets: { ...currentTargets },
        nextTargets: { ...nextTargets },
        base: {
          achieved: { ...base.achieved },
          currentSse: exactAxisSse(currentTargets, base.achieved),
          projectedOutgoingQuality: baseOutgoing?.quality ?? null,
        },
        candidate: {
          achieved: { ...fit.achieved },
          currentSse: exactAxisSse(currentTargets, fit.achieved),
          projectedOutgoingQuality: candidateOutgoing?.quality ?? null,
        },
      };
    }
    fit.ref = { x: probe.targetState.sledX, y: probe.targetState.sledY };
    fit.aimed = true;
    out.push(fit);
  }
  return out;
}

/** M4 Part B — the air knob: ONE deterministic air-matched ride-out variant
 *  per refined base, emitted only when the base's predicted next-gap air
 *  misses the (floor-clamped) ask by more than AIR_KNOB_MIN_MISMATCH. The
 *  ride-out length is the release-frame lever: predicted next-gap air =
 *  (nextEnd − release) / gapFrames, so the needed release shift solves in
 *  closed form (no probes, no model fit, no RNG — frames × exit speed = tail
 *  length delta). The edit goes through the unchanged exact production
 *  evaluation (I1: proposer, never judge; I3: tryCandidateLines is metered).
 *  Prefers the base's MEASURED release state over the model's base-knob
 *  prediction. */
function makeAirMatchedCandidate(
  // deno-lint-ignore no-explicit-any
  engine: any,
  gap: Gap,
  nextGap: Gap,
  ctx: SpecContext,
  base: Candidate,
  lineIdStart: number,
  axisMeasureEnd: number,
  probe: ReturnType<typeof getCandidateProbe>,
): Candidate | null {
  const ask = objectiveTargetsForGap(nextGap, ctx)?.air;
  if (typeof ask !== "number" || !Number.isFinite(ask)) return null;
  // The release lever is the base candidate's own exact launch: its anchor is
  // the geometric arc exit, so `relFrame` is the exit frame with no correction.
  // (The former fallback read `exit.frame`/`exit.speed`, which no probe has
  // ever emitted, so that branch could only ever return null.)
  const launch = base.ballisticLaunch;
  if (launch === undefined || !launch.airborne) return null;
  const relFrame = launch.anchorFrame;
  const relSpeed = launch.state.speed;
  if (!Number.isFinite(relFrame) || !Number.isFinite(relSpeed) || relSpeed <= 0) return null;
  const gapFrames = scorerGapFrameCount(nextGap);
  const effAsk = airDeliverabilityAsk(ask, gapFrames);
  const predAir = projectOutgoingScorerGap(
    base,
    nextGap,
    ctx.gapAxisTargets,
  )?.achieved.air;
  if (predAir === undefined || !Number.isFinite(predAir)) return null;
  if (Math.abs(predAir - effAsk) <= AIR_KNOB_MIN_MISMATCH) return null;
  // Target release frame delivering effAsk, kept strictly rideable: after the
  // current catch, and leaving the landing detector its ≥K_BOUNCE_LANDING
  // airborne frames before the next contact.
  const latestRelease = nextGap.endFrame - K_BOUNCE_LANDING - 2;
  const desired = Math.max(
    gap.endFrame + 1,
    Math.min(latestRelease, relFrame + (predAir - effAsk) * gapFrames),
  );
  const dtFrames = desired - relFrame;
  if (Math.abs(dtFrames) < AIR_KNOB_MIN_SHIFT_FRAMES) return null;
  const edited = adjustArcTailLength(base.lines, dtFrames * relSpeed);
  if (edited === null) return null;
  aimTotals.enum_air_considered++;
  const airLines = edited.map((l, i) => ({ ...l, id: lineIdStart + i }));
  const fit = tryCandidateLines(
    engine, gap, airLines, lineIdStart, ctx.allContactFrames,
    axisMeasureEnd, gap.targets, true,
    "normal", probe.preTargetSledTrace,
  ) as Candidate | null;
  if (fit === null) {
    aimTotals.enum_air_gate_fail++;
    return null;
  }
  aimTotals.enum_air_emitted++;
  fit.ref = { x: probe.targetState.sledX, y: probe.targetState.sledY };
  fit.aimed = true;
  return fit;
}

function projectedReadoutQuality(
  readout: {
    nextMeanSpeedPx: number;
    nextAirFraction: number;
    nextElevation: number;
    nextAmplitude: number;
  },
  outgoingTargets: AxisValues,
): number | null {
  return projectedOutgoingSurrogateQuality(
    outgoingTargets,
    readout.nextMeanSpeedPx,
    readout.nextAirFraction,
    Number.isFinite(readout.nextElevation) ? readout.nextElevation : undefined,
    Number.isFinite(readout.nextAmplitude) ? readout.nextAmplitude : undefined,
  );
}

// ─────────── 7 · Quality-objective pool sort (LR_RANK_QUALITY) ───────────
//
// Same objective the aim lane optimizes, but evaluated on each candidate's
// ACHIEVED axes and its arrival state at the next contact — used to RANK the
// per-gap candidate pool (node.ts) instead of cost. Handoff branch selection
// stays forward-eval. All dead code unless rankQualityEnabled().
//
// Cost control (vs an unbounded ride-every-candidate judge, 148.4M frames) —
// the objective NEVER charges a physics frame:
//   • MEMOIZE per candidate (objectiveCache) — object identity survives pool
//     rebuilds and branch scoring, so no candidate is ever scored twice.
//   • PREDICTED ARRIVAL — candidates propagate their captured release state
//     ballistically to the next contact (zero frames). Prediction-impossible →
//     null objective → cost order.

/** Per-candidate objective memo (object identity, scoped to live candidates).
 *  null = computed-and-undefined (no next contact / unreadable arrival / prediction
 *  impossible); a number = the objective. Absent key = not yet computed. */
const objectiveCache = new WeakMap<Candidate, GapObjectiveScore | null>();

/**
 * Per-pool spread of each objective layer.
 *
 * A layer can only rank if it VARIES across the candidates the search has to
 * choose between, and the layer that varies most is the one actually deciding.
 * Neither fact is visible from the committed track or from any existing
 * counter, and both turned out to matter: on dense specs readiness sits at a
 * mean level around 0.09 with the largest relative spread of any layer, so the
 * ranking of a real arc is dominated by a prediction about an arc that does not
 * exist yet — while on healthy specs the layers are balanced. Accumulated from
 * values `sortCandidatesByQuality` has already computed, so it costs nothing.
 */
let layerSpread = {
  pools: 0,
  settledSpread: 0,
  projectedSpread: 0,
  readinessSpread: 0,
  valueSpread: 0,
  settledMean: 0,
  projectedMean: 0,
  readinessMean: 0,
  valueMean: 0,
};

function recordObjectiveLayerSpread(scores: readonly GapObjectiveScore[]): void {
  if (scores.length < 2) return;
  layerSpread.pools++;
  const track = (
    pick: (s: GapObjectiveScore) => number,
    spreadKey: "settledSpread" | "projectedSpread" | "readinessSpread" | "valueSpread",
    meanKey: "settledMean" | "projectedMean" | "readinessMean" | "valueMean",
  ) => {
    let lo = Infinity;
    let hi = -Infinity;
    let sum = 0;
    for (const s of scores) {
      const v = pick(s);
      if (v < lo) lo = v;
      if (v > hi) hi = v;
      sum += v;
    }
    layerSpread[spreadKey] += hi - lo;
    layerSpread[meanKey] += sum / scores.length;
  };
  track((s) => s.settledIncomingQuality, "settledSpread", "settledMean");
  track((s) => s.projectedOutgoingQuality, "projectedSpread", "projectedMean");
  track((s) => s.readiness, "readinessSpread", "readinessMean");
  track((s) => s.value, "valueSpread", "valueMean");
}

/** Canonical three-layer candidate objective, memoized by candidate identity. */
export function candidateQualityObjective(
  // deno-lint-ignore no-explicit-any
  _engine: any,
  candidate: Candidate,
  gap: Gap,
  gaps: Gap[],
  ctx?: SpecContext,
): number | null {
  const cached = objectiveCache.get(candidate);
  if (cached !== undefined) return cached?.value ?? null;
  const objective = scoreCandidateProposal(
    candidate,
    gap,
    gaps,
    ctx?.gapAxisTargets,
  );
  if (objective === null) {
    aimTotals.rank_quality_pred_bail++;
    objectiveCache.set(candidate, null);
    return null;
  }
  aimTotals.rank_quality_pred_used++;
  objectiveCache.set(candidate, objective);
  return objective.value;
}

/** Full three-layer score for a candidate already scored by the pool sort. */
function candidateObjectiveLayers(candidate: Candidate): GapObjectiveScore | null {
  return objectiveCache.get(candidate) ?? null;
}

function objectiveTargetsForGap(gap: Gap, ctx?: SpecContext): AxisValues {
  return ctx?.gapAxisTargets?.[gap.index] ?? gap.targets;
}


/** Sort a candidate pool by the quality objective DESCENDING; ties (and
 *  undefined-objective candidates relative to each other) break by cost
 *  ascending then sample order (stable). When ANY candidate has a defined
 *  objective the gap has a readable next-contact frontier, so defined-objective
 *  candidates rank ABOVE undefined ones; when none do, the whole pool falls back
 *  to the cost order. Every candidate's objective is scored by ballistic
 *  prediction (no charged rides). Pool/disagreement
 *  telemetry is recorded only when `record` is set: a pool build may sort twice
 *  (pre-lane, then merged with lane extras) and the counters must reflect the
 *  FINAL ordering once per build — when the merged re-sort never happens, the
 *  caller records the pre-lane ordering itself via `recordRankQualityPool`. */
export function sortCandidatesByQuality(
  // deno-lint-ignore no-explicit-any
  engine: any,
  gap: Gap,
  gaps: Gap[],
  costSorted: Candidate[],
  record: boolean,
  ctx?: SpecContext,
): Candidate[] {
  if (costSorted.length === 0) return costSorted;
  const objectives = new Map<Candidate, number>();
  const layers: GapObjectiveScore[] = [];
  let anyDefined = false;
  for (const cand of costSorted) {
    const obj = candidateQualityObjective(engine, cand, gap, gaps, ctx);
    if (obj !== null) {
      objectives.set(cand, obj);
      anyDefined = true;
      const full = candidateObjectiveLayers(cand);
      if (full !== null) layers.push(full);
    }
  }
  if (record) recordObjectiveLayerSpread(layers);
  if (!anyDefined) {
    if (record && aimStudyStatsEnabled()) {
      recordRankQualityPool(costSorted, costSorted);
      recordPoolAirSpread(gap, gaps, costSorted, ctx);
    }
    return costSorted;
  }
  // `costSorted` is already cost-then-sample-order; a stable sort therefore
  // breaks objective ties by cost then sample order for free.
  const ranked = [...costSorted].sort((a, b) => {
    const oa = objectives.get(a);
    const ob = objectives.get(b);
    if (oa !== undefined && ob !== undefined) return ob - oa;
    if (oa !== undefined) return -1; // defined ranks above undefined
    if (ob !== undefined) return 1;
    return 0; // both undefined: keep cost/sample order
  });
  if (record && aimStudyStatsEnabled()) {
    recordRankQualityPool(costSorted, ranked);
    recordPoolAirSpread(gap, gaps, costSorted, ctx);
  }
  return ranked;
}

/** M4 pool air-substrate telemetry (law #1: does the pool CONTAIN air-delivering
 *  candidates for the judge to pick?). Once per pool build (the `record` final
 *  ordering, same cadence as recordRankQualityPool): over candidates carrying an
 *  airborne release read, the predicted next-gap air, its per-pool spread, and
 *  whether any candidate sits at/below the effective ask + deadband. Pure reads,
 *  zero physics frames; membership-only (order-independent). */
export function recordPoolAirSpread(
  gap: Gap,
  gaps: Gap[],
  pool: readonly Candidate[],
  ctx?: SpecContext,
): void {
  const nextGap = nextContactGap(gap, gaps);
  if (nextGap === null) return;
  const ask = objectiveTargetsForGap(nextGap, ctx)?.air;
  if (typeof ask !== "number" || !Number.isFinite(ask)) return;
  const effAsk = airDeliverabilityAsk(ask, scorerGapFrameCount(nextGap));
  let n = 0;
  let sum = 0;
  let min = Infinity;
  let max = -Infinity;
  for (const cand of pool) {
    const air = projectOutgoingScorerGap(
      cand,
      nextGap,
      ctx?.gapAxisTargets,
    )?.achieved.air;
    if (air === undefined || !Number.isFinite(air)) continue;
    n++;
    sum += air;
    if (air < min) min = air;
    if (air > max) max = air;
  }
  if (n === 0) return;
  aimTotals.rank_air_pools++;
  aimTotals.rank_air_cands += n;
  aimTotals.rankAirPredSum += sum;
  aimTotals.rankAirAskSum += effAsk;
  aimTotals.rankAirSpreadSum += n >= 2 ? max - min : 0;
  if (min <= effAsk + AIR_DELIVERABILITY_DEADBAND) aimTotals.rank_air_deliverable_pools++;
}

/** Once-per-pool-build telemetry over the FINAL ordering: pool count, top-3 /
 *  top-1 disagreement vs the cost order, and scored/defined tallies for the
 *  fallback rate. Defined-ness is read off the objective memo (a cached number;
 *  prediction-impossible candidates memo null and count as undefined). Pure
 *  reads — cannot perturb the ordering. */
export function recordRankQualityPool(costSorted: Candidate[], ranked: Candidate[]): void {
  aimTotals.rank_quality_pools++;
  aimTotals.rank_quality_candidates_scored += costSorted.length;
  for (const cand of costSorted) {
    if (typeof objectiveCache.get(cand) === "number") aimTotals.rank_quality_objective_defined++;
  }
  if (costSorted[0] !== ranked[0]) aimTotals.rank_quality_top1_disagree++;
  const k = Math.min(3, costSorted.length);
  const costTop = new Set(costSorted.slice(0, k));
  let same = true;
  for (let i = 0; i < k; i++) {
    if (!costTop.has(ranked[i])) { same = false; break; }
  }
  if (!same) aimTotals.rank_quality_top3_disagree++;
}
