/**
 * Experimental passive capture–redirect–release proposal.
 *
 * This is an additive ordinary-pool proposal. It reads the same predicted contact
 * state and authored impact event as the existing sampler, constructs one
 * gravity-opposed C1 capture boundary, distributes the requested catchable turn over
 * the scorer's six-frame contact horizon, and ends the surface so release is a
 * natural exact-engine outcome. The normal pool and every admission/ranking
 * authority remain unchanged.
 *
 * Default is OFF. `LR_CONTACT_TRANSITION=capture-balanced` enables proposal 1;
 * `LR_CONTACT_TRANSITION=impulse-release` enables proposal 2. After that
 * monotone tranche is repriced, `LR_CONTACT_TRANSITION=zero-net-chicane`
 * enables the first non-monotone proposal under the contacted-frame ruler.
 */
import { getCandidateProbe, type Candidate, type SpecContext } from "./sample.ts";
import { axisLookaheadEndFrame, tryCandidateLines } from "../core/candidate.ts";
import { registerCompileReset } from "../core/compile_lifecycle.ts";
import { engineLineFromTrackLine } from "../core/substrate.ts";
import { makeSolidLine } from "../arc.ts";
import { AXIS_QUALITY_TOLERANCE } from "../score.ts";
import { scoreCandidateProposal } from "./objective.ts";
import { getRiderMetered, SLED_POINT_ORDER } from "../../lib/detector.ts";
import { COLLISION_UPDATE_TYPE } from "../../lib/update_types.ts";
import {
  IMPACT,
  IMPACT_WINDOW,
  impactToRawPx,
  type Gap,
  type TrackLine,
} from "../types.ts";

export const CONTACT_TRANSITION_MODES = [
  "capture-balanced",
  "impulse-release",
  "zero-net-chicane",
  "staged-outbound-native",
  "native-pulse-cell",
  "active-native-pulse-cell",
  "native-entry-lip",
  "staged-return-cell",
] as const;
export type ContactTransitionMode = (typeof CONTACT_TRANSITION_MODES)[number];
export type ContactTransitionPhase = "all" | "repair";
export type NativePulseDose = "half" | "full";
export type NativePulseAnchor = "carrier-end" | "projected-frame";
export type NativeEntryLipDose = "half" | "full";

export type ContactTransitionControl = {
  targetPhaseOffsetFrames: number;
  entryTurnShare: number;
  approachFrames: number;
  runwayFrames: number;
};

export type ContactTransitionGeometryInput = {
  anchor: { x: number; y: number };
  speedPxPerFrame: number;
  incomingHeadingDeg: number;
  targetImpact: number;
  turnOrientation: -1 | 1;
  lineIdStart: number;
  control: ContactTransitionControl;
};

export type ContactTransitionGeometry = {
  mechanism:
    | "monotone_capture"
    | "zero_net_chicane"
    | "staged_return_cell"
    | "native_pulse_cell"
    | "active_native_pulse_cell"
    | "native_entry_lip";
  lines: TrackLine[];
  entryAngleDeg: number;
  exitAngleDeg: number;
  requestedTurnDeg: number;
  catchableTurnDeg: number;
  entryTurnDeg: number;
  responseTurnDeg: number;
  responseSegments: number;
  accumulatedTurnDeg: number;
  turnOrientation: -1 | 1;
  outboundLineIds?: number[];
  returnLineId?: number;
  returnFrame?: number;
};

export type StagedReturnState = {
  frame: number;
  velocity: { x: number; y: number };
  points: Array<{ id: string; x: number; y: number }>;
};

export type ContactTransitionStats = {
  eligible_pools: number;
  suppressed_by_chicane_room: number;
  suppressed_by_existing_delivery: number;
  offered: number;
  constructed: number;
  construction_failed: number;
  exact_attempts: number;
  exact_rejected: number;
  contact_achieved: number;
  delivery_not_improved: number;
  staged_state_available: number;
  staged_return_constructed: number;
  staged_outbound_collision: number;
  staged_return_collision: number;
  staged_both_collisions: number;
  staged_objective_defined: number;
  staged_settled_quality_sum: number;
  staged_projected_quality_sum: number;
  staged_readiness_sum: number;
  staged_catchability_sum: number;
  staged_speed_fit_sum: number;
  staged_air_fit_sum: number;
  staged_impact_feasibility_sum: number;
  staged_elevation_fit_sum: number;
  staged_objective_sum: number;
  staged_incumbent_objective_sum: number;
  active_pulse_segments_constructed: number;
  active_pulse_candidates_admitted: number;
  active_pulse_final_lines: number;
  release_observed: number;
  airborne_release: number;
  selected_for_branch: number;
  selected_negative_orientation: number;
  selected_positive_orientation: number;
  pool_entries: number;
  pool_rank0: number;
  pool_top3: number;
  pool_rank_sum: number;
  pool_size_sum: number;
  achieved_impact_sum: number;
  target_impact_sum: number;
};

const CONTROL_BY_MODE: Record<ContactTransitionMode, ContactTransitionControl> = {
  "capture-balanced": {
    // The old calibration screen closed all eight state families at both
    // half- and one-frame-forward placement. Half-frame is the smaller phase
    // displacement; balanced response avoids putting the whole turn into one
    // collision or deferring the whole command to later vertices.
    targetPhaseOffsetFrames: 0.5,
    entryTurnShare: 0.5,
    approachFrames: 2,
    runwayFrames: 1,
  },
  "impulse-release": {
    // The previous campaign isolated a still-open representation: spend the
    // catchable turn at the collision itself and then leave one finite straight
    // response boundary. This is the passive analogue of a trajectory corner,
    // not another redistribution of curvature along the existing carrier.
    targetPhaseOffsetFrames: 0.5,
    entryTurnShare: 1,
    approachFrames: 2,
    runwayFrames: 1,
  },
  "zero-net-chicane": {
    // Placement and finite extent share the same physical phase contract as
    // the monotone proposals. The builder below owns the non-monotone tangent
    // law; entryTurnShare/runwayFrames are intentionally inert for that form.
    targetPhaseOffsetFrames: 0.5,
    entryTurnShare: 0,
    approachFrames: 2,
    runwayFrames: 1,
  },
  "staged-outbound-native": {
    // Preserve the admitted incumbent in full and add only the independently
    // engaging outbound surface. This isolates whether the measured local
    // impulse can hand control back to the incumbent's native continuation;
    // unlike staged-return-cell it places no return or settling surface.
    targetPhaseOffsetFrames: 0.5,
    entryTurnShare: 0,
    approachFrames: 2,
    runwayFrames: 1,
  },
  "native-pulse-cell": {
    // A five-frame low-frequency auxiliary pulse shares the admitted carrier's
    // start and returns to its tangent. The complete native carrier remains in
    // the candidate, so the pulse must earn its collision and continuation.
    targetPhaseOffsetFrames: 0.5,
    entryTurnShare: 0,
    approachFrames: 2,
    runwayFrames: 1,
  },
  "active-native-pulse-cell": {
    // Preserve the incumbent and the frozen half-dose pulse geometry, changing
    // only the five auxiliary chords to forward type-1 material. This is the
    // fixed geometry x material interaction assay, not a material-frequency
    // or pulse-dose walk.
    targetPhaseOffsetFrames: 0.5,
    entryTurnShare: 0,
    approachFrames: 2,
    runwayFrames: 1,
  },
  "native-entry-lip": {
    // Add one finite impact-facing approach to the incumbent carrier's exact
    // contact vertex. The incumbent remains whole and owns the response side.
    targetPhaseOffsetFrames: 0.5,
    entryTurnShare: 0,
    approachFrames: 2,
    runwayFrames: 1,
  },
  "staged-return-cell": {
    // The exact fork is observed one frame after this candidate's first owned
    // outbound collision. The return surface is derived from that event-bound
    // state, never from a predicted incoming point or a per-case phase menu.
    targetPhaseOffsetFrames: 0.5,
    entryTurnShare: 0,
    approachFrames: 2,
    runwayFrames: 1,
  },
};

