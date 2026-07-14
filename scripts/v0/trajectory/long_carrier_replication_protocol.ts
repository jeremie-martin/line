/**
 * Preregistered transfer cohort for the fixed long-carrier duration assay.
 *
 * It defines evidence scope and the immutable roster only. It never imports a
 * compiler proposal or selects an arm from an observed replay.
 */
import { PHYSICAL_PREFIX_DONOR_SELECTION_RULE } from "./prefix_projection_contract.ts";

export const LONG_CARRIER_REPLICATION_SCOPE = "long_carrier_duration_replication.v2";
export const LONG_CARRIER_REPLICATION_PROTOCOL_SCHEMA = "line.long-carrier-replication-protocol.v2";
/** The fixed complete-row stencil. It is evidence, not a search menu. */
export const LONG_CARRIER_REPLICATION_FRACTIONS = [0, 0.25, 0.5, 0.75, 1] as const;

/**
 * Shared authoring code whose bytes define the manual spec inputs, rather
 * than a compiler behavior being evaluated. `core/curves.ts` is also within
 * the broad compiler boundary, so the controller treats this explicit input
 * subset as immutable protocol source before it captures a cohort.
 */
export const LONG_CARRIER_REPLICATION_AUTHORING_INPUT_PATHS = Object.freeze([
  "scripts/v0/core/curves.ts",
] as const);

export function isLongCarrierReplicationAuthoringInputPath(path: string): boolean {
  return LONG_CARRIER_REPLICATION_AUTHORING_INPUT_PATHS.some((candidate) => candidate === path);
}

export type LongCarrierReplicationRole = "primary_low_air" | "scope_control";
export type LongCarrierReplicationCategory = "low_air" | "ordinary";

type SourceContext = {
  sourceId: string;
  sourcePath: string;
  category: LongCarrierReplicationCategory;
  role: LongCarrierReplicationRole;
  targetGap: number;
  expectedOutgoingFrames: number;
  selectionRationale: string;
};

const PUBLIC_SEEDS = [730201, 730203] as const;

const SOURCE_CONTEXTS = [
  {
    sourceId: "syncopated_low_air_425",
    sourcePath: "scripts/v0/trajectory/validation_specs/syncopated_low_air_425.ts",
    category: "low_air",
    role: "primary_low_air",
    targetGap: 12,
    expectedOutgoingFrames: 170,
    selectionRationale: "Late syncopated launch accent before the manually authored 4.25-second low-air reentry.",
  },
  {
    sourceId: "accelerating_low_air_475",
    sourcePath: "scripts/v0/trajectory/validation_specs/accelerating_low_air_475.ts",
    category: "low_air",
    role: "primary_low_air",
    targetGap: 15,
    expectedOutgoingFrames: 190,
    selectionRationale: "Contracting-cadence launch accent before the manually authored 4.75-second accelerating low-air reentry.",
  },
  {
    sourceId: "decelerating_low_air_625",
    sourcePath: "scripts/v0/trajectory/validation_specs/decelerating_low_air_625.ts",
    category: "low_air",
    role: "primary_low_air",
    targetGap: 13,
    expectedOutgoingFrames: 250,
    selectionRationale: "Expanding-cadence launch accent before the manually authored 6.25-second decelerating low-air reentry.",
  },
  {
    sourceId: "sparse_low_air_725",
    sourcePath: "scripts/v0/trajectory/validation_specs/sparse_low_air_725.ts",
    category: "low_air",
    role: "primary_low_air",
    targetGap: 12,
    expectedOutgoingFrames: 290,
    selectionRationale: "Sparse positive-impact launch before the manually authored 7.25-second low-air reentry.",
  },
  {
    sourceId: "ordinary_partial_axes_115",
    sourcePath: "scripts/v0/trajectory/validation_specs/ordinary_partial_axes_115.ts",
    category: "ordinary",
    role: "scope_control",
    targetGap: 14,
    expectedOutgoingFrames: 46,
    selectionRationale: "Ordinary irregular cadence with amplitude intentionally unspecified at the 1.15-second outgoing interval.",
  },
  {
    sourceId: "open_high_air_195",
    sourcePath: "scripts/v0/trajectory/validation_specs/open_high_air_195.ts",
    category: "ordinary",
    role: "scope_control",
    targetGap: 11,
    expectedOutgoingFrames: 78,
    selectionRationale: "Open high-air launch before the manually authored 1.95-second high-air reentry; a scope control, not a low-air benefit case.",
  },
] as const satisfies readonly SourceContext[];

