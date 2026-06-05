/**
 * verify_optimizer — regression oracle for the COMPILER / optimizer search path.
 *
 * Sibling of sim_trace (`npm run verify:engine`). Where sim_trace pins the
 * physics ENGINE on fixed tracks frame-by-frame, this pins the OPTIMIZER's
 * end-to-end output: it runs the real `compileHandoff` on a small curated set
 * of golden specs and hashes `{track, stats}`. `stats` carries sim_frames plus
 * the full deterministic search-trajectory counts, so ANY drift in physics,
 * budget accounting, OR candidate selection flips the hash and is pinpointed to
 * the offending case.
 *
 * Why this exists: the existing optimizer tests (v0_determinism, optimizer_handoff)
 * only assert SELF-consistency (compile twice → same hash). A change that
 * deterministically alters the compiled track passes those green. This gate
 * catches it by comparing against a recorded baseline.
 *
 * Workflow (mirrors sim_trace exactly):
 *   1. On a clean baseline:  npm run verify:optimizer            → records hashes
 *   2. After a compiler edit: npm run verify:optimizer           → checks; exits
 *                                                                   non-zero + names
 *                                                                   the divergent case
 *   3. To re-baseline on purpose: npm run verify:optimizer -- --update
 *
 * Kept intentionally small (4 compiles, ~seconds) — enough cases for confidence,
 * not a battleship. The cases mirror v0_determinism.test.ts's curated
 * small/medium/large sample, plus mini_burst (the spec `npm run perf` optimizes).
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { loadGoldenSpec } from "../golden_suite.ts";
import { compileHandoff } from "../optimizer/handoff.ts";

const OUT_DIR = "generated/verify-optimizer";
const BASELINE = resolve(OUT_DIR, "baseline.json");

// [spec, seed]. Small/medium/large (mirrors v0_determinism.test.ts) + the perf spec.
const CASES: Array<[string, number]> = [
  ["tiny_dance", 0],
  ["syncopated_switchback", 1],
  ["drums_signature", 2],
  ["mini_burst", 0],
];
const BUDGET = 40_000;

type Cell = { hash: string; lines: number; sim_frames: number };
type Baseline = { budget: number; cases: Record<string, Cell> };

function key(spec: string, seed: number): string {
  return `${spec}|seed${seed}`;
}

async function compileCell(spec: string, seed: number): Promise<Cell> {
  // deno-lint-ignore no-explicit-any
  const loaded = await loadGoldenSpec(spec as any, "base" as any);
  const res = compileHandoff(loaded, seed, { budgets: [BUDGET] });
  const cp = res.checkpoints[res.checkpoints.length - 1];
  const hash = createHash("sha256")
    .update(JSON.stringify({ track: cp.track, stats: cp.stats }))
    .digest("hex")
    .slice(0, 16);
  return {
    hash,
    lines: cp.track?.lines?.length ?? -1,
    sim_frames: cp.stats?.sim_frames ?? -1,
  };
}

async function main(): Promise<void> {
  const update = process.argv.includes("--update");

  const current: Record<string, Cell> = {};
  for (const [spec, seed] of CASES) {
    const cell = await compileCell(spec, seed);
    current[key(spec, seed)] = cell;
    console.log(
      `  ${key(spec, seed).padEnd(28)} lines=${String(cell.lines).padStart(4)}  ` +
        `sim_frames=${String(cell.sim_frames).padStart(7)}  ${cell.hash}`,
    );
  }

  mkdirSync(OUT_DIR, { recursive: true });

  if (update || !existsSync(BASELINE)) {
    const baseline: Baseline = { budget: BUDGET, cases: current };
    writeFileSync(BASELINE, JSON.stringify(baseline, null, 2) + "\n");
    console.log(
      `\n${update ? "Re-baselined" : "No baseline found — recorded"} ` +
        `${CASES.length} cases → ${BASELINE}`,
    );
    return;
  }

  const baseline: Baseline = JSON.parse(readFileSync(BASELINE, "utf8"));
  const diffs: string[] = [];
  for (const [spec, seed] of CASES) {
    const k = key(spec, seed);
    const got = current[k];
    const want = baseline.cases[k];
    if (!want) {
      diffs.push(`  ${k}: NEW case (no baseline) — run --update to record`);
      continue;
    }
    if (got.hash !== want.hash) {
      const what =
        got.sim_frames !== want.sim_frames
          ? `sim_frames ${want.sim_frames} → ${got.sim_frames}`
          : got.lines !== want.lines
            ? `lines ${want.lines} → ${got.lines}`
            : "track bytes changed (same lines & sim_frames)";
      diffs.push(`  ${k}: ${want.hash} → ${got.hash}   [${what}]`);
    }
  }

  if (baseline.budget !== BUDGET) {
    diffs.push(`  budget changed: baseline ${baseline.budget} vs current ${BUDGET} — re-baseline`);
  }

  if (diffs.length === 0) {
    console.log(`\n✓ optimizer output bit-identical to baseline (${CASES.length} cases @ ${BUDGET})`);
    return;
  }

  console.error(`\n✗ optimizer output DIVERGED from baseline:\n${diffs.join("\n")}`);
  console.error(`\nIf this change is intentional, re-baseline: npm run verify:optimizer -- --update`);
  process.exit(1);
}

main();
