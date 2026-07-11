import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  developmentCases,
  qualificationCases,
  type CatalogEntry,
} from "../../benchmark/v2/catalog.ts";
import { benchmarkPolicy } from "../../benchmark/v2/policy.ts";

const COMPAT_DIR = resolve("benchmark/v2/compat");
const LOCK_PATH = resolve("benchmark/v2/catalog.lock.json");
const CASE_DEFINITION_FILES = [
  "benchmark/v2/catalog.ts",
  "benchmark/v2/policy.ts",
  "benchmark/v2/cases/case.ts",
  "benchmark/v2/variant_catalog.generated.ts",
  "scripts/benchmark/materialize_variants.ts",
];

const developmentEntries = developmentCases.map(manifestEntry);
const qualificationEntries = qualificationCases.map(manifestEntry);
const sourceManifest = {
  schema: "line.benchmark-v2.source-inventory.v4",
  status: "canonical-development-inventory",
  description: "Generated compatibility inventory. benchmark/v2/catalog.ts is the editable source of truth.",
  representative_candidates: developmentEntries.filter((entry) => entry.cohort === "representative").map(stripCohort),
  capability_candidates: developmentEntries.filter((entry) => entry.cohort === "capability").map(stripCohort),
  regression_candidates: developmentEntries.filter((entry) => entry.cohort === "regression").map(stripCohort),
  development_music_candidates: developmentEntries.filter((entry) => entry.cohort === "development_music").map(stripCohort),
};
const heldoutManifest = {
  schema: "line.benchmark-v2.qualification-registry.v2",
  status: "qualification-monitor",
  description: "Generated qualification registry. Qualification is a linked sidecar and never enters the optimization headline.",
  references: qualificationEntries.map(stripCohort),
};
const suiteManifest = {
  schema: "line.benchmark-v2.suite.v3",
  status: "selected-canonical-development-suite",
  description: "Generated compatibility policy. benchmark/v2/policy.ts is the editable source of truth.",
  strata: benchmarkPolicy.strata.map((stratum) => ({
    id: stratum.id,
    weight: stratum.weight,
    groups: stratum.groups.map((group) => ({
      id: group.id,
      weight: group.weight,
      members: group.parents.flatMap(parentMembers),
      parents: group.parents.map((parent) => ({
        id: parent,
        members: parentMembers(parent),
      })),
    })),
  })),
  component_weights: benchmarkPolicy.componentWeights,
  axis_quality_tolerance: benchmarkPolicy.axisQualityTolerance,
  transform: { kind: benchmarkPolicy.transform.kind, jolt_ms: benchmarkPolicy.transform.joltMs },
  seed_policy: {
    kind: benchmarkPolicy.seedPolicy.kind,
    profile_seed_bases: benchmarkPolicy.seedPolicy.profileSeedBases,
  },
  profiles: {
    probe: {
      budgets: [...benchmarkPolicy.profiles.probe.budgets],
      seeds_per_budget: benchmarkPolicy.profiles.probe.seedsPerBudget,
    },
    canonical: {
      budgets: [...benchmarkPolicy.profiles.canonical.budgets],
      seeds_per_budget: benchmarkPolicy.profiles.canonical.seedsPerBudget,
    },
  },
  budget_weights: benchmarkPolicy.budgetWeights,
};

const lockWithoutFingerprint = {
  schema: "line.benchmark-v2.catalog-lock.v1",
  status: benchmarkPolicy.status,
  source: "benchmark/v2/catalog.ts",
  policy: "benchmark/v2/policy.ts",
  definitionFiles: CASE_DEFINITION_FILES,
  development: developmentEntries,
  qualification: qualificationEntries,
  profiles: benchmarkPolicy.profiles,
  strata: benchmarkPolicy.strata,
};
const outputs: Array<{ path: string; content: string }> = [
  { path: resolve(COMPAT_DIR, "source-manifest.json"), content: renderJson(sourceManifest) },
  { path: resolve(COMPAT_DIR, "heldout-manifest.json"), content: renderJson(heldoutManifest) },
  { path: resolve(COMPAT_DIR, "suite-manifest.json"), content: renderJson(suiteManifest) },
  {
    path: LOCK_PATH,
    content: renderJson({
      ...lockWithoutFingerprint,
      fingerprint: hashJsonAndFiles(lockWithoutFingerprint, [
        ...CASE_DEFINITION_FILES,
        ...developmentCases.flatMap(sourceFiles),
        ...qualificationCases.flatMap(sourceFiles),
      ]),
    }),
  },
];

