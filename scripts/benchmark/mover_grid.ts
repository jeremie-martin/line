/**
 * mover_grid — a many-seed paired grid over the sources a candidate can
 * actually move, with its action-set power statement attached.
 *
 * WHAT THIS INSTRUMENT IS FOR
 *   A candidate whose reach is a handful of sources is not observed by a
 *   44-source, 8-seed eval; it is observed by many seeds on the sources it can
 *   move. Filtering the canonical manifests to that subset (see
 *   `mini_manifest.ts`) turns a 26-minute eval into a ~4-minute grid, which is
 *   the difference between probing a design and guessing at it. The p1b
 *   collapse investigation ran 48-seed, 7-source grids at 750k in about four
 *   minutes and decomposed a rejected mechanism with them.
 *
 *   Both arms compile through `scale_study.ts` in a subprocess, so this tool
 *   never imports the runner and cannot become part of the promoting chain.
 *   Cells are compile-identical to the canonical grid's cells: the same source
 *   entries, the same jolt, the same budget and seed reach `compileHandoff`,
 *   and the same scorer inputs reach `scoreV2Report`. `--verify` proves that
 *   without compiling anything.
 *
 * WHAT IT IS NOT FOR — THE LIMIT, STATED ONCE
 *   Evidence, never promotion. The aggregate a mini grid prints is a
 *   renormalized subset score, not the suite headline; quoting it as one is a
 *   category error. A group whose canonical members are all present does report
 *   its exact canonical group score, and every per-cell score is exact —
 *   those are the numbers to quote. Promotion runs through
 *   `npm run benchmark -- eval` and nothing here writes to governance state.
 *
 * WHY THE POWER FOOTER IS NOT OPTIONAL
 *   The 1b lottery previewed clean on 14 changed cells and cost −5.41 at N=48.
 *   A clean preview over an action set that small excludes only failure rates
 *   above ~20%; the mechanism's break-even was 0.3%. Every report this tool
 *   prints therefore ends with the arithmetic — changed cells, adverse events,
 *   the exclusion bound, and (when priced) the break-even rate and the action
 *   set that would be needed to see it. See `action_set_power.ts`.
 *
 * USAGE
 *   npm run benchmark:v2:mover-grid -- --verify
 *   npm run benchmark:v2:mover-grid -- --ref=HEAD --seeds=48
 *   npm run benchmark:v2:mover-grid -- --ref=deadline-two-anchor-750k --seeds=48 \
 *     --value=13 --value-cells=88 --event-cost=50
 *   npm run benchmark:v2:mover-grid -- --report=<candidate.json>,<ref.json>
 *
 *   --sources=<selector>   preset / stratum:<id> / group:<id> / source ids
 *                          (default `capability` — the three frontier groups in full;
 *                           `p1b-collapse` reproduces the collapse investigation's set)
 *   --seeds=<n|list>       seed count from --seed-base, or an explicit list (default 48)
 *   --budgets=<list>       default 750000
 *   --jobs=<n>             worker pool size
 *   --ref=<git ref>        paired arm, compiled in a throwaway worktree (default HEAD)
 *   --env=K=V,K=V          extra compiler env for the CANDIDATE arm only
 *   --out=<dir>            artifact directory
 *   --verify               derive + prove compile-identity, compile nothing
 *   --report=<cand>,<ref>  re-report two existing scale-study archives
 *   --value/--value-cells/--event-cost   price the action set in the footer
 *   --keep-worktree        leave the ref worktree in place for inspection
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { dirname, join, resolve } from "node:path";
import {
  actionSetPower,
  formatActionSetPower,
  type ActionSetPower,
  type BreakEvenInput,
} from "./action_set_power.ts";
import {
  assertPairedArms,
  describeArmIdentity,
  pairGridCells,
  readGridArm,
  type GridArm,
  type GridCell,
} from "./paired_grid.ts";
import {
  CANONICAL_SOURCE_MANIFEST,
  CANONICAL_SUITE_MANIFEST,
  DEFAULT_SOURCE_SUBSET,
  deriveMiniManifests,
  loadCanonicalManifests,
  resolveSourceSubset,
  serializeManifest,
  SOURCE_SUBSET_PRESETS,
  verifyMiniManifestIdentity,
  type MiniManifests,
} from "./mini_manifest.ts";

const MOVER_GRID_SCHEMA = "line.benchmark-v2.mover-grid.v1" as const;
/** The engine kernel is a build artifact, not a tracked file; both arms share it. */
const ENGINE_ARTIFACT = "engine-rs/target/wasm32-unknown-unknown/release/lr_engine.wasm";

