/**
 * low_budget_reading — the standing 250k evidence reading.
 *
 * WHY THIS EXISTS  (budget dividends plan, Phase 0b, DECIDED 2026-08-03)
 *   The promoting instrument runs at 750k only. Everything the campaign has
 *   learned says the interesting behaviour is below it: ROI goes as B^-1.22, the
 *   only ROI hypothesis that ever cleared the eval-slot floor lives at
 *   150k-300k, and the rescue class — a compile that fails at low budget and is
 *   healed by a mechanism — cannot appear at 750k on the promotion ladder's own
 *   seeds at all, because there the capability sources are already all valid
 *   (`docs/budget-aware-map.md` §6.2). A lever whose whole value is rescuing
 *   compiles that fail was, structurally, invisible to us.
 *
 *   The owner's choice for 0b was option (ii): a second surface that is
 *   **tracked but never promoting**. This command is that surface. It is a
 *   standing reading, published alongside the campaign loop, run after an eval
 *   — not a gate, not a headline, and not wired into the eval chain.
 *
 * WHY 250k AND NOT 300k
 *   300k WAS the edge of the remaining-work estimator's calibrated domain, and
 *   that is an argument about a *model*, not about the compiler. This reading
 *   is evidence: it wants the regime where completions are actually at risk, so
 *   that a rescue has something to rescue and a loss has something to lose.
 *   (The model question has since resolved the same way: the estimator's domain
 *   floor moved to 250k on 2026-08-03, so this operating point reads calibrated
 *   margins. That is a convenience, not the reason the budget was chosen.)
 *   250k is where the measurement that motivated this decision was taken (the
 *   Phase-1 rescue-class reading: capability +112.9 with 11 completions gained),
 *   it is a member of the canonical suite's own `probe` and `canonical` budget
 *   profiles, and it is one of the two budgets the campaign explicitly deferred
 *   rather than deleted (`campaign-baseline.json.scope.deferred_budgets`), so a
 *   later conversion to a promoting tier reuses this exact operating point
 *   instead of inventing one. Calibration coverage is a Phase 2 concern; if a
 *   *model* is ever fitted at these budgets it can pick its own domain.
 *   `--budget=` exists for a deliberate second operating point, never as a
 *   default anyone drifts to.
 *
 * WHAT IT COMPARES
 *   The working tree against the **promoted campaign baseline's compiler
 *   snapshot**, resolved from `benchmark/v2/campaign-baseline.json` the way the
 *   eval machinery does: `compiler_snapshot.createSnapshotWorkspace` extracts
 *   the recorded tar over a detached worktree with the *current* benchmark
 *   framework, then the baseline arm compiles there under the snapshot's own
 *   `LR_` environment. That is deliberately not a git checkout of the
 *   promoting commit: the snapshot is the artifact the promotion actually
 *   verified (`archiveSha256` is checked before use), it survives history
 *   edits, and it keeps the framework identical across arms so only the
 *   compiler differs. `mover_grid.ts`'s `--ref` worktree is the right tool for
 *   comparing two commits; a baseline is not a commit.
 *
 * THE CELLS
 *   The mover-grid `capability` mini manifest — all three frontier groups whole
 *   plus one back-filled control per remaining stratum, 11 sources — at 48
 *   seeds. Compile-identity with the canonical grid is re-proven on every run
 *   (`mini_manifest.ts`), so every per-cell score and every complete-group
 *   score here is exactly the canonical one. The subset aggregate is a
 *   renormalized subset score and is never a headline.
 *
 * THE VERDICT VOCABULARY  (fixed; never invented per run)
 *   Let A = changed cells (the action set: the compiled track differs),
 *       R = rescues (invalid -> valid), L = losses (valid -> invalid),
 *       d = mean paired delta per cell, blocked by seed over the 48 seed
 *           blocks, t = d / SE(d)   (see `paired_grid.ts` for why seed blocks),
 *       T = 2.0, about the two-sided 95% Student-t point at 47 df — a reading
 *           threshold for a non-promoting instrument, NOT a promotion gate;
 *           the campaign's calibrated O'Brien-Fleming boundary is unaffected,
 *       REFERENCE_LOSS_RATE = 4.4%, the per-changed-cell completion-loss rate
 *           the 1b eval actually measured (`budget-aware-map.md` §6.1) — the
 *           rate a null here has to be able to see to mean anything.
 *
 *   Evaluated strictly in order; the first match is the verdict:
 *     1. PARITY           A = 0. Bit-identical everywhere: nothing changed and
 *                         nothing was tested.
 *     2. ADVERSE          L > R, or t <= -T. The tree destroys completions the
 *                         baseline keeps, or is reliably worse per cell.
 *     3. RESCUE-POSITIVE  R > L and t > -T. Net completions healed — the class
 *                         of result this reading exists to make visible.
 *     4. SCORE-POSITIVE   R = L and t >= +T. Reliably better per cell without
 *                         moving the completion count.
 *     5. PARITY           L = 0, |t| < T, and a zero-loss observation over A
 *                         cells excludes REFERENCE_LOSS_RATE at 95%. A null
 *                         that could have seen the known failure rate.
 *     6. UNDERPOWERED     Otherwise. Something moved and nothing is excluded;
 *                         the power footer says what it would take.
 *
 * WHAT THIS IS NOT
 *   Not promotion, not a headline, not an eval-chain step. It writes nothing to
 *   benchmark governance state, touches no fingerprinted file, and imports the
 *   runner only for the snapshot-workspace helper. Promotion runs through
 *   `npm run benchmark -- eval`.
 *
 * USAGE
 *   npm run benchmark:v2:low-budget-reading                     # the standing reading
 *   npm run benchmark:v2:low-budget-reading -- --dry-run        # plan + provenance, compiles nothing
 *   npm run benchmark:v2:low-budget-reading -- --jobs=16 --label=after-my-eval
 *   npm run benchmark:v2:low-budget-reading -- --report=<tree.json.gz>,<baseline.json.gz>
 *
 *   Each run keeps its two arm archives gzipped under `<out>/arms/` (~17 MB;
 *   `--keep-raw-arms` retains the ~195 MB uncompressed copies instead). The
 *   reading's own record carries every cell of both arms, so the archives are
 *   for re-derivation, not for reading the result.
 */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { arch, availableParallelism, platform } from "node:os";