const STAGED_RETURN_DELAY_FRAMES = 1;

const totals: ContactTransitionStats = {
  eligible_pools: 0,
  suppressed_by_chicane_room: 0,
  suppressed_by_existing_delivery: 0,
  offered: 0,
  constructed: 0,
  construction_failed: 0,
  exact_attempts: 0,
  exact_rejected: 0,
  contact_achieved: 0,
  delivery_not_improved: 0,
  staged_state_available: 0,
  staged_return_constructed: 0,
  staged_outbound_collision: 0,
  staged_return_collision: 0,
  staged_both_collisions: 0,
  staged_objective_defined: 0,
  staged_settled_quality_sum: 0,
  staged_projected_quality_sum: 0,
  staged_readiness_sum: 0,
  staged_catchability_sum: 0,
  staged_speed_fit_sum: 0,
  staged_air_fit_sum: 0,
  staged_impact_feasibility_sum: 0,
  staged_elevation_fit_sum: 0,
  staged_objective_sum: 0,
  staged_incumbent_objective_sum: 0,
  active_pulse_segments_constructed: 0,
  active_pulse_candidates_admitted: 0,
  active_pulse_final_lines: 0,
  release_observed: 0,
  airborne_release: 0,
  selected_for_branch: 0,
  selected_negative_orientation: 0,
  selected_positive_orientation: 0,
  pool_entries: 0,
  pool_rank0: 0,
  pool_top3: 0,
  pool_rank_sum: 0,
  pool_size_sum: 0,
  achieved_impact_sum: 0,
  target_impact_sum: 0,
};

const orientationByCandidate = new WeakMap<Candidate, -1 | 1>();

function resetContactTransitionStats(): void {
  for (const key of Object.keys(totals) as Array<keyof ContactTransitionStats>) totals[key] = 0;
}
registerCompileReset(resetContactTransitionStats);

export function contactTransitionMode(
  environment: Record<string, string | undefined> = process.env,
): ContactTransitionMode | null {
  const value = environment.LR_CONTACT_TRANSITION;
  if (value === undefined || value === "" || value === "0" || value === "off") return null;
  if ((CONTACT_TRANSITION_MODES as readonly string[]).includes(value)) {
    return value as ContactTransitionMode;
  }
  throw new Error(
    `LR_CONTACT_TRANSITION must be off or one of ${CONTACT_TRANSITION_MODES.join(", ")}; got ${value}`,
  );
}

export function contactTransitionPhase(
  environment: Record<string, string | undefined> = process.env,
): ContactTransitionPhase {
  const value = environment.LR_CONTACT_TRANSITION_PHASE;
  if (value === undefined || value === "" || value === "all") return "all";
  if (value === "repair") return "repair";
  throw new Error(`LR_CONTACT_TRANSITION_PHASE must be all or repair; got ${value}`);
}

export function nativePulseDose(
  environment: Record<string, string | undefined> = process.env,
): NativePulseDose {
  const value = environment.LR_CONTACT_PULSE_DOSE;
  if (value === undefined || value === "" || value === "half") return "half";
  if (value === "full") return "full";
  throw new Error(`LR_CONTACT_PULSE_DOSE must be half or full; got ${value}`);
}

export function nativePulseAnchor(
  environment: Record<string, string | undefined> = process.env,
): NativePulseAnchor {
  const value = environment.LR_CONTACT_PULSE_ANCHOR;
  if (value === undefined || value === "" || value === "carrier-end") return "carrier-end";
  if (value === "projected-frame") return "projected-frame";
  throw new Error(`LR_CONTACT_PULSE_ANCHOR must be carrier-end or projected-frame; got ${value}`);
}

export function nativeEntryLipDose(
  environment: Record<string, string | undefined> = process.env,
): NativeEntryLipDose {
  const value = environment.LR_CONTACT_LIP_DOSE;
  if (value === undefined || value === "" || value === "half") return "half";
  if (value === "full") return "full";
  throw new Error(`LR_CONTACT_LIP_DOSE must be half or full; got ${value}`);
}

export function snapshotContactTransitionStats(): ContactTransitionStats | null {
  return contactTransitionMode() === null && totals.offered === 0 ? null : { ...totals };
}

export function recordContactTransitionFinalTrack(lines: readonly TrackLine[]): void {
  totals.active_pulse_final_lines = contactTransitionMode() === "active-native-pulse-cell"
    ? lines.reduce((count, line) => count + (line.type === 1 ? 1 : 0), 0)
    : 0;
}

export function recordContactTransitionBranchSelection(candidates: readonly (Candidate | null)[]): void {
  for (const candidate of candidates) {
    if (candidate === null) continue;
    const orientation = orientationByCandidate.get(candidate);
    if (orientation === undefined) continue;
    totals.selected_for_branch++;
    if (orientation === -1) totals.selected_negative_orientation++;
    else totals.selected_positive_orientation++;
  }
}

export function recordContactTransitionPoolRanks(
  candidates: readonly Candidate[],
  sortedPool: readonly Candidate[],
): void {
  for (const candidate of candidates) {
    const rank = sortedPool.indexOf(candidate);
    if (rank < 0) continue;
    totals.pool_entries++;
    if (rank === 0) totals.pool_rank0++;
    if (rank < 3) totals.pool_top3++;
    totals.pool_rank_sum += rank;
    totals.pool_size_sum += sortedPool.length;
  }
}

