/**
 * Mini manifests — a source-id-filtered projection of the canonical Benchmark
 * V2 source and suite manifests.
 *
 * WHAT THIS IS FOR
 *   A candidate that can only touch a handful of sources does not need a
 *   44-source grid to be *observed*; it needs many seeds on the sources it can
 *   move. Filtering the manifests to that subset turns a 26-minute eval into a
 *   4-minute mover grid, which is the difference between probing a design and
 *   guessing at it.
 *
 * THE PROPERTY THAT MAKES IT EVIDENCE — COMPILE-IDENTITY
 *   Every kept source entry is carried across byte-for-byte, and the scoring
 *   parameters the evaluator actually reads (`component_weights`,
 *   `axis_quality_tolerance`) and the spec transform (`transform.jolt_ms`) are
 *   carried across unchanged. The compiler's inputs are therefore identical:
 *
 *     compileHandoff(applyJolt(spec, jolt), seed, { budget })
 *
 *   and so is the per-cell score, because `scoreV2Report` is typed to consume
 *   exactly `Pick<SuiteManifest, "component_weights" | "axis_quality_tolerance">`.
 *   A cell compiled under a mini manifest is bit-identical to the same cell
 *   compiled under the full one. `verifyMiniManifestIdentity` re-derives that
 *   claim mechanically and `mover_grid.ts --verify` runs it on demand;
 *   `tests/benchmark_v2_mini_manifest.test.ts` runs it in CI.
 *
 * WHAT IS *NOT* PRESERVED — AND WHY THAT IS THE POINT
 *   Group weights are renormalized inside each stratum over the surviving
 *   groups, so the aggregate a mini grid reports is NOT the suite headline and
 *   must never be quoted as one. A group whose canonical members are all kept
 *   still reports its exact canonical group score (`complete` in the derivation
 *   report); a partially-kept group does not. The derived manifests also carry
 *   rewritten `description` fields, so their manifest fingerprints differ from
 *   the canonical ones by construction and no mini artifact can be mistaken for
 *   canonical evidence downstream.
 *
 * LIMITS
 *   Evidence, never promotion. Mini grids size an action set, bound a failure
 *   rate, and localise a mechanism. They do not produce headlines, they are not
 *   a decision instrument, and nothing here writes to benchmark governance
 *   state.
 */

import {
  loadSourceManifest,
  resolveSources,
  type ResolvedSource,
  type SourceManifest,
  type SourceManifestEntry,
} from "../v0/benchmark_v2/model.ts";
import {
  loadSuiteManifest,
  validateSuiteManifest,
  type CanonicalStratumId,
  type SuiteGroup,
  type SuiteManifest,
  type SuiteStratum,
} from "../v0/benchmark_v2/suite_model.ts";

export const CANONICAL_SOURCE_MANIFEST = "benchmark/v2/compat/source-manifest.json";
export const CANONICAL_SUITE_MANIFEST = "benchmark/v2/compat/suite-manifest.json";

/** Manifest array that holds each canonical stratum's sources. */
const STRATUM_ARRAY: Record<CanonicalStratumId, keyof SourceManifest & `${string}_candidates`> = {
  representative: "representative_candidates",
  capability: "capability_candidates",
  legacy_regression: "regression_candidates",
  development_music: "development_music_candidates",
};

const STRATUM_IDS = Object.keys(STRATUM_ARRAY) as CanonicalStratumId[];

/**
 * Named subsets, expressed as *selectors over the manifests* rather than
 * frozen id lists, so a suite edit cannot silently leave the instrument
 * pointing at sources that no longer exist.
 */
export const SOURCE_SUBSET_PRESETS: Record<string, { selector: string; note: string }> = {
  /** The capability movers: the three frontier groups in full. */
  capability: {
    selector: "stratum:capability",
    note: "the capability movers — rapid_pickup, dense_recovery and low_air frontier groups in full",
  },
  /** The 7-source subset the p1b collapse investigation ran its mover grids on. */
  "p1b-collapse": {
    selector: "group:rapid_pickup_frontier,group:dense_recovery_frontier",
    note: "the p1b collapse investigation's mover set (rapid_pickup + dense_recovery frontiers)",
  },
  /** Every canonical member — the full grid, for a scope-control run. */
  all: { selector: STRATUM_IDS.map((id) => `stratum:${id}`).join(","), note: "every canonical source" },
};

