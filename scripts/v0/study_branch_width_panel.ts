/**
 * Cheap fixed-seed panel for a global handoff branch-width experiment.
 *
 * The compiler deliberately owns the width. This script only records its
 * outcome across a balanced capability/representative panel, so a temporary
 * width edit is evaluated as one hypothesis rather than one showcased case.
 */
import { writeFileSync } from "node:fs";
import { basename } from "node:path";
import dense from "../../benchmark/v2/cases/normative/capability/frontier_dense_recovery.ts";
import frontier from "../../benchmark/v2/cases/normative/capability/frontier_low_air_endurance.ts";
import pickup from "../../benchmark/v2/cases/normative/capability/frontier_pickup_progression.ts";
import believer from "../../benchmark/v2/cases/normative/development_music/believer_56_6s.ts";
import countercurrent from "../../benchmark/v2/cases/normative/representative/countercurrent.ts";
import dense240 from "../../benchmark/v2/cases/variants/capability/frontier_dense_recovery_240ms_figures.ts";
import frontier6 from "../../benchmark/v2/cases/variants/capability/frontier_low_air_endurance_6s.ts";
import frontier4 from "../../benchmark/v2/cases/variants/capability/frontier_low_air_endurance_4s.ts";
import frontier7 from "../../benchmark/v2/cases/variants/capability/frontier_low_air_endurance_7s.ts";
import pickupShifted from "../../benchmark/v2/cases/variants/capability/frontier_pickup_progression_shifted.ts";
import { benchmarkPolicy } from "../../benchmark/v2/policy.ts";
import { applyJolt } from "../produce/seed.ts";
import { scoreDriftReport } from "./score.ts";
import {
  compileHandoff,
  setHandoffRankedOptionsProbeHook,
  type HandoffRankedOptionsProbeRecord,
} from "./optimizer/handoff.ts";
import { FPS, type Spec } from "./types.ts";

const catalog: Record<string, Spec> = {
  pickup,
  "pickup-shifted": pickupShifted,
  dense,
  dense240,
  frontier,
  frontier4,
  frontier6,
  frontier7,
  countercurrent,
  believer,
};
const argv = process.argv.slice(2);
if (argv.includes("--help") || argv.includes("-h")) {
  process.stdout.write(
    "Usage: study_branch_width_panel.ts [--cases=NAME,...] [--seed=N] " +
      "[--search-seed-offset=N] [--budget=N] [--root-options=1] [--polish] [--out=FILE]\n",
  );
  process.exit(0);
}
const arg = (name: string): string | undefined =>
  argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const names = (arg("cases") ?? Object.keys(catalog).join(","))
  .split(",")
  .filter((value) => value.length > 0);
const seed = Number(arg("seed") ?? "27");
const searchSeedOffset = Number(arg("search-seed-offset") ?? "0");
const budget = Number(arg("budget") ?? "500000");
const rootOptions = arg("root-options") === "1";
const polish = argv.includes("--polish");
const out = arg("out");
if (!Number.isSafeInteger(seed)) throw new Error(`invalid --seed=${seed}`);
if (!Number.isSafeInteger(searchSeedOffset)) {
  throw new Error(`invalid --search-seed-offset=${searchSeedOffset}`);
}
if (!Number.isSafeInteger(budget) || budget <= 0) throw new Error(`invalid --budget=${budget}`);
const selected = names.map((name) => {
  const spec = catalog[name];
  if (spec === undefined) throw new Error(`unknown --cases entry ${name}`);
  return [name, spec] as const;
});

const rows = selected.map(([name, source]) => {
  const spec = applyJolt(source, benchmarkPolicy.transform.joltMs);
  const started = performance.now();
  let rootOptionRecord: HandoffRankedOptionsProbeRecord | null = null;
  if (rootOptions) {
    setHandoffRankedOptionsProbeHook((record) => {
      if (rootOptionRecord === null && record.gapIndex === 0) rootOptionRecord = record;
    });
  }
  let checkpoint;
  try {
    checkpoint = compileHandoff(spec, seed, {
      budget,
      searchSeed: seed + searchSeedOffset,
      polish,
    });
  } finally {
    setHandoffRankedOptionsProbeHook(null);
  }
  const score = scoreDriftReport(checkpoint.report, {
    totalFrames: Math.round(spec.duration * FPS),
  });
  return {
    name,
    spec: basename(name),
    valid: score.contract_passed,
    score: Number(score.score.toFixed(4)),
    simFrames: checkpoint.stats.sim_frames,
    firstCompletionFrame: checkpoint.stats.first_completion_frame ?? null,
    branchLimit: checkpoint.stats.handoff_policy_branch_limit_max ?? null,
    // Existing compiler telemetry, surfaced here so a source trial can explain
    // whether an aiming change altered proposal volume, admission, or only
    // downstream search allocation.
    aim: checkpoint.stats.aim ?? null,
    elapsedMs: Math.round(performance.now() - started),
    polish: {
      tried: checkpoint.stats.polish_variants_tried ?? 0,
      changed: checkpoint.stats.polish_variants_changed ?? 0,
      adopted: checkpoint.stats.polish_variants_adopted ?? 0,
    },
    ...(rootOptions ? { rootOptions: rootOptionRecord } : {}),
  };
});
const output = {
  schema: "line.study-branch-width-panel.v1",
  // `seed` drives the compiler's candidate sampling; specs themselves are fixed.
  compilerSeed: seed,
  searchSeed: seed + searchSeedOffset,
  searchSeedOffset,
  budget,
  polish,
  rows,
};
if (out !== undefined) writeFileSync(out, `${JSON.stringify(output, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