export function makeContactTransitionCandidates(
  // deno-lint-ignore no-explicit-any
  engine: any,
  gap: Gap,
  gaps: readonly Gap[],
  ctx: SpecContext,
  lineIdStart: number,
  incumbents: readonly Candidate[],
  lanePhase: "normal" | "repair" = "normal",
): Candidate[] {
  const mode = contactTransitionMode();
  if (mode === null || !gap.endsWithContact) return [];
  const configuredPhase = contactTransitionPhase();
  if (
    (configuredPhase === "repair" && lanePhase !== "repair") ||
    (configuredPhase === "all" && lanePhase === "repair")
  ) return [];
  const nextContactFrame = ctx.allContactFrames.find((frame) => frame > gap.endFrame);
  if (
    mode === "zero-net-chicane" ||
    mode === "staged-outbound-native" ||
    mode === "native-pulse-cell" ||
    mode === "active-native-pulse-cell" ||
    mode === "staged-return-cell"
  ) {
    const intervalFrames = nextContactFrame === undefined ? null : nextContactFrame - gap.endFrame;
    const lacksChicaneScope = mode === "zero-net-chicane" &&
      (intervalFrames === null || intervalFrames > 2 * IMPACT_WINDOW);
    const lacksReturnRoom = mode === "staged-return-cell" &&
      (intervalFrames === null || intervalFrames <= STAGED_RETURN_DELAY_FRAMES + 1);
    const lacksOutboundRoom = mode === "staged-outbound-native" &&
      (intervalFrames === null || intervalFrames <= 2);
    const lacksPulseRoom = (mode === "native-pulse-cell" || mode === "active-native-pulse-cell") &&
      (intervalFrames === null || intervalFrames <= IMPACT_WINDOW);
    if (lacksChicaneScope || lacksReturnRoom || lacksOutboundRoom || lacksPulseRoom) {
      totals.suppressed_by_chicane_room++;
      return [];
    }
  }
  const literalTargets = ctx.gapAxisTargets?.[gap.index] ?? gap.targets;
  const targetImpact = literalTargets.impact;
  if (targetImpact === undefined || !(targetImpact > 0)) return [];
  totals.eligible_pools++;
  const bestExistingImpact = incumbents.reduce(
    (best, candidate) => Math.max(best, candidate.achieved.impact ?? Number.NEGATIVE_INFINITY),
    Number.NEGATIVE_INFINITY,
  );
  const bestExistingImpactError = incumbents.reduce(
    (best, candidate) => candidate.achieved.impact === undefined
      ? best
      : Math.min(best, Math.abs(candidate.achieved.impact - targetImpact)),
    Number.POSITIVE_INFINITY,
  );
  if (bestExistingImpact >= targetImpact - AXIS_QUALITY_TOLERANCE) {
    totals.suppressed_by_existing_delivery++;
    return [];
  }

  const probe = getCandidateProbe(engine, gap, ctx);
  const speedPxPerFrame = probe.targetState.speed;
  if (!(speedPxPerFrame > 0) || !Number.isFinite(speedPxPerFrame)) return [];
  const out: Candidate[] = [];
  // Impact is a magnitude, but the physical environment is not unsigned:
  // gravity supplies the normal. Rotate a rightward arrival counter-clockwise
  // (and a leftward arrival clockwise), away from gravity. This makes chirality
  // explicit and state-derived without paying for a globally hard-coded mirror.
  const turnOrientation: -1 | 1 = Math.cos(probe.targetState.angleDeg * Math.PI / 180) >= 0 ? -1 : 1;
  for (const orientation of [turnOrientation]) {
    totals.offered++;
    let geometry: ContactTransitionGeometry;
    try {
      const input: ContactTransitionGeometryInput = {
        anchor: { x: probe.targetState.sledX, y: probe.targetState.sledY },
        speedPxPerFrame,
        incomingHeadingDeg: probe.targetState.angleDeg,
        targetImpact,
        turnOrientation: orientation,
        lineIdStart,
        control: CONTROL_BY_MODE[mode],
      };
      const base = incumbents.reduce<Candidate | null>((best, candidate) =>
        best === null || (candidate.achieved.impact ?? Number.NEGATIVE_INFINITY) >
            (best.achieved.impact ?? Number.NEGATIVE_INFINITY)
          ? candidate
          : best,
      null);
      if (mode === "zero-net-chicane") {
        if (base === null) throw new Error("zero-net chicane requires an admitted incumbent");
        geometry = buildCapturePreservingZeroNetChicaneGeometry(
          base.lines,
          input,
          Math.max(0, base.achieved.impact ?? 0),
        );
      } else if (mode === "native-entry-lip") {
        if (base === null) throw new Error("native entry lip requires an admitted incumbent");
        geometry = buildCapturePreservingNativeEntryLipGeometry(
          base.lines,
          input,
          Math.max(0, base.achieved.impact ?? 0),
          nativeEntryLipDose(),
        );
        const lipEngine = engine.addLine(geometry.lines.map(engineLineFromTrackLine));
        getRiderMetered(lipEngine, gap.endFrame + IMPACT_WINDOW);
        const lipFrame = firstOwnedSledCollisionFrame(
          lipEngine,
          new Set(geometry.outboundLineIds ?? []),
          Math.max(gap.startFrame, gap.endFrame - 1),
          gap.endFrame + IMPACT_WINDOW,
        );
        if (lipFrame === null) throw new Error("native entry lip collision is unavailable");
      } else if (mode === "native-pulse-cell" || mode === "active-native-pulse-cell") {
        if (base === null) throw new Error("native pulse cell requires an admitted incumbent");
        geometry = mode === "active-native-pulse-cell"
          ? buildCapturePreservingActiveNativePulseGeometry(
            base.lines,
            input,
            Math.max(0, base.achieved.impact ?? 0),
          )
          : buildCapturePreservingNativePulseGeometry(
            base.lines,
            input,
            Math.max(0, base.achieved.impact ?? 0),
            nativePulseDose(),
            nativePulseAnchor(),
          );
        if (mode === "active-native-pulse-cell") {
          totals.active_pulse_segments_constructed += geometry.outboundLineIds?.length ?? 0;
        }
        const pulseEngine = engine.addLine(geometry.lines.map(engineLineFromTrackLine));
        getRiderMetered(pulseEngine, gap.endFrame + IMPACT_WINDOW);
        const pulseFrame = firstOwnedSledCollisionFrame(
          pulseEngine,
          new Set(geometry.outboundLineIds ?? []),
          gap.endFrame,
          gap.endFrame + IMPACT_WINDOW,
        );
        if (pulseFrame === null) throw new Error("native pulse collision is unavailable");
      } else if (mode === "staged-outbound-native" || mode === "staged-return-cell") {
        if (base === null) throw new Error("staged return cell requires an admitted incumbent");
        const outbound = buildCapturePreservingStagedOutboundGeometry(
          base.lines,
          input,
          Math.max(0, base.achieved.impact ?? 0),
        );
        const stagedEngine = engine.addLine(outbound.lines.map(engineLineFromTrackLine));
        getRiderMetered(stagedEngine, gap.endFrame + IMPACT_WINDOW);
        const outboundFrame = firstOwnedSledCollisionFrame(
          stagedEngine,
          new Set(outbound.outboundLineIds ?? []),
          gap.endFrame,
          gap.endFrame + IMPACT_WINDOW,
        );
        if (outboundFrame === null) throw new Error("staged outbound collision is unavailable");
        if (mode === "staged-outbound-native") {
          geometry = outbound;
        } else {
          const returnFrame = outboundFrame + STAGED_RETURN_DELAY_FRAMES;
          const returnState = readStagedReturnState(stagedEngine, returnFrame);
          if (returnState === null) throw new Error("staged return state is unavailable");
          if (nextContactFrame === undefined) throw new Error("staged return cell requires a following contact");
          if (returnFrame >= nextContactFrame) throw new Error("staged return would reach the following contact");
          totals.staged_state_available++;
          geometry = buildCapturePreservingStagedReturnGeometry(
            outbound,
            returnState,
            base.ballisticLaunch?.state.comAngleDeg ?? outbound.entryAngleDeg,
          );
          totals.staged_return_constructed++;
          const returnEngine = engine.addLine(geometry.lines.map(engineLineFromTrackLine));
          getRiderMetered(returnEngine, Math.min(nextContactFrame - 1, returnFrame + IMPACT_WINDOW));
          const returnCollisionFrame = firstOwnedSledCollisionFrame(
            returnEngine,
            new Set(geometry.returnLineId === undefined ? [] : [geometry.returnLineId]),
            returnFrame,
            Math.min(nextContactFrame - 1, returnFrame + IMPACT_WINDOW),
          );
          if (returnCollisionFrame === null) throw new Error("staged return collision is unavailable");
        }
      } else {
        geometry = buildCaptureRedirectReleaseGeometry(input);
      }
      totals.constructed++;
    } catch {
      totals.construction_failed++;
      continue;
    }
    totals.exact_attempts++;
    const fit = tryCandidateLines(
      engine,
      gap,
      geometry.lines,
      lineIdStart,
      ctx.allContactFrames,
      axisLookaheadEndFrame(gap, ctx.allContactFrames),
      gap.targets,
      true,
      "normal",
      probe.preTargetSledTrace,
    ) as Candidate | null;
    if (fit === null) {
      totals.exact_rejected++;
      continue;
    }
    fit.ref = { x: probe.targetState.sledX, y: probe.targetState.sledY };
    orientationByCandidate.set(fit, orientation);
    totals.contact_achieved++;
    if (
      geometry.mechanism === "staged_return_cell" ||
      geometry.mechanism === "native_pulse_cell" ||
      geometry.mechanism === "active_native_pulse_cell" ||
      geometry.mechanism === "native_entry_lip"
    ) {
      recordStagedCollisionTelemetry(engine, fit.lines, geometry, gap.endFrame);
      const objective = scoreCandidateProposal(fit, gap, gaps, ctx.gapAxisTargets);
      const incumbentObjective = incumbents.reduce((best, candidate) => {
        const scored = scoreCandidateProposal(candidate, gap, gaps, ctx.gapAxisTargets);
        return Math.max(best, scored?.value ?? Number.NEGATIVE_INFINITY);
      }, Number.NEGATIVE_INFINITY);
      if (objective !== null) {
        totals.staged_objective_defined++;
        totals.staged_settled_quality_sum += objective.settledIncomingQuality;
        totals.staged_projected_quality_sum += objective.projectedOutgoingQuality;
        totals.staged_readiness_sum += objective.readiness;
        totals.staged_catchability_sum += objective.catchability;
        totals.staged_speed_fit_sum += objective.speedFit;
        totals.staged_air_fit_sum += objective.airFit;
        totals.staged_impact_feasibility_sum += objective.impactFeasibility;
        totals.staged_elevation_fit_sum += objective.elevationFit;
        totals.staged_objective_sum += objective.value;
        if (Number.isFinite(incumbentObjective)) {
          totals.staged_incumbent_objective_sum += incumbentObjective;
        }
      }
    }
    if (geometry.mechanism === "active_native_pulse_cell") {
      totals.active_pulse_candidates_admitted++;
    }
    totals.target_impact_sum += targetImpact;
    totals.achieved_impact_sum += fit.achieved.impact ?? 0;
    const fitImpactError = fit.achieved.impact === undefined
      ? Number.POSITIVE_INFINITY
      : Math.abs(fit.achieved.impact - targetImpact);
    if (!(fitImpactError + 1e-9 < bestExistingImpactError)) {
      totals.delivery_not_improved++;
      continue;
    }
    if (fit.ballisticLaunch !== undefined) {
      totals.release_observed++;
      if (fit.ballisticLaunch.airborne) totals.airborne_release++;
    }
    out.push(fit);
  }
  return out;
}