/**
 * Cells, arm reading, pairing and comparability are shared with the standing
 * low-budget reading; see `paired_grid.ts`. What stays here is what this
 * instrument uniquely says about an action set.
 */
type Cell = GridCell;
type Arm = GridArm;

await main();

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const argument = (name: string): string | undefined =>
    args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
  const flag = (name: string): boolean => args.includes(`--${name}`);

  if (flag("help") || flag("h")) {
    printUsage();
    return;
  }
  const subset = argument("sources") ?? DEFAULT_SOURCE_SUBSET;
  const sourceManifestPath = resolve(argument("manifest") ?? CANONICAL_SOURCE_MANIFEST);
  const suiteManifestPath = resolve(argument("suite") ?? CANONICAL_SUITE_MANIFEST);
  const { sources, suite, resolved } = loadCanonicalManifests(sourceManifestPath, suiteManifestPath);
  const selectedIds = resolveSourceSubset(subset, resolved, suite);
  const mini = deriveMiniManifests(sources, suite, selectedIds);
  const identity = verifyMiniManifestIdentity(sources, suite, mini);

  const breakEven = priceArgument(argument);
  const eventName = "lost completion";
  const reportPair = argument("report");
  const maxCells = Number(argument("max-cells") ?? "40");
  // Canonical group membership, so a report can say which group scores are the
  // canonical ones — including when it is re-reading somebody else's archives.
  const canonicalGroups = new Map(suite.strata.flatMap((stratum) =>
    stratum.groups.map((group) => [group.id, group.members] as const)
  ));

  if (flag("verify")) {
    printDerivation(subset, mini, identity);
    // With --out the derived manifests are materialized too, so the same subset
    // can be handed straight to scale_study.ts for a one-armed run.
    const verifyOut = argument("out");
    if (verifyOut !== undefined) {
      for (const path of writeMiniManifests(resolve(verifyOut), mini)) console.log(`  wrote ${path}`);
    }
    process.exitCode = identity.ok ? 0 : 1;
    return;
  }

  if (reportPair !== undefined) {
    const [candidatePath, refPath] = reportPair.split(",").map((entry) => entry.trim());
    if (candidatePath === undefined || refPath === undefined) {
      throw new Error(`--report needs two archive paths: --report=<candidate.json>,<ref.json>`);
    }
    const candidate = readGridArm("candidate", candidatePath);
    const reference = readGridArm("ref", refPath);
    const power = report(candidate, reference, { breakEven, eventName, canonicalGroups, maxCells });
    writeReport(argument("out"), { candidate: candidatePath, ref: refPath }, candidate, reference, power);
    return;
  }

  const budgets = argument("budgets") ?? "750000";
  const seeds = seedList(argument("seeds") ?? "48", Number(argument("seed-base") ?? "0"));
  const jobs = Number(argument("jobs") ?? String(Math.min(24, Math.max(1, availableParallelism() - 1))));
  const ref = argument("ref") ?? "HEAD";
  const stamp = new Date().toISOString().replaceAll(/[:.]/g, "-");
  const out = resolve(argument("out") ?? `generated/benchmark-v2/mover-grids/${stamp}`);
  mkdirSync(out, { recursive: true });

  printDerivation(subset, mini, identity);
  if (!identity.ok) {
    throw new Error(`mini manifest derivation failed its compile-identity checks; refusing to compile`);
  }
  const [miniSourcePath, miniSuitePath] = writeMiniManifests(out, mini);

  const cells = mini.keptIds.length * seeds.length * budgets.split(",").length;
  console.log(
    `\n${cells} cells per arm; budgets ${budgets}; ${seeds.length} seeds from ${seeds[0]}; ${jobs} jobs\n` +
    `  candidate  working tree${describeEnv(parseEnv(argument("env")))}\n` +
    `  ref        ${ref}\n`,
  );

  const started = performance.now();
  const candidatePath = join(out, "candidate.json");
  runArm({
    label: "candidate",
    cwd: process.cwd(),
    out: candidatePath,
    manifest: miniSourcePath,
    suite: miniSuitePath,
    budgets,
    seeds,
    jobs,
    env: parseEnv(argument("env")),
  });
  const refPath = join(out, "ref.json");
  const worktree = createRefWorktree(ref);
  try {
    runArm({
      label: "ref",
      cwd: worktree,
      out: refPath,
      manifest: miniSourcePath,
      suite: miniSuitePath,
      budgets,
      seeds,
      jobs,
      env: {},
    });
  } finally {
    if (!flag("keep-worktree")) disposeWorktree(worktree);
    else console.log(`  ref worktree kept at ${worktree}`);
  }
  console.log(`  both arms in ${((performance.now() - started) / 1000).toFixed(1)}s\n`);

  const candidate = readGridArm("candidate", candidatePath);
  const reference = readGridArm("ref", refPath);
  const power = report(candidate, reference, { breakEven, eventName, canonicalGroups, maxCells });
  writeReport(out, { candidate: candidatePath, ref: refPath, refCommit: ref }, candidate, reference, power);
}