import { join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { actionSetPower, formatActionSetPower, type ActionSetPower } from "./action_set_power.ts";
import {
  assertPairedArms,
  describeArmIdentity,
  pairGridCells,
  readGridArm,
  seedBlockPairedDelta,
  type CellPair,
  type GridArm,
  type SeedBlockDelta,
} from "./paired_grid.ts";
import {
  CANONICAL_SOURCE_MANIFEST,
  CANONICAL_SUITE_MANIFEST,
  deriveMiniManifests,
  loadCanonicalManifests,
  resolveSourceSubset,
  serializeManifest,
  verifyMiniManifestIdentity,
  type MiniManifestIdentity,
  type MiniManifests,
} from "./mini_manifest.ts";
import {
  createSnapshotWorkspace,
  disposeSnapshotWorkspace,
  validateCompilerSnapshot,
  type CompilerSnapshot,
  type SnapshotWorkspace,
} from "../v0/benchmark_v2/compiler_snapshot.ts";

export const LOW_BUDGET_READING_SCHEMA = "line.benchmark-v2.low-budget-reading.v1" as const;
export const LOW_BUDGET_INDEX_SCHEMA = "line.benchmark-v2.low-budget-reading-index.v1" as const;
/** Bumped whenever the derived tables, the verdict rule, or the record shape change. */
export const INSTRUMENT_VERSION = "1.0.0" as const;

/** The at-risk regime. See the header for why this and not 300k. */
export const PRIMARY_BUDGET = 250_000;
/** All three capability frontier groups whole, plus a control per other stratum. */
export const READING_SOURCE_SUBSET = "capability";
export const READING_SEEDS = 48;
/** Two-sided ~95% at 47 df. A reading threshold, never a promotion gate. */
export const VERDICT_T = 2.0;
/** The completion-loss rate the 1b eval measured (budget-aware-map.md §6.1). */
export const REFERENCE_LOSS_RATE = 4 / 90;
export const CAMPAIGN_BASELINE_PATH = "benchmark/v2/campaign-baseline.json";
export const READING_DIRECTORY = "generated/benchmark-v2/low-budget";
export const READING_INDEX = "index.jsonl";

export const BUDGET_RATIONALE =
  "250k is the measured rescue budget, not a calibration boundary. It is where the Phase-1 " +
  "rescue-class reading was taken (capability +112.9 with 11 completions gained; the decision that " +
  "cites it is budget-dividends-plan.md Phase 0b), it is a member of " +
  "the canonical suite's own probe and canonical budget profiles, and it is one of the two budgets " +
  "the campaign deferred rather than deleted - so converting this reading into a promoting tier " +
  "later reuses this operating point instead of inventing one. It was chosen over 300k because 300k " +
  "was the edge of the remaining-work estimator's calibrated domain, which is an argument about a " +
  "model rather than about the compiler; evidence wants the regime where completions are actually at " +
  "risk. That model question has since resolved the same way - the estimator's domain floor moved to " +
  "250k on 2026-08-03 (docs/compile-budget-telemetry.md, The 250k Extension) - so this operating " +
  "point reads calibrated margins too.";

export const READING_NOTE =
  "Standing low-budget evidence reading: the working tree against the promoted campaign baseline's " +
  "compiler snapshot, over the capability mini manifest. Tracked, never promoting. The subset " +
  "aggregate is a renormalized subset score and is not the suite headline; per-cell scores and " +
  "complete-group scores are exact. Promotion runs through `npm run benchmark -- eval`.";

export type VerdictCode =
  | "PARITY"
  | "ADVERSE"
  | "RESCUE-POSITIVE"
  | "SCORE-POSITIVE"
  | "UNDERPOWERED";

export type Verdict = {
  code: VerdictCode;
  /** The single sentence the terminal prints beside the code. */
  rationale: string;
  /** Which numbered rule in the header fired. */
  rule: number;
  criteria: string;
  inputs: {
    changedCells: number;
    rescues: number;
    losses: number;
    meanDelta: number;
    standardError: number;
    t: number;
    thresholdT: number;
    referenceLossRate: number;
    exclusionBound: number | null;
  };
};

export const VERDICT_CRITERIA =
  "A=changed cells, R=rescues (invalid->valid), L=losses (valid->invalid), " +
  "d=paired mean delta per cell blocked by seed, t=d/SE(d), T=2.0, " +
  `reference loss rate=${(100 * REFERENCE_LOSS_RATE).toFixed(1)}% (the rate the 1b eval measured). ` +
  "In order: (1) PARITY if A=0; (2) ADVERSE if L>R or t<=-T; (3) RESCUE-POSITIVE if R>L and t>-T; " +
  "(4) SCORE-POSITIVE if R=L and t>=+T; (5) PARITY if L=0, |t|<T and a zero-loss observation over A " +
  "cells excludes the reference loss rate at 95%; (6) UNDERPOWERED otherwise.";

/**
 * The verdict rule, in one pure function so it is testable and so no run can
 * invent a category. See the module header for the criteria it implements.
 */
export function readingVerdict(input: {
  changedCells: number;
  rescues: number;
  losses: number;
  paired: Pick<SeedBlockDelta, "meanDelta" | "standardError" | "t">;
  power: ActionSetPower;
  thresholdT?: number;
  referenceLossRate?: number;
}): Verdict {
  const thresholdT = input.thresholdT ?? VERDICT_T;
  const referenceLossRate = input.referenceLossRate ?? REFERENCE_LOSS_RATE;
  const { changedCells, rescues, losses } = input;
  const { t, meanDelta } = input.paired;
  const bound = input.power.exclusionBound;
  const per = `${signed(meanDelta, 3)}/cell, t ${signed(t, 2)}`;
  const decide = (): Pick<Verdict, "code" | "rationale" | "rule"> => {
    if (changedCells === 0) {
      return {
        code: "PARITY",
        rule: 1,
        rationale: "every cell is bit-identical — the tree and the baseline compiler agree exactly, " +
          "so nothing changed and nothing was tested",
      };
    }
    if (losses > rescues) {
      return {
        code: "ADVERSE",
        rule: 2,
        rationale: `${losses} completions lost against ${rescues} rescued — the tree destroys ` +
          `completions the baseline keeps (about 50 headline points each)`,
      };
    }
    if (t <= -thresholdT) {
      return {
        code: "ADVERSE",
        rule: 2,
        rationale: `reliably worse per cell at ${per} over ${changedCells} changed cells`,
      };
    }
    if (rescues > losses) {
      return {
        code: "RESCUE-POSITIVE",
        rule: 3,
        rationale: `${rescues - losses} net completions healed (${rescues} rescued, ${losses} lost) at ${per}` +
          ` — the rescue class this reading exists to make visible`,
      };
    }
    if (rescues === losses && t >= thresholdT) {
      return {
        code: "SCORE-POSITIVE",
        rule: 4,
        rationale: `reliably better per cell at ${per} with the completion count unmoved ` +
          `(${rescues} rescued, ${losses} lost)`,
      };
    }
    if (losses === 0 && Math.abs(t) < thresholdT && bound !== null && bound <= referenceLossRate) {
      return {
        code: "PARITY",
        rule: 5,
        rationale: `no completion lost over ${changedCells} changed cells and ${per} — an action set ` +
          `large enough to exclude the ${percent(referenceLossRate)} rate the 1b eval measured`,
      };
    }
    return {
      code: "UNDERPOWERED",
      rule: 6,
      rationale: `${changedCells} changed cells moved at ${per}, ${rescues} rescued / ${losses} lost — ` +
        `neither direction is established; see the power footer for what it would take`,
    };
  };
  return {
    ...decide(),
    criteria: VERDICT_CRITERIA,
    inputs: {
      changedCells,
      rescues,
      losses,
      meanDelta: input.paired.meanDelta,
      standardError: input.paired.standardError,
      t,
      thresholdT,
      referenceLossRate,
      exclusionBound: bound,
    },
  };
}

export type CampaignBaselineArm = {
  path: string;
  sha256: string;
  label: string;
  generatedAt: string;
  canonicalHeadline: number | null;
  promotionSeeds: number | null;
  stoppingAction: string | null;
  deferredBudgets: number[];
  snapshot: CompilerSnapshot;
};

/**
 * Resolve the promoted baseline's compiler the way the eval machinery does:
 * from the campaign baseline record's compiler snapshot, checksum-verified
 * before anything is run against it.
 */
export function loadCampaignBaselineArm(path = CAMPAIGN_BASELINE_PATH): CampaignBaselineArm {
  const absolute = resolve(path);
  if (!existsSync(absolute)) throw new Error(`${path}: campaign baseline record is required`);
  const bytes = readFileSync(absolute);
  const record = JSON.parse(bytes.toString("utf8"));
  if (record?.schema !== "line.benchmark-v2.campaign-baseline.v2") {
    throw new Error(`${path}: not a campaign-baseline.v2 record`);
  }
  const snapshot = record.compiler_snapshot as CompilerSnapshot;
  if (snapshot == null) throw new Error(`${path}: campaign baseline carries no compiler snapshot`);
  validateCompilerSnapshot(snapshot);
  if (snapshot.candidateFingerprint !== record.candidate_fingerprint) {
    throw new Error(`${path}: snapshot fingerprint disagrees with the promoted candidate fingerprint`);
  }
  return {
    path: relativeToCwd(absolute),
    sha256: sha256(bytes),
    label: String(record.label),
    generatedAt: String(record.generated_at),
    canonicalHeadline: numberOrNull(record.development?.canonical_headline),
    promotionSeeds: numberOrNull(record.promoted_comparison?.seeds),
    stoppingAction: typeof record.promoted_comparison?.stopping_action === "string"
      ? record.promoted_comparison.stopping_action
      : null,
    deferredBudgets: Array.isArray(record.scope?.deferred_budgets) ? record.scope.deferred_budgets : [],
    snapshot,
  };
}

export type GroupRow = {
  id: string;
  stratum: string;
  /** `canonical` when every canonical member survived the mini manifest. */
  scope: string;
  baselineScore: number;
  treeScore: number;
  delta: number;
  cells: number;
  changedCells: number;
  baselineValid: number;
  treeValid: number;
  rescued: number;
  lost: number;
};

export type SourceRow = {
  id: string;
  role: "mover" | "control";
  baselineScore: number;
  treeScore: number;
  delta: number;
  cells: number;
  changedCells: number;
  baselineValid: number;
  treeValid: number;
  rescued: number;
  lost: number;
};

function tallyCells(pairs: CellPair[]) {
  return {
    cells: pairs.length,
    changedCells: pairs.filter((pair) => pair.ref.trackHash !== pair.candidate.trackHash).length,
    baselineValid: pairs.filter((pair) => pair.ref.valid).length,
    treeValid: pairs.filter((pair) => pair.candidate.valid).length,
    rescued: pairs.filter((pair) => !pair.ref.valid && pair.candidate.valid).length,
    lost: pairs.filter((pair) => pair.ref.valid && !pair.candidate.valid).length,
  };
}

export function buildGroupRows(
  tree: GridArm,
  baseline: GridArm,
  pairs: CellPair[],
  canonicalGroups: Map<string, string[]>,
): GroupRow[] {
  const bySource = new Map<string, CellPair[]>();
  for (const pair of pairs) {
    const rows = bySource.get(pair.ref.sourceId) ?? [];
    rows.push(pair);
    bySource.set(pair.ref.sourceId, rows);
  }
  const rows: GroupRow[] = [];
  for (const [id, group] of baseline.groups) {
    const after = tree.groups.get(id);
    if (after === undefined) continue;
    const canonical = canonicalGroups.get(id);
    const members = group.members.flatMap((member) => bySource.get(member) ?? []);
    rows.push({
      id,
      stratum: group.stratum,
      scope: canonical === undefined
        ? "unknown group"
        : canonical.length === group.members.length
        ? "canonical"
        : `partial ${group.members.length}/${canonical.length}`,
      baselineScore: group.score,
      treeScore: after.score,
      delta: after.score - group.score,
      ...tallyCells(members),
    });
  }
  return rows;
}

export function buildSourceRows(
  tree: GridArm,
  baseline: GridArm,
  pairs: CellPair[],
  controlIds: Set<string>,
): SourceRow[] {
  const bySource = new Map<string, CellPair[]>();
  for (const pair of pairs) {
    const rows = bySource.get(pair.ref.sourceId) ?? [];
    rows.push(pair);
    bySource.set(pair.ref.sourceId, rows);
  }
  const rows: SourceRow[] = [];
  for (const [id, before] of baseline.sources) {
    const after = tree.sources.get(id);
    if (after === undefined) continue;
    rows.push({
      id,
      role: controlIds.has(id) ? "control" : "mover",
      baselineScore: before.score,
      treeScore: after.score,
      delta: after.score - before.score,
      ...tallyCells(bySource.get(id) ?? []),
    });
  }
  return rows;
}

export type ReadingRecord = ReturnType<typeof buildReadingRecord>;

export function buildReadingRecord(input: {
  label: string;
  generatedAt: string;
  budget: number;
  seeds: number[];
  jobs: number | null;
  subset: string;
  mini: MiniManifests;
  identity: MiniManifestIdentity;
  baselineArm: CampaignBaselineArm | null;
  tree: GridArm;
  baseline: GridArm;
  canonicalGroups: Map<string, string[]>;
  archivePaths: { tree: string; baseline: string };
  pairingNotes: string[];
}) {
  const { tree, baseline } = input;
  const paired = pairGridCells(tree, baseline);
  const seedBlocks = seedBlockPairedDelta(paired.pairs);
  const power = actionSetPower({
    changedCells: paired.changed.length,
    adverseEvents: paired.lost.length,
    totalCells: paired.pairs.length,
  });
  const verdict = readingVerdict({
    changedCells: paired.changed.length,
    rescues: paired.gained.length,
    losses: paired.lost.length,
    paired: seedBlocks,
    power,
  });
  const controlIds = new Set(input.mini.controlIds);
  const groups = buildGroupRows(tree, baseline, paired.pairs, input.canonicalGroups);
  const sources = buildSourceRows(tree, baseline, paired.pairs, controlIds);
  const controlPairs = paired.pairs.filter((pair) => controlIds.has(pair.ref.sourceId));
  const treeSummary = summaryFor(tree, input.budget);
  const baselineSummary = summaryFor(baseline, input.budget);

  return {
    schema: LOW_BUDGET_READING_SCHEMA,
    instrumentVersion: INSTRUMENT_VERSION,
    generatedAt: input.generatedAt,
    label: input.label,
    note: READING_NOTE,
    promoting: false,
    budgetRationale: BUDGET_RATIONALE,
    plan: {
      budget: input.budget,
      seeds: input.seeds,
      seedBase: input.seeds[0] ?? null,
      sourceSubset: input.subset,
      sourceIds: input.mini.keptIds,
      moverIds: input.mini.keptIds.filter((id) => !controlIds.has(id)),
      controlIds: input.mini.controlIds,
      cellsPerArm: paired.pairs.length,
      jobs: input.jobs,
    },
    verdict,
    paired: {
      unit: "score points per cell",
      blocks: seedBlocks.blocks.length,
      cellsPerBlock: seedBlocks.blocks[0]?.cells ?? 0,
      meanDelta: seedBlocks.meanDelta,
      standardDeviation: seedBlocks.standardDeviation,
      standardError: seedBlocks.standardError,
      t: finiteOrNull(seedBlocks.t),
      degreesOfFreedom: seedBlocks.degreesOfFreedom,
      sumDelta: paired.scoreDelta,
      seedBlocks: seedBlocks.blocks,
    },
    completions: {
      rescued: paired.gained.map(cellSummary),
      lost: paired.lost.map(cellSummary),
      net: paired.gained.length - paired.lost.length,
      baselineValidCells: paired.pairs.filter((pair) => pair.ref.valid).length,
      treeValidCells: paired.pairs.filter((pair) => pair.candidate.valid).length,
    },
    actionSet: power,
    aggregate: {
      note: "Renormalized subset score over the mini manifest. NOT the suite headline.",
      baseline: baselineSummary?.score ?? null,
      tree: treeSummary?.score ?? null,
      delta: treeSummary != null && baselineSummary != null ? treeSummary.score - baselineSummary.score : null,
    },
    tables: {
      groups,
      sources,
      controls: {
        ids: input.mini.controlIds,
        cells: controlPairs.length,
        changedCells: controlPairs.filter((pair) => pair.ref.trackHash !== pair.candidate.trackHash).length,
        expectation: "Controls come from strata the capability subset does not target. They are a " +
          "witness, not a measurement: a moved control means the arms differ by more than the " +
          "capability-side mechanism under discussion.",
      },
    },
    provenance: {
      campaignBaseline: input.baselineArm === null ? null : {
        path: input.baselineArm.path,
        sha256: input.baselineArm.sha256,
        label: input.baselineArm.label,
        generatedAt: input.baselineArm.generatedAt,
        canonicalHeadline: input.baselineArm.canonicalHeadline,
        promotionSeeds: input.baselineArm.promotionSeeds,
        stoppingAction: input.baselineArm.stoppingAction,
        deferredBudgets: input.baselineArm.deferredBudgets,
        compilerSnapshot: {
          archive: input.baselineArm.snapshot.archive,
          archiveSha256: input.baselineArm.snapshot.archiveSha256,
          candidateFingerprint: input.baselineArm.snapshot.candidateFingerprint,
          compilerSourceFingerprint: input.baselineArm.snapshot.compilerSourceFingerprint,
          engineArtifactFingerprint: input.baselineArm.snapshot.engineArtifactFingerprint,
          compilerEnvironment: input.baselineArm.snapshot.compilerEnvironment,
        },
      },
      arms: {
        tree: armProvenance(tree, input.archivePaths.tree),
        baseline: armProvenance(baseline, input.archivePaths.baseline),
      },
      pairing: {
        identityStatement: describeArmIdentity(tree, baseline, paired.changed.length),
        notes: input.pairingNotes,
      },
      suiteFingerprint: baseline.archive.suiteFingerprint,
      sourceManifestFingerprint: baseline.archive.sourceManifestFingerprint,
      scoringProtocolFingerprint: baseline.archive.scoringProtocolFingerprint,
      scorerFingerprint: baseline.archive.scorerFingerprint,
      transform: baseline.archive.transform,
      miniManifest: {
        selector: input.subset,
        canonicalSourceManifest: CANONICAL_SOURCE_MANIFEST,
        canonicalSuiteManifest: CANONICAL_SUITE_MANIFEST,
        keptIds: input.mini.keptIds,
        controlIds: input.mini.controlIds,
        groups: input.mini.groups,
        compileIdentity: input.identity,
      },
      runtime: { node: process.version, platform: platform(), architecture: arch() },
      instrument: {
        script: "scripts/benchmark/low_budget_reading.ts",
        version: INSTRUMENT_VERSION,
        schema: LOW_BUDGET_READING_SCHEMA,
        head: gitHead(),
        verdictCriteria: VERDICT_CRITERIA,
      },
    },
    cells: paired.pairs.map((pair) => ({
      sourceId: pair.ref.sourceId,
      budget: pair.ref.budget,
      seed: pair.ref.seed,
      changed: pair.ref.trackHash !== pair.candidate.trackHash,
      delta: pair.candidate.score - pair.ref.score,
      baseline: cellSide(pair.ref),
      tree: cellSide(pair.candidate),
    })),
  };
}

/** Everything a future study needs to know an arm's identity without re-running it. */
function armProvenance(arm: GridArm, archivePath: string) {
  const candidate = arm.archive.candidate ?? {};
  return {
    label: arm.label,
    archive: relativeToCwd(resolve(archivePath)),
    archiveExists: existsSync(resolve(archivePath)),
    engine: candidate.engine ?? null,
    head: candidate.head ?? null,
    candidateFingerprint: candidate.candidateFingerprint ?? null,
    compilerSourceFingerprint: candidate.compilerSourceFingerprint ?? null,
    compilerDiffSha256: candidate.compilerDiffSha256 ?? null,
    compilerIdentityProtocol: candidate.compilerIdentityProtocol ?? null,
    engineArtifactFingerprint: candidate.engineArtifactFingerprint ?? null,
    compilerEnvironment: candidate.compilerEnvironment ?? {},
    trackedChanges: candidate.trackedChanges ?? [],
    compilerSourceFiles: candidate.compilerSourceFiles ?? [],
    environment: arm.archive.environment ?? null,
    generatedAt: arm.archive.generatedAt ?? null,
  };
}

function cellSide(cell: CellPair["ref"]) {
  return {
    score: cell.score,
    valid: cell.valid,
    status: cell.status,
    trackHash: cell.trackHash,
    firstCompletionFrame: cell.firstCompletionFrame,
  };
}

function cellSummary(pair: CellPair) {
  return {
    sourceId: pair.ref.sourceId,
    seed: pair.ref.seed,
    baselineScore: pair.ref.score,
    treeScore: pair.candidate.score,
    baselineStatus: pair.ref.status,
    treeStatus: pair.candidate.status,
    baselineFirstCompletionFrame: pair.ref.firstCompletionFrame,
    treeFirstCompletionFrame: pair.candidate.firstCompletionFrame,
  };
}

function summaryFor(arm: GridArm, budget: number): { score: number } | null {
  return (arm.archive.summaries ?? []).find((summary: any) => summary.budget === budget) ?? null;
}

/**
 * The whole terminal block, built as one string so it is testable and so the
 * power footer cannot be printed conditionally. Ten seconds of reading:
 * who, what, the verdict, the groups, the completions, the power.
 */
export function formatReadingBlock(record: ReadingRecord): string {
  const lines: string[] = [];
  const { plan, provenance, verdict } = record;
  const treeArm = provenance.arms.tree;
  const baselineArm = provenance.arms.baseline;
  const baselineLabel = provenance.campaignBaseline?.label ?? baselineArm.label;

  lines.push(
    `LOW-BUDGET READING  ${plan.budget / 1000}k x ${plan.seeds.length} seeds x ${plan.sourceIds.length} sources ` +
    `= ${plan.cellsPerArm} cells per arm  (${record.label})`,
  );
  // `trackedChanges` is `git status --short` over the whole worktree, not just
  // the compiler paths — say "worktree" so nobody reads it as compiler drift.
  lines.push(
    `  tree      ${short(treeArm.candidateFingerprint)}  compiler ${short(treeArm.compilerSourceFingerprint)}` +
    (treeArm.trackedChanges.length === 0
      ? "  worktree clean"
      : `  worktree +${treeArm.trackedChanges.length} uncommitted path(s)`),
  );
  lines.push(
    `  baseline  ${short(baselineArm.candidateFingerprint)}  compiler ${short(baselineArm.compilerSourceFingerprint)}` +
    `  ${baselineLabel}` +
    (record.provenance.campaignBaseline?.canonicalHeadline == null
      ? ""
      : ` (750k headline ${record.provenance.campaignBaseline.canonicalHeadline})`),
  );
  lines.push(
    `  shared    engine ${short(treeArm.engineArtifactFingerprint)}  ` +
    `mini-suite ${short(provenance.suiteFingerprint)}  scorer ${short(provenance.scorerFingerprint)}`,
  );
  for (const note of provenance.pairing.notes) lines.push(`  WARNING   ${note}`);
  // Only the anomalous identity statement is worth terminal space: same
  // fingerprint, different tracks means something outside compiler identity
  // separates the arms and the archive cannot name it.
  if (
    treeArm.candidateFingerprint === baselineArm.candidateFingerprint &&
    record.actionSet.changedCells > 0
  ) {
    lines.push(`  WARNING   ${provenance.pairing.identityStatement}`);
  }

  lines.push("");
  lines.push(...wrapAfter(`VERDICT  ${verdict.code}  —  `, verdict.rationale, "         "));

  lines.push("");
  lines.push(
    // "resc"/"lost" carry the validity movement, so the validity column is the
    // tree's absolute count rather than an ambiguous pair.
    `  ${"capability group".padEnd(30)} ${"base".padStart(9)} ${"tree".padStart(9)} ${"delta".padStart(8)} ` +
    `${"tree valid".padStart(11)} ${"resc".padStart(5)} ${"lost".padStart(5)}  scope`,
  );
  for (const row of record.tables.groups.filter((group) => group.stratum === "capability")) {
    lines.push(groupLine(row));
  }
  const others = record.tables.groups.filter((group) => group.stratum !== "capability");
  if (others.length > 0) {
    lines.push(`  — controls —`);
    for (const row of others) lines.push(groupLine(row));
  }
  lines.push(
    `  ${"SUBSET AGGREGATE".padEnd(30)} ${fixed(record.aggregate.baseline, 9)} ${fixed(record.aggregate.tree, 9)} ` +
    `${signedFixed(record.aggregate.delta, 8)}   renormalized subset, NOT a headline`,
  );

  lines.push("");
  lines.push(
    `PAIRED DELTA  ${record.paired.blocks} seed blocks x ${record.paired.cellsPerBlock} cells  ` +
    `(a seed is the replicate, not a cell)`,
  );
  lines.push(
    `  mean ${signed(record.paired.meanDelta, 3)}/cell   SE ${record.paired.standardError.toFixed(3)}   ` +
    // `paired.t` is null on disk when the blocks agree exactly; the sign of the
    // mean is what makes an infinite t readable rather than mysterious.
    `t ${record.paired.t === null ? signed(record.paired.meanDelta * Infinity || 0, 2) : signed(record.paired.t, 2)}` +
    `   sum ${signed(record.paired.sumDelta, 1)}`,
  );
  lines.push(
    `  completions  ${record.completions.rescued.length} rescued, ${record.completions.lost.length} lost ` +
    `(net ${signed(record.completions.net, 0)})   validity ${record.completions.baselineValidCells} -> ` +
    `${record.completions.treeValidCells} of ${plan.cellsPerArm}`,
  );
  // Named, not just counted — but bounded, and the elision is always stated so
  // nobody reads a truncated list as the whole set.
  const NAMED = 8;
  for (const cell of record.completions.rescued.slice(0, NAMED)) {
    lines.push(`    RESCUED  ${cell.sourceId.padEnd(42)} seed ${String(cell.seed).padStart(3)}  ` +
      `${cell.baselineStatus} -> ${cell.treeScore.toFixed(1)}`);
  }
  for (const cell of record.completions.lost.slice(0, NAMED)) {
    lines.push(`    LOST     ${cell.sourceId.padEnd(42)} seed ${String(cell.seed).padStart(3)}  ` +
      `${cell.baselineScore.toFixed(1)} -> ${cell.treeStatus}`);
  }
  const elided = Math.max(0, record.completions.rescued.length - NAMED) +
    Math.max(0, record.completions.lost.length - NAMED);
  if (elided > 0) lines.push(`    ... and ${elided} more, all of them in the record`);
  const controls = record.tables.controls;
  lines.push(
    `  controls     ${controls.ids.length} sources, ${controls.cells} cells, ` +
    (controls.changedCells === 0
      ? "bit-identical as required"
      : `${controls.changedCells} MOVED — the arms differ by more than the capability mechanism`),
  );

  lines.push("");
  lines.push(formatActionSetPower(record.actionSet, "lost completion"));
  lines.push("");
  // Two hard lines: the command must never be broken across a wrap.
  lines.push(`  Evidence, never promotion: a tracked low-budget surface, not the acceptance surface.`);
  lines.push("  Headlines come from `npm run benchmark -- eval`.");
  return lines.join("\n");
}

/**
 * Word-wrap to a terminal width with a hanging indent, preserving whatever
 * leading indent the text already carries.
 */
export function wrap(text: string, indent = "  ", width = 116): string[] {
  const lead = /^ */.exec(text)![0];
  return wrapAfter(lead, text.slice(lead.length), indent, width);
}

/**
 * Wrap `text` after a literal `prefix` that is never re-flowed — so a header
 * like `VERDICT  PARITY  —  ` keeps its alignment while its sentence wraps.
 */
export function wrapAfter(prefix: string, text: string, indent = "  ", width = 116): string[] {
  const lines: string[] = [];
  let current = prefix;
  let empty = true;
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const candidate = empty ? `${current}${word}` : `${current} ${word}`;
    if (candidate.length > width && !empty) {
      lines.push(current);
      current = `${indent}${word}`;
    } else {
      current = candidate;
    }
    empty = false;
  }
  if (current.trim() !== "") lines.push(current);
  return lines;
}