export function buildCaptureRedirectReleaseGeometry(
  input: ContactTransitionGeometryInput,
): ContactTransitionGeometry {
  const speed = positive("speedPxPerFrame", input.speedPxPerFrame);
  const targetImpact = bounded("targetImpact", input.targetImpact, 0, 1);
  const heading = finite("incomingHeadingDeg", input.incomingHeadingDeg);
  const orientation = input.turnOrientation;
  if (orientation !== -1 && orientation !== 1) throw new Error("turnOrientation must be -1 or 1");
  if (!Number.isSafeInteger(input.lineIdStart)) throw new Error("lineIdStart must be a safe integer");
  const phase = bounded("targetPhaseOffsetFrames", input.control.targetPhaseOffsetFrames, 0, 1);
  const entryShare = bounded("entryTurnShare", input.control.entryTurnShare, 0, 1);
  const approachFrames = positive("approachFrames", input.control.approachFrames);
  const runwayFrames = positive("runwayFrames", input.control.runwayFrames);
  if (!(runwayFrames < IMPACT_WINDOW)) throw new Error("runwayFrames must be below IMPACT_WINDOW");

  const requestedTurnRad = impactToRawPx(targetImpact) / speed;
  const catchableTurnRad = Math.min(requestedTurnRad, Math.asin(IMPACT.CATCHABLE_REDIR_FRACTION));
  const requestedTurnDeg = requestedTurnRad * 180 / Math.PI;
  const catchableTurnDeg = catchableTurnRad * 180 / Math.PI;
  const entryTurnDeg = catchableTurnDeg * entryShare;
  const responseTurnDeg = catchableTurnDeg - entryTurnDeg;
  const entryAngleDeg = heading + orientation * entryTurnDeg;
  const exitAngleDeg = entryAngleDeg + orientation * responseTurnDeg;
  const anchorTangent = unit(heading);
  const capture = {
    x: finite("anchor.x", input.anchor.x) + anchorTangent.x * phase * speed,
    y: finite("anchor.y", input.anchor.y) + anchorTangent.y * phase * speed,
  };
  const entryTangent = unit(entryAngleDeg);
  const approach = {
    x: capture.x - entryTangent.x * approachFrames * speed,
    y: capture.y - entryTangent.y * approachFrames * speed,
  };
  const runwayExit = {
    x: capture.x + entryTangent.x * runwayFrames * speed,
    y: capture.y + entryTangent.y * runwayFrames * speed,
  };
  const responseExtentPx = (IMPACT_WINDOW - runwayFrames) * speed;
  const responseSegments = adaptiveResponseSegments(responseExtentPx, responseTurnDeg);
  const lines: TrackLine[] = [
    makeSolidLine(input.lineIdStart, approach.x, approach.y, capture.x, capture.y),
    makeSolidLine(input.lineIdStart + 1, capture.x, capture.y, runwayExit.x, runwayExit.y),
  ];
  let point = runwayExit;
  const segmentLength = responseExtentPx / responseSegments;
  for (let index = 0; index < responseSegments; index++) {
    const fraction = responseSegments === 1 ? 0 : index / (responseSegments - 1);
    const tangent = unit(entryAngleDeg + orientation * responseTurnDeg * fraction);
    const next = {
      x: point.x + tangent.x * segmentLength,
      y: point.y + tangent.y * segmentLength,
    };
    lines.push(makeSolidLine(input.lineIdStart + lines.length, point.x, point.y, next.x, next.y));
    point = next;
  }
  return {
    mechanism: "monotone_capture",
    lines,
    entryAngleDeg,
    exitAngleDeg,
    requestedTurnDeg,
    catchableTurnDeg,
    entryTurnDeg,
    responseTurnDeg,
    responseSegments,
    accumulatedTurnDeg: catchableTurnDeg,
    turnOrientation: orientation,
  };
}

/**
 * Finite zero-net-turn contact packet for the accumulated contacted-frame
 * impact ruler. Six one-frame chords alternate gently around the incoming
 * heading and return to it at release. Exact discovery replay showed that the
 * articulated rider receives far less turn than the surface tangent travels,
 * so the packet commands a bounded fourfold surface turn while retaining zero
 * net tangent change. Downstream continuation is not asked to inherit the
 * impact command.
 */
