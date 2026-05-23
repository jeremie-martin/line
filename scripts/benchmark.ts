/**
 * Compiler benchmark suite.
 *
 * For each (spec × strategy) pair: run, measure, report. The purpose is
 * not to find the best track for any single spec but to make the
 * tradeoffs between strategies legible — and to catch regressions
 * across compiler changes.
 *
 *   npx tsx scripts/benchmark.ts                # all specs × all strategies
 *   npx tsx scripts/benchmark.ts --specs=foo,bar # subset
 *   npx tsx scripts/benchmark.ts --out=bench/latest.md   # save report
 *
 * Strategies exercised:
 *   - adaptive       : just adaptive defaults, no search
 *   - greedy         : per-move random with backtracking (default knobs)
 *   - greedy-deep    : greedy with backtrackDepth=3 (probes the limit)
 *   - mc-50          : Monte Carlo, 50 trials
 *   - mc-200         : Monte Carlo, 200 trials (slow; opt out via --quick)
 */
import { resolve } from "node:path";
import { writeFileSync } from "node:fs";
import { ride, type RideResult } from "./lib/ride.ts";
import { searchRide, searchRideGreedy, defaultFitness } from "./lib/search.ts";
import type { Move } from "./lib/moves.ts";

// ────────── CLI args ──────────

const argv = process.argv.slice(2);
const arg = (name: string): string | null => {
  const m = argv.find((a) => a.startsWith(`--${name}=`));
  return m ? m.slice(name.length + 3) : null;
};
const has = (name: string) => argv.includes(`--${name}`);
const quick = has("quick");
const outPath = arg("out");
const specsArg = arg("specs");

// ────────── Specs ──────────

const SPECS: Array<{ name: string; path: string; desc: string }> = [
  { name: "easy-single",  path: "specs/easy-single.ts",  desc: "single slide, easiest case" },
  { name: "six-slides",   path: "specs/six-slides.ts",   desc: "6-slide chain @ 50f spacing" },
  { name: "tight-chain",  path: "specs/tight-chain.ts",  desc: "8-slide chain @ 30f spacing" },
  { name: "showcase",     path: "specs/showcase.ts",     desc: "slide → halfPipe → slide" },
  { name: "grand-tour",   path: "specs/grand-tour.ts",   desc: "17-move catalog tour" },
  { name: "wide-gap",     path: "specs/wide-gap.ts",     desc: "200-frame gap — expected to struggle" },
];

const enabledSpecs = specsArg
  ? new Set(specsArg.split(",").map((s) => s.trim()))
  : null;

// ────────── Strategies ──────────

type StrategyRun = {
  result: RideResult;
  elapsedMs: number;
  sims: number;
};
type Strategy = {
  name: string;
  desc: string;
  run: (moves: Move[]) => StrategyRun;
};

const STRATEGIES: Strategy[] = [
  {
    name: "adaptive",
    desc: "no search, deterministic",
    run(moves) {
      const t0 = Date.now();
      const result = ride(moves);
      return { result, elapsedMs: Date.now() - t0, sims: 1 };
    },
  },
  {
    name: "greedy",
    desc: "per-move random, backtrack=1, 10 tries",
    run(moves) {
      const t0 = Date.now();
      const g = searchRideGreedy(moves, {}, { triesPerMove: 10, backtrackDepth: 1, seed: 1 });
      return { result: g.result, elapsedMs: Date.now() - t0, sims: g.totalSimulations };
    },
  },
  {
    name: "greedy-deep",
    desc: "greedy with backtrack=3",
    run(moves) {
      const t0 = Date.now();
      const g = searchRideGreedy(moves, {}, { triesPerMove: 10, backtrackDepth: 3, seed: 1 });
      return { result: g.result, elapsedMs: Date.now() - t0, sims: g.totalSimulations };
    },
  },
  {
    name: "mc-50",
    desc: "Monte Carlo, 50 trials",
    run(moves) {
      const t0 = Date.now();
      const s = searchRide(moves, {}, { trials: 50, seed: 1, topK: 1 });
      return { result: s.best.result, elapsedMs: Date.now() - t0, sims: 50 };
    },
  },
];
if (!quick) {
  STRATEGIES.push({
    name: "mc-200",
    desc: "Monte Carlo, 200 trials",
    run(moves) {
      const t0 = Date.now();
      const s = searchRide(moves, {}, { trials: 200, seed: 1, topK: 1 });
      return { result: s.best.result, elapsedMs: Date.now() - t0, sims: 200 };
    },
  });
}

// ────────── Per-trial metrics ──────────

type Row = {
  spec: string;
  strategy: string;
  survived: boolean;
  allPassed: boolean;
  contactPct: number;
  longestSlideFrames: number;
  meanVxSliding: number;
  driftCount: number;
  fitness: number;
  elapsedMs: number;
  sims: number;
};

