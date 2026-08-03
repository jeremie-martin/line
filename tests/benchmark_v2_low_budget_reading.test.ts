import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { gzipSync } from "node:zlib";
import { join, resolve } from "node:path";
import { afterAll, describe, expect, test } from "vitest";
import {
  BUDGET_RATIONALE,
  CAMPAIGN_BASELINE_PATH,
  INSTRUMENT_VERSION,
  LOW_BUDGET_INDEX_SCHEMA,
  LOW_BUDGET_READING_SCHEMA,
  PRIMARY_BUDGET,
  READING_SEEDS,
  READING_SOURCE_SUBSET,
  REFERENCE_LOSS_RATE,
  VERDICT_CRITERIA,
  VERDICT_T,
  buildGroupRows,
  buildReadingRecord,
  buildSourceRows,
  formatReadingBlock,
  loadCampaignBaselineArm,
  readingIndexEntry,
  readingVerdict,
  retainCompressedArchive,
  writeReading,
  type VerdictCode,
} from "../scripts/benchmark/low_budget_reading.ts";
import {
  assertPairedArms,
  gridCellKey,
  pairGridCells,
  readGridArm,
  seedBlockPairedDelta,
  type GridArm,
  type GridCell,
} from "../scripts/benchmark/paired_grid.ts";
import { actionSetPower, requiredChangedCells } from "../scripts/benchmark/action_set_power.ts";
import {
  deriveMiniManifests,
  loadCanonicalManifests,
  resolveSourceSubset,
  verifyMiniManifestIdentity,
} from "../scripts/benchmark/mini_manifest.ts";

const canonical = loadCanonicalManifests();
const canonicalGroups = new Map(canonical.suite.strata.flatMap((stratum) =>
  stratum.groups.map((group) => [group.id, group.members] as const)
));
const mini = deriveMiniManifests(
  canonical.sources,
  canonical.suite,
  resolveSourceSubset("group:rapid_pickup_frontier", canonical.resolved, canonical.suite),
);
const identity = verifyMiniManifestIdentity(canonical.sources, canonical.suite, mini);
const BUDGET = 250_000;