function groupLine(row: GroupRow): string {
  return `  ${row.id.padEnd(30)} ${row.baselineScore.toFixed(2).padStart(9)} ${row.treeScore.toFixed(2).padStart(9)} ` +
    `${signed(row.delta, 2).padStart(8)} ${`${row.treeValid}/${row.cells}`.padStart(11)} ` +
    `${String(row.rescued).padStart(5)} ${String(row.lost).padStart(5)}  ${row.scope}`;
}

/** One line per reading, append-only, so readings accumulate into a history. */
export function readingIndexEntry(record: ReadingRecord, recordPath: string, recordSha256: string) {
  return {
    schema: LOW_BUDGET_INDEX_SCHEMA,
    generatedAt: record.generatedAt,
    label: record.label,
    record: relativeToCwd(resolve(recordPath)),
    recordSha256,
    instrumentVersion: record.instrumentVersion,
    budget: record.plan.budget,
    seeds: record.plan.seeds.length,
    seedBase: record.plan.seedBase,
    sources: record.plan.sourceIds.length,
    cellsPerArm: record.plan.cellsPerArm,
    verdict: record.verdict.code,
    verdictRule: record.verdict.rule,
    meanDelta: record.paired.meanDelta,
    standardError: record.paired.standardError,
    t: record.paired.t,
    changedCells: record.actionSet.changedCells,
    rescued: record.completions.rescued.length,
    lost: record.completions.lost.length,
    subsetAggregateDelta: record.aggregate.delta,
    treeCandidateFingerprint: record.provenance.arms.tree.candidateFingerprint,
    baselineLabel: record.provenance.campaignBaseline?.label ?? null,
    baselineCandidateFingerprint: record.provenance.arms.baseline.candidateFingerprint,
  };
}