if (process.argv.includes("--check")) {
  const drifted = outputs.filter((output) => {
    try {
      return readFileSync(output.path, "utf8") !== output.content;
    } catch {
      return true;
    }
  });
  if (drifted.length > 0) {
    for (const output of drifted) console.error(`catalog drift: ${relativeToCwd(output.path)} does not match a regeneration from the typed catalog/policy`);
    console.error(`run \`node --import tsx scripts/benchmark/sync_catalog.ts\` to regenerate (this changes the suite fingerprint)`);
    process.exit(1);
  }
  console.log(`catalog check: ${outputs.length} generated files match the typed catalog and policy`);
} else {
  mkdirSync(COMPAT_DIR, { recursive: true });
  for (const output of outputs) {
    mkdirSync(dirname(output.path), { recursive: true });
    writeFileSync(output.path, output.content);
  }
  console.log(`Catalog: ${developmentCases.length} development (${developmentCases.filter((entry) => entry.case.metadata.variant !== undefined).length} variants), ${qualificationCases.length} qualification`);
  console.log(`Lock: benchmark/v2/catalog.lock.json`);
  console.log(`Compatibility: benchmark/v2/compat/`);
}

function manifestEntry(entry: CatalogEntry): any {
  const metadata = entry.case.metadata;
  const score = entry.case.scoreDocument;
  return {
    cohort: metadata.cohort,
    id: metadata.id,
    module: entry.sourcePath,
    source_files: sourceFiles(entry),
    origin_family: metadata.originFamily,
    music_backed: metadata.musicBacked,
    music_work_id: metadata.musicWorkId,
    reference_pulse_seconds: metadata.referencePulseSeconds,
    eligible_components: metadata.eligibleComponents,
    diagnostic_components: metadata.diagnosticComponents ?? [],
    notes: metadata.notes,
    case_metadata: {
      title: metadata.title,
      parent_id: metadata.variant?.parentId,
      variant: metadata.variant === undefined ? undefined : {
        kind: metadata.variant.kind,
        rationale: metadata.variant.rationale,
        parameters: metadata.variant.parameters,
      },
      diagnostic_tags: score?.diagnostic_tags ?? (metadata.variant === undefined ? [metadata.cohort] : [metadata.cohort, "materialized_variant"]),
      provenance_kind: metadata.variant === undefined
        ? score?.provenance.kind ?? (metadata.cohort === "qualification" ? "qualification_reference" : "materialized_music")
        : "materialized_parent_specific_variant",
      phases: metadata.phases,
      event_role_counts: score === undefined ? {} : eventRoleCounts(score),
    },
  };
}

function stripCohort(entry: any): any {
  const { cohort: _cohort, ...rest } = entry;
  return removeUndefined(rest);
}

function sourceFiles(entry: CatalogEntry): string[] {
  return [...new Set([entry.sourcePath, ...(entry.dependencies ?? [])])];
}

function parentMembers(parentId: string): string[] {
  const members = developmentCases.filter((entry) =>
    entry.case.metadata.id === parentId || entry.case.metadata.variant?.parentId === parentId
  ).map((entry) => entry.case.metadata.id);
  if (members.length === 0 || members[0] !== parentId) throw new Error(`${parentId}: base case or ordered variants missing`);
  return members;
}

function eventRoleCounts(document: NonNullable<BenchmarkCaseLike["scoreDocument"]>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const placement of document.placements) {
    for (const event of document.phrases[placement.phrase]) counts[event.role] = (counts[event.role] ?? 0) + 1;
  }
  for (const event of document.events ?? []) counts[event.role] = (counts[event.role] ?? 0) + 1;
  return counts;
}

type BenchmarkCaseLike = CatalogEntry["case"];

function renderJson(value: unknown): string {
  return `${JSON.stringify(removeUndefined(value), null, 2)}\n`;
}

function relativeToCwd(path: string): string {
  const prefix = `${process.cwd()}/`;
  return path.startsWith(prefix) ? path.slice(prefix.length) : path;
}

function removeUndefined<T>(value: T): T {
  if (Array.isArray(value)) return value.map(removeUndefined) as T;
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).flatMap(([key, child]) =>
      child === undefined ? [] : [[key, removeUndefined(child)]]
    )) as T;
  }
  return value;
}

function hashJsonAndFiles(value: unknown, paths: string[]): string {
  const hash = createHash("sha256").update(JSON.stringify(value));
  for (const path of [...new Set(paths)].sort()) {
    hash.update(`\0${path}\0`);
    hash.update(readFileSync(path));
  }
  return hash.digest("hex");
}