function printUsage(): void {
  console.log(
    `mover_grid — many-seed paired grid over a source subset, with its power statement.\n` +
    `Evidence, never promotion: the aggregate is a renormalized subset score, not a headline.\n\n` +
    `  --sources=<selector>   ${Object.keys(SOURCE_SUBSET_PRESETS).join(" | ")} | stratum:<id> | group:<id> | <source id>,...\n` +
    `                         (default ${DEFAULT_SOURCE_SUBSET}; controls are back-filled so every stratum stays populated)\n` +
    `  --seeds=<n|list>       seed count from --seed-base, or an explicit comma list (default 48)\n` +
    `  --seed-base=<n>        first seed when --seeds is a count (default 0)\n` +
    `  --budgets=<list>       comma-separated budgets (default 750000)\n` +
    `  --jobs=<n>             worker pool size per arm\n` +
    `  --ref=<git ref>        paired arm, compiled in a throwaway worktree (default HEAD)\n` +
    `  --env=K=V,K=V          extra compiler env for the CANDIDATE arm only\n` +
    `  --out=<dir>            artifact directory (manifests, both archives, JSON report)\n` +
    `  --max-cells=<n>        changed-cell rows to print; validity flips are never elided (default 40)\n` +
    `  --verify               derive and prove compile-identity, compile nothing\n` +
    `  --report=<cand>,<ref>  re-report two existing scale-study archives, compile nothing\n` +
    `  --value=<points> --value-cells=<n> --event-cost=<points>\n` +
    `                         price the action set so the footer can state break-even\n` +
    `  --keep-worktree        leave the ref worktree in place for inspection`,
  );
}

/** Materialize the derived manifests; returns [sourcePath, suitePath]. */
function writeMiniManifests(directory: string, mini: MiniManifests): [string, string] {
  mkdirSync(directory, { recursive: true });
  const sourcePath = join(directory, "mini-source-manifest.json");
  const suitePath = join(directory, "mini-suite-manifest.json");
  writeFileSync(sourcePath, serializeManifest(mini.sourceManifest));
  writeFileSync(suitePath, serializeManifest(mini.suiteManifest));
  return [sourcePath, suitePath];
}

