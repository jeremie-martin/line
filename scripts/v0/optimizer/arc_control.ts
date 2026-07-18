/**
 * Declarative control configurations for arc-knob research.
 *
 * This module intentionally contains no physics, scoring, or study-specific
 * choices.  A configuration is the product of independent axes:
 *   - an ordered sequence of atomic knobs;
 *   - a model-training method;
 *   - a probe layout.
 *
 * The normal compiler currently consumes the legacy two-coordinate adapter,
 * but both it and the matrix runner share `arc_actuator.ts` for actual ordered
 * geometry composition.  Keeping this description data-only prevents a
 * probe method such as "sequential conditional" from accidentally naming a
 * particular physical knob order.
 */
import {
  arcKnobProbeSpan,
  enumerateArcKnobSequences,
  type ArcKnobId,
  type ArcKnobSequence,
} from "./arc_actuator.ts";

/** How observations are converted into a response model. */
export type ArcTrainingMethod =
  | "base_additive"
  | "base_joint"
  | "sequential_conditional";

/** Where each scalar knob is observed relative to its own declared span. */
export type ArcProbeLayoutId =
  | "signed3_narrow"
  | "signed3"
  | "signed3_wide";

export type ArcProbeLayout = Readonly<{
  id: ArcProbeLayoutId;
  /**
   * Physical probe values are this coordinate multiplied by the owning
   * knob's nominal inverse-model span.  This is intentionally independent of
   * the later inverse-model scan, which continues to cover its declared
   * proposal range.
   */
  normalizedPoints: readonly number[];
}>;

export const ARC_PROBE_LAYOUTS: Readonly<Record<ArcProbeLayoutId, ArcProbeLayout>> = {
  signed3_narrow: { id: "signed3_narrow", normalizedPoints: [-0.6, 0, 0.6] },
  signed3: { id: "signed3", normalizedPoints: [-1, 0, 1] },
  signed3_wide: { id: "signed3_wide", normalizedPoints: [-1.4, 0, 1.4] },
};

export const ARC_TRAINING_METHODS: readonly ArcTrainingMethod[] = [
  "base_additive",
  "base_joint",
  "sequential_conditional",
];

/** The accepted compiler's historical response coordinates, made explicit as
 * a normal configuration rather than hidden in an aiming implementation. */
export const ARC_CONTROL_DEFAULT: Readonly<{
  sequence: ArcKnobSequence;
  trainingMethod: ArcTrainingMethod;
  probeLayout: ArcProbeLayoutId;
}> = {
  sequence: ["whole_rotation", "tail_pitch"],
  trainingMethod: "base_additive",
  probeLayout: "signed3",
};

export type ArcControlConfiguration = Readonly<{
  /** Stable, readable identity: method/layout/ordered knob sequence. */
  id: string;
  /** Configurations expected to use the same observations and yield the same
   * final proposals under the current dimensionality share this key.  Their
   * stage-specific trace metadata can still differ, so this is deliberately
   * not called full execution equivalence. */
  observationEquivalenceKey: string;
  sequence: ArcKnobSequence;
  trainingMethod: ArcTrainingMethod;
  probeLayout: ArcProbeLayoutId;
}>;

export type ArcControlMatrixOptions = Readonly<{
  knobs?: readonly ArcKnobId[];
  maxKnobs: number;
  allowRepeated?: boolean;
  trainingMethods?: readonly ArcTrainingMethod[];
  probeLayouts?: readonly ArcProbeLayoutId[];
}>;

function configurationId(
  sequence: ArcKnobSequence,
  trainingMethod: ArcTrainingMethod,
  probeLayout: ArcProbeLayoutId,
): string {
  return `${trainingMethod}--${probeLayout}--${sequence.join("__")}`;
}

function observationEquivalenceKey(
  sequence: ArcKnobSequence,
  trainingMethod: ArcTrainingMethod,
  probeLayout: ArcProbeLayoutId,
): string {
  // With one scalar knob and the signed three-point layout, the three training
  // methods observe and invert the same one-dimensional quadratic.  Keep
  // their requested rows, but declare that expected observation/proposal
  // equivalence instead of hiding the Cartesian product.
  const effectiveMethod = sequence.length === 1 ? "scalar_1d" : trainingMethod;
  return `${effectiveMethod}--${probeLayout}--${sequence.join("__")}`;
}