export function buildZeroNetChicaneGeometry(
  input: ContactTransitionGeometryInput,
): ContactTransitionGeometry {
  const speed = positive("speedPxPerFrame", input.speedPxPerFrame);
  const targetImpact = bounded("targetImpact", input.targetImpact, 0, 1);
  const heading = finite("incomingHeadingDeg", input.incomingHeadingDeg);
  const orientation = input.turnOrientation;
  if (orientation !== -1 && orientation !== 1) throw new Error("turnOrientation must be -1 or 1");
  if (!Number.isSafeInteger(input.lineIdStart)) throw new Error("lineIdStart must be a safe integer");
  const phase = bounded("targetPhaseOffsetFrames", input.control.targetPhaseOffsetFrames, 0, 1);
  const approachFrames = positive("approachFrames", input.control.approachFrames);
  const requestedTurnRad = impactToRawPx(targetImpact) / speed;
  const catchableTurnRad = Math.min(requestedTurnRad, Math.asin(IMPACT.CATCHABLE_REDIR_FRACTION));
  const requestedTurnDeg = requestedTurnRad * 180 / Math.PI;
  const catchableTurnDeg = catchableTurnRad * 180 / Math.PI;
  const responseSegments = IMPACT_WINDOW;
  // For [ +a, -a, +a, -a, +a, 0 ], arrival->first plus all joins
  // travels a + 4(2a) + a = 10a while ending at the arrival heading.
  // Discovery 700-701 transferred only 4.32 / 47.38 = 9.1% of the requested
  // impact across admitted packets. Use a deliberately conservative 25%
  // response model (4x surface travel), bounded before each alternating join
  // becomes an ejection-scale corner. This is the one amplitude calibration
  // within the declared topology, not a new menu or per-case selection.
  const responseEfficiency = 0.25;
  const oscillationDeg = Math.min(catchableTurnDeg / (10 * responseEfficiency), 15);
  const headings = Array.from({ length: responseSegments }, (_, index) =>
    index === responseSegments - 1
      ? heading
      : heading + orientation * (index % 2 === 0 ? oscillationDeg : -oscillationDeg)
  );
  const anchorTangent = unit(heading);
  const capture = {
    x: finite("anchor.x", input.anchor.x) + anchorTangent.x * phase * speed,
    y: finite("anchor.y", input.anchor.y) + anchorTangent.y * phase * speed,
  };
  const entryTangent = unit(headings[0]!);
  const approach = {
    x: capture.x - entryTangent.x * approachFrames * speed,
    y: capture.y - entryTangent.y * approachFrames * speed,
  };
  const lines: TrackLine[] = [
    makeSolidLine(input.lineIdStart, approach.x, approach.y, capture.x, capture.y),
  ];
  let point = capture;
  for (const angle of headings) {
    const tangent = unit(angle);
    const next = { x: point.x + tangent.x * speed, y: point.y + tangent.y * speed };
    lines.push(makeSolidLine(input.lineIdStart + lines.length, point.x, point.y, next.x, next.y));
    point = next;
  }
  const accumulatedTurnDeg = Math.abs(headings[0]! - heading) + headings.slice(1).reduce(
    (sum, angle, index) => sum + Math.abs(angle - headings[index]!),
    0,
  );
  return {
    mechanism: "zero_net_chicane",
    lines,
    entryAngleDeg: headings[0]!,
    exitAngleDeg: headings.at(-1)!,
    requestedTurnDeg,
    catchableTurnDeg,
    entryTurnDeg: oscillationDeg,
    responseTurnDeg: catchableTurnDeg - oscillationDeg,
    responseSegments,
    accumulatedTurnDeg,
    turnOrientation: orientation,
  };
}

/**
 * Preserve an incumbent's exact approach and first post-contact carrier, then
 * insert the same six-chord zero-net packet around that carrier's tangent.
 * Only the incumbent's measured impact deficit supplies amplitude. This turns
 * a known engine-admitted catch into the new transition instead of rebuilding
 * capture from a predicted point.
 */
export function buildCapturePreservingZeroNetChicaneGeometry(
  baseLines: readonly TrackLine[],
  input: ContactTransitionGeometryInput,
  baseAchievedImpact: number,
): ContactTransitionGeometry {
  const speed = positive("speedPxPerFrame", input.speedPxPerFrame);
  const targetImpact = bounded("targetImpact", input.targetImpact, 0, 1);
  const achievedImpact = bounded("baseAchievedImpact", baseAchievedImpact, 0, 1);
  const orientation = input.turnOrientation;
  if (orientation !== -1 && orientation !== 1) throw new Error("turnOrientation must be -1 or 1");
  if (!Number.isSafeInteger(input.lineIdStart)) throw new Error("lineIdStart must be a safe integer");
  if (baseLines.length < 2) throw new Error("capture-preserving chicane requires a multi-line incumbent");
  const contactIndex = nearestLineStart(baseLines, input.anchor);
  if (contactIndex < 0) throw new Error("capture-preserving chicane cannot resolve the incumbent contact");
  const carrier = baseLines[contactIndex]!;
  const carrierLength = Math.hypot(carrier.x2 - carrier.x1, carrier.y2 - carrier.y1);
  if (!(carrierLength > 0) || !Number.isFinite(carrierLength)) throw new Error("incumbent carrier is degenerate");
  const carrierAngleDeg = Math.atan2(carrier.y2 - carrier.y1, carrier.x2 - carrier.x1) * 180 / Math.PI;
  const impactDeficit = Math.max(0, targetImpact - achievedImpact);
  const requestedTurnRad = impactToRawPx(impactDeficit) / speed;
  const catchableTurnRad = Math.min(requestedTurnRad, Math.asin(IMPACT.CATCHABLE_REDIR_FRACTION));
  const requestedTurnDeg = requestedTurnRad * 180 / Math.PI;
  const catchableTurnDeg = catchableTurnRad * 180 / Math.PI;
  // [0,+a,-a,+a,-a,0] travels 8a and returns to the admitted carrier tangent.
  // Retain the conservative 25% transfer calibration and the same corner cap.
  const oscillationDeg = Math.min(catchableTurnDeg / (8 * 0.25), 15);
  const headings = [
    carrierAngleDeg,
    carrierAngleDeg + orientation * oscillationDeg,
    carrierAngleDeg - orientation * oscillationDeg,
    carrierAngleDeg + orientation * oscillationDeg,
    carrierAngleDeg - orientation * oscillationDeg,
    carrierAngleDeg,
  ];
  const lines = baseLines.slice(0, contactIndex).map((line, index) => ({
    ...line,
    id: input.lineIdStart + index,
  }));
  lines.push({ ...carrier, id: input.lineIdStart + lines.length });
  let point = { x: carrier.x2, y: carrier.y2 };
  for (const angle of headings.slice(1)) {
    const tangent = unit(angle);
    const next = { x: point.x + tangent.x * speed, y: point.y + tangent.y * speed };
    lines.push(makeSolidLine(input.lineIdStart + lines.length, point.x, point.y, next.x, next.y));
    point = next;
  }
  const accumulatedTurnDeg = headings.slice(1).reduce(
    (sum, angle, index) => sum + Math.abs(angle - headings[index]!),
    0,
  );
  return {
    mechanism: "zero_net_chicane",
    lines,
    entryAngleDeg: carrierAngleDeg,
    exitAngleDeg: headings.at(-1)!,
    requestedTurnDeg,
    catchableTurnDeg,
    entryTurnDeg: 0,
    responseTurnDeg: catchableTurnDeg,
    responseSegments: headings.length,
    accumulatedTurnDeg,
    turnOrientation: orientation,
  };
}

/**
 * Preserve the incumbent program and add a low-frequency zero-net auxiliary
 * pulse at its contacted carrier. Unlike the earlier alternating chicane, two
 * consecutive chords hold each lobe long enough for the articulated sled to
 * respond, and unlike the staged return cell no observed-state rail replaces
 * the incumbent's native continuation.
 */
