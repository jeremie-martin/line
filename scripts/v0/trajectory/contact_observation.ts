/**
 * Study-only, ungated observation of a proposed line group's local contact
 * behavior. This does not decide candidate validity and must never replace the
 * exact candidate gate; it exists so a bounded local corrector can distinguish
 * a missed/early/late owned contact from a later support failure.
 */
import {
  PERSISTENCE_FRAMES,
  SLED_POINT_ORDER,
  type Detection,
  type DetEvent,
} from "../../lib/detector.ts";
import { COLLISION_UPDATE_TYPE } from "../../lib/update_types.ts";
import {
  postimpactAirborneAt,
  postimpactContactLineIdsAt,
  postimpactIsAuthoredContactEvent,
  postimpactPositionAt,
  postimpactSpeedAt,
  postimpactVelocityAt,
} from "./postimpact_detection_measurement.ts";

export type LocalContactState = {
  frame: number;
  position: { x: number; y: number };
  velocity: { x: number; y: number };
  speedPxPerFrame: number;
  airborne: boolean;
};

export type OwnedContactEvent = {
  type: DetEvent["type"];
  frame: number;
  timingErrorFrames: number;
  contactLineIds: number[];
  ownedLineIds: number[];
  lineRoles: string[];
  gateEligible: boolean;
  /** True when the event touched the caller's designated local primitive. */
  roleEligible: boolean;
};

export type OwnedContactObservation = {
  targetFrame: number;
  observationEndFrame: number;
  terminus: Detection["terminus"];
  ownedEvents: OwnedContactEvent[];
  /** All detector events in the local window, including unowned collisions. */
  nearbyEvents: OwnedContactEvent[];
  closestOwnedEvent: OwnedContactEvent | null;
  /** Prefer an on-time event on the local primitive, then timing proximity. */
  selectedOwnedEvent: OwnedContactEvent | null;
  /** Exact detector measurement at the selected collision frame. */
  selectedEventState: LocalContactState | null;
  /** Detector-persistence endpoint after the selected event. */
  persistenceEndFrame: number | null;
  persistenceEndState: LocalContactState | null;
  persistenceWindowComplete: boolean;
  /** Caller-declared response endpoint after the selected event. */
  responseEndFrame: number | null;
  responseEndState: LocalContactState | null;
  responseWindowComplete: boolean;
  targetState: LocalContactState | null;
  handoffState: LocalContactState | null;
};

export function observeOwnedContactTransition(
  det: Detection,
  input: {
    targetFrame: number;
    gapFrames: number;
    observationEndFrame: number;
    ownedLineIds: ReadonlySet<number>;
    /** Optional role attribution for each proposed line. */
    lineRoles?: ReadonlyMap<number, string>;
    /**
     * A selected event must touch at least one of these local roles when
     * supplied. A C1 contact boundary may be attributed to either adjacent
     * line by the engine, so a contact phase can deliberately name both while
     * excluding later support/tail terrain.
     */
    requiredLineRoles?: readonly string[];
    /** Detector-persistence state offset; defaults to the detector threshold. */
    persistenceOffsetFrames?: number;
    /** Independent scorer/response offset; defaults to persistence for generic callers. */
    responseOffsetFrames?: number;
  },
): OwnedContactObservation {
  const ownedLineIds = new Set(input.ownedLineIds);
  const nearbyEvents = det.events
    .filter((event) => event.frame <= input.observationEndFrame)
    .map((event) => summarizeEvent(event, det, { ...input, ownedLineIds }));
  const ownedEvents = nearbyEvents.filter((event) => event.ownedLineIds.length > 0);
  const closestOwnedEvent = selectClosest(ownedEvents);
  const selectedOwnedEvent = selectPreferred(ownedEvents);
  const persistenceEndFrame = selectedOwnedEvent === null
    ? null
    : selectedOwnedEvent.frame + (input.persistenceOffsetFrames ?? PERSISTENCE_FRAMES);
  const responseEndFrame = selectedOwnedEvent === null
    ? null
    : selectedOwnedEvent.frame + (input.responseOffsetFrames ?? input.persistenceOffsetFrames ?? PERSISTENCE_FRAMES);
  const persistenceEndState = persistenceEndFrame === null || persistenceEndFrame > input.observationEndFrame
    ? null
    : stateAt(det, persistenceEndFrame);
  const responseEndState = responseEndFrame === null || responseEndFrame > input.observationEndFrame
    ? null
    : stateAt(det, responseEndFrame);
  return {
    targetFrame: input.targetFrame,
    observationEndFrame: input.observationEndFrame,
    terminus: det.terminus,
    ownedEvents,
    nearbyEvents,
    closestOwnedEvent,
    selectedOwnedEvent,
    selectedEventState: selectedOwnedEvent === null ? null : stateAt(det, selectedOwnedEvent.frame),
    persistenceEndFrame,
    persistenceEndState,
    persistenceWindowComplete: persistenceEndFrame !== null && persistenceEndFrame <= input.observationEndFrame && persistenceEndState !== null,
    responseEndFrame,
    responseEndState,
    responseWindowComplete: responseEndFrame !== null && responseEndFrame <= input.observationEndFrame && responseEndState !== null,
    targetState: stateAt(det, input.targetFrame),
    handoffState: stateAt(det, input.observationEndFrame),
  };
}