/** Write the record, its checksum sidecar, and the history line. Returns the record path. */
export function writeReading(directory: string, record: ReadingRecord): { record: string; index: string } {
  const target = resolve(directory);
  mkdirSync(target, { recursive: true });
  const stamp = record.generatedAt.replaceAll(/[:.]/g, "-");
  const path = join(target, `${stamp}-${safeLabel(record.label)}.json`);
  const bytes = Buffer.from(`${JSON.stringify(record, null, 2)}\n`);
  writeFileSync(path, bytes);
  const digest = sha256(bytes);
  writeFileSync(`${path}.sha256`, `${digest}  ${relativeToCwd(path)}\n`);
  const indexPath = join(target, READING_INDEX);
  appendFileSync(indexPath, `${JSON.stringify(readingIndexEntry(record, path, digest))}\n`);
  return { record: path, index: indexPath };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

/** `file://${argv[1]}` string-compares an unresolved, unescaped path: it is
 *  false for `node scripts/…` (relative) and for any path containing a space or
 *  other percent-encoded character, and the module then silently does nothing.
 *  `pathToFileURL(resolve(...))` is the same normalization `import.meta.url`
 *  already carries (see describe_budget_telemetry.ts). */
function isCliEntry(): boolean {
  const entry = process.argv[1];
  return entry !== undefined && import.meta.url === pathToFileURL(resolve(entry)).href;
}

if (isCliEntry()) await main();

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const argument = (name: string): string | undefined =>
    args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
  const flag = (name: string): boolean => args.includes(`--${name}`);

  if (flag("help") || flag("h")) {
    printUsage();
    return;
  }

  const subset = argument("sources") ?? READING_SOURCE_SUBSET;
  let budget = Number(argument("budget") ?? String(PRIMARY_BUDGET));
  if (!Number.isSafeInteger(budget) || budget < 1) throw new Error(`--budget must be a positive integer`);
  const seedCount = Number(argument("seeds") ?? String(READING_SEEDS));
  const seedBase = Number(argument("seed-base") ?? "0");
  if (!Number.isSafeInteger(seedCount) || seedCount < 1) throw new Error(`--seeds must be a positive integer`);
  if (!Number.isSafeInteger(seedBase) || seedBase < 0) throw new Error(`--seed-base must be a non-negative integer`);
  let seeds = Array.from({ length: seedCount }, (_, index) => seedBase + index);
  const jobs = Number(argument("jobs") ?? String(Math.min(16, Math.max(1, availableParallelism() - 1))));
  if (!Number.isSafeInteger(jobs) || jobs < 1) throw new Error(`--jobs must be a positive integer`);
  const label = argument("label") ?? "tree-vs-baseline";
  const directory = resolve(argument("out") ?? READING_DIRECTORY);
  const generatedAt = new Date().toISOString();

  const { sources, suite, resolved } = loadCanonicalManifests();
  const mini = deriveMiniManifests(sources, suite, resolveSourceSubset(subset, resolved, suite));
  const identity = verifyMiniManifestIdentity(sources, suite, mini);
  const canonicalGroups = new Map(suite.strata.flatMap((stratum) =>
    stratum.groups.map((group) => [group.id, group.members] as const)
  ));

  const reportPair = argument("report");
  const baselineArm = reportPair !== undefined && flag("no-baseline-record")
    ? null
    : loadCampaignBaselineArm(argument("baseline") ?? CAMPAIGN_BASELINE_PATH);

  let treePath: string;
  let baselinePath: string;
  let treeArm: GridArm | null = null;
  if (reportPair !== undefined) {
    const [tree, baseline] = reportPair.split(",").map((entry) => entry.trim());
    if (tree === undefined || baseline === undefined) {
      throw new Error(`--report needs two archive paths: --report=<tree.json>,<baseline.json>`);
    }
    treePath = tree;
    baselinePath = baseline;
    // Re-reporting reads an operating point rather than choosing one: the
    // archives are the authority, so the plan describes them, not the defaults.
    treeArm = readGridArm("working tree", treePath);
    if (treeArm.archive.budgets.length !== 1) {
      throw new Error(
        `--report expects single-budget archives; got budgets ${treeArm.archive.budgets.join(", ")}`,
      );
    }
    budget = treeArm.archive.budgets[0];
    seeds = [...treeArm.archive.seeds];
    // The derived tables and the control expectation are stated in terms of
    // the selector's sources. Archives from a different subset would be
    // reported against the wrong mini manifest, silently.
    const archived = [...new Set([...treeArm.cells.values()].map((cell) => cell.sourceId))].sort();
    const expected = [...mini.keptIds].sort();
    if (JSON.stringify(archived) !== JSON.stringify(expected)) {
      throw new Error(
        `--report archives cover ${archived.length} sources that do not match --sources=${subset} ` +
        `(${expected.length}); pass the selector the archives were compiled under`,
      );
    }
    printPlan({ subset, budget, seeds, jobs, mini, identity, baselineArm, dryRun: false, reReport: true });
  } else {
    printPlan({ subset, budget, seeds, jobs, mini, identity, baselineArm, dryRun: flag("dry-run") });
    if (!identity.ok) {
      throw new Error(`mini manifest derivation failed its compile-identity checks; refusing to compile`);
    }
    if (flag("dry-run")) return;
    const workDirectory = join(directory, "arms", `${generatedAt.replaceAll(/[:.]/g, "-")}-${safeLabel(label)}`);
    mkdirSync(workDirectory, { recursive: true });
    const [miniSourcePath, miniSuitePath] = writeMiniManifests(workDirectory, mini);
    const started = performance.now();

    treePath = join(workDirectory, "tree.json");
    console.log(`\n  [tree] compiling ${mini.keptIds.length * seeds.length} cells in the working tree`);
    runArm({
      cwd: process.cwd(),
      out: treePath,
      manifest: miniSourcePath,
      suite: miniSuitePath,
      budget,
      seeds,
      jobs,
      env: {},
    });

    baselinePath = join(workDirectory, "baseline.json");
    console.log(
      `  [baseline] materializing the ${baselineArm!.label} compiler snapshot ` +
      `(${short(baselineArm!.snapshot.candidateFingerprint)}); this takes a minute`,
    );
    let workspace: SnapshotWorkspace | null = null;
    try {
      workspace = createSnapshotWorkspace(baselineArm!.snapshot);
      console.log(`  [baseline] compiling in ${workspace.directory}`);
      runArm({
        cwd: workspace.directory,
        out: baselinePath,
        manifest: miniSourcePath,
        suite: miniSuitePath,
        budget,
        seeds,
        jobs,
        // The snapshot's own LR_ environment is part of the promoted compiler.
        env: baselineArm!.snapshot.compilerEnvironment,
        clearLrEnvironment: true,
      });
    } finally {
      if (workspace !== null) disposeSnapshotWorkspace(workspace);
    }
    console.log(`  both arms in ${((performance.now() - started) / 1000).toFixed(1)}s\n`);
  }

  const tree = treeArm ?? readGridArm("working tree", treePath);
  const baseline = readGridArm(baselineArm?.label ?? "baseline", baselinePath);
  // A tree-vs-baseline reading legitimately spans an engine rebuild; the note
  // is surfaced in the terminal block and stored, never silently dropped.
  const pairingNotes = assertPairedArms(tree, baseline, { allowEngineDrift: true });

  // Archives this command produced are its to prune; archives it was handed
  // via --report belong to whoever made them and are never touched.
  if (reportPair === undefined && !flag("keep-raw-arms")) {
    const before = [treePath, baselinePath].reduce((sum, path) => sum + armFootprint(path), 0);
    treePath = retainCompressedArchive(treePath);
    baselinePath = retainCompressedArchive(baselinePath);
    const after = [treePath, baselinePath].reduce((sum, path) => sum + armFootprint(path), 0);
    console.log(
      `  arms      kept gzipped, ${megabytes(after)} instead of ${megabytes(before)} ` +
      `(--keep-raw-arms to retain the uncompressed copies)\n`,
    );
  }

  const record = buildReadingRecord({
    label,
    generatedAt,
    budget,
    seeds,
    jobs: reportPair === undefined ? jobs : null,
    subset,
    mini,
    identity,
    baselineArm,
    tree,
    baseline,
    canonicalGroups,
    archivePaths: { tree: treePath, baseline: baselinePath },
    pairingNotes,
  });

  console.log(formatReadingBlock(record));
  const written = writeReading(directory, record);
  console.log(`\n  record  ${relativeToCwd(written.record)}`);
  console.log(`  history ${relativeToCwd(written.index)}`);
}