export function buildCapturePreservingNativePulseGeometry(
  baseLines: readonly TrackLine[],
  input: ContactTransitionGeometryInput,
  baseAchievedImpact: number,
  dose: NativePulseDose,
  anchorMode: NativePulseAnchor = "carrier-end",
): ContactTransitionGeometry {
  const speed = positive("speedPxPerFrame", input.speedPxPerFrame);
  const targetImpact = bounded("targetImpact", input.targetImpact, 0, 1);
  const achievedImpact = bounded("baseAchievedImpact", baseAchievedImpact, 0, 1);
  const orientation = input.turnOrientation;
  if (orientation !== -1 && orientation !== 1) throw new Error("turnOrientation must be -1 or 1");
  if (!Number.isSafeInteger(input.lineIdStart)) throw new Error("lineIdStart must be a safe integer");
  if (dose !== "half" && dose !== "full") throw new Error("native pulse dose must be half or full");
  if (anchorMode !== "carrier-end" && anchorMode !== "projected-frame") {
    throw new Error("native pulse anchor must be carrier-end or projected-frame");
  }
  if (baseLines.length < 2) throw new Error("native pulse cell requires a multi-line incumbent");
  const contactIndex = nearestLineStart(baseLines, input.anchor);
  if (contactIndex < 0) throw new Error("native pulse cell cannot resolve the incumbent contact");
  const carrier = baseLines[contactIndex]!;
  const carrierLength = Math.hypot(carrier.x2 - carrier.x1, carrier.y2 - carrier.y1);
  if (!(carrierLength > 0) || !Number.isFinite(carrierLength)) throw new Error("incumbent carrier is degenerate");
  const carrierVector = { x: carrier.x2 - carrier.x1, y: carrier.y2 - carrier.y1 };
  const rawCarrierTangent = { x: carrierVector.x / carrierLength, y: carrierVector.y / carrierLength };
  const incomingTangent = unit(input.incomingHeadingDeg);
  const carrierTangent = dot(rawCarrierTangent, incomingTangent) >= 0
    ? rawCarrierTangent
    : { x: -rawCarrierTangent.x, y: -rawCarrierTangent.y };
  const carrierAngleDeg = Math.atan2(carrierTangent.y, carrierTangent.x) * 180 / Math.PI;
  const impactDeficit = Math.max(0, targetImpact - achievedImpact);
  const requestedTurnRad = impactToRawPx(impactDeficit) / speed;
  const catchableTurnRad = Math.min(requestedTurnRad, Math.asin(IMPACT.CATCHABLE_REDIR_FRACTION));
  const requestedTurnDeg = requestedTurnRad * 180 / Math.PI;
  const catchableTurnDeg = catchableTurnRad * 180 / Math.PI;
  // [+a,+a,-a,-a,0] travels 4a and returns to the carrier tangent. The
  // retained 25% transfer prior makes a=catchable the full predicted deficit;
  // half is the conservative same-amplitude comparison to the old 8a packet.
  const doseScale = dose === "full" ? 1 : 0.5;
  const oscillationDeg = Math.min(catchableTurnDeg * doseScale, 15);
  if (!(oscillationDeg > 1e-9)) throw new Error("native pulse cell has no impact deficit");
  const headings = [
    carrierAngleDeg + orientation * oscillationDeg,
    carrierAngleDeg + orientation * oscillationDeg,
    carrierAngleDeg - orientation * oscillationDeg,
    carrierAngleDeg - orientation * oscillationDeg,
    carrierAngleDeg,
  ];
  const lines = baseLines.map((line, index) => ({
    ...line,
    id: input.lineIdStart + index,
  }));
  const outboundLineIds: number[] = [];
  let point = anchorMode === "carrier-end"
    ? { x: carrier.x2, y: carrier.y2 }
    : projectedCarrierFork(carrier, input.anchor, carrierTangent, speed);
  for (const angle of headings) {
    const tangent = unit(angle);
    const next = { x: point.x + tangent.x * speed, y: point.y + tangent.y * speed };
    const id = input.lineIdStart + lines.length;
    lines.push(makeSolidLine(id, point.x, point.y, next.x, next.y));
    outboundLineIds.push(id);
    point = next;
  }
  const accumulatedTurnDeg = Math.abs(headings[0]! - carrierAngleDeg) + headings.slice(1).reduce(
    (sum, angle, index) => sum + Math.abs(angle - headings[index]!),
    0,
  );
  return {
    mechanism: "native_pulse_cell",
    lines,
    entryAngleDeg: carrierAngleDeg,
    exitAngleDeg: headings.at(-1)!,
    requestedTurnDeg,
    catchableTurnDeg,
    entryTurnDeg: 0,
    responseTurnDeg: catchableTurnDeg,
    responseSegments: headings.length,
    accumulatedTurnDeg,
    turnOrientation: orientation,
    outboundLineIds,
  };
}

/**
 * Fixed material interaction for the incumbent-preserving native pulse. The
 * incumbent remains byte-equivalent apart from fresh ids, and the half-dose
 * carrier-end pulse keeps its exact geometry and collision side. Reversing
 * each auxiliary segment while toggling its side makes lr-core's fixed type-1
 * impulse point along the pulse traversal without changing the active normal.
 */
export function buildCapturePreservingActiveNativePulseGeometry(
  baseLines: readonly TrackLine[],
  input: ContactTransitionGeometryInput,
  baseAchievedImpact: number,
): ContactTransitionGeometry {
  const passive = buildCapturePreservingNativePulseGeometry(
    baseLines,
    input,
    baseAchievedImpact,
    "half",
    "carrier-end",
  );
  const activeIds = new Set(passive.outboundLineIds ?? []);
  return {
    ...passive,
    mechanism: "active_native_pulse_cell",
    lines: passive.lines.map((line) => activeIds.has(line.id) ? forwardAccelerationEquivalent(line) : line),
  };
}

