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
export type ArcProbeLayoutId = "signed3";

export type ArcProbeLayout = Readonly<{
  id: ArcProbeLayoutId;
  normalizedPoints: readonly [-1, 0, 1];
}>;

export const ARC_PROBE_LAYOUTS: Readonly<Record<ArcProbeLayoutId, ArcProbeLayout>> = {
  signed3: { id: "signed3", normalizedPoints: [-1, 0, 1] },
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

/** Planned scalar physics rides before gate outcomes.  This is a transparent
 * accounting rule, useful both to bound a smoke matrix and to compare methods
 * at equal or intentionally different budgets. */
export function plannedArcControlProbeCount(configuration: ArcControlConfiguration): number {
  const dimensions = configuration.sequence.length;
  switch (configuration.trainingMethod) {
    case "base_additive":
      // One shared center and two signed axis observations per knob.
      return 1 + 2 * dimensions;
    case "base_joint":
      // Complete signed cube around the original arc.
      return 3 ** dimensions;
    case "sequential_conditional":
      // Every stage is observed on the physically materialized prefix at the
      // complete signed layout.  In particular, a later-stage center is an
      // actual ride of the transformed arc, never a value synthesized from
      // the preceding model.
      return 3 * dimensions;
  }
}