export type LongCarrierReplicationPanelId =
  | "validation_long_carrier_syncopated_low_air_425_seed_730201"
  | "validation_long_carrier_syncopated_low_air_425_seed_730203"
  | "validation_long_carrier_accelerating_low_air_475_seed_730201"
  | "validation_long_carrier_accelerating_low_air_475_seed_730203"
  | "validation_long_carrier_decelerating_low_air_625_seed_730201"
  | "validation_long_carrier_decelerating_low_air_625_seed_730203"
  | "validation_long_carrier_sparse_low_air_725_seed_730201"
  | "validation_long_carrier_sparse_low_air_725_seed_730203"
  | "validation_long_carrier_ordinary_partial_axes_115_seed_730201"
  | "validation_long_carrier_ordinary_partial_axes_115_seed_730203"
  | "validation_long_carrier_open_high_air_195_seed_730201"
  | "validation_long_carrier_open_high_air_195_seed_730203";

export type LongCarrierReplicationCase = SourceContext & {
  id: LongCarrierReplicationPanelId;
  publicSeed: (typeof PUBLIC_SEEDS)[number];
};

const cases: readonly LongCarrierReplicationCase[] = [
  ...SOURCE_CONTEXTS.flatMap((source) => PUBLIC_SEEDS.map((publicSeed) => ({
    ...source,
    id: `validation_long_carrier_${source.sourceId}_seed_${publicSeed}` as LongCarrierReplicationPanelId,
    publicSeed,
  }))),
];

/**
 * The invocation grammar is part of the preregistration, not controller
 * convenience data. Paths are filled only after the immutable output root is
 * chosen; no caller may add a selector, budget, or alternate study entrypoint.
 */
export const LONG_CARRIER_REPLICATION_COMMAND_TEMPLATES = Object.freeze({
  capture: Object.freeze([
    "--import",
    "tsx",
    "scripts/v0/capture_long_carrier_replication_fixture.ts",
    "--case={id}",
    "--cohort=validation",
    "--budget=500000",
    "--out={fixture}",
  ]),
  assay: Object.freeze([
    "--import",
    "tsx",
    "scripts/v0/study_long_carrier_duration_response.ts",
    "--fixture={fixture}",
    "--out={assay}",
  ]),
});

export function longCarrierReplicationArtifactPaths(ordinal: number, id: string): {
  fixture: string;
  assay: string;
} {
  if (!Number.isSafeInteger(ordinal) || ordinal < 1) throw new Error("replication ordinal must be a positive safe integer");
  const prefix = String(ordinal).padStart(2, "0");
  return {
    fixture: `fixtures/${prefix}-${id}.json`,
    assay: `assays/${prefix}-${id}.json`,
  };
}

/** Exact child arguments, excluding the recorded Node executable. */
export function longCarrierReplicationCaptureArgv(entry: Pick<LongCarrierReplicationCase, "id">, fixturePath: string): string[] {
  return expandCommandTemplate(LONG_CARRIER_REPLICATION_COMMAND_TEMPLATES.capture, {
    id: entry.id,
    fixture: fixturePath,
  });
}

/** Arguments persisted by the capture artifact's `process.argv.slice(2)`. */
export function longCarrierReplicationCaptureScriptArgv(
  entry: Pick<LongCarrierReplicationCase, "id">,
  fixturePath: string,
): string[] {
  return scriptArgvAfterEntry(
    longCarrierReplicationCaptureArgv(entry, fixturePath),
    "scripts/v0/capture_long_carrier_replication_fixture.ts",
  );
}

/** Exact child arguments, excluding the recorded Node executable. */
export function longCarrierReplicationAssayArgv(fixturePath: string, assayPath: string): string[] {
  return expandCommandTemplate(LONG_CARRIER_REPLICATION_COMMAND_TEMPLATES.assay, {
    fixture: fixturePath,
    assay: assayPath,
  });
}

/** Arguments persisted by the assay artifact's `process.argv.slice(2)`. */
export function longCarrierReplicationAssayScriptArgv(fixturePath: string, assayPath: string): string[] {
  return scriptArgvAfterEntry(
    longCarrierReplicationAssayArgv(fixturePath, assayPath),
    "scripts/v0/study_long_carrier_duration_response.ts",
  );
}

/**
 * The controller's terminal verification is deliberately stricter than a
 * historical archive review: it must bind the just-created ledger to the
 * execution identity that captured it.
 */
export function longCarrierReplicationSelfVerifierArgv(outDir: string): string[] {
  return [
    "--import",
    "tsx",
    "scripts/v0/verify_long_carrier_replication.ts",
    `--out-dir=${outDir}`,
    "--require-current-identity",
  ];
}

function scriptArgvAfterEntry(nodeArgv: readonly string[], entryPath: string): string[] {
  if (nodeArgv[0] !== "--import" || nodeArgv[1] !== "tsx" || nodeArgv[2] !== entryPath) {
    throw new Error(`long-carrier command template has an invalid Node entrypoint for ${entryPath}`);
  }
  return nodeArgv.slice(3);
}