function forwardAccelerationEquivalent(line: TrackLine): TrackLine {
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

/**
 * Add a finite impact-facing entry lip to an incumbent's exact carrier vertex.
 * The incumbent line program is copied in full. The lip ends where the native
 * carrier begins, so a successful exact fit receives one contact-local impulse
 * and then has the original response and release geometry available.
 */
export function buildCapturePreservingNativeEntryLipGeometry(
  baseLines: readonly TrackLine[],
  input: ContactTransitionGeometryInput,
  baseAchievedImpact: number,
  dose: NativeEntryLipDose,
): ContactTransitionGeometry {
  const speed = positive("speedPxPerFrame", input.speedPxPerFrame);
  const targetImpact = bounded("targetImpact", input.targetImpact, 0, 1);
  const achievedImpact = bounded("baseAchievedImpact", baseAchievedImpact, 0, 1);
  const orientation = input.turnOrientation;
  if (orientation !== -1 && orientation !== 1) throw new Error("turnOrientation must be -1 or 1");
  if (!Number.isSafeInteger(input.lineIdStart)) throw new Error("lineIdStart must be a safe integer");
  if (dose !== "half" && dose !== "full") throw new Error("native entry lip dose must be half or full");
  if (baseLines.length < 2) throw new Error("native entry lip requires a multi-line incumbent");
  const contactIndex = nearestLineStart(baseLines, input.anchor);
  if (contactIndex < 0) throw new Error("native entry lip cannot resolve the incumbent contact");
  const carrier = baseLines[contactIndex]!;
  const carrierLength = Math.hypot(carrier.x2 - carrier.x1, carrier.y2 - carrier.y1);
  if (!(carrierLength > 0) || !Number.isFinite(carrierLength)) throw new Error("incumbent carrier is degenerate");
  const carrierAngleDeg = Math.atan2(carrier.y2 - carrier.y1, carrier.x2 - carrier.x1) * 180 / Math.PI;
  const impactDeficit = Math.max(0, targetImpact - achievedImpact);
  const requestedTurnRad = impactToRawPx(impactDeficit) / speed;
  const catchableTurnRad = Math.min(requestedTurnRad, Math.asin(IMPACT.CATCHABLE_REDIR_FRACTION));
  const requestedTurnDeg = requestedTurnRad * 180 / Math.PI;
  const catchableTurnDeg = catchableTurnRad * 180 / Math.PI;
  const doseScale = dose === "full" ? 1 : 0.5;
  const lipTurnDeg = Math.min(catchableTurnDeg * doseScale, 15);
  if (!(lipTurnDeg > 1e-9)) throw new Error("native entry lip has no impact deficit");
  const lipAngleDeg = carrierAngleDeg + orientation * lipTurnDeg;
  const tangent = unit(lipAngleDeg);
  const end = { x: carrier.x1, y: carrier.y1 };
  const start = {
    x: end.x - tangent.x * input.control.approachFrames * speed,
    y: end.y - tangent.y * input.control.approachFrames * speed,
  };
  const lines = baseLines.map((line, index) => ({
    ...line,
    id: input.lineIdStart + index,
  }));
  const lipLineId = input.lineIdStart + lines.length;
  lines.push(makeSolidLine(lipLineId, start.x, start.y, end.x, end.y));
  return {
    mechanism: "native_entry_lip",
    lines,
    entryAngleDeg: lipAngleDeg,
    exitAngleDeg: carrierAngleDeg,
    requestedTurnDeg,
    catchableTurnDeg,
    entryTurnDeg: lipTurnDeg,
    responseTurnDeg: 0,
    responseSegments: 1,
    accumulatedTurnDeg: lipTurnDeg,
    turnOrientation: orientation,
    outboundLineIds: [lipLineId],
  };
}

/**
 * First half of a two-stage return cell. Preserve the incumbent's exact catch
 * and spend half of a calibrated zero-net redirection packet on one bounded
 * outbound tangent. The second half is deliberately absent: callers must
 * observe this exact fork before they are allowed to place a return surface.
 */
export function buildCapturePreservingStagedOutboundGeometry(
  baseLines: readonly TrackLine[],
  input: ContactTransitionGeometryInput,
  baseAchievedImpact: number,
): ContactTransitionGeometry {
  const speed = positive("speedPxPerFrame", input.speedPxPerFrame);
  const targetImpact = bounded("targetImpact", input.targetImpact, 0, 1);
  const achievedImpact = bounded("baseAchievedImpact", baseAchievedImpact, 0, 1);
  const orientation = input.turnOrientation;
  if (orientation !== -1 && orientation !== 1) throw new Error("turnOrientation must be -1 or 1");
  if (!Number.isSafeInteger(input.lineIdStart)) throw new Error("lineIdStart must be a safe integer");
  if (baseLines.length < 2) throw new Error("staged return cell requires a multi-line incumbent");
  const contactIndex = nearestLineStart(baseLines, input.anchor);
  if (contactIndex < 0) throw new Error("staged return cell cannot resolve the incumbent contact");
  const carrier = baseLines[contactIndex]!;
  const carrierLength = Math.hypot(carrier.x2 - carrier.x1, carrier.y2 - carrier.y1);
  if (!(carrierLength > 0) || !Number.isFinite(carrierLength)) throw new Error("incumbent carrier is degenerate");
  const carrierAngleDeg = Math.atan2(carrier.y2 - carrier.y1, carrier.x2 - carrier.x1) * 180 / Math.PI;
  const impactDeficit = Math.max(0, targetImpact - achievedImpact);
  const requestedTurnRad = impactToRawPx(impactDeficit) / speed;
  const catchableTurnRad = Math.min(requestedTurnRad, Math.asin(IMPACT.CATCHABLE_REDIR_FRACTION));
  const requestedTurnDeg = requestedTurnRad * 180 / Math.PI;
  const catchableTurnDeg = catchableTurnRad * 180 / Math.PI;
  // One outbound collision plus one independent return collision should carry
  // the packet. The prior one-sided assay transferred roughly 25% of surface
  // tangent travel to the articulated rider, so command half the deficit on
  // each side and retain the already-safe 15-degree join bound.
  const responseEfficiency = 0.25;
  const outboundTurnDeg = Math.min(catchableTurnDeg / (2 * responseEfficiency), 15);
  if (!(outboundTurnDeg > 1e-9)) throw new Error("staged return cell has no impact deficit");
  const outboundAngleDeg = carrierAngleDeg + orientation * outboundTurnDeg;
  // Unlike the earlier chicane, retain the incumbent's complete downstream
  // carrier. The staged contacts are auxiliary collision surfaces: if they do
  // not establish a better transition, the admitted native continuation still
  // exists instead of being silently replaced by an untested launch state.
  const lines = baseLines.map((line, index) => ({
    ...line,
    id: input.lineIdStart + index,
  }));
  const outboundLineIds: number[] = [];
  let point = { x: carrier.x2, y: carrier.y2 };
  for (let frame = 0; frame < 2; frame++) {
    const tangent = unit(outboundAngleDeg);
    const next = { x: point.x + tangent.x * speed, y: point.y + tangent.y * speed };
    const id = input.lineIdStart + lines.length;
    lines.push(makeSolidLine(id, point.x, point.y, next.x, next.y));
    outboundLineIds.push(id);
    point = next;
  }
  return {
    mechanism: "staged_return_cell",
    lines,
    entryAngleDeg: carrierAngleDeg,
    exitAngleDeg: outboundAngleDeg,
    requestedTurnDeg,
    catchableTurnDeg,
    entryTurnDeg: 0,
    responseTurnDeg: outboundTurnDeg,
    responseSegments: 2,
    accumulatedTurnDeg: outboundTurnDeg,
    turnOrientation: orientation,
    outboundLineIds,
  };
}

/**
 * Complete a staged cell from the exact state produced by its outbound half.
 * The return surface is tangent to the admitted carrier. Its active normal
 * faces the observed collective motion, and its position/span are support
 * functions of all four sled collision points. No named-point choice, phase
 * menu, case identity, or outcome-dependent orientation enters construction.
 */
export function buildCapturePreservingStagedReturnGeometry(
  outbound: ContactTransitionGeometry,
  state: StagedReturnState,
  returnHeadingDeg: number,
): ContactTransitionGeometry {
  if (outbound.mechanism !== "staged_return_cell" || outbound.outboundLineIds === undefined) {
    throw new Error("staged return completion requires an outbound staged cell");
  }
  if (!Number.isSafeInteger(state.frame) || state.frame < 0) throw new Error("return frame must be non-negative");
  if (state.points.length !== SLED_POINT_ORDER.length) throw new Error("return surface requires the full sled state");
  const speed = Math.hypot(state.velocity.x, state.velocity.y);
  if (!(speed > 1e-9) || !Number.isFinite(speed)) throw new Error("return state velocity is degenerate");
  let tangent = unit(finite("returnHeadingDeg", returnHeadingDeg));
  let normal = { x: -tangent.y, y: tangent.x };
  if (dot(normal, state.velocity) < 0) {
    tangent = { x: -tangent.x, y: -tangent.y };
    normal = { x: -normal.x, y: -normal.y };
  }
  const normalSupport = Math.max(...state.points.map((point) => point.x * normal.x + point.y * normal.y));
  const tangentProjections = state.points.map((point) => point.x * tangent.x + point.y * tangent.y);
  const halfFrameMargin = speed * 0.5;
  const lower = Math.min(...tangentProjections) - halfFrameMargin;
  const upper = Math.max(...tangentProjections) + halfFrameMargin;
  if (!(upper - lower > 1e-9) || ![normalSupport, lower, upper].every(Number.isFinite)) {
    throw new Error("return support plane is degenerate");
  }
  const start = {
    x: tangent.x * lower + normal.x * normalSupport,
    y: tangent.y * lower + normal.y * normalSupport,
  };
  const end = {
    x: tangent.x * upper + normal.x * normalSupport,
    y: tangent.y * upper + normal.y * normalSupport,
  };
  const returnLineId = outbound.lines[0]!.id + outbound.lines.length;
  const returnLine: TrackLine = {
    id: returnLineId,
    type: 0,
    x1: start.x,
    y1: start.y,
    x2: end.x,
    y2: end.y,
    flipped: false,
    leftExtended: false,
    rightExtended: false,
  };
  return {
    ...outbound,
    lines: [...outbound.lines, returnLine],
    exitAngleDeg: returnHeadingDeg,
    responseSegments: outbound.responseSegments + 1,
    accumulatedTurnDeg: outbound.accumulatedTurnDeg +
      Math.abs(normalizeAngleDeg(returnHeadingDeg - outbound.exitAngleDeg)),
    returnLineId,
    returnFrame: state.frame,
  };
}

// deno-lint-ignore no-explicit-any
function readStagedReturnState(engine: any, frame: number): StagedReturnState | null {
  const rider = getRiderMetered(engine, frame);
  const velocity = readVec(rider?.velocity);
  if (velocity === null) return null;
  const points = SLED_POINT_ORDER.flatMap((id): StagedReturnState["points"] => {
    const position = readVec(rider?.get?.(id)?.pos);
    return position === null ? [] : [{ id, ...position }];
  });
  return points.length === SLED_POINT_ORDER.length ? { frame, velocity, points } : null;
}

function recordStagedCollisionTelemetry(
  // deno-lint-ignore no-explicit-any
  engine: any,
  lines: readonly TrackLine[],
  geometry: ContactTransitionGeometry,
  targetFrame: number,
): void {
  try {
    const full = engine.addLine(lines.map(engineLineFromTrackLine));
    const lastFrame = Math.max(targetFrame + IMPACT_WINDOW, geometry.returnFrame ?? targetFrame);
    getRiderMetered(full, lastFrame);
    const outbound = hasOwnedSledCollision(
      full,
      new Set(geometry.outboundLineIds ?? []),
      targetFrame,
      lastFrame,
    );
    const returned = hasOwnedSledCollision(
      full,
      new Set(geometry.returnLineId === undefined ? [] : [geometry.returnLineId]),
      targetFrame,
      lastFrame,
    );
    if (outbound) totals.staged_outbound_collision++;
    if (returned) totals.staged_return_collision++;
    if (outbound && returned) totals.staged_both_collisions++;
  } catch {
    // The exact candidate gate remains authoritative. Telemetry must never
    // rehabilitate or reject a fit when an engine inspection is unavailable.
  }
}

// deno-lint-ignore no-explicit-any
function hasOwnedSledCollision(engine: any, lineIds: ReadonlySet<number>, first: number, last: number): boolean {
  return firstOwnedSledCollisionFrame(engine, lineIds, first, last) !== null;
}

// deno-lint-ignore no-explicit-any
function firstOwnedSledCollisionFrame(
  engine: any,
  lineIds: ReadonlySet<number>,
  first: number,
  last: number,
): number | null {
  if (lineIds.size === 0) return null;
  for (let frame = first; frame <= last; frame++) {
    const updates = engine.getUpdatesAtFrame?.(frame);
    if (!Array.isArray(updates)) continue;
    for (const update of updates) {
      if (update?.type !== COLLISION_UPDATE_TYPE || !lineIds.has(update?.id) || !Array.isArray(update?.updated)) {
        continue;
      }
      if (update.updated.some((point: { id?: unknown }) =>
        typeof point?.id === "string" && (SLED_POINT_ORDER as readonly string[]).includes(point.id)
      )) return frame;
    }
  }
  return null;
}

function readVec(value: unknown): { x: number; y: number } | null {
  if (value === null || typeof value !== "object") return null;
  const candidate = value as { x?: unknown; y?: unknown };
  return typeof candidate.x === "number" && typeof candidate.y === "number" &&
      Number.isFinite(candidate.x) && Number.isFinite(candidate.y)
    ? { x: candidate.x, y: candidate.y }
    : null;
}

function dot(left: { x: number; y: number }, right: { x: number; y: number }): number {
  return left.x * right.x + left.y * right.y;
}

function normalizeAngleDeg(angle: number): number {
  let normalized = (angle + 180) % 360;
  if (normalized < 0) normalized += 360;
  return normalized - 180;
}

function nearestLineStart(
  lines: readonly TrackLine[],
  anchor: { x: number; y: number },
): number {
  let best = -1;
  let distance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!;
    const candidate = (line.x1 - anchor.x) ** 2 + (line.y1 - anchor.y) ** 2;
    if (candidate < distance) {
      best = index;
      distance = candidate;
    }
  }
  return best;
}