/**
 * Read the sled points that the engine reports as colliding with the selected
 * locally-owned terrain at one frame. This is diagnostic evidence only: event
 * ownership and candidate admission remain defined by the detector/evaluator.
 */
export function ownedSledCollisionTelemetry(
  updates: unknown,
  ownedLineIds: ReadonlySet<number>,
): { ownedCollisionLineIds: number[]; firedSledPointIds: string[] } {
  if (!Array.isArray(updates)) return { ownedCollisionLineIds: [], firedSledPointIds: [] };
  const lineIds = new Set<number>();
  const pointIds = new Set<string>();
  for (const update of updates) {
    if (update === null || typeof update !== "object") continue;
    const candidate = update as { type?: unknown; id?: unknown; updated?: unknown };
    if (
      candidate.type !== COLLISION_UPDATE_TYPE ||
      typeof candidate.id !== "number" ||
      !ownedLineIds.has(candidate.id) ||
      !Array.isArray(candidate.updated)
    ) continue;
    const sledIds = candidate.updated.flatMap((point) => {
      const id = point !== null && typeof point === "object" ? (point as { id?: unknown }).id : undefined;
      return typeof id === "string" && (SLED_POINT_ORDER as readonly string[]).includes(id) ? [id] : [];
    });
    if (sledIds.length === 0) continue;
    lineIds.add(candidate.id);
    for (const id of sledIds) pointIds.add(id);
  }
  return {
    ownedCollisionLineIds: [...lineIds].sort((left, right) => left - right),
    firedSledPointIds: SLED_POINT_ORDER.filter((id) => pointIds.has(id)),
  };
}

function summarizeEvent(
  event: DetEvent,
  det: Detection,
  input: {
    targetFrame: number;
    gapFrames: number;
    ownedLineIds: ReadonlySet<number>;
    lineRoles?: ReadonlyMap<number, string>;
    requiredLineRoles?: readonly string[];
  },
): OwnedContactEvent {
  const contactLineIds = postimpactContactLineIdsAt(det, event.frame)
    .filter((lineId) => Number.isSafeInteger(lineId));
  const ownedLineIds = contactLineIds.filter((lineId) => input.ownedLineIds.has(lineId));
  const lineRoles = [...new Set(ownedLineIds.flatMap((lineId) => {
    const role = input.lineRoles?.get(lineId);
    return role === undefined ? [] : [role];
  }))].sort();
  const timingErrorFrames = event.frame - input.targetFrame;
  return {
    type: event.type,
    frame: event.frame,
    timingErrorFrames,
    contactLineIds,
    ownedLineIds,
    lineRoles,
    gateEligible: postimpactIsAuthoredContactEvent(event, input.gapFrames) && Math.abs(timingErrorFrames) <= 1,
    roleEligible: input.requiredLineRoles === undefined ||
      lineRoles.some((role) => input.requiredLineRoles!.includes(role)),
  };
}

function selectClosest(events: readonly OwnedContactEvent[]): OwnedContactEvent | null {
  return events.reduce<OwnedContactEvent | null>((closest, event) => {
    if (closest === null) return event;
    return compareByTargetProximity(event, closest) < 0 ? event : closest;
  }, null);
}

function selectPreferred(events: readonly OwnedContactEvent[]): OwnedContactEvent | null {
  const preferred = events.filter((event) => event.gateEligible && event.roleEligible);
  return selectClosest(preferred);
}

function compareByTargetProximity(left: OwnedContactEvent, right: OwnedContactEvent): number {
  const distance = Math.abs(left.timingErrorFrames) - Math.abs(right.timingErrorFrames);
  return distance !== 0 ? distance : left.frame - right.frame;
}

function stateAt(det: Detection, frame: number): LocalContactState | null {
  const position = postimpactPositionAt(det, frame);
  const velocity = postimpactVelocityAt(det, frame);
  const speed = postimpactSpeedAt(det, frame);
  const airborne = postimpactAirborneAt(det, frame);
  if (position === undefined || velocity === undefined || speed === undefined || airborne === undefined) return null;
  return {
    frame,
    position: { ...position },
    velocity: { ...velocity },
    speedPxPerFrame: speed,
    airborne,
  };
}