function printUsage(): void {
  console.log(
    `low_budget_reading — the standing ${PRIMARY_BUDGET / 1000}k evidence reading (tracked, never promoting).\n\n` +
    `The working tree against the promoted campaign baseline's compiler snapshot, over the\n` +
    `capability mini manifest. Verdicts: PARITY / RESCUE-POSITIVE / SCORE-POSITIVE / ADVERSE /\n` +
    `UNDERPOWERED — criteria fixed in the module header, never invented per run.\n\n` +
    `  --label=<text>         names the run and its record file (default tree-vs-baseline)\n` +
    `  --budget=<n>           default ${PRIMARY_BUDGET} — the measured rescue budget; see the header\n` +
    `  --seeds=<n>            seed count from --seed-base (default ${READING_SEEDS})\n` +
    `  --seed-base=<n>        first seed (default 0 — the campaign's own schedule)\n` +
    `  --sources=<selector>   mini-manifest selector (default ${READING_SOURCE_SUBSET})\n` +
    `  --jobs=<n>             worker pool size per arm\n` +
    `  --baseline=<path>      campaign baseline record (default ${CAMPAIGN_BASELINE_PATH})\n` +
    `  --out=<dir>            reading directory (default ${READING_DIRECTORY})\n` +
    `  --dry-run              print the plan and provenance, compile nothing\n` +
    `  --keep-raw-arms        keep the uncompressed arm archives (~195 MB) instead of the gzipped ones\n` +
    `  --report=<tree>,<base> re-report two existing scale-study archives, compile nothing`,
  );
}