function priceArgument(argument: (name: string) => string | undefined): BreakEvenInput | null {
  const value = argument("value");
  const eventCost = argument("event-cost");
  if (value === undefined || eventCost === undefined) return null;
  const valueCells = argument("value-cells");
  return {
    value: Number(value),
    eventCost: Number(eventCost),
    ...(valueCells === undefined ? {} : { valueCells: Number(valueCells) }),
  };
}

function seedList(text: string, base: number): number[] {
  if (text.includes(",")) {
    const seeds = text.split(",").map(Number);
    if (seeds.some((seed) => !Number.isSafeInteger(seed) || seed < 0)) {
      throw new Error(`--seeds list must be non-negative integers`);
    }
    return seeds;
  }
  const count = Number(text);
  if (!Number.isSafeInteger(count) || count < 1) throw new Error(`--seeds must be a count or a comma list`);
  if (!Number.isSafeInteger(base) || base < 0) throw new Error(`--seed-base must be a non-negative integer`);
  return Array.from({ length: count }, (_, index) => base + index);
}

function parseEnv(text: string | undefined): Record<string, string> {
  if (text === undefined || text.length === 0) return {};
  return Object.fromEntries(text.split(",").map((entry) => {
    const split = entry.indexOf("=");
    if (split <= 0) throw new Error(`--env entries must be KEY=VALUE: ${entry}`);
    return [entry.slice(0, split), entry.slice(split + 1)];
  }));
}

function describeEnv(env: Record<string, string>): string {
  const entries = Object.entries(env);
  return entries.length === 0 ? "" : ` + ${entries.map(([key, value]) => `${key}=${value}`).join(" ")}`;
}

function printDerivation(subset: string, mini: MiniManifests, identity: ReturnType<typeof verifyMiniManifestIdentity>): void {
  console.log(`MINI MANIFEST  (--sources=${subset})`);
  console.log(`  ${mini.keptIds.length} sources: ${mini.keptIds.join(", ")}`);
  if (mini.controlIds.length > 0) {
    console.log(`  controls back-filled to keep every stratum populated: ${mini.controlIds.join(", ")}`);
  }
  for (const group of mini.groups) {
    console.log(
      `  ${group.stratum.padEnd(18)} ${group.id.padEnd(30)} ` +
      `${group.members.length}/${group.canonicalMembers.length} members  ` +
      `weight ${group.canonicalWeight} -> ${group.weight.toFixed(4)}  ` +
      `${group.complete ? "COMPLETE (canonical group score)" : "partial (per-cell values only)"}`,
    );
  }
  console.log(`\nCOMPILE-IDENTITY`);
  for (const check of identity.checks) {
    console.log(`  ${check.ok ? "ok  " : "FAIL"} ${check.claim}\n         ${check.detail}`);
  }
  console.log(
    `  ${identity.ok ? "PROVEN" : "NOT PROVEN"}: every kept cell compiles and scores identically to its ` +
    `canonical counterpart.\n  The aggregate below is a renormalized subset score, NOT the suite headline.`,
  );
}

function runArm(input: {
  label: string;
  cwd: string;
  out: string;
  manifest: string;
  suite: string;
  budgets: string;
  seeds: number[];
  jobs: number;
  env: Record<string, string>;
}): void {
  // Shelling out keeps this tool out of the runner's import graph AND is the
  // only way the ref arm can execute the ref's own compiler.
  console.log(`  [${input.label}] compiling in ${input.cwd}`);
  execFileSync(
    process.execPath,
    [
      "--import", "tsx", "scripts/v0/benchmark_v2/scale_study.ts",
      `--manifest=${input.manifest}`,
      `--suite=${input.suite}`,
      `--budgets=${input.budgets}`,
      `--seeds=${input.seeds.join(",")}`,
      `--jobs=${input.jobs}`,
      "--budget-telemetry=off",
      `--out=${input.out}`,
    ],
    {
      cwd: input.cwd,
      env: { LR_ENGINE: "wasm", ...process.env, ...input.env },
      stdio: ["ignore", "inherit", "inherit"],
    },
  );
}