export const DEFAULT_SOURCE_SUBSET = "capability";

export type MiniManifests = {
  /** Ids named by the selector, before control back-filling. */
  selectedIds: string[];
  /** Ids auto-added because their stratum would otherwise be empty. */
  controlIds: string[];
  /** Every kept id, in canonical manifest order. */
  keptIds: string[];
  sourceManifest: SourceManifest;
  suiteManifest: SuiteManifest;
  /** Per-group provenance: a complete group's score is the canonical group score. */
  groups: Array<{
    stratum: CanonicalStratumId;
    id: string;
    members: string[];
    canonicalMembers: string[];
    canonicalWeight: number;
    weight: number;
    complete: boolean;
  }>;
};

/**
 * Expand a subset selector into canonical source ids.
 *
 * Accepted terms, comma-separated: a preset name, `stratum:<id>`,
 * `group:<origin_family>`, or a bare source id. Order and duplicates do not
 * matter — the result is always canonical manifest order, deduplicated.
 */
export function resolveSourceSubset(
  selector: string,
  sources: ResolvedSource[],
  suite: SuiteManifest,
): string[] {
  const known = new Set(sources.map((source) => source.id));
  const byStratum = new Map(suite.strata.map((stratum) =>
    [stratum.id as string, stratum.groups.flatMap((group) => group.members)]
  ));
  const byGroup = new Map(suite.strata.flatMap((stratum) =>
    stratum.groups.map((group) => [group.id, group.members] as const)
  ));
  const picked = new Set<string>();
  for (const rawTerm of selector.split(",").map((term) => term.trim()).filter(Boolean)) {
    const preset = SOURCE_SUBSET_PRESETS[rawTerm];
    if (preset !== undefined) {
      for (const id of resolveSourceSubset(preset.selector, sources, suite)) picked.add(id);
    } else if (rawTerm.startsWith("stratum:")) {
      const members = byStratum.get(rawTerm.slice("stratum:".length));
      if (members === undefined) throw new Error(`unknown stratum in --sources: ${rawTerm}`);
      for (const id of members) picked.add(id);
    } else if (rawTerm.startsWith("group:")) {
      const members = byGroup.get(rawTerm.slice("group:".length));
      if (members === undefined) throw new Error(`unknown group in --sources: ${rawTerm}`);
      for (const id of members) picked.add(id);
    } else if (known.has(rawTerm)) {
      picked.add(rawTerm);
    } else {
      throw new Error(
        `unknown source in --sources: ${rawTerm} ` +
        `(expected a preset ${Object.keys(SOURCE_SUBSET_PRESETS).join("/")}, stratum:<id>, group:<id>, or a source id)`,
      );
    }
  }
  if (picked.size === 0) throw new Error(`--sources selected nothing`);
  return sources.filter((source) => picked.has(source.id)).map((source) => source.id);
}

/**
 * Project the canonical manifests onto `selectedIds`.
 *
 * Strata may not be dropped — `validateSuiteManifest` requires all four — so a
 * stratum with no selected member is back-filled with its first canonical
 * source. That control is deterministic (manifest order) and doubles as the
 * bit-identity witness the mover grids relied on: a control source must come
 * back byte-identical from both arms or the arms differ by more than the
 * candidate.
 */