function printPlan(input: {
  subset: string;
  budget: number;
  seeds: number[];
  jobs: number;
  mini: MiniManifests;
  identity: MiniManifestIdentity;
  baselineArm: CampaignBaselineArm | null;
  dryRun: boolean;
  reReport?: boolean;
}): void {
  const { mini, identity, baselineArm } = input;
  console.log(
    `LOW-BUDGET READING PLAN  ${input.budget / 1000}k x ${input.seeds.length} seeds x ` +
    `${mini.keptIds.length} sources = ${mini.keptIds.length * input.seeds.length} cells per arm`,
  );
  console.log(`  budget    ${BUDGET_RATIONALE.split(". ")[0]}.`);
  for (const line of wrap(`  sources   --sources=${input.subset}: ${mini.keptIds.join(", ")}`, "            ")) {
    console.log(line);
  }
  if (mini.controlIds.length > 0) {
    for (const line of wrap(`  controls  ${mini.controlIds.join(", ")}`, "            ")) console.log(line);
  }
  console.log(`  seeds     ${input.seeds[0]}..${input.seeds[input.seeds.length - 1]}`);
  if (baselineArm !== null) {
    console.log(
      `  baseline  ${baselineArm.label} @ ${baselineArm.generatedAt}` +
      (baselineArm.canonicalHeadline === null ? "" : `, 750k headline ${baselineArm.canonicalHeadline}`),
    );
    console.log(
      `            snapshot ${baselineArm.snapshot.archive} ` +
      `(sha256 ${short(baselineArm.snapshot.archiveSha256)}, verified)`,
    );
    console.log(`            compiler ${short(baselineArm.snapshot.compilerSourceFingerprint)}` +
      `  env ${JSON.stringify(baselineArm.snapshot.compilerEnvironment)}`);
  }
  const failures = identity.checks.filter((check) => !check.ok);
  console.log(
    `  identity  ${failures.length === 0 ? "PROVEN" : "NOT PROVEN"} — ${identity.checks.length} compile-identity ` +
    `checks over the mini manifest; every kept cell scores exactly as its canonical counterpart` +
    (mini.groups.filter((group) => group.complete).length === 0
      ? ""
      : `\n            canonical group scores: ${mini.groups.filter((group) => group.complete).map((group) => group.id).join(", ")}`),
  );
  for (const check of failures) console.log(`            FAIL ${check.claim}: ${check.detail}`);
  if (input.reReport === true) console.log(`  mode      --report: budget and seeds read from the archives; nothing compiled`);
  if (input.dryRun) console.log(`\n  --dry-run: nothing was compiled.`);
}