/**
 * A detached worktree at `ref`, with `node_modules` and the built engine
 * artifact shared from the working tree. Sharing the kernel is deliberate: a
 * mover grid compares compiler (TypeScript) changes, so both arms must run the
 * same engine bytes — the report asserts their engine fingerprints match.
 */
function createRefWorktree(ref: string): string {
  const parent = mkdtempSync(join(process.env.TMPDIR ?? "/tmp", "mover-grid-"));
  const workspace = join(parent, "ref");
  execFileSync("git", ["worktree", "add", "--detach", "--force", workspace, ref], { stdio: "inherit" });
  const modules = resolve("node_modules");
  if (!existsSync(modules)) throw new Error(`node_modules is required to run the ref arm`);
  symlinkSync(modules, join(workspace, "node_modules"));
  if (existsSync(ENGINE_ARTIFACT)) {
    mkdirSync(dirname(join(workspace, ENGINE_ARTIFACT)), { recursive: true });
    symlinkSync(resolve(ENGINE_ARTIFACT), join(workspace, ENGINE_ARTIFACT));
  }
  return workspace;
}

function disposeWorktree(workspace: string): void {
  execFileSync("git", ["worktree", "remove", "--force", workspace], { stdio: "ignore" });
  rmSync(dirname(workspace), { recursive: true, force: true });
}

