import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type { ResolvedSource, SourceRole } from "./model.ts";

export const SUITE_MANIFEST_SCHEMA = "line.benchmark-v2.suite.v2" as const;

export type ComponentName = "air" | "speed" | "impact" | "amplitude";
export type CanonicalStratumId =
  | "representative"
  | "capability"
  | "legacy_regression"
  | "development_music";

export type SuiteParent = { id: string; members: string[] };
export type SuiteGroup = {
  id: string;
  weight: number;
  members: string[];
  parents?: SuiteParent[];
};
export type SuiteStratum = { id: CanonicalStratumId; weight: number; groups: SuiteGroup[] };

export type SuiteManifest = {
  schema: typeof SUITE_MANIFEST_SCHEMA;
  status: "selected-canonical-development-suite";
  description: string;
  strata: SuiteStratum[];
  component_weights: Record<ComponentName, number>;
  axis_quality_tolerance: number;
  transform: { kind: "production_felt_jolt"; jolt_ms: number };
  seed_policy: { kind: "budget_disjoint_contiguous"; seed_base: number };
  profiles: Record<"probe" | "canonical", { budgets: number[]; seeds_per_budget: number }>;
  budget_weights: Array<{ budget: number; weight: number }>;
};

export type SuiteIdentity = {
  suiteFingerprint: string;
  suiteManifestFingerprint: string;
  sourceManifestFingerprint: string;
  definitionFingerprint: string;
};

export type ResolvedSeedSchedule = {
  kind: "budget_disjoint_contiguous";
  seedBase: number;
  seedsPerBudget: number;
  byBudget: Array<{ budget: number; actualSeeds: number[] }>;
};

export type ExecutionPolicyIdentity = {
  executionPolicyFingerprint: string;
  suiteFingerprint: string;
  harnessFingerprint: string;
  engine: string;
  compiler: string;
  profile: "probe" | "canonical";
  budgets: number[];
  seedSchedule: ResolvedSeedSchedule;
  sources: Array<{ id: string; role: SourceRole; sourceFingerprint: string }>;
  transform: SuiteManifest["transform"];
};

export const BENCHMARK_DEFINITION_SOURCE_FILES = [
  "benchmark/v2/cases/case.ts",
  "benchmark/v2/catalog.ts",
  "benchmark/v2/policy.ts",
  "benchmark/v2/variant_catalog.generated.ts",
  "scripts/v0/benchmark_v2/evaluator.ts",
  "scripts/v0/benchmark_v2/suite_model.ts",
  "scripts/v0/benchmark_v2/score_model.ts",
  "scripts/v0/benchmark_v2/model.ts",
  "scripts/v0/core/substrate.ts",
  "scripts/v0/core/measure.ts",
  "scripts/v0/core/beats.ts",
  "scripts/v0/core/curves.ts",
  "scripts/v0/types.ts",
  "scripts/produce/seed.ts",
] as const;

export const HARNESS_SOURCE_FILES = [
  "scripts/v0/benchmark_v2/runner.ts",
  "scripts/v0/golden_suite.ts",
] as const;

export const DECISION_SOURCE_FILES = [
  "scripts/v0/benchmark_v2/decide.ts",
  "scripts/v0/benchmark_v2/decision_model.ts",
] as const;

export function loadSuiteManifest(path: string, sources?: ResolvedSource[]): SuiteManifest {
  const parsed = JSON.parse(readFileSync(path, "utf8")) as SuiteManifest;
  if (
    parsed.schema !== SUITE_MANIFEST_SCHEMA ||
    parsed.status !== "selected-canonical-development-suite"
  ) {
    throw new Error(`unsupported or unfrozen V2 suite manifest`);
  }
  validateSuiteManifest(parsed, sources);
  return parsed;
}

export function validateSuiteManifest(suite: SuiteManifest, sources?: ResolvedSource[]): void {
  if (suite.strata.length === 0) throw new Error(`suite needs canonical strata`);
  assertUnique(suite.strata.map((stratum) => stratum.id), "stratum ids");
  assertSameSet(
    suite.strata.map((stratum) => stratum.id),
    ["representative", "capability", "legacy_regression", "development_music"],
    "canonical strata",
  );
  assertSum(suite.strata.map((stratum) => stratum.weight), 1, "stratum weights");
  const groups = suite.strata.flatMap((stratum) => stratum.groups);
  assertUnique(groups.map((group) => group.id), "group ids");
  for (const stratum of suite.strata) {
    if (stratum.groups.length === 0) throw new Error(`${stratum.id}: needs coverage groups`);
    assertSum(stratum.groups.map((group) => group.weight), 1, `${stratum.id} group weights`);
    for (const group of stratum.groups) {
      if (group.members.length < 1) throw new Error(`${group.id}: needs at least one member`);
      assertUnique(group.members, `${group.id} members`);
      if (group.parents !== undefined) {
        if (group.parents.length < 1) throw new Error(`${group.id}: needs at least one parent`);
        assertUnique(group.parents.map((parent) => parent.id), `${group.id} parent ids`);
        for (const parent of group.parents) {
          if (parent.members.length < 1) throw new Error(`${group.id}/${parent.id}: needs at least one member`);
          if (parent.members[0] !== parent.id) {
            throw new Error(`${group.id}/${parent.id}: base case must be the first parent member`);
          }
          assertUnique(parent.members, `${group.id}/${parent.id} members`);
        }
        assertSameSet(
          group.parents.flatMap((parent) => parent.members),
          group.members,
          `${group.id} parent membership`,
        );
      }
    }
  }
  assertUnique(groups.flatMap((group) => group.members), "canonical members");
  assertSum(Object.values(suite.component_weights), 1, "component weights");
  if (!finitePositive(suite.axis_quality_tolerance)) throw new Error(`invalid axis quality tolerance`);
  if (!Number.isFinite(suite.transform.jolt_ms)) throw new Error(`invalid jolt`);
  if (
    suite.seed_policy.kind !== "budget_disjoint_contiguous" ||
    !Number.isSafeInteger(suite.seed_policy.seed_base) || suite.seed_policy.seed_base < 0
  ) {
    throw new Error(`invalid seed policy`);
  }
  for (const profileName of ["probe", "canonical"] as const) {
    const profile = suite.profiles[profileName];
    if (
      profile === undefined || !Array.isArray(profile.budgets) || profile.budgets.length === 0 ||
      profile.budgets.some((budget) => !Number.isSafeInteger(budget) || budget <= 0) ||
      new Set(profile.budgets).size !== profile.budgets.length ||
      !Number.isSafeInteger(profile.seeds_per_budget) || profile.seeds_per_budget < 1
    ) {
      throw new Error(`${profileName}: invalid budget/seed profile`);
    }
  }
  assertUnique(suite.budget_weights.map((entry) => String(entry.budget)), "budget weight keys");
  assertSum(suite.budget_weights.map((entry) => entry.weight), 1, "budget weights");
  assertSameSet(
    suite.budget_weights.map((entry) => String(entry.budget)),
    suite.profiles.canonical.budgets.map(String),
    "canonical budget weights",
  );
  if (sources !== undefined) validateSourceMembership(suite, sources);
}

