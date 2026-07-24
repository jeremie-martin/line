/**
 * Declarative control configurations for arc-knob research.
 *
 * This module intentionally contains no physics, scoring, or study-specific
 * choices.  A configuration is the product of independent axes:
 *   - an ordered sequence of atomic knobs;
 *   - a model-training method;
 *   - a signed probe layout and its physical range scale;
 *   - an inverse-solver proposal-range scale.
 *
 * The normal compiler and the matrix runner share `arc_actuator.ts` for
 * ordered geometry composition. Keeping this description data-only prevents
 * a probe method such as "sequential conditional" from accidentally naming a
 * particular physical knob order.
 */
import {
  arcKnobProbeSpan,
  arcKnobScanStep,
  enumerateArcKnobSequences,
  getArcKnob,
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
   * Signed topology around zero. The physical distance is additionally set by
   * `probeRangeScale`, independently of the later proposal-range scale.
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

/** Ordinary number of distinct inverse-model proposals emitted per refined base. */
export const ARC_PROPOSAL_COUNT_DEFAULT = 2;

/** Multiplies only the physical probe coordinates used to fit a model. */
export const ARC_PROBE_RANGE_SCALE_DEFAULT = 1;

/** Multiplies only the inverse solver's candidate grid around zero. */
export const ARC_PROPOSAL_RANGE_SCALE_DEFAULT = 1;

/** The selected normal response configuration.  It remains declarative so
 * source-default behavior and explicit matrix configurations use the same
 * control boundary. */
export const ARC_CONTROL_DEFAULT: Readonly<{
  sequence: ArcKnobSequence;
  trainingMethod: ArcTrainingMethod;
  probeLayout: ArcProbeLayoutId;
  probeRangeScale: number;
  proposalRangeScale: number;
  proposalCount: number;
}> = {
  sequence: ["tail_pitch", "post_contact_pitch"],
  trainingMethod: "base_additive",
  probeLayout: "signed3",
  probeRangeScale: 0.6,
  proposalRangeScale: 1.2,
  proposalCount: ARC_PROPOSAL_COUNT_DEFAULT,
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
  /** Multiplies physical observations, never the inverse solver's range. */
  probeRangeScale: number;
  /** Multiplies the inverse solver's candidate grid, never probe positions. */
  proposalRangeScale: number;
  proposalCount: number;
}>;

export type ArcControlMatrixOptions = Readonly<{
  knobs?: readonly ArcKnobId[];
  maxKnobs: number;
  allowRepeated?: boolean;
  trainingMethods?: readonly ArcTrainingMethod[];
  probeLayouts?: readonly ArcProbeLayoutId[];
  probeRangeScales?: readonly number[];
  proposalRangeScales?: readonly number[];
  proposalCounts?: readonly number[];
  /** An explicit fixed sequence is a protocol constant, not a second
   * representation of a model or observation policy. */
  sequences?: readonly ArcKnobSequence[];
}>;

function scaleToken(scale: number): string {
  return String(scale);
}

function configurationId(
  sequence: ArcKnobSequence,
  trainingMethod: ArcTrainingMethod,
  probeLayout: ArcProbeLayoutId,
  probeRangeScale: number,
  proposalRangeScale: number,
  proposalCount: number,
): string {
  const ranges = probeRangeScale === ARC_PROBE_RANGE_SCALE_DEFAULT &&
    proposalRangeScale === ARC_PROPOSAL_RANGE_SCALE_DEFAULT
    ? ""
    : `--probe${scaleToken(probeRangeScale)}--span${scaleToken(proposalRangeScale)}`;
  return `${trainingMethod}--${probeLayout}${ranges}--p${proposalCount}--${sequence.join("__")}`;
}

function observationEquivalenceKey(
  sequence: ArcKnobSequence,
  trainingMethod: ArcTrainingMethod,
  probeLayout: ArcProbeLayoutId,
  probeRangeScale: number,
  proposalRangeScale: number,
  proposalCount: number,
): string {
  // With one scalar knob and the signed three-point layout, the three training
  // methods observe and invert the same one-dimensional quadratic.  Keep
  // their requested rows, but declare that expected observation/proposal
  // equivalence instead of hiding the Cartesian product.
  const effectiveMethod = sequence.length === 1 ? "scalar_1d" : trainingMethod;
  const ranges = `--probe${scaleToken(probeRangeScale)}--span${scaleToken(proposalRangeScale)}`;
  return `${effectiveMethod}--${probeLayout}${ranges}--p${proposalCount}--${sequence.join("__")}`;
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
  const probeRangeScales = options.probeRangeScales === undefined
    ? [ARC_PROBE_RANGE_SCALE_DEFAULT]
    : [...options.probeRangeScales];
  const proposalRangeScales = options.proposalRangeScales === undefined
    ? [ARC_PROPOSAL_RANGE_SCALE_DEFAULT]
    : [...options.proposalRangeScales];
  const proposalCounts = options.proposalCounts === undefined ? [ARC_PROPOSAL_COUNT_DEFAULT] : [...options.proposalCounts];
  for (const method of methods) {
    if (!ARC_TRAINING_METHODS.includes(method)) throw new Error(`unknown arc training method ${method}`);
  }
  for (const layout of layouts) {
    if (!(layout in ARC_PROBE_LAYOUTS)) throw new Error(`unknown arc probe layout ${layout}`);
  }
  for (const scale of [...probeRangeScales, ...proposalRangeScales]) {
    if (!Number.isFinite(scale) || scale <= 0) throw new Error(`invalid positive arc range scale ${scale}`);
  }
  for (const proposalCount of proposalCounts) {
    if (!Number.isSafeInteger(proposalCount) || proposalCount < 1) {
      throw new Error(`invalid arc proposal count ${proposalCount}`);
    }
  }
  const sequences = options.sequences === undefined
    ? enumerateArcKnobSequences({
      ...(options.knobs === undefined ? {} : { knobs: options.knobs }),
      maxLength: options.maxKnobs,
      ...(options.allowRepeated === true ? { allowRepeated: true } : {}),
    })
    : options.sequences.map((declared) => {
      const sequence = [...declared] as ArcKnobSequence;
      if (sequence.length < 1 || sequence.length > options.maxKnobs) {
        throw new Error(`explicit arc knob sequence has invalid length ${sequence.length}`);
      }
      for (const knob of sequence) getArcKnob(knob);
      if (options.allowRepeated !== true && new Set(sequence).size !== sequence.length) {
        throw new Error(`explicit arc knob sequence repeats a knob without allowRepeated`);
      }
      return sequence;
    });
  return sequences.flatMap((sequence) => methods.flatMap((trainingMethod) => layouts.flatMap((probeLayout) =>
    probeRangeScales.flatMap((probeRangeScale) => proposalRangeScales.flatMap((proposalRangeScale) =>
      proposalCounts.map((proposalCount) => ({
        id: configurationId(sequence, trainingMethod, probeLayout, probeRangeScale, proposalRangeScale, proposalCount),
        observationEquivalenceKey: observationEquivalenceKey(
          sequence, trainingMethod, probeLayout, probeRangeScale, proposalRangeScale, proposalCount,
        ),
        sequence,
        trainingMethod,
        probeLayout,
        probeRangeScale,
        proposalRangeScale,
        proposalCount,
      })),
    )),
  )));
}

/** Probe values for one scalar knob, ordered with the real center first for
 * sequential stages.  Keeping this rule here ensures the ordinary compiler,
 * local study runner, and planned-cost accounting cannot silently diverge. */
export function arcControlStageProbeValues(
  knob: ArcKnobId,
  probeLayout: ArcProbeLayoutId,
  probeRangeScale = ARC_PROBE_RANGE_SCALE_DEFAULT,
): number[] {
  if (!Number.isFinite(probeRangeScale) || probeRangeScale <= 0) {
    throw new Error(`invalid positive probe range scale ${probeRangeScale}`);
  }
  const span = arcKnobProbeSpan(knob);
  const points = ARC_PROBE_LAYOUTS[probeLayout].normalizedPoints;
  return [
    0,
    ...points.filter((point) => point !== 0).map((point) => point * span * probeRangeScale),
  ];
}

/**
 * Full inverse-model values for one knob.  Keep the exact requested boundary
 * even when its scaled span is not an integer number of scan steps; otherwise
 * a range-scale experiment would silently test a smaller asymmetric domain.
 */
export function arcControlProposalValues(
  knob: ArcKnobId,
  proposalRangeScale = ARC_PROPOSAL_RANGE_SCALE_DEFAULT,
): number[] {
  if (!Number.isFinite(proposalRangeScale) || proposalRangeScale <= 0) {
    throw new Error(`invalid positive proposal range scale ${proposalRangeScale}`);
  }
  const extent = arcKnobProbeSpan(knob) * proposalRangeScale;
  const step = arcKnobScanStep(knob);
  const positive = [0];
  for (let value = step; value < extent - 1e-9; value += step) positive.push(value);
  if (Math.abs(positive.at(-1)! - extent) > 1e-9) positive.push(extent);
  return [...positive.slice(1).reverse().map((value) => -value), ...positive];
}

/**
 * Materialize the original-arc observation plan for a declared configuration.
 * It owns only the observation layout—not model fitting, geometry, or the
 * inverse-model search range.  `base_additive` observes one center plus each
 * non-center axis point; `base_joint` observes the complete tensor product.
 */
export function arcControlProbeVectors(
  configuration: Pick<
    ArcControlConfiguration,
    "sequence" | "trainingMethod" | "probeLayout" | "probeRangeScale"
  >,
): number[][] {
  const spans = configuration.sequence.map(arcKnobProbeSpan);
  const points = ARC_PROBE_LAYOUTS[configuration.probeLayout].normalizedPoints;
  if (configuration.trainingMethod !== "base_joint") {
    const center = Array.from({ length: spans.length }, () => 0);
    return [
      center,
      ...spans.flatMap((span, index) => points.filter((point) => point !== 0).map((point) => {
        const values = Array.from({ length: spans.length }, () => 0);
        values[index] = point * span * configuration.probeRangeScale;
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
    for (const point of points) visit([...prefix, point * spans[index] * configuration.probeRangeScale], index + 1);
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