function report(
  candidate: Arm,
  reference: Arm,
  options: {
    breakEven: BreakEvenInput | null;
    eventName: string;
    canonicalGroups: Map<string, string[]>;
    maxCells: number;
  },
): ActionSetPower {
  assertPairedArms(candidate, reference);

  const { pairs, changed, lost, gained, scoreDelta } = pairGridCells(candidate, reference);
  const keys = pairs.map((pair) => pair.key);

  console.log(`GRID  ${keys.length} cells, candidate vs ref`);
  console.log(`  arms                ${describeArmIdentity(candidate, reference, changed.length)}`);
  console.log(`  changed tracks      ${changed.length}`);
  console.log(`  lost completions    ${lost.length}`);
  console.log(`  gained completions  ${gained.length}`);
  console.log(`  score sum delta     ${scoreDelta >= 0 ? "+" : ""}${scoreDelta.toFixed(1)}` +
    `  (mean ${(scoreDelta / keys.length).toFixed(2)}/cell)`);

  console.log(`\nCAPABILITY GROUPS`);
  console.log(`  ${"group".padEnd(30)} ${"stratum".padEnd(18)} ${"ref".padStart(10)} ${"cand".padStart(10)} ${"delta".padStart(9)}  scope`);
  for (const [id, group] of reference.groups) {
    const after = candidate.groups.get(id);
    if (after === undefined) continue;
    const canonical = options.canonicalGroups.get(id);
    const scope = canonical === undefined
      ? "unknown group"
      : canonical.length === group.members.length ? "canonical" : `partial ${group.members.length}/${canonical.length}`;
    console.log(
      `  ${id.padEnd(30)} ${group.stratum.padEnd(18)} ${group.score.toFixed(2).padStart(10)} ` +
      `${after.score.toFixed(2).padStart(10)} ${(after.score - group.score >= 0 ? "+" : "")}` +
      `${(after.score - group.score).toFixed(2).padStart(8)}  ` +
      scope,
    );
  }

  console.log(`\nSOURCES`);
  console.log(`  ${"source".padEnd(42)} ${"ref".padStart(10)} ${"cand".padStart(10)} ${"delta".padStart(9)} ${"valid".padStart(9)}`);
  for (const [id, before] of reference.sources) {
    const after = candidate.sources.get(id);
    if (after === undefined) continue;
    console.log(
      `  ${id.padEnd(42)} ${before.score.toFixed(2).padStart(10)} ${after.score.toFixed(2).padStart(10)} ` +
      `${(after.score - before.score >= 0 ? "+" : "")}${(after.score - before.score).toFixed(2).padStart(8)} ` +
      `${`${after.validRuns}/${after.totalRuns}`.padStart(9)}` +
      (after.validRuns === before.validRuns ? "" : `  (ref ${before.validRuns}/${before.totalRuns})`),
    );
  }

  const moved = changed.map((pair) => ({ before: pair.ref, after: pair.candidate }));
  // Validity flips are the whole point of the footer, so they are never elided;
  // the rest of the action set is truncated to keep the report readable.
  const flips = moved.filter((pair) => pair.before.valid !== pair.after.valid);
  const shown = moved.length <= options.maxCells
    ? moved
    : [...flips, ...moved.filter((pair) => pair.before.valid === pair.after.valid)
        .slice(0, Math.max(0, options.maxCells - flips.length))];
  console.log(`\nCHANGED CELLS  (${moved.length}${shown.length < moved.length ? `, showing ${shown.length}` : ""})`);
  if (moved.length === 0) {
    console.log(`  none — the candidate is bit-identical to the ref across every cell`);
  } else {
    console.log(
      `  ${"source".padEnd(42)} ${"seed".padStart(5)} ${"ref".padStart(9)} ${"cand".padStart(9)} ` +
      `${"delta".padStart(9)} ${"ref fc".padStart(9)} ${"cand fc".padStart(9)}`,
    );
    for (const { before, after } of shown) {
      const mark = before.valid && !after.valid ? "  LOST" : !before.valid && after.valid ? "  GAINED" : "";
      console.log(
        `  ${after.sourceId.padEnd(42)} ${String(after.seed).padStart(5)} ` +
        `${(before.valid ? before.score.toFixed(1) : "X").padStart(9)} ` +
        `${(after.valid ? after.score.toFixed(1) : "X").padStart(9)} ` +
        `${(after.score - before.score).toFixed(1).padStart(9)} ` +
        `${String(before.firstCompletionFrame ?? "-").padStart(9)} ` +
        `${String(after.firstCompletionFrame ?? "-").padStart(9)}${mark}`,
      );
    }
  }

  const power = actionSetPower({
    changedCells: changed.length,
    adverseEvents: lost.length,
    totalCells: keys.length,
    breakEven: options.breakEven,
  });
  console.log(`\n${formatActionSetPower(power, options.eventName)}`);
  console.log(
    `\n  Evidence, never promotion: this grid sizes an action set and bounds a rate. ` +
    `Headlines come from\n  \`npm run benchmark -- eval\`.`,
  );
  return power;
}

function writeReport(
  out: string | undefined,
  paths: Record<string, string>,
  candidate: Arm,
  reference: Arm,
  power: ActionSetPower,
): void {
  if (out === undefined) return;
  const directory = resolve(out);
  mkdirSync(directory, { recursive: true });
  const path = join(directory, "mover-grid-report.json");
  const cells = [...reference.cells.keys()].sort().map((key) => ({
    ref: reference.cells.get(key)!,
    candidate: candidate.cells.get(key)!,
  }));
  writeFileSync(path, `${JSON.stringify({
    schema: MOVER_GRID_SCHEMA,
    generatedAt: new Date().toISOString(),
    note: "Mover-grid evidence over a source-id-filtered mini manifest. Not a headline, not a decision.",
    paths,
    suiteFingerprint: reference.archive.suiteFingerprint,
    sourceManifestFingerprint: reference.archive.sourceManifestFingerprint,
    scorerFingerprint: reference.archive.scorerFingerprint,
    arms: { candidate: candidate.archive.candidate, ref: reference.archive.candidate },
    power,
    changedCells: cells.filter((cell) => cell.ref.trackHash !== cell.candidate.trackHash),
    cells,
  }, null, 2)}\n`);
  console.log(`\n  report ${path}`);
}