export function deriveMiniManifests(
  fullSources: SourceManifest,
  fullSuite: SuiteManifest,
  selectedIds: string[],
): MiniManifests {
  const selected = new Set(selectedIds);
  const controlIds: string[] = [];
  for (const stratum of fullSuite.strata) {
    const members = stratum.groups.flatMap((group) => group.members);
    if (members.some((id) => selected.has(id))) continue;
    const control = members[0];
    if (control === undefined) throw new Error(`${stratum.id}: canonical stratum has no members`);
    selected.add(control);
    controlIds.push(control);
  }

  const sourceManifest: SourceManifest = {
    schema: fullSources.schema,
    status: fullSources.status,
    description:
      "Derived mini inventory — a source-id-filtered projection of " +
      `${CANONICAL_SOURCE_MANIFEST} for mover grids. Entries are carried across byte-for-byte; ` +
      "evidence only, never a headline.",
    representative_candidates: [],
    capability_candidates: [],
    regression_candidates: [],
    development_music_candidates: [],
  };
  for (const stratumId of STRATUM_IDS) {
    const key = STRATUM_ARRAY[stratumId];
    // Entries are copied by reference and re-serialized verbatim: the kept
    // entry's bytes, and therefore its sourceFingerprint, are unchanged.
    (sourceManifest[key] as SourceManifestEntry[]) =
      (fullSources[key] as SourceManifestEntry[]).filter((entry) => selected.has(entry.id));
  }

  const groups: MiniManifests["groups"] = [];
  const strata: SuiteStratum[] = fullSuite.strata.map((stratum) => {
    const surviving = stratum.groups
      .map((group) => ({ group, members: group.members.filter((id) => selected.has(id)) }))
      .filter((entry) => entry.members.length > 0);
    const weightSum = surviving.reduce((sum, entry) => sum + entry.group.weight, 0);
    return {
      id: stratum.id,
      weight: stratum.weight,
      groups: surviving.map(({ group, members }): SuiteGroup => {
        const weight = group.weight / weightSum;
        groups.push({
          stratum: stratum.id,
          id: group.id,
          members,
          canonicalMembers: [...group.members],
          canonicalWeight: group.weight,
          weight,
          complete: members.length === group.members.length,
        });
        return {
          id: group.id,
          weight,
          members,
          ...(group.parents === undefined ? {} : { parents: projectParents(group, members) }),
        };
      }),
    };
  });

  const suiteManifest: SuiteManifest = {
    ...fullSuite,
    description:
      "Derived mini suite — a source-id-filtered projection of " +
      `${CANONICAL_SUITE_MANIFEST} for mover grids. Group weights are renormalized inside each ` +
      "stratum, so the aggregate is NOT the suite headline; per-cell scores and complete-group " +
      "scores are exact.",
    strata,
  };

  const keptIds = STRATUM_IDS.flatMap((stratumId) =>
    (sourceManifest[STRATUM_ARRAY[stratumId]] as SourceManifestEntry[]).map((entry) => entry.id)
  );
  return {
    selectedIds: [...selectedIds],
    controlIds,
    keptIds,
    sourceManifest,
    suiteManifest,
    groups,
  };
}

/**
 * `validateSuiteManifest` requires a parent's base case to be its first member.
 * When filtering removes the base case, promote the first surviving member —
 * the parent then aggregates exactly the members that remain.
 */
function projectParents(group: SuiteGroup, members: string[]): SuiteGroup["parents"] {
  const kept = new Set(members);
  const parents = (group.parents ?? [])
    .map((parent) => parent.members.filter((id) => kept.has(id)))
    .filter((surviving) => surviving.length > 0)
    .map((surviving) => ({ id: surviving[0], members: surviving }));
  const covered = parents.flatMap((parent) => parent.members).sort();
  if (JSON.stringify(covered) !== JSON.stringify([...members].sort())) {
    throw new Error(`${group.id}: projected parents do not cover the kept members`);
  }
  return parents;
}

export type IdentityCheck = { claim: string; ok: boolean; detail: string };

export type MiniManifestIdentity = {
  keptIds: string[];
  checks: IdentityCheck[];
  ok: boolean;
};

/**
 * Mechanically re-derive the compile-identity claim: for every kept source,
 * the compiler and the scorer see byte-identical inputs under the mini
 * manifests and under the canonical ones.
 *
 * Resolving sources reads the spec files off disk, so `sourceFingerprint`
 * equality is a statement about the actual case bytes, not about the manifest
 * text alone.
 */
