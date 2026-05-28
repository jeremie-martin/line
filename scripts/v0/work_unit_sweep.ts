import { performance } from "node:perf_hooks";

import { compile } from "./compile.ts";
import { budgetFor, GOLDEN_SPECS, loadGoldenSpec, type GoldenSpecName } from "./golden_suite.ts";
import type { CompileOptions, Spec } from "./types.ts";

type Strategy = NonNullable<CompileOptions["strategy"]>;

type SweepRow = {
  name: string;
  seed: number;
  strategy: Strategy;
  budget_units: number | null;
  elapsed_ms: number;
  work_units: number;
  sim_frames: number;
  physics_frames_computed: number;
  trajectory_frames_read: number;
  engine_add_lines: number;
  candidates_sampled: number;
  leaves_attempted: number;
  leaves_scored: number;
  wall_ms_per_work_unit: number;
};

function arg(name: string): string | null {
  const prefix = `--${name}=`;
  const found = process.argv.slice(2).find((a) => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : null;
}

function has(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function parseSeeds(): number[] {
  const raw = arg("seeds");
  if (raw === null) return [0];
  const seeds = raw.split(",").map((part) => Number(part.trim()));
  if (seeds.some((seed) => !Number.isInteger(seed))) {
    throw new Error(`--seeds must be comma-separated integers, got ${raw}`);
  }
  return seeds;
}

function parseStrategy(): Strategy {
  const raw = arg("strategy");
  if (raw === null) return "legacy";
  if (raw !== "legacy" && raw !== "lds") {
    throw new Error(`--strategy must be legacy or lds, got ${raw}`);
  }
  return raw;
}

function parseLimit(): number {
  const raw = arg("limit");
  if (raw === null) return GOLDEN_SPECS.length;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`--limit must be a positive integer, got ${raw}`);
  }
  return value;
}

function mean(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function stddev(values: number[]): number {
  if (values.length === 0) return 0;
  const m = mean(values);
  return Math.sqrt(mean(values.map((value) => Math.pow(value - m, 2))));
}

function coefficientOfVariation(values: number[]): number {
  const m = mean(values);
  return m === 0 ? 0 : stddev(values) / m;
}

async function timedCompile(
  name: GoldenSpecName,
  spec: Spec,
  seed: number,
  strategy: Strategy,
): Promise<SweepRow> {
  const budget = strategy === "lds" ? budgetFor(spec) : undefined;
  const t0 = performance.now();
  const result = compile(spec, {
    seed,
    strategy,
    ...(budget !== undefined ? { budget } : {}),
  });
  const elapsed = performance.now() - t0;
  return {
    name,
    seed,
    strategy,
    budget_units: budget?.units ?? null,
    elapsed_ms: elapsed,
    work_units: result.stats.work_units_used,
    sim_frames: result.stats.sim_frames,
    physics_frames_computed: result.stats.physics_frames_computed,
    trajectory_frames_read: result.stats.trajectory_frames_read,
    engine_add_lines: result.stats.engine_add_lines,
    candidates_sampled: result.stats.candidates_sampled,
    leaves_attempted: result.stats.leaves_attempted,
    leaves_scored: result.stats.leaves_scored,
    wall_ms_per_work_unit: result.stats.work_units_used > 0
      ? elapsed / result.stats.work_units_used
      : 0,
  };
}

async function main(): Promise<void> {
  const strategy = parseStrategy();
  const seeds = parseSeeds();
  const names = GOLDEN_SPECS.slice(0, parseLimit());
  const rows: SweepRow[] = [];

  for (const seed of seeds) {
    for (const name of names) {
      const spec = await loadGoldenSpec(name, "base");
      rows.push(await timedCompile(name, spec, seed, strategy));
    }
  }

  const ratios = rows.map((row) => row.wall_ms_per_work_unit).filter((value) => Number.isFinite(value));
  const summary = {
    strategy,
    seeds,
    cases: rows.length,
    wall_ms_per_work_unit_mean: mean(ratios),
    wall_ms_per_work_unit_cv: coefficientOfVariation(ratios),
    rows,
  };

  if (has("json")) {
    process.stdout.write(JSON.stringify(summary, null, 2) + "\n");
  } else {
    console.log(
      `work-unit sweep strategy=${strategy} cases=${rows.length} ` +
        `mean=${summary.wall_ms_per_work_unit_mean.toFixed(6)}ms/unit ` +
        `cv=${summary.wall_ms_per_work_unit_cv.toFixed(3)}`,
    );
    for (const row of rows) {
      console.log(
        `${row.name.padEnd(24)} seed=${row.seed} ` +
          `elapsed=${row.elapsed_ms.toFixed(0)}ms work=${row.work_units} ` +
          `ratio=${row.wall_ms_per_work_unit.toFixed(6)} ` +
          `sim=${row.sim_frames} phys=${row.physics_frames_computed} read=${row.trajectory_frames_read} ` +
          `add=${row.engine_add_lines} cand=${row.candidates_sampled} leaves=${row.leaves_scored}`,
      );
    }
  }
}

await main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