function expandCommandTemplate(
  template: readonly string[],
  values: Readonly<Record<string, string>>,
): string[] {
  return template.map((token) => token.replace(/\{([a-z]+)\}/g, (_whole, name: string) => {
    const value = values[name];
    if (value === undefined) throw new Error(`missing long-carrier command template value ${name}`);
    return value;
  }));
}

export const LONG_CARRIER_REPLICATION_PROTOCOL = Object.freeze({
  schema: LONG_CARRIER_REPLICATION_PROTOCOL_SCHEMA,
  scope: LONG_CARRIER_REPLICATION_SCOPE,
  purpose: "Prospective transfer test of the fixed straight long-carrier duration-response relation; not a compiler candidate, planner, or qualification score.",
  capture: Object.freeze({
    engine: "wasm",
    captureBudget: 500_000,
    relevantEnvironment: Object.freeze({ LR_ENGINE: "wasm" }),
    transform: Object.freeze({ kind: "production_felt_jolt", joltMs: -15 }),
    prefixProjectionRule: PHYSICAL_PREFIX_DONOR_SELECTION_RULE,
  }),
  authoringInputPaths: LONG_CARRIER_REPLICATION_AUTHORING_INPUT_PATHS,
  commandTemplates: LONG_CARRIER_REPLICATION_COMMAND_TEMPLATES,
  sources: Object.freeze(SOURCE_CONTEXTS.map((source) => Object.freeze({ ...source }))),
  cases: Object.freeze(cases.map((entry) => Object.freeze({ ...entry }))),
  decisionRule: Object.freeze({
    primaryRole: "primary_low_air",
    requiredSeedsPerSource: 2,
    minimumCompleteFiveArmRowsPerSeed: 1,
    fractions: LONG_CARRIER_REPLICATION_FRACTIONS,
    monotonicity: "every complete primary row must satisfy the fixed one-sample non-increasing-air predicate recomputed from the five declared fractions",
    endpointContrast: "each primary seed needs one complete row with no off-beat arm and f=0 minus f=1 air fraction greater than two measurement samples",
    controls: "scope controls must produce at least one structurally valid complete row and remain fully reported before support; they cannot replace a missing primary result, count as benefit, or overturn a completed primary falsification",
    speed: "terminal reference speed is reported as a secondary diagnostic only; this protocol establishes no continuation or next-contact criterion",
  }),
} as const);

/** Files that define the prospective cohort and must be committed before it runs. */
export const LONG_CARRIER_REPLICATION_DEFINITION_PATHS = Object.freeze([
  "scripts/v0/trajectory/long_carrier_replication_protocol.ts",
  "scripts/v0/trajectory/long_carrier_replication_input.ts",
  ...LONG_CARRIER_REPLICATION_AUTHORING_INPUT_PATHS,
  ...LONG_CARRIER_REPLICATION_PROTOCOL.sources.map((source) => source.sourcePath),
] as const);

/**
 * The committed, human-reviewable entrypoints that define this study. Their
 * recursive source closures are additionally fingerprinted in the immutable
 * declaration, because capture intentionally reaches the current compiler.
 */
export const LONG_CARRIER_REPLICATION_EXECUTION_DEFINITION_PATHS = Object.freeze([
  ...LONG_CARRIER_REPLICATION_DEFINITION_PATHS,
  "scripts/v0/run_long_carrier_replication.ts",
  "scripts/v0/verify_long_carrier_replication.ts",
  "scripts/v0/capture_long_carrier_replication_fixture.ts",
  "scripts/v0/study_long_carrier_duration_response.ts",
  "scripts/v0/trajectory/long_carrier_replication_assessment.ts",
  "scripts/v0/trajectory/long_carrier_replication_records.ts",
] as const);

export function longCarrierReplicationCaseById(id: string): LongCarrierReplicationCase {
  const entry = LONG_CARRIER_REPLICATION_PROTOCOL.cases.find((candidate) => candidate.id === id);
  if (entry === undefined) throw new Error(`unknown long-carrier replication panel ${id}`);
  return entry;
}

export function assertLongCarrierReplicationCase(input: {
  id: string;
  cohort: string;
  category: string;
  sourcePath: string;
  seed: number;
  targetGap: number;
  expectedOutgoingFrames?: number;
  selectionRationale: string;
  studyScope?: string;
}): LongCarrierReplicationCase {
  const expected = longCarrierReplicationCaseById(input.id);
  if (
    input.cohort !== "validation" ||
    input.category !== expected.category ||
    input.sourcePath !== expected.sourcePath ||
    input.seed !== expected.publicSeed ||
    input.targetGap !== expected.targetGap ||
    input.expectedOutgoingFrames !== expected.expectedOutgoingFrames ||
    input.selectionRationale !== expected.selectionRationale ||
    input.studyScope !== LONG_CARRIER_REPLICATION_SCOPE
  ) {
    throw new Error(`long-carrier replication panel ${input.id} does not match the preregistered scope`);
  }
  return expected;
}