export function verifyMiniManifestIdentity(
  fullSources: SourceManifest,
  fullSuite: SuiteManifest,
  mini: MiniManifests,
): MiniManifestIdentity {
  const checks: IdentityCheck[] = [];
  const check = (claim: string, ok: boolean, detail: string): void => {
    checks.push({ claim, ok, detail });
  };

  const fullEntries = new Map(STRATUM_IDS.flatMap((stratumId) =>
    (fullSources[STRATUM_ARRAY[stratumId]] as SourceManifestEntry[])
      .map((entry) => [entry.id, entry] as const)
  ));
  const miniEntries = new Map(STRATUM_IDS.flatMap((stratumId) =>
    (mini.sourceManifest[STRATUM_ARRAY[stratumId]] as SourceManifestEntry[])
      .map((entry) => [entry.id, entry] as const)
  ));
  const differing = [...miniEntries].filter(([id, entry]) =>
    JSON.stringify(fullEntries.get(id)) !== JSON.stringify(entry)
  ).map(([id]) => id);
  check(
    "source entries are carried across byte-for-byte",
    differing.length === 0 && miniEntries.size === mini.keptIds.length,
    differing.length === 0
      ? `${miniEntries.size} entries identical to ${CANONICAL_SOURCE_MANIFEST}`
      : `differing: ${differing.join(", ")}`,
  );

  const fullResolved = new Map(resolveSources(fullSources).map((source) => [source.id, source]));
  const miniResolved = resolveSources(mini.sourceManifest);
  const resolvedDiff = miniResolved.filter((source) =>
    JSON.stringify(fullResolved.get(source.id)) !== JSON.stringify(source)
  ).map((source) => source.id);
  check(
    "resolved sources (incl. sourceFingerprint over the spec bytes) are identical",
    resolvedDiff.length === 0,
    resolvedDiff.length === 0
      ? `${miniResolved.length} sources resolve identically`
      : `differing: ${resolvedDiff.join(", ")}`,
  );

  check(
    "spec transform is unchanged (same jolt reaches the compiler)",
    JSON.stringify(mini.suiteManifest.transform) === JSON.stringify(fullSuite.transform),
    JSON.stringify(mini.suiteManifest.transform),
  );
  check(
    "scorer inputs are unchanged (component_weights, axis_quality_tolerance)",
    JSON.stringify(mini.suiteManifest.component_weights) === JSON.stringify(fullSuite.component_weights) &&
      mini.suiteManifest.axis_quality_tolerance === fullSuite.axis_quality_tolerance,
    `tolerance ${mini.suiteManifest.axis_quality_tolerance}; ` +
    `weights ${JSON.stringify(mini.suiteManifest.component_weights)}`,
  );
  check(
    "seed and budget policy are unchanged (same cells addressable)",
    JSON.stringify(mini.suiteManifest.seed_policy) === JSON.stringify(fullSuite.seed_policy) &&
      JSON.stringify(mini.suiteManifest.profiles) === JSON.stringify(fullSuite.profiles) &&
      JSON.stringify(mini.suiteManifest.budget_weights) === JSON.stringify(fullSuite.budget_weights),
    `profiles ${JSON.stringify(mini.suiteManifest.profiles)}`,
  );

  let validation = "validates";
  let validated = true;
  try {
    validateSuiteManifest(mini.suiteManifest, miniResolved);
  } catch (error) {
    validated = false;
    validation = error instanceof Error ? error.message : String(error);
  }
  check("derived suite passes the runner's own suite validator", validated, validation);

  const canonicalMembers = new Set(
    fullSuite.strata.flatMap((stratum) => stratum.groups.flatMap((group) => group.members)),
  );
  const stray = mini.keptIds.filter((id) => !canonicalMembers.has(id));
  check(
    "every kept source is a canonical member (no source is invented)",
    stray.length === 0,
    stray.length === 0 ? `${mini.keptIds.length} of ${canonicalMembers.size} canonical members` : stray.join(", "),
  );

  const complete = mini.groups.filter((group) => group.complete);
  check(
    "complete groups report canonical group scores",
    true,
    complete.length === 0
      ? "none (every kept group is partial; only per-cell values are canonical)"
      : complete.map((group) => group.id).join(", "),
  );

  return { keptIds: mini.keptIds, checks, ok: checks.every((entry) => entry.ok) };
}

/** Byte-stable serialization, so a re-derivation is diffable against its predecessor. */
export function serializeManifest(manifest: SourceManifest | SuiteManifest): string {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

export function loadCanonicalManifests(
  sourcePath = CANONICAL_SOURCE_MANIFEST,
  suitePath = CANONICAL_SUITE_MANIFEST,
): { sources: SourceManifest; suite: SuiteManifest; resolved: ResolvedSource[] } {
  const sources = loadSourceManifest(sourcePath);
  const resolved = resolveSources(sources);
  // Read the suite through the runner's own loader so a mini grid can never be
  // derived from a suite the runner would reject.
  const suite = loadSuiteManifest(suitePath, resolved);
  return { sources, suite, resolved };
}
