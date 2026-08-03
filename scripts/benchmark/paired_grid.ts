/**
 * paired_grid — the shared reading half of every two-arm scale-study grid.
 *
 * WHAT LIVES HERE
 *   Two instruments compile the same cells twice and compare them:
 *   `mover_grid.ts` (an action-set probe over the sources a candidate can move)
 *   and `low_budget_reading.ts` (the standing 250k evidence reading). They
 *   disagree about what to *say*; they must never disagree about what a paired
 *   cell is, when two arms are comparable, or how a paired delta is computed.
 *   That common half is here so there is exactly one definition of each.
 *
 *   - a **cell** is (source, budget, seed) and its outcome under one arm;
 *   - two arms are **comparable** only if they scored the same specs with the
 *     same scorer over the same cells — anything else and the deltas measure
 *     the tooling instead of the compiler;
 *   - the **paired delta** is blocked by seed, because a seed is the
 *     independent replicate the campaign's own SE is built on: within one seed
 *     every source sees the same draw, so the block mean is the unit that
 *     varies. `docs/budget-aware-map.md` §6.2 is the standing reminder that
 *     seed blocks disagree structurally, not just noisily.
 *
 * WHAT DOES NOT LIVE HERE
 *   Verdicts, report layout, and disk schemas. Those belong to the instrument
 *   that owns the question. This module reads archives and does arithmetic.
 */

import { resolve } from "node:path";
import { readVerifiedArtifact } from "./study_lib.ts";

export const SCALE_STUDY_ARCHIVE_SCHEMA = "line.benchmark-v2.budget-scale-study.v2" as const;

/** One (source, budget, seed) outcome under one arm. */
export type GridCell = {
  sourceId: string;
  budget: number;
  seed: number;
  /** Invalid runs score 0, matching the evaluator's own treatment. */
  score: number;
  valid: boolean;
  trackHash: string | null;
  firstCompletionFrame: number | null;
  status: string;
};

export type GridArm = {
  label: string;
  path: string;
  archive: any;
  cells: Map<string, GridCell>;
  groups: Map<string, { score: number; stratum: string; members: string[] }>;
  sources: Map<string, { score: number; validRuns: number; totalRuns: number }>;
};

export function gridCellKey(sourceId: string, budget: number, seed: number): string {
  return `${sourceId}\0${budget}\0${seed}`;
}

/** Read one arm's `budget-scale-study.v2` archive through the retained-evidence checksum gate. */
export function readGridArm(label: string, path: string): GridArm {
  const absolute = resolve(path);
  const archive = JSON.parse(readVerifiedArtifact(absolute).bytes.toString("utf8"));
  if (archive?.schema !== SCALE_STUDY_ARCHIVE_SCHEMA) {
    throw new Error(`${path}: not a ${SCALE_STUDY_ARCHIVE_SCHEMA} archive`);
  }
  const cells = new Map<string, GridCell>();
  for (const row of archive.runs) {
    cells.set(gridCellKey(row.task.sourceId, row.task.budget, row.task.actualSeed), {
      sourceId: row.task.sourceId,
      budget: row.task.budget,
      seed: row.task.actualSeed,
      score: row.score.valid ? row.score.score : 0,
      valid: row.score.valid === true,
      trackHash: row.trackHash ?? null,
      firstCompletionFrame: (row.stats ?? {}).first_completion_frame ?? null,
      status: row.status,
    });
  }
  const groups: GridArm["groups"] = new Map(archive.summaries.flatMap((summary: any) =>
    summary.groups.map((group: any) => [group.id, {
      score: group.score as number,
      stratum: group.stratum as string,
      members: group.members as string[],
    }] as const)
  ));
  const sources: GridArm["sources"] = new Map(archive.summaries.flatMap((summary: any) =>
    summary.specifications.map((entry: any) => [entry.id, {
      score: entry.score as number,
      validRuns: entry.validRuns as number,
      totalRuns: entry.totalRuns as number,
    }] as const)
  ));
  return { label, path: absolute, archive, cells, groups, sources };
}

/**
 * A paired comparison is only paired if the two arms scored the same specs
 * with the same scorer over the same cells. Everything checked here is a
 * *hard* precondition except the engine kernel, which is a build artifact:
 * a mover grid compares TypeScript changes and must refuse an engine
 * difference, while a standing tree-vs-baseline reading legitimately spans one
 * and has to say so instead of refusing. Returns the notes a caller must show.
 */
export function assertPairedArms(
  candidate: GridArm,
  reference: GridArm,
  options: { allowEngineDrift?: boolean } = {},
): string[] {
  for (
    const field of [
      "suiteFingerprint",
      "sourceManifestFingerprint",
      "scoringProtocolFingerprint",
      "scorerFingerprint",
    ]
  ) {
    if (candidate.archive[field] !== reference.archive[field]) {
      throw new Error(`arms disagree on ${field}; the comparison is not paired`);
    }
  }
  const notes: string[] = [];
  const candidateEngine = candidate.archive.candidate.engineArtifactFingerprint;
  const referenceEngine = reference.archive.candidate.engineArtifactFingerprint;
  if (candidateEngine !== referenceEngine) {
    const detail = `arms ran different engine kernels (${short(candidateEngine)} vs ${short(referenceEngine)}); ` +
      `every delta below is compiler AND engine`;
    if (options.allowEngineDrift !== true) {
      throw new Error(`${detail}; rebuild so both arms share one kernel`);
    }
    notes.push(detail);
  }
  const referenceSpecs = new Map(
    reference.archive.runs.map((row: any) => [row.task.sourceId, row.source.sourceFingerprint]),
  );
  for (const row of candidate.archive.runs) {
    if (referenceSpecs.get(row.task.sourceId) !== row.source.sourceFingerprint) {
      throw new Error(`${row.task.sourceId}: spec bytes differ between arms; the ref moved the benchmark, not the compiler`);
    }
  }
  const missing = [...candidate.cells.keys()].filter((key) => !reference.cells.has(key));
  if (missing.length > 0 || candidate.cells.size !== reference.cells.size) {
    throw new Error(`arms cover different cells (${candidate.cells.size} vs ${reference.cells.size})`);
  }
  return notes;
}