function writeMiniManifests(directory: string, mini: MiniManifests): [string, string] {
  const sourcePath = join(directory, "mini-source-manifest.json");
  const suitePath = join(directory, "mini-suite-manifest.json");
  writeFileSync(sourcePath, serializeManifest(mini.sourceManifest));
  writeFileSync(suitePath, serializeManifest(mini.suiteManifest));
  return [sourcePath, suitePath];
}

/**
 * Both arms compile through `scale_study.ts` in a subprocess, so this command
 * never imports the runner and cannot become part of the promoting chain.
 */
function runArm(input: {
  cwd: string;
  out: string;
  manifest: string;
  suite: string;
  budget: number;
  seeds: number[];
  jobs: number;
  env: Record<string, string>;
  clearLrEnvironment?: boolean;
}): void {
  const environment: Record<string, string | undefined> = { ...process.env };
  if (input.clearLrEnvironment === true) {
    for (const name of Object.keys(environment)) if (name.startsWith("LR_")) delete environment[name];
  }
  execFileSync(
    process.execPath,
    [
      "--import",
      "tsx",
      "scripts/v0/benchmark_v2/scale_study.ts",
      `--manifest=${input.manifest}`,
      `--suite=${input.suite}`,
      `--budgets=${input.budget}`,
      `--seeds=${input.seeds.join(",")}`,
      `--jobs=${input.jobs}`,
      "--budget-telemetry=off",
      `--out=${input.out}`,
    ],
    {
      cwd: input.cwd,
      env: { ...environment, ...input.env, LR_ENGINE: "wasm" },
      stdio: ["ignore", "inherit", "inherit"],
    },
  );
}

