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
 *   1. On a clean baseline:  npm run verify:optimizer -- --update
 *   2. After an engine edit: npm run verify:optimizer
 *   3. Wider confidence:     npm run verify:optimizer:wide
 *
 * Kept intentionally small (4 compiles, ~seconds) — enough cases for confidence,
 * not a battleship. The cases mirror v0_determinism.test.ts's curated
 * small/medium/large sample, plus mini_burst (the spec `npm run perf` optimizes).
 * Pass --wide (or use npm run verify:optimizer:wide) for a 12-case second-tier
 * gate with broader spec coverage and its own baseline.
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { loadGoldenSpec } from "../golden_suite.ts";
import { compileHandoff } from "../optimizer/handoff.ts";
import { SMOKE_VERIFY_CASES, VERIFY_OPTIMIZER_BUDGET, WIDE_VERIFY_CASES } from "./optimizer_verify_cases.ts";

const OUT_DIR = "generated/verify-optimizer";
const WIDE = process.argv.includes("--wide");
const BASELINE = resolve(OUT_DIR, WIDE ? "baseline.wide.json" : "baseline.json");
const CASES = WIDE ? WIDE_VERIFY_CASES : SMOKE_VERIFY_CASES;
const BUDGET = VERIFY_OPTIMIZER_BUDGET;

type Cell = { hash: string; lines: number; sim_frames: number };
type Baseline = { budget: number; suite?: string; cases: Record<string, Cell> };

function key(spec: string, seed: number): string {
  return `${spec}|seed${seed}`;
}

async function compileCell(spec: string, seed: number): Promise<Cell> {
  // deno-lint-ignore no-explicit-any
  const loaded = await loadGoldenSpec(spec as any, "base" as any);
  const cp = compileHandoff(loaded, seed, { budget: BUDGET });
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

  if (update) {
    const baseline: Baseline = { budget: BUDGET, suite: WIDE ? "wide" : "smoke", cases: current };
    writeFileSync(BASELINE, JSON.stringify(baseline, null, 2) + "\n");
    console.log(`\nRe-baselined ${CASES.length} cases → ${BASELINE}`);
    return;
  }
  if (!existsSync(BASELINE)) {
    // Fail rather than auto-record: a missing baseline means there is nothing to
    // verify against, so passing would be a false green on a fresh checkout.
    const cmd = WIDE ? "npm run verify:optimizer:wide -- --update" : "npm run verify:optimizer -- --update";
    console.error(
      `\nNo baseline at ${BASELINE} — cannot verify. Record it on known-good HEAD: ${cmd}`,
    );
    process.exit(1);
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
  if (baseline.suite !== undefined && baseline.suite !== (WIDE ? "wide" : "smoke")) {
    diffs.push(`  suite changed: baseline ${baseline.suite} vs current ${WIDE ? "wide" : "smoke"} — re-baseline`);
  }

  if (diffs.length === 0) {
    console.log(`\n✓ optimizer output bit-identical to baseline (${CASES.length} ${WIDE ? "wide " : ""}cases @ ${BUDGET})`);
    return;
  }

  console.error(`\n✗ optimizer output DIVERGED from baseline:\n${diffs.join("\n")}`);
  console.error(`\nIf this change is intentional, re-baseline: ${WIDE ? "npm run verify:optimizer:wide -- --update" : "npm run verify:optimizer -- --update"}`);
  process.exit(1);
}

main();