/**
 * Compiler identity records the `LR_`-prefixed environment and the compiler
 * bytes. An arm gated on anything else — a differently-prefixed probe knob, an
 * untracked input — is invisible to it. Say so rather than mis-report a real
 * difference as a self-check.
 */
export function describeArmIdentity(candidate: GridArm, reference: GridArm, changedCells: number): string {
  const same = candidate.archive.candidate.candidateFingerprint ===
    reference.archive.candidate.candidateFingerprint;
  if (same && changedCells === 0) {
    return "arms share a candidate fingerprint and every cell is bit-identical — self-check passed";
  }
  if (same) {
    return `arms share a candidate fingerprint yet differ on ${changedCells} cells: whatever separates them is ` +
      `invisible to compiler identity (a non-LR_ env knob, or an untracked input). Record it yourself — the archive cannot.`;
  }
  return `candidate ${short(candidate.archive.candidate.candidateFingerprint)} vs ` +
    `ref ${short(reference.archive.candidate.candidateFingerprint)}`;
}

export type CellPair = { key: string; ref: GridCell; candidate: GridCell };

export type PairedGrid = {
  /** Every cell, in sorted key order, so two runs of this produce one diff. */
  pairs: CellPair[];
  /** The action set: pairs whose compiled track differs. */
  changed: CellPair[];
  /** valid -> invalid. One of these costs roughly 50 headline points (§6.1). */
  lost: CellPair[];
  /** invalid -> valid. The rescue class the low-budget reading exists to see. */
  gained: CellPair[];
  /** Sum of (candidate - ref) over every cell. */
  scoreDelta: number;
};

export function pairGridCells(candidate: GridArm, reference: GridArm): PairedGrid {
  const pairs = [...reference.cells.keys()].sort().map((key) => ({
    key,
    ref: reference.cells.get(key)!,
    candidate: candidate.cells.get(key)!,
  }));
  const changed = pairs.filter((pair) => pair.ref.trackHash !== pair.candidate.trackHash);
  return {
    pairs,
    changed,
    lost: pairs.filter((pair) => pair.ref.valid && !pair.candidate.valid),
    gained: pairs.filter((pair) => !pair.ref.valid && pair.candidate.valid),
    scoreDelta: pairs.reduce((sum, pair) => sum + pair.candidate.score - pair.ref.score, 0),
  };
}

export type SeedBlockDelta = {
  /** One entry per seed, ascending: the seed's mean paired per-cell delta. */
  blocks: Array<{ seed: number; cells: number; meanDelta: number }>;
  /** Mean over blocks — the reading's point estimate, in points per cell. */
  meanDelta: number;
  /** Sample standard deviation across blocks. */
  standardDeviation: number;
  /** Standard error of `meanDelta`. */
  standardError: number;
  /**
   * meanDelta / standardError. Infinite when the blocks agree exactly on a
   * non-zero delta — a real statement (perfectly consistent movement), not a
   * defect; zero when there is no movement at all.
   */
  t: number;
  degreesOfFreedom: number;
};

/**
 * The paired delta, blocked by seed.
 *
 * Cells within one seed are not independent replicates — the seed is. Pooling
 * cells would divide by sqrt(sources x seeds) and overstate precision by the
 * square root of the source count; blocking by seed is what the campaign's own
 * eval does and what makes this number comparable to a campaign SE.
 */
export function seedBlockPairedDelta(pairs: CellPair[]): SeedBlockDelta {
  const bySeed = new Map<number, number[]>();
  for (const pair of pairs) {
    const deltas = bySeed.get(pair.ref.seed) ?? [];
    deltas.push(pair.candidate.score - pair.ref.score);
    bySeed.set(pair.ref.seed, deltas);
  }
  const blocks = [...bySeed.entries()]
    .sort((left, right) => left[0] - right[0])
    .map(([seed, deltas]) => ({
      seed,
      cells: deltas.length,
      meanDelta: deltas.reduce((sum, delta) => sum + delta, 0) / deltas.length,
    }));
  const n = blocks.length;
  if (n === 0) {
    return { blocks, meanDelta: 0, standardDeviation: 0, standardError: 0, t: 0, degreesOfFreedom: 0 };
  }
  const meanDelta = blocks.reduce((sum, block) => sum + block.meanDelta, 0) / n;
  const variance = n < 2
    ? 0
    : blocks.reduce((sum, block) => sum + (block.meanDelta - meanDelta) ** 2, 0) / (n - 1);
  const standardDeviation = Math.sqrt(variance);
  const standardError = n < 2 ? 0 : standardDeviation / Math.sqrt(n);
  const t = standardError > 0
    ? meanDelta / standardError
    : meanDelta === 0 ? 0 : Math.sign(meanDelta) * Infinity;
  return { blocks, meanDelta, standardDeviation, standardError, t, degreesOfFreedom: Math.max(0, n - 1) };
}

function short(fingerprint: unknown): string {
  return typeof fingerprint === "string" ? fingerprint.slice(0, 12) : String(fingerprint);
}