/**
 * Each arm archive is ~60 MB uncompressed with a 30 MB resume checkpoint beside
 * it, and the reading's own record already carries every cell of both arms.
 * Keep the gzipped archive — `readVerifiedArtifact` reads `.gz` directly, so
 * `--report` still works on it — and drop the redundant copies: about 195 MB
 * down to 17 MB per reading, on an instrument designed to accumulate a history.
 * Returns the path that survived.
 */
export function retainCompressedArchive(path: string): string {
  const compressed = `${path}.gz`;
  if (!existsSync(compressed) || !existsSync(`${compressed}.sha256`)) return path;
  for (const redundant of [path, `${path}.sha256`, `${path}.checkpoint.jsonl`]) {
    rmSync(redundant, { force: true });
  }
  return compressed;
}

/** Bytes of an archive and every sidecar this command may have left beside it. */
function armFootprint(path: string): number {
  const candidates = path.endsWith(".gz")
    ? [path, `${path}.sha256`]
    : [path, `${path}.sha256`, `${path}.gz`, `${path}.gz.sha256`, `${path}.checkpoint.jsonl`];
  return candidates.reduce((sum, entry) => sum + (existsSync(entry) ? statSync(entry).size : 0), 0);
}

function megabytes(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(0)} MB`;
}

function safeLabel(label: string): string {
  return label.replace(/[^a-zA-Z0-9_.-]+/g, "-").replace(/^-+|-+$/g, "") || "reading";
}

function short(fingerprint: unknown): string {
  return typeof fingerprint === "string" ? fingerprint.slice(0, 12) : String(fingerprint);
}

function signed(value: number, digits: number): string {
  if (!Number.isFinite(value)) return value > 0 ? "+inf" : "-inf";
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}`;
}

function fixed(value: number | null, width: number): string {
  return (value === null ? "-" : value.toFixed(2)).padStart(width);
}

function signedFixed(value: number | null, width: number): string {
  return (value === null ? "-" : signed(value, 2)).padStart(width);
}

function percent(value: number): string {
  return `${(100 * value).toFixed(2)}%`;
}

function finiteOrNull(value: number): number | null {
  return Number.isFinite(value) ? value : null;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function relativeToCwd(path: string): string {
  const relativePath = relative(process.cwd(), resolve(path));
  return relativePath.startsWith("..") ? resolve(path) : relativePath;
}

function gitHead(): string | null {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}