const temporaries: string[] = [];
function scratch(): string {
  const path = mkdtempSync(join(tmpdir(), "low-budget-reading-test-"));
  temporaries.push(path);
  return path;
}
afterAll(() => {
  for (const path of temporaries) rmSync(path, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Synthetic arms. Cells are what the verdict and the tables are computed from,
// so the fixtures are stated as cells and everything else is derived.
// ---------------------------------------------------------------------------

type CellSpec = { sourceId: string; seed: number; score: number; valid?: boolean; trackHash?: string };

function armFrom(
  label: string,
  cellSpecs: CellSpec[],
  candidate: Record<string, unknown>,
  groupScores: Map<string, number> = new Map(),
): GridArm {
  const cells = new Map<string, GridCell>();
  for (const spec of cellSpecs) {
    const valid = spec.valid ?? true;
    cells.set(gridCellKey(spec.sourceId, BUDGET, spec.seed), {
      sourceId: spec.sourceId,
      budget: BUDGET,
      seed: spec.seed,
      score: valid ? spec.score : 0,
      valid,
      trackHash: spec.trackHash ?? `${label}:${spec.sourceId}:${spec.seed}`,
      firstCompletionFrame: valid ? 1000 + spec.seed : null,
      status: valid ? "ok" : "error",
    });
  }
  const sources = new Map<string, { score: number; validRuns: number; totalRuns: number }>();
  for (const id of new Set(cellSpecs.map((spec) => spec.sourceId))) {
    const rows = [...cells.values()].filter((cell) => cell.sourceId === id);
    sources.set(id, {
      score: rows.reduce((sum, cell) => sum + cell.score, 0) / rows.length,
      validRuns: rows.filter((cell) => cell.valid).length,
      totalRuns: rows.length,
    });
  }
  const groups = new Map(mini.groups.map((group) => [group.id, {
    score: groupScores.get(group.id) ??
      group.members.reduce((sum, id) => sum + (sources.get(id)?.score ?? 0), 0) / group.members.length,
    stratum: group.stratum as string,
    members: [...group.members],
  }]));
  const archive = {
    schema: "line.benchmark-v2.budget-scale-study.v2",
    generatedAt: "2026-08-03T00:00:00.000Z",
    suiteFingerprint: "s".repeat(64),
    sourceManifestFingerprint: "m".repeat(64),
    scoringProtocolFingerprint: "p".repeat(64),
    scorerFingerprint: "c".repeat(64),
    transform: { kind: "production_felt_jolt", jolt_ms: -15 },
    candidate,
    environment: { node: "v22.0.0", platform: "linux", architecture: "x64" },
    budgets: [BUDGET],
    seeds: [...new Set(cellSpecs.map((spec) => spec.seed))].sort((a, b) => a - b),
    summaries: [{
      budget: BUDGET,
      score: [...groups.values()].reduce((sum, group) => sum + group.score, 0) / Math.max(1, groups.size),
      validRuns: [...cells.values()].filter((cell) => cell.valid).length,
      totalRuns: cells.size,
      specifications: [...sources].map(([id, entry]) => ({ id, ...entry })),
      groups: [...groups].map(([id, group]) => ({ id, ...group })),
      strata: [],
    }],
    runs: [...cells.values()].map((cell) => ({
      task: { sourceId: cell.sourceId, budget: cell.budget, seedSlot: cell.seed, actualSeed: cell.seed },
      source: { id: cell.sourceId, sourceFingerprint: `f-${cell.sourceId}` },
      status: cell.status,
      trackHash: cell.trackHash,
      stats: { first_completion_frame: cell.firstCompletionFrame },
      score: { valid: cell.valid, score: cell.score },
    })),
  };
  return { label, path: `/synthetic/${label}.json`, archive, cells, groups, sources };
}

function candidateIdentity(tag: string): Record<string, unknown> {
  return {
    engine: "wasm",
    head: `${tag}head`.padEnd(40, "0"),
    candidateFingerprint: tag.repeat(64).slice(0, 64),
    compilerSourceFingerprint: tag.repeat(64).slice(0, 64).split("").reverse().join(""),
    compilerDiffSha256: "d".repeat(64),
    compilerIdentityProtocol: "line.compiler-source-identity.v2",
    engineArtifactFingerprint: "e".repeat(64),
    compilerEnvironment: {},
    trackedChanges: [],
    compilerSourceFiles: ["scripts/v0/optimizer/handoff.ts"],
  };
}

/** The 2 movers x seeds grid the fixtures use, plus the 3 back-filled controls. */
function grid(seeds: number[], score: (sourceId: string, seed: number) => number): CellSpec[] {
  return mini.keptIds.flatMap((sourceId) => seeds.map((seed) => ({ sourceId, seed, score: score(sourceId, seed) })));
}

function recordFrom(tree: GridArm, baseline: GridArm, label = "fixture") {
  return buildReadingRecord({
    label,
    generatedAt: "2026-08-03T12-00-00.000Z".replace(/-/g, ":").replace("2026:08:03", "2026-08-03"),
    budget: BUDGET,
    seeds: [...new Set([...baseline.cells.values()].map((cell) => cell.seed))].sort((a, b) => a - b),
    jobs: 16,
    subset: "group:rapid_pickup_frontier",
    mini,
    identity,
    baselineArm: null,
    tree,
    baseline,
    canonicalGroups,
    archivePaths: { tree: "/synthetic/tree.json", baseline: "/synthetic/baseline.json" },
    pairingNotes: [],
  });
}

// ---------------------------------------------------------------------------

describe("the verdict vocabulary", () => {
  const paired = (t: number) => ({ meanDelta: t * 0.5, standardError: 0.5, t });
  const verdict = (input: {
    changedCells: number;
    rescues?: number;
    losses?: number;
    t?: number;
  }) => readingVerdict({
    changedCells: input.changedCells,
    rescues: input.rescues ?? 0,
    losses: input.losses ?? 0,
    paired: paired(input.t ?? 0),
    power: actionSetPower({ changedCells: input.changedCells, adverseEvents: input.losses ?? 0 }),
  });

  test("rule 1 — an empty action set is PARITY and says nothing was tested", () => {
    const result = verdict({ changedCells: 0 });
    expect(result.code).toBe<VerdictCode>("PARITY");
    expect(result.rule).toBe(1);
    expect(result.rationale).toMatch(/bit-identical/);
    expect(result.rationale).toMatch(/nothing was tested/);
  });

  test("rule 2 — losing more completions than it heals is ADVERSE however good the score looks", () => {
    const result = verdict({ changedCells: 100, rescues: 1, losses: 3, t: +9 });
    expect(result.code).toBe<VerdictCode>("ADVERSE");
    expect(result.rule).toBe(2);
    // The 50-points-per-loss arithmetic is why completions outrank the score.
    expect(result.rationale).toMatch(/50 headline points/);
  });

  test("rule 2 — a reliably negative paired delta is ADVERSE with the completion count unmoved", () => {
    expect(verdict({ changedCells: 100, t: -VERDICT_T }).code).toBe<VerdictCode>("ADVERSE");
    expect(verdict({ changedCells: 100, t: -3 }).rule).toBe(2);
  });

  test("rule 2 outranks rule 3 — a rescue does not excuse a reliably negative delta", () => {
    expect(verdict({ changedCells: 100, rescues: 2, losses: 0, t: -5 }).code).toBe<VerdictCode>("ADVERSE");
  });

  test("rule 3 — net healed completions is RESCUE-POSITIVE, the class this reading exists for", () => {
    const result = verdict({ changedCells: 120, rescues: 11, losses: 0, t: +1 });
    expect(result.code).toBe<VerdictCode>("RESCUE-POSITIVE");
    expect(result.rule).toBe(3);
    expect(result.rationale).toMatch(/11 net completions healed/);
  });

  test("rule 3 fires on a net rescue even when some completions were lost", () => {
    expect(verdict({ changedCells: 120, rescues: 4, losses: 2, t: 0 }).code).toBe<VerdictCode>("RESCUE-POSITIVE");
  });

  test("rule 4 — a reliably better delta with the completion count unmoved is SCORE-POSITIVE", () => {
    const result = verdict({ changedCells: 120, rescues: 0, losses: 0, t: +VERDICT_T });
    expect(result.code).toBe<VerdictCode>("SCORE-POSITIVE");
    expect(result.rule).toBe(4);
  });

  test("rule 5 — a clean null big enough to see the known loss rate is PARITY, not UNDERPOWERED", () => {
    // 66 changed cells is exactly what a zero-loss observation needs to exclude
    // the 4.4% rate the 1b eval measured.
    const needed = requiredChangedCells(REFERENCE_LOSS_RATE);
    expect(needed).toBe(66);
    const powered = verdict({ changedCells: needed, t: +0.4 });
    expect(powered.code).toBe<VerdictCode>("PARITY");
    expect(powered.rule).toBe(5);
    expect(powered.rationale).toMatch(/4\.44%/);
  });

  test("rule 6 — one cell short of that, the same null is UNDERPOWERED", () => {
    const result = verdict({ changedCells: requiredChangedCells(REFERENCE_LOSS_RATE) - 1, t: +0.4 });
    expect(result.code).toBe<VerdictCode>("UNDERPOWERED");
    expect(result.rule).toBe(6);
    expect(result.rationale).toMatch(/neither direction is established/);
  });

  test("rule 6 — a lost completion balanced by a rescue is never quietly called parity", () => {
    const result = verdict({ changedCells: 400, rescues: 1, losses: 1, t: +0.2 });
    expect(result.code).toBe<VerdictCode>("UNDERPOWERED");
  });

  test("every verdict carries its criteria and the inputs it was computed from", () => {
    const result = verdict({ changedCells: 12, rescues: 1, losses: 0, t: 1 });
    expect(result.criteria).toBe(VERDICT_CRITERIA);
    expect(result.inputs).toMatchObject({
      changedCells: 12,
      rescues: 1,
      losses: 0,
      thresholdT: VERDICT_T,
      referenceLossRate: REFERENCE_LOSS_RATE,
    });
    expect(result.inputs.exclusionBound).toBeGreaterThan(0);
  });

  test("the vocabulary is closed — no run can invent a sixth code", () => {
    const codes = new Set<string>();
    for (const changedCells of [0, 10, 66, 400]) {
      for (const rescues of [0, 1, 3]) {
        for (const losses of [0, 1, 3]) {
          for (const t of [-9, -2, -0.5, 0, 0.5, 2, 9]) {
            codes.add(verdict({ changedCells, rescues, losses, t }).code);
          }
        }
      }
    }
    expect([...codes].sort()).toEqual(
      ["ADVERSE", "PARITY", "RESCUE-POSITIVE", "SCORE-POSITIVE", "UNDERPOWERED"],
    );
  });

  test("the documented criteria string names every rule the code implements", () => {
    for (const code of ["PARITY", "ADVERSE", "RESCUE-POSITIVE", "SCORE-POSITIVE", "UNDERPOWERED"]) {
      expect(VERDICT_CRITERIA).toContain(code);
    }
  });
});

describe("the paired delta is blocked by seed", () => {
  test("a seed is the replicate, so the SE is not the pooled-cell SE", () => {
    const baseline = armFrom("base", grid([0, 1, 2, 3], () => 100), candidateIdentity("a"));
    // Every source in a seed block moves together: the block means vary, the
    // within-block cells do not. Pooling cells would understate that spread.
    const shift = new Map([[0, +4], [1, -4], [2, +4], [3, -4]]);
    const tree = armFrom("tree", grid([0, 1, 2, 3], (_id, seed) => 100 + shift.get(seed)!), candidateIdentity("b"));
    const delta = seedBlockPairedDelta(pairGridCells(tree, baseline).pairs);
    expect(delta.blocks.map((block) => block.meanDelta)).toEqual([4, -4, 4, -4]);
    expect(delta.meanDelta).toBeCloseTo(0, 12);
    expect(delta.standardDeviation).toBeCloseTo(4 * Math.sqrt(4 / 3), 12);
    expect(delta.degreesOfFreedom).toBe(3);
  });

  test("blocks that agree exactly on a non-zero delta report an infinite t, not a divide-by-zero", () => {
    const baseline = armFrom("base", grid([0, 1, 2], () => 100), candidateIdentity("a"));
    const tree = armFrom("tree", grid([0, 1, 2], () => 105), candidateIdentity("b"));
    const delta = seedBlockPairedDelta(pairGridCells(tree, baseline).pairs);
    expect(delta.meanDelta).toBeCloseTo(5, 12);
    expect(delta.standardError).toBe(0);
    expect(delta.t).toBe(Infinity);
  });

  test("no movement at all is t = 0, not NaN", () => {
    const baseline = armFrom("base", grid([0, 1], () => 100), candidateIdentity("a"));
    const tree = armFrom("tree", grid([0, 1], () => 100), candidateIdentity("b"));
    expect(seedBlockPairedDelta(pairGridCells(tree, baseline).pairs).t).toBe(0);
  });

  test("an empty grid is a defined zero rather than an exception", () => {
    expect(seedBlockPairedDelta([]).blocks).toEqual([]);
    expect(seedBlockPairedDelta([]).t).toBe(0);
  });
});

describe("pairing preconditions", () => {
  const baseline = armFrom("base", grid([0, 1], () => 100), candidateIdentity("a"));

  test("a scorer or suite disagreement refuses to be reported as a paired delta", () => {
    const tree = armFrom("tree", grid([0, 1], () => 100), candidateIdentity("b"));
    tree.archive.scorerFingerprint = "x".repeat(64);
    expect(() => assertPairedArms(tree, baseline)).toThrow(/not paired/);
  });

  test("a moved spec is caught as the benchmark moving, not the compiler", () => {
    const tree = armFrom("tree", grid([0, 1], () => 100), candidateIdentity("b"));
    tree.archive.runs[0].source.sourceFingerprint = "moved";
    expect(() => assertPairedArms(tree, baseline)).toThrow(/moved the benchmark/);
  });

  test("an engine difference is fatal for a mover grid and a stated note for this reading", () => {
    const tree = armFrom("tree", grid([0, 1], () => 100), {
      ...candidateIdentity("b"),
      engineArtifactFingerprint: "9".repeat(64),
    });
    expect(() => assertPairedArms(tree, baseline)).toThrow(/different engine kernels/);
    const notes = assertPairedArms(tree, baseline, { allowEngineDrift: true });
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatch(/compiler AND engine/);
  });

  test("differing cell coverage is refused rather than silently intersected", () => {
    const tree = armFrom("tree", grid([0, 1, 2], () => 100), candidateIdentity("b"));
    expect(() => assertPairedArms(tree, baseline, { allowEngineDrift: true })).toThrow(/different cells/);
  });
});

describe("derived tables", () => {
  const seeds = [0, 1, 2, 3];
  const baseline = armFrom("base", grid(seeds, () => 100), candidateIdentity("a"));
  const movers = mini.keptIds.filter((id) => !mini.controlIds.includes(id));
  // One mover is rescued on seed 0 and loses a completion on seed 1; controls
  // are carried across bit-identically, as a control must be.
  const treeCells = grid(seeds, () => 100).map((cell) => {
    if (mini.controlIds.includes(cell.sourceId)) return { ...cell, trackHash: `base:${cell.sourceId}:${cell.seed}` };
    if (cell.sourceId === movers[0] && cell.seed === 1) return { ...cell, score: 0, valid: false };
    return { ...cell, score: 112 };
  });
  const baselineCells = grid(seeds, () => 100).map((cell) =>
    cell.sourceId === movers[0] && cell.seed === 0 ? { ...cell, score: 0, valid: false } : cell
  );
  const baselineWithFailure = armFrom("base", baselineCells, candidateIdentity("a"));
  const tree = armFrom("tree", treeCells, candidateIdentity("b"));
  const pairs = pairGridCells(tree, baselineWithFailure).pairs;

  test("group rows tally exactly the cells of their members", () => {
    const rows = buildGroupRows(tree, baselineWithFailure, pairs, canonicalGroups);
    const pickup = rows.find((row) => row.id === "rapid_pickup_frontier")!;
    expect(pickup.scope).toBe("canonical");
    expect(pickup.cells).toBe(movers.length * seeds.length);
    expect(pickup.rescued).toBe(1);
    expect(pickup.lost).toBe(1);
    expect(pickup.baselineValid + 1).toBe(pickup.cells);
    expect(pickup.treeValid + 1).toBe(pickup.cells);
  });

  test("a partially kept group is labelled partial so its score is never quoted as canonical", () => {
    const rows = buildGroupRows(tree, baselineWithFailure, pairs, canonicalGroups);
    const partial = rows.filter((row) => row.scope.startsWith("partial"));
    expect(partial.length).toBeGreaterThan(0);
    for (const row of partial) expect(row.scope).toMatch(/^partial \d+\/\d+$/);
  });

  test("controls are labelled and stay bit-identical in the fixture, as a control must", () => {
    const rows = buildSourceRows(tree, baselineWithFailure, pairs, new Set(mini.controlIds));
    const controls = rows.filter((row) => row.role === "control");
    expect(controls.map((row) => row.id).sort()).toEqual([...mini.controlIds].sort());
    for (const row of controls) expect(row.changedCells).toBe(0);
    expect(rows.filter((row) => row.role === "mover").every((row) => row.changedCells > 0)).toBe(true);
  });

  test("the record's rescue and loss lists name the exact cells", () => {
    const record = recordFrom(tree, baselineWithFailure);
    expect(record.completions.rescued).toHaveLength(1);
    expect(record.completions.lost).toHaveLength(1);
    expect(record.completions.rescued[0]).toMatchObject({ sourceId: movers[0], seed: 0 });
    expect(record.completions.lost[0]).toMatchObject({ sourceId: movers[0], seed: 1 });
    expect(record.completions.net).toBe(0);
  });
});

describe("provenance completeness", () => {
  const tree = armFrom("tree", grid([0, 1, 2], () => 105), candidateIdentity("b"));
  const baseline = armFrom("base", grid([0, 1, 2], () => 100), candidateIdentity("a"));
  const record = recordFrom(tree, baseline);

  test("a future study can identify both compilers without re-running anything", () => {
    for (const arm of [record.provenance.arms.tree, record.provenance.arms.baseline]) {
      expect(arm.candidateFingerprint).toMatch(/^[a-z0-9]{64}$/);
      expect(arm.compilerSourceFingerprint).toMatch(/^[a-z0-9]{64}$/);
      expect(arm.engineArtifactFingerprint).toMatch(/^[a-z0-9]{64}$/);
      expect(arm.compilerIdentityProtocol).toBe("line.compiler-source-identity.v2");
      expect(arm.compilerEnvironment).toEqual({});
      expect(arm.archive).toBeTruthy();
    }
    expect(record.provenance.arms.tree.candidateFingerprint)
      .not.toBe(record.provenance.arms.baseline.candidateFingerprint);
  });

  test("the scoring contract that produced the numbers is pinned", () => {
    for (
      const field of [
        "suiteFingerprint",
        "sourceManifestFingerprint",
        "scoringProtocolFingerprint",
        "scorerFingerprint",
      ] as const
    ) {
      expect(record.provenance[field]).toMatch(/^[a-z0-9]{64}$/);
    }
    expect(record.provenance.transform).toEqual({ kind: "production_felt_jolt", jolt_ms: -15 });
  });

  test("the operating point, the cells and the instrument version are all recorded", () => {
    expect(record.plan.budget).toBe(BUDGET);
    expect(record.plan.seeds).toEqual([0, 1, 2]);
    expect(record.plan.sourceIds).toEqual(mini.keptIds);
    expect(record.plan.controlIds).toEqual(mini.controlIds);
    expect(record.plan.moverIds.length + record.plan.controlIds.length).toBe(record.plan.sourceIds.length);
    expect(record.plan.cellsPerArm).toBe(mini.keptIds.length * 3);
    expect(record.instrumentVersion).toBe(INSTRUMENT_VERSION);
    expect(record.schema).toBe(LOW_BUDGET_READING_SCHEMA);
    expect(record.provenance.instrument.version).toBe(INSTRUMENT_VERSION);
    expect(record.provenance.instrument.script).toBe("scripts/benchmark/low_budget_reading.ts");
  });

  test("the mini manifest and its compile-identity proof travel with the record", () => {
    const manifest = record.provenance.miniManifest;
    expect(manifest.keptIds).toEqual(mini.keptIds);
    expect(manifest.compileIdentity.ok).toBe(true);
    expect(manifest.compileIdentity.checks.length).toBeGreaterThan(5);
    expect(manifest.groups.some((group) => group.complete)).toBe(true);
  });

  test("the reading declares itself non-promoting and explains its budget", () => {
    expect(record.promoting).toBe(false);
    expect(record.note).toMatch(/never promoting/);
    expect(record.note).toMatch(/not the suite headline/);
    expect(record.budgetRationale).toBe(BUDGET_RATIONALE);
    expect(record.budgetRationale).toMatch(/250k/);
    expect(record.budgetRationale).toMatch(/300k/);
    expect(record.aggregate.note).toMatch(/NOT the suite headline/);
  });

  test("every cell carries both sides, so the record is re-analysable without the archives", () => {
    expect(record.cells).toHaveLength(mini.keptIds.length * 3);
    for (const cell of record.cells) {
      expect(cell.baseline.trackHash).toBeTruthy();
      expect(cell.tree.trackHash).toBeTruthy();
      expect(typeof cell.baseline.valid).toBe("boolean");
      expect(typeof cell.tree.valid).toBe("boolean");
      expect(cell.delta).toBeCloseTo(cell.tree.score - cell.baseline.score, 12);
      expect(cell.changed).toBe(cell.baseline.trackHash !== cell.tree.trackHash);
    }
  });

  test("the record survives a JSON round trip unchanged", () => {
    expect(JSON.parse(JSON.stringify(record))).toEqual(JSON.parse(JSON.stringify(record)));
    expect(JSON.parse(JSON.stringify(record)).verdict.code).toBe(record.verdict.code);
  });

  test("an infinite t is stored as null rather than as the string \"null\" JSON produces", () => {
    // Every fixture block moves by exactly +5, so t is infinite by construction.
    expect(record.paired.standardError).toBe(0);
    expect(record.paired.t).toBeNull();
    expect(record.verdict.inputs.t).toBe(Infinity);
    expect(JSON.parse(JSON.stringify(record)).paired.t).toBeNull();
  });
});

describe("the terminal block", () => {
  const movers = mini.keptIds.filter((id) => !mini.controlIds.includes(id));
  const baseline = armFrom(
    "base",
    grid([0, 1, 2, 3], () => 100).map((cell) =>
      cell.sourceId === movers[0] && cell.seed === 0 ? { ...cell, score: 0, valid: false } : cell
    ),
    candidateIdentity("a"),
  );
  const tree = armFrom("tree", grid([0, 1, 2, 3], (_id, seed) => 100 + seed), candidateIdentity("b"));
  const block = formatReadingBlock(recordFrom(tree, baseline, "terminal-fixture"));

  test("it leads with what was measured and against what", () => {
    expect(block).toMatch(/^LOW-BUDGET READING {2}250k x 4 seeds x \d+ sources = \d+ cells per arm {2}\(terminal-fixture\)/);
    expect(block).toContain("  tree      ");
    expect(block).toContain("  baseline  ");
  });

  test("the verdict is one line with its reason", () => {
    const verdictLine = block.split("\n").find((line) => line.startsWith("VERDICT"))!;
    expect(verdictLine).toMatch(/^VERDICT {2}(PARITY|ADVERSE|RESCUE-POSITIVE|SCORE-POSITIVE|UNDERPOWERED) {2}— {2}\S/);
    expect(block.split("\n").filter((line) => line.startsWith("VERDICT"))).toHaveLength(1);
  });

  test("the capability groups are a table and the aggregate is disclaimed in place", () => {
    expect(block).toContain("capability group");
    expect(block).toContain("rapid_pickup_frontier");
    expect(block).toContain("— controls —");
    expect(block).toMatch(/SUBSET AGGREGATE.*renormalized subset, NOT a headline/);
  });

  test("healed and lost completions are named, not just counted", () => {
    expect(block).toContain("completions  1 rescued, 0 lost");
    expect(block).toContain(`RESCUED  ${movers[0]}`);
  });

  test("a long completion list is truncated with the elision stated, never silently", () => {
    // Every mover cell fails in the baseline and is healed in the tree.
    const seeds = [0, 1, 2, 3, 4, 5];
    const failing = armFrom(
      "base",
      grid(seeds, () => 100).map((cell) =>
        mini.controlIds.includes(cell.sourceId) ? cell : { ...cell, score: 0, valid: false }
      ),
      candidateIdentity("a"),
    );
    const healed = armFrom("tree", grid(seeds, () => 100), candidateIdentity("b"));
    const record = recordFrom(healed, failing, "many-rescues");
    expect(record.completions.rescued.length).toBeGreaterThan(8);
    const text = formatReadingBlock(record);
    expect(text).toContain("VERDICT  RESCUE-POSITIVE");
    expect(text).toMatch(/\.\.\. and \d+ more, all of them in the record/);
    expect(text.split("\n").filter((line) => line.includes("RESCUED"))).toHaveLength(8);
  });

  test("the power footer is always present and the reading disclaims promotion", () => {
    expect(block).toContain("ACTION-SET POWER");
    expect(block).toContain("exclusion bound");
    expect(block).toContain("Evidence, never promotion");
    expect(block).toContain("npm run benchmark -- eval");
  });

  test("a bit-identical pair still prints the power footer, saying it excluded nothing", () => {
    const same = armFrom("tree", grid([0, 1], () => 100), candidateIdentity("b"));
    const identical = armFrom("tree", grid([0, 1], () => 100), candidateIdentity("b"));
    const quiet = formatReadingBlock(recordFrom(same, identical, "identical"));
    expect(quiet).toContain("VERDICT  PARITY");
    expect(quiet).toContain("ACTION-SET POWER");
    expect(quiet).toContain("changed nothing");
  });

  test("a moved control is called out instead of blending into the table", () => {
    const movedControl = armFrom(
      "tree",
      grid([0, 1], () => 100).map((cell) =>
        cell.sourceId === mini.controlIds[0] ? { ...cell, trackHash: "moved" } : cell
      ),
      candidateIdentity("b"),
    );
    const quiet = armFrom("base", grid([0, 1], () => 100), candidateIdentity("a"));
    expect(formatReadingBlock(recordFrom(movedControl, quiet, "moved-control")))
      .toContain("MOVED — the arms differ by more than the capability mechanism");
  });

  test("it stays inside a terminal width and a screenful", () => {
    const lines = block.split("\n");
    expect(lines.length).toBeLessThan(45);
    for (const line of lines) expect(line.length).toBeLessThanOrEqual(120);
  });
});

describe("the reading history on disk", () => {
  test("a record is written with a checksum sidecar the study reader accepts", () => {
    const directory = scratch();
    const tree = armFrom("tree", grid([0, 1], () => 101), candidateIdentity("b"));
    const baseline = armFrom("base", grid([0, 1], () => 100), candidateIdentity("a"));
    const written = writeReading(directory, recordFrom(tree, baseline, "first"));
    expect(existsSync(written.record)).toBe(true);
    const bytes = readFileSync(written.record);
    const sidecar = readFileSync(`${written.record}.sha256`, "utf8").trim().split(/\s+/)[0];
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(sidecar);
    expect(JSON.parse(bytes.toString("utf8")).schema).toBe(LOW_BUDGET_READING_SCHEMA);
  });

  test("readings accumulate into an append-only history, one line each", () => {
    const directory = scratch();
    const baseline = armFrom("base", grid([0, 1], () => 100), candidateIdentity("a"));
    for (const [index, score] of [100, 104, 96].entries()) {
      const tree = armFrom("tree", grid([0, 1], () => score), candidateIdentity("b"));
      const record = { ...recordFrom(tree, baseline, `run-${index}`) };
      record.generatedAt = `2026-08-0${index + 1}T00:00:00.000Z`;
      writeReading(directory, record);
    }
    const lines = readFileSync(join(directory, "index.jsonl"), "utf8").trim().split("\n");
    expect(lines).toHaveLength(3);
    const entries = lines.map((line) => JSON.parse(line));
    expect(entries.map((entry) => entry.label)).toEqual(["run-0", "run-1", "run-2"]);
    for (const entry of entries) {
      expect(entry.schema).toBe(LOW_BUDGET_INDEX_SCHEMA);
      expect(entry.budget).toBe(BUDGET);
      expect(entry.verdict).toBeTruthy();
      expect(existsSync(resolve(entry.record))).toBe(true);
      expect(createHash("sha256").update(readFileSync(resolve(entry.record))).digest("hex"))
        .toBe(entry.recordSha256);
    }
    // The history is the point: a later reading is comparable to an earlier one.
    expect(entries[1].meanDelta).toBeGreaterThan(entries[0].meanDelta);
    expect(entries[2].meanDelta).toBeLessThan(entries[0].meanDelta);
  });

  test("the index line answers the standing questions without opening the record", () => {
    const tree = armFrom("tree", grid([0, 1], () => 103), candidateIdentity("b"));
    const baseline = armFrom("base", grid([0, 1], () => 100), candidateIdentity("a"));
    const record = recordFrom(tree, baseline, "index-shape");
    const entry = readingIndexEntry(record, "/tmp/x.json", "0".repeat(64));
    for (
      const key of [
        "generatedAt",
        "label",
        "record",
        "recordSha256",
        "instrumentVersion",
        "budget",
        "seeds",
        "verdict",
        "meanDelta",
        "changedCells",
        "rescued",
        "lost",
        "treeCandidateFingerprint",
        "baselineCandidateFingerprint",
      ]
    ) {
      expect(entry).toHaveProperty(key);
      expect((entry as Record<string, unknown>)[key]).not.toBeUndefined();
    }
  });

  test("a label cannot escape the reading directory through the filename", () => {
    const directory = scratch();
    const tree = armFrom("tree", grid([0], () => 100), candidateIdentity("b"));
    const baseline = armFrom("base", grid([0], () => 100), candidateIdentity("a"));
    const written = writeReading(directory, recordFrom(tree, baseline, "../../escaped/../label"));
    expect(resolve(written.record).startsWith(resolve(directory))).toBe(true);
  });
});

describe("arm-archive retention", () => {
  function armFiles(directory: string, name: string): string {
    const path = join(directory, name);
    const bytes = Buffer.from(JSON.stringify({ schema: "line.benchmark-v2.budget-scale-study.v2" }));
    writeFileSync(path, bytes);
    writeFileSync(`${path}.sha256`, `${createHash("sha256").update(bytes).digest("hex")}  ${path}\n`);
    writeFileSync(`${path}.checkpoint.jsonl`, "{}\n");
    writeFileSync(`${path}.gz`, gzipSync(bytes));
    writeFileSync(
      `${path}.gz.sha256`,
      `${createHash("sha256").update(gzipSync(bytes)).digest("hex")}  ${path}.gz\n`,
    );
    return path;
  }

  test("the gzipped archive survives and the redundant copies do not", () => {
    const directory = scratch();
    const path = armFiles(directory, "tree.json");
    expect(retainCompressedArchive(path)).toBe(`${path}.gz`);
    expect(existsSync(`${path}.gz`)).toBe(true);
    expect(existsSync(`${path}.gz.sha256`)).toBe(true);
    for (const gone of [path, `${path}.sha256`, `${path}.checkpoint.jsonl`]) {
      expect(existsSync(gone)).toBe(false);
    }
  });

  test("what survives is still readable by the study reader, so --report keeps working", () => {
    const directory = scratch();
    const arm = armFrom("tree", grid([0, 1], () => 100), candidateIdentity("b"));
    const path = join(directory, "tree.json");
    const bytes = Buffer.from(`${JSON.stringify(arm.archive, null, 2)}\n`);
    writeFileSync(path, bytes);
    writeFileSync(`${path}.sha256`, `${createHash("sha256").update(bytes).digest("hex")}  ${path}\n`);
    const compressed = gzipSync(bytes);
    writeFileSync(`${path}.gz`, compressed);
    writeFileSync(`${path}.gz.sha256`, `${createHash("sha256").update(compressed).digest("hex")}  ${path}.gz\n`);
    const kept = retainCompressedArchive(path);
    expect(readGridArm("tree", kept).cells.size).toBe(arm.cells.size);
  });

  test("without a verified gzip beside it, nothing is deleted", () => {
    const directory = scratch();
    const path = join(directory, "tree.json");
    writeFileSync(path, "{}");
    expect(retainCompressedArchive(path)).toBe(path);
    expect(existsSync(path)).toBe(true);
  });
});

describe("the baseline arm is resolved from the campaign record", () => {
  test("the promoted baseline's compiler snapshot resolves and verifies", () => {
    const arm = loadCampaignBaselineArm();
    const record = JSON.parse(readFileSync(CAMPAIGN_BASELINE_PATH, "utf8"));
    expect(arm.label).toBe(record.label);
    // validateCompilerSnapshot has already re-checked the tarball's sha256.
    expect(arm.snapshot.candidateFingerprint).toBe(record.candidate_fingerprint);
    expect(arm.snapshot.archive).toBe(record.compiler_snapshot.archive);
    expect(existsSync(arm.snapshot.archive)).toBe(true);
    expect(arm.canonicalHeadline).toBe(record.development.canonical_headline);
    // 250k is deferred rather than deleted, which is why this reading can
    // become a promoting tier later without moving its operating point.
    expect(arm.deferredBudgets).toContain(PRIMARY_BUDGET);
  });

  test("a record whose snapshot disagrees with the promoted fingerprint is refused", () => {
    const directory = scratch();
    const record = JSON.parse(readFileSync(CAMPAIGN_BASELINE_PATH, "utf8"));
    record.candidate_fingerprint = "0".repeat(64);
    const path = join(directory, "campaign-baseline.json");
    writeFileSync(path, JSON.stringify(record));
    expect(() => loadCampaignBaselineArm(path)).toThrow(/disagrees with the promoted candidate fingerprint/);
  });

  test("a non-campaign-baseline file is refused rather than half-read", () => {
    const directory = scratch();
    const path = join(directory, "not-a-baseline.json");
    writeFileSync(path, JSON.stringify({ schema: "something.else" }));
    expect(() => loadCampaignBaselineArm(path)).toThrow(/not a campaign-baseline.v2 record/);
    expect(() => loadCampaignBaselineArm(join(directory, "missing.json"))).toThrow(/is required/);
  });
});

describe("the standing operating point is the documented one", () => {
  test("the defaults are 250k x 48 seeds over the capability subset", () => {
    expect(PRIMARY_BUDGET).toBe(250_000);
    expect(READING_SEEDS).toBe(48);
    expect(READING_SOURCE_SUBSET).toBe("capability");
    expect(VERDICT_T).toBe(2.0);
    expect(REFERENCE_LOSS_RATE).toBeCloseTo(0.0444, 4);
  });

  test("the capability subset keeps all three frontier groups whole plus one control per stratum", () => {
    const standing = deriveMiniManifests(
      canonical.sources,
      canonical.suite,
      resolveSourceSubset(READING_SOURCE_SUBSET, canonical.resolved, canonical.suite),
    );
    expect(standing.keptIds).toHaveLength(11);
    expect(standing.controlIds).toHaveLength(3);
    const complete = standing.groups.filter((group) => group.stratum === "capability");
    expect(complete.length).toBe(3);
    expect(complete.every((group) => group.complete)).toBe(true);
    expect(verifyMiniManifestIdentity(canonical.sources, canonical.suite, standing).ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Integration: the real CLI, over two real archive files, end to end.
// ---------------------------------------------------------------------------

describe("integration — the CLI re-reports two archives", () => {
  function writeArchive(directory: string, name: string, arm: GridArm): string {
    const path = join(directory, name);
    const bytes = Buffer.from(`${JSON.stringify(arm.archive, null, 2)}\n`);
    writeFileSync(path, bytes);
    writeFileSync(`${path}.sha256`, `${createHash("sha256").update(bytes).digest("hex")}  ${path}\n`);
    return path;
  }

  test("it prints the block, writes the record, and appends the history", () => {
    const directory = scratch();
    const arms = join(directory, "arms");
    mkdirSync(arms, { recursive: true });
    const movers = mini.keptIds.filter((id) => !mini.controlIds.includes(id));
    const baseline = armFrom(
      "base",
      grid([0, 1, 2, 3], () => 100).map((cell) =>
        cell.sourceId === movers[0] && cell.seed === 2 ? { ...cell, score: 0, valid: false } : cell
      ),
      candidateIdentity("a"),
    );
    const tree = armFrom(
      "tree",
      grid([0, 1, 2, 3], (id, seed) => (mini.controlIds.includes(id) ? 100 : 100 + seed)),
      candidateIdentity("b"),
    );
    // Controls must be bit-identical across arms, exactly as a real run.
    for (const id of mini.controlIds) {
      for (const seed of [0, 1, 2, 3]) {
        const key = gridCellKey(id, BUDGET, seed);
        tree.cells.get(key)!.trackHash = baseline.cells.get(key)!.trackHash;
        const run = tree.archive.runs.find((row: any) => row.task.sourceId === id && row.task.actualSeed === seed);
        run.trackHash = baseline.cells.get(key)!.trackHash;
      }
    }
    const treePath = writeArchive(arms, "tree.json", tree);
    const baselinePath = writeArchive(arms, "baseline.json", baseline);

    const stdout = execFileSync(process.execPath, [
      "--import",
      "tsx",
      "scripts/benchmark/low_budget_reading.ts",
      `--report=${treePath},${baselinePath}`,
      `--sources=group:rapid_pickup_frontier`,
      `--out=${directory}`,
      "--label=integration",
      "--no-baseline-record",
    ], { cwd: resolve("."), encoding: "utf8", env: { ...process.env, LR_ENGINE: "wasm" } });

    expect(stdout).toContain("LOW-BUDGET READING PLAN  250k x 4 seeds");
    expect(stdout).toContain("--report: budget and seeds read from the archives");
    expect(stdout).toContain("VERDICT  RESCUE-POSITIVE");
    expect(stdout).toContain("ACTION-SET POWER");
    expect(stdout).toContain("Evidence, never promotion");
    expect(stdout).toContain("controls     3 sources, 12 cells, bit-identical as required");

    const index = readFileSync(join(directory, "index.jsonl"), "utf8").trim().split("\n");
    expect(index).toHaveLength(1);
    const entry = JSON.parse(index[0]);
    expect(entry.verdict).toBe("RESCUE-POSITIVE");
    expect(entry.budget).toBe(BUDGET);
    expect(entry.seeds).toBe(4);
    expect(entry.rescued).toBe(1);
    expect(entry.lost).toBe(0);

    const record = JSON.parse(readFileSync(resolve(entry.record), "utf8"));
    expect(record.schema).toBe(LOW_BUDGET_READING_SCHEMA);
    expect(record.plan.budget).toBe(BUDGET);
    expect(record.plan.seeds).toEqual([0, 1, 2, 3]);
    expect(record.plan.jobs).toBeNull();
    expect(record.provenance.arms.tree.candidateFingerprint)
      .toBe(tree.archive.candidate.candidateFingerprint);
    expect(record.provenance.arms.baseline.candidateFingerprint)
      .toBe(baseline.archive.candidate.candidateFingerprint);
    // The record is self-sufficient: reading it back needs no archive.
    expect(record.cells).toHaveLength(mini.keptIds.length * 4);
  });

  test("archives from a different subset are refused, not reported against the wrong manifest", () => {
    const directory = scratch();
    const arms = join(directory, "arms");
    mkdirSync(arms, { recursive: true });
    const treePath = writeArchive(arms, "tree.json", armFrom("tree", grid([0], () => 100), candidateIdentity("b")));
    const basePath = writeArchive(arms, "base.json", armFrom("base", grid([0], () => 100), candidateIdentity("a")));
    expect(() =>
      execFileSync(process.execPath, [
        "--import",
        "tsx",
        "scripts/benchmark/low_budget_reading.ts",
        `--report=${treePath},${basePath}`,
        // The fixtures are the rapid_pickup subset, not the standing one.
        `--out=${directory}`,
        "--no-baseline-record",
      ], { cwd: resolve("."), encoding: "utf8", stdio: "pipe", env: { ...process.env, LR_ENGINE: "wasm" } })
    ).toThrow(/do not match --sources=capability/);
    expect(existsSync(join(directory, "index.jsonl"))).toBe(false);
  });

  test("--dry-run resolves the real baseline and compiles nothing", () => {
    const directory = scratch();
    const stdout = execFileSync(process.execPath, [
      "--import",
      "tsx",
      "scripts/benchmark/low_budget_reading.ts",
      "--dry-run",
      `--out=${directory}`,
    ], { cwd: resolve("."), encoding: "utf8", env: { ...process.env, LR_ENGINE: "wasm" } });

    expect(stdout).toContain(`LOW-BUDGET READING PLAN  250k x 48 seeds x 11 sources = 528 cells per arm`);
    expect(stdout).toContain("snapshot benchmark/v2/runs/");
    expect(stdout).toContain("identity  PROVEN");
    expect(stdout).toContain("--dry-run: nothing was compiled.");
    expect(existsSync(join(directory, "index.jsonl"))).toBe(false);
  });
});

describe("the reading writes nothing to governance state", () => {
  test("it names no fingerprinted benchmark module", () => {
    const source = readFileSync("scripts/benchmark/low_budget_reading.ts", "utf8");
    for (
      const governed of [
        "benchmark/v2/baseline.json",
        "benchmark/v2/studies/decision-calibration.json",
        "scripts/v0/benchmark_v2/rebaseline.ts",
        "scripts/v0/benchmark_v2/decide.ts",
        "scripts/v0/benchmark_v2/runner.ts",
      ]
    ) {
      expect(source).not.toContain(governed);
    }
    // The only campaign file it touches is the baseline record, read-only.
    expect(source).toContain(CAMPAIGN_BASELINE_PATH);
    expect(source).not.toMatch(/writeFileSync\([^)]*campaign-baseline/);
  });

  test("every artifact path it writes lives under the reading directory", () => {
    const record = recordFrom(
      armFrom("tree", grid([0], () => 100), candidateIdentity("b")),
      armFrom("base", grid([0], () => 100), candidateIdentity("a")),
    );
    const directory = scratch();
    const written = writeReading(directory, record);
    for (const path of [written.record, written.index]) {
      expect(resolve(path).startsWith(resolve(directory))).toBe(true);
    }
  });
});