export function suiteIdentity(
  suitePath: string,
  sourceManifestPath: string,
  sources: ResolvedSource[],
): SuiteIdentity {
  const suiteContents = readFileSync(suitePath, "utf8");
  const sourceContents = readFileSync(sourceManifestPath, "utf8");
  const definitionFingerprint = hashFiles([...BENCHMARK_DEFINITION_SOURCE_FILES]);
  const sourceFingerprints = [...sources]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((source) => `${source.id}\0${source.role}\0${source.sourceFingerprint}`)
    .join("\0");
  const suiteManifestFingerprint = sha256(suiteContents);
  const sourceManifestFingerprint = sha256(sourceContents);
  return {
    suiteManifestFingerprint,
    sourceManifestFingerprint,
    definitionFingerprint,
    suiteFingerprint: sha256([
      suiteManifestFingerprint,
      sourceManifestFingerprint,
      definitionFingerprint,
      sourceFingerprints,
    ].join("\0")),
  };
}

export function canonicalMembers(suite: Pick<SuiteManifest, "strata">): string[] {
  return suite.strata.flatMap((stratum) => stratum.groups.flatMap((group) => group.members));
}

export function resolvedSeedSchedule(
  suite: Pick<SuiteManifest, "seed_policy">,
  budgets: number[],
  seedsPerBudget: number,
): ResolvedSeedSchedule {
  return {
    kind: suite.seed_policy.kind,
    seedBase: suite.seed_policy.seed_base,
    seedsPerBudget,
    byBudget: budgets.map((budget, budgetIndex) => ({
      budget,
      actualSeeds: Array.from(
        { length: seedsPerBudget },
        (_, seedSlot) => suite.seed_policy.seed_base + seedSlot + budgetIndex * seedsPerBudget,
      ),
    })),
  };
}

export function executionPolicyIdentity(input: Omit<ExecutionPolicyIdentity, "executionPolicyFingerprint">): ExecutionPolicyIdentity {
  return {
    ...input,
    executionPolicyFingerprint: sha256(JSON.stringify(input)),
  };
}

export function sourceInventoryFingerprint(contents: string): string {
  return sha256(contents);
}

export function fingerprintFiles(paths: readonly string[]): string {
  return hashFiles([...paths]);
}

function validateSourceMembership(suite: SuiteManifest, sources: ResolvedSource[]): void {
  const byId = new Map(sources.map((source) => [source.id, source]));
  assertSameSet(canonicalMembers(suite), sources.map((source) => source.id), "canonical source membership");
  for (const stratum of suite.strata) {
    const expectedRole = roleForStratum(stratum.id);
    for (const group of stratum.groups) {
      for (const id of group.members) {
        const source = byId.get(id);
        if (source?.role !== expectedRole) {
          throw new Error(`${id}: role ${source?.role ?? "missing"} does not match ${stratum.id}`);
        }
        if (source.originFamily !== group.id) {
          throw new Error(`${id}: source family ${source.originFamily} != ${group.id}`);
        }
      }
    }
  }
}

function roleForStratum(stratum: CanonicalStratumId): SourceRole {
  if (stratum === "representative") return "representative_candidate";
  if (stratum === "capability") return "capability_candidate";
  if (stratum === "legacy_regression") return "regression_candidate";
  return "development_music_candidate";
}

function hashFiles(paths: string[]): string {
  const hash = createHash("sha256");
  for (const path of [...paths].sort()) {
    hash.update(`${path.length}:${path}\0`);
    hash.update(readFileSync(path));
    hash.update("\0");
  }
  return hash.digest("hex");
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function finitePositive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function assertSum(values: number[], expected: number, label: string): void {
  const total = values.reduce((sum, value) => sum + value, 0);
  if (values.some((value) => !finitePositive(value)) || Math.abs(total - expected) > 1e-9) {
    throw new Error(`${label} must be positive and sum to ${expected}; got ${total}`);
  }
}

function assertUnique(values: string[], label: string): void {
  if (new Set(values).size !== values.length) throw new Error(`${label} must be unique`);
}

function assertSameSet(actual: string[], expected: string[], label: string): void {
  const a = [...actual].sort();
  const b = [...expected].sort();
  if (a.length !== b.length || a.some((value, index) => value !== b[index])) {
    throw new Error(`${label} mismatch`);
  }
}