function projectedCarrierFork(
  carrier: TrackLine,
  anchor: { x: number; y: number },
  motionTangent: { x: number; y: number },
  speedPxPerFrame: number,
): { x: number; y: number } {
  const dx = carrier.x2 - carrier.x1;
  const dy = carrier.y2 - carrier.y1;
  const lengthSq = dx * dx + dy * dy;
  if (!(lengthSq > 0) || !Number.isFinite(lengthSq)) throw new Error("incumbent carrier is degenerate");
  const projection = clamp01(
    ((anchor.x - carrier.x1) * dx + (anchor.y - carrier.y1) * dy) / lengthSq,
  );
  return {
    x: carrier.x1 + projection * dx + motionTangent.x * speedPxPerFrame,
    y: carrier.y1 + projection * dy + motionTangent.y * speedPxPerFrame,
  };
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function adaptiveResponseSegments(extentPx: number, turnDeg: number): number {
  if (Math.abs(turnDeg) <= 1e-12) return 1;
  const turnRad = Math.abs(turnDeg) * Math.PI / 180;
  const chordCount = Math.ceil(Math.sqrt(turnRad * extentPx / (8 * 2)));
  // Tangent samples include both endpoints, so N segments expose N-1 angular
  // intervals. Add the endpoint sample rather than under-resolving by one.
  const angleCount = Math.ceil(Math.abs(turnDeg) / 5) + 1;
  return Math.max(2, chordCount, angleCount);
}

function unit(angleDeg: number): { x: number; y: number } {
  const radians = angleDeg * Math.PI / 180;
  return { x: Math.cos(radians), y: Math.sin(radians) };
}

function finite(name: string, value: number): number {
  if (!Number.isFinite(value)) throw new Error(`${name} must be finite`);
  return value;
}

function positive(name: string, value: number): number {
  if (!Number.isFinite(value) || !(value > 0)) throw new Error(`${name} must be positive and finite`);
  return value;
}

function bounded(name: string, value: number, low: number, high: number): number {
  if (!Number.isFinite(value) || value < low || value > high) {
    throw new Error(`${name} must be in [${low}, ${high}]`);
  }
  return value;
}