/**
 * Enumerate the direct Cartesian product.  It does not assert that a given
 * model will receive a rich enough *observed* row set: model execution uses a
 * deterministic fitting ladder and records the achieved form.  The matrix is
 * therefore an empirical map of configurations, not a hand-pruned judgment
 * about which ordered knob compositions "make sense".
 */
export function enumerateArcControlConfigurations(options: ArcControlMatrixOptions): ArcControlConfiguration[] {
  const methods = options.trainingMethods === undefined ? ARC_TRAINING_METHODS : [...options.trainingMethods];
  const layouts = options.probeLayouts === undefined ? Object.keys(ARC_PROBE_LAYOUTS) as ArcProbeLayoutId[] : [...options.probeLayouts];
  for (const method of methods) {
    if (!ARC_TRAINING_METHODS.includes(method)) throw new Error(`unknown arc training method ${method}`);
  }
  for (const layout of layouts) {
    if (!(layout in ARC_PROBE_LAYOUTS)) throw new Error(`unknown arc probe layout ${layout}`);
  }
  const sequences = enumerateArcKnobSequences({
    ...(options.knobs === undefined ? {} : { knobs: options.knobs }),
    maxLength: options.maxKnobs,
    ...(options.allowRepeated === true ? { allowRepeated: true } : {}),
  });
  return sequences.flatMap((sequence) => methods.flatMap((trainingMethod) => layouts.map((probeLayout) => ({
    id: configurationId(sequence, trainingMethod, probeLayout),
    observationEquivalenceKey: observationEquivalenceKey(sequence, trainingMethod, probeLayout),
    sequence,
    trainingMethod,
    probeLayout,
  }))));
}

/** Probe values for one scalar knob, ordered with the real center first for
 * sequential stages.  Keeping this rule here ensures the ordinary compiler,
 * local study runner, and planned-cost accounting cannot silently diverge. */
export function arcControlStageProbeValues(
  knob: ArcKnobId,
  probeLayout: ArcProbeLayoutId,
): number[] {
  const span = arcKnobProbeSpan(knob);
  const points = ARC_PROBE_LAYOUTS[probeLayout].normalizedPoints;
  return [
    0,
    ...points.filter((point) => point !== 0).map((point) => point * span),
  ];
}

/**
 * Materialize the original-arc observation plan for a declared configuration.
 * It owns only the observation layout—not model fitting, geometry, or the
 * inverse-model search range.  `base_additive` observes one center plus each
 * non-center axis point; `base_joint` observes the complete tensor product.
 */
export function arcControlProbeVectors(configuration: ArcControlConfiguration): number[][] {
  const spans = configuration.sequence.map(arcKnobProbeSpan);
  const points = ARC_PROBE_LAYOUTS[configuration.probeLayout].normalizedPoints;
  if (configuration.trainingMethod !== "base_joint") {
    const center = Array.from({ length: spans.length }, () => 0);
    return [
      center,
      ...spans.flatMap((span, index) => points.filter((point) => point !== 0).map((point) => {
        const values = Array.from({ length: spans.length }, () => 0);
        values[index] = point * span;
        return values;
      })),
    ];
  }
  const out: number[][] = [];
  const visit = (prefix: number[], index: number): void => {
    if (index === spans.length) {
      out.push(prefix);
      return;
    }
    for (const point of points) visit([...prefix, point * spans[index]], index + 1);
  };
  visit([], 0);
  return out;
}

/** Planned scalar physics rides before gate outcomes.  This is a transparent
 * accounting rule, useful both to bound a smoke matrix and to compare methods
 * at equal or intentionally different budgets. */
export function plannedArcControlProbeCount(configuration: ArcControlConfiguration): number {
  const dimensions = configuration.sequence.length;
  const pointCount = ARC_PROBE_LAYOUTS[configuration.probeLayout].normalizedPoints.length;
  switch (configuration.trainingMethod) {
    case "base_additive":
      // One shared center and every non-center axis observation per knob.
      return 1 + (pointCount - 1) * dimensions;
    case "base_joint":
      // Complete declared tensor around the original arc.
      return pointCount ** dimensions;
    case "sequential_conditional":
      // Every stage is observed on the physically materialized prefix at the
      // complete declared layout.  In particular, a later-stage center is an
      // actual ride of the transformed arc, never a value synthesized from
      // the preceding model.
      return pointCount * dimensions;
  }
}
