/**
 * Explicit physical/scoring ownership at one authored contact.
 *
 * `Gap i` is the scored interval [T(i-1), T(i)].  A terrain fragment proposed
 * around T(i) can influence that incoming interval, the collision event at
 * T(i), and the outgoing interval [T(i), T(i+1)].  Those are different
 * contracts.  This study-only model keeps them separate so a future generator
 * cannot accidentally use one target bag as a proxy for all three.
 */
import type { AxisValues, Gap } from "../types.ts";

/**
 * Axes measured over a physical/scored interval.  `impact` is deliberately
 * absent: it belongs to the event at the *end* of that interval, rather than
 * to terrain support within it.
 */
export type IntervalAxes = Omit<AxisValues, "impact">;

type IntervalContract = {
  gapIndex: number;
  startFrame: number;
  endFrame: number;
  endKind: "contact" | "tail";
  /** Elapsed inter-frame intervals for kinematics. */
  intervalFrames: number;
  /** Inclusive scorer samples over [startFrame, endFrame]. */
  measurementSamples: number;
  /** Only non-event axes explicitly authored for this interval. */
  axes: IntervalAxes;
};

export type IncomingInterval = IntervalContract & { endKind: "contact" };

export type ContactEventContract = {
  /** The authored contact at the end of the incoming scored interval. */
  frame: number;
  /** Null means the event has no authored redirection request. */
  impact: number | null;
};

export type OutgoingInterval = IntervalContract & {
  /**
   * The event at the end of this interval, if any.  A later arrival planner
   * may read it explicitly; an outgoing support planner cannot accidentally
   * confuse it with an interval residual.
   */
  arrival: ContactEventContract | null;
};

export type TransitionContract = {
  /** Scorer-owned interval ending at this contact. */
  incoming: IncomingInterval;
  /** Collision-local request at the boundary between the two intervals. */
  event: ContactEventContract;
  /**
   * Physical interval after the contact. A tail interval remains explicit even
   * when no later authored event exists, because a generator still has to
   * support or release the rider through it.
   */
  outgoing: OutgoingInterval | null;
};

/**
 * Build the exact three-way ownership contract for `current`.
 *
 * `literalTargets` must be the resolved non-jittered target bags when a study
 * needs authored semantics. The production sampler may use jittered geometry
 * targets separately; no randomization belongs in this contract.
 */
export function transitionContractForGap(
  current: Gap,
  next: Gap | undefined,
  literalTargets: readonly AxisValues[],
): TransitionContract {
  if (!current.endsWithContact) {
    throw new Error(`transition contract requires a contact-ending incoming gap, got g${current.index}`);
  }
  const incoming = incomingIntervalFromGap(current, literalTargets[current.index]);
  const outgoing = next === undefined
    ? null
    : intervalFromContiguousOutgoingGap(current, next, literalTargets[next.index]);
  return {
    incoming,
    event: {
      frame: current.endFrame,
      // Impact is event-owned: compiler materialization assigns it to the gap
      // whose end frame is the authored contact.
      impact: explicitImpact(literalTargets[current.index]),
    },
    outgoing,
  };
}

/** Build all non-terminal contact transition contracts from a timeline. */
export function transitionContracts(
  gaps: readonly Gap[],
  literalTargets: readonly AxisValues[],
): TransitionContract[] {
  if (gaps.length !== literalTargets.length) {
    throw new Error(`transition contract target count ${literalTargets.length} != gap count ${gaps.length}`);
  }
  const out: TransitionContract[] = [];
  for (let index = 0; index < gaps.length; index++) {
    const current = gaps[index]!;
    if (!current.endsWithContact) continue;
    out.push(transitionContractForGap(current, gaps[index + 1], literalTargets));
  }
  return out;
}

function intervalFromContiguousOutgoingGap(
  current: Gap,
  outgoing: Gap,
  targets: AxisValues | undefined,
): OutgoingInterval {
  if (outgoing.startFrame !== current.endFrame) {
    throw new Error(
      `g${current.index} requires a contiguous outgoing interval; received g${outgoing.index} ` +
      `[${outgoing.startFrame}, ${outgoing.endFrame}]`,
    );
  }
  const interval = intervalFromGap(outgoing, targets);
  return {
    ...interval,
    arrival: outgoing.endsWithContact
      ? { frame: outgoing.endFrame, impact: explicitImpact(targets) }
      : null,
  };
}

function incomingIntervalFromGap(gap: Gap, targets: AxisValues | undefined): IncomingInterval {
  const interval = intervalFromGap(gap, targets);
  if (interval.endKind !== "contact") {
    throw new Error(`incoming interval g${gap.index} must end at an authored contact`);
  }
  return { ...interval, endKind: "contact" };
}

function intervalFromGap(gap: Gap, targets: AxisValues | undefined): IntervalContract {
  const intervalFrames = gap.endFrame - gap.startFrame;
  if (!Number.isSafeInteger(intervalFrames) || intervalFrames < 0) {
    throw new Error(`invalid transition interval g${gap.index}: ${gap.startFrame}..${gap.endFrame}`);
  }
  return {
    gapIndex: gap.index,
    startFrame: gap.startFrame,
    endFrame: gap.endFrame,
    endKind: gap.endsWithContact ? "contact" : "tail",
    intervalFrames,
    measurementSamples: intervalFrames + 1,
    axes: explicitIntervalAxes(targets ?? {}),
  };
}

function explicitIntervalAxes(targets: AxisValues): IntervalAxes {
  return Object.fromEntries(Object.entries(targets).flatMap(([axis, value]) =>
    axis !== "impact" && typeof value === "number" && Number.isFinite(value) ? [[axis, value]] : [],
  ));
}

function explicitImpact(targets: AxisValues | undefined): number | null {
  const impact = targets?.impact;
  return typeof impact === "number" && Number.isFinite(impact) ? impact : null;
}