function rowFor(spec: string, strategy: string, run: StrategyRun): Row {
  const r = run.result;
  const s = r.detection.summary;
  let driftCount = 0;
  for (const step of r.steps) {
    if (step.verdict) driftCount += step.verdict.drift.length;
  }
  return {
    spec,
    strategy,
    survived: r.survived,
    allPassed: r.allPassed,
    contactPct: s.contactFractionSpec * 100,
    longestSlideFrames: s.longestContactRun,
    meanVxSliding: s.meanVxSliding,
    driftCount,
    fitness: defaultFitness(r),
    elapsedMs: run.elapsedMs,
    sims: run.sims,
  };
}

// ────────── Run benchmark ──────────

const rows: Row[] = [];
const t0Total = Date.now();

for (const spec of SPECS) {
  if (enabledSpecs && !enabledSpecs.has(spec.name)) continue;
  const mod = await import(resolve(spec.path));
  const movesRaw = typeof mod.default === "function" ? mod.default() : mod.default;
  if (!Array.isArray(movesRaw)) {
    console.error(`spec ${spec.name} doesn't default-export Move[] (got ${typeof movesRaw}); skipping`);
    continue;
  }
  const moves = movesRaw as Move[];
  for (const strategy of STRATEGIES) {
    process.stdout.write(`  ${spec.name.padEnd(14)} × ${strategy.name.padEnd(12)} ... `);
    try {
      const run = strategy.run(moves);
      const row = rowFor(spec.name, strategy.name, run);
      rows.push(row);
      const status = row.survived ? (row.allPassed ? "✓" : "✓ (drift)") : "✗";
      process.stdout.write(
        `${status.padEnd(10)} ${row.fitness.toFixed(0).padStart(5)} fit · ${row.elapsedMs.toString().padStart(5)}ms\n`,
      );
    } catch (e) {
      process.stdout.write(`THREW: ${String(e).slice(0, 80)}\n`);
    }
  }
}

const elapsedTotal = Date.now() - t0Total;
console.log(`\nTotal: ${(elapsedTotal / 1000).toFixed(1)}s`);

// ────────── Render comparison table ──────────

function fmtTable(rows: Row[]): string {
  const lines: string[] = [];
  const specs = [...new Set(rows.map((r) => r.spec))];
  const strats = [...new Set(rows.map((r) => r.strategy))];

  lines.push("");
  lines.push("# Benchmark report");
  lines.push("");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push("");

  // Per-spec table: rows = strategy, cols = metrics.
  for (const spec of specs) {
    lines.push(`## ${spec}`);
    lines.push("");
    const specRows = rows.filter((r) => r.spec === spec);
    lines.push("| strategy | survived | pass | contact% | longest | mean vx | drift | fitness | time | sims |");
    lines.push("|---|---|---|---|---|---|---|---|---|---|");
    for (const r of specRows) {
      lines.push(
        `| ${r.strategy} ` +
          `| ${r.survived ? "✓" : "✗"} ` +
          `| ${r.allPassed ? "✓" : ""} ` +
          `| ${r.contactPct.toFixed(1)}% ` +
          `| ${r.longestSlideFrames}f ` +
          `| ${r.meanVxSliding.toFixed(2)} ` +
          `| ${r.driftCount} ` +
          `| ${r.fitness.toFixed(0)} ` +
          `| ${r.elapsedMs}ms ` +
          `| ${r.sims} |`,
      );
    }
    lines.push("");
  }

  // Summary: per-strategy aggregate across specs.
  lines.push("## Strategy aggregates");
  lines.push("");
  lines.push("| strategy | survived/n | all-passed/n | mean fitness | mean elapsed (ms) | mean sims |");
  lines.push("|---|---|---|---|---|---|");
  for (const strat of strats) {
    const r = rows.filter((x) => x.strategy === strat);
    const survived = r.filter((x) => x.survived).length;
    const allPassed = r.filter((x) => x.allPassed).length;
    const meanFitness = r.reduce((s, x) => s + x.fitness, 0) / r.length;
    const meanElapsed = r.reduce((s, x) => s + x.elapsedMs, 0) / r.length;
    const meanSims = r.reduce((s, x) => s + x.sims, 0) / r.length;
    lines.push(
      `| ${strat} | ${survived}/${r.length} | ${allPassed}/${r.length} | ${meanFitness.toFixed(1)} | ${meanElapsed.toFixed(0)} | ${meanSims.toFixed(0)} |`,
    );
  }
  lines.push("");
  return lines.join("\n");
}

const table = fmtTable(rows);
console.log(table);

if (outPath) {
  const abs = resolve(outPath);
  writeFileSync(abs, table);
  console.log(`\nReport written to: ${abs}`);
}
