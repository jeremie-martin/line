/**
 * v0 CLI entry — load a spec module, compile it, write Track JSON +
 * DriftReport to disk.
 *
 *   npx tsx scripts/v0/run.ts --spec=scripts/v0/specs/first.ts
 *   npx tsx scripts/v0/run.ts --spec=scripts/v0/specs/first.ts --seed=42 --out=generated/v0_first
 *   npx tsx scripts/v0/run.ts --spec=... --compiler=handoff --budget=200000
 *
 * --compiler: handoff (default). Kept explicit so future compilers can be
 *             added without changing the CLI shape. Default budget 200000.
 *
 * Outputs:
 *   <out>.track.json
 *   <out>.report.json
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve, basename } from "node:path";
import { compileHandoff } from "./optimizer/handoff.ts";
import { AXES, FPS, type Spec } from "./types.ts";
import { axisDetails, scoreDriftReport } from "./score.ts";

const COMPILERS = {
  handoff: compileHandoff,
} as const;

type CompilerName = keyof typeof COMPILERS;

function isCompilerName(value: string): value is CompilerName {
  return Object.hasOwn(COMPILERS, value);
}

const argv = process.argv.slice(2);
const arg = (name: string): string | null => {
  const m = argv.find((a) => a.startsWith(`--${name}=`));
  return m ? m.slice(name.length + 3) : null;
};

const specPath = arg("spec");
if (!specPath) {
  console.error("usage: npx tsx scripts/v0/run.ts --spec=<path.ts> [--seed=N] [--out=<prefix>]");
  process.exit(1);
}

const seed = arg("seed") !== null ? parseInt(arg("seed")!, 10) : 0;

const rawCompiler = arg("compiler") ?? "handoff";
if (!isCompilerName(rawCompiler)) {
  console.error(`unknown --compiler=${rawCompiler} (expected handoff)`);
  process.exit(1);
}
const compiler: CompilerName = rawCompiler;
const rawBudget = arg("budget");
const budgetUnits = rawBudget !== null ? Number(rawBudget) : 200_000;
if (!Number.isSafeInteger(budgetUnits) || budgetUnits <= 0) {
  console.error(`invalid --budget=${arg("budget")} (expected positive integer)`);
  process.exit(1);
}

const specName = basename(specPath).replace(/\.ts$/, "");
const outPrefix = arg("out") ?? `generated/v0_${specName}`;

console.log(`spec=${specPath}  compiler=${compiler}  seed=${seed}  budget=${budgetUnits}  out=${outPrefix}`);

const specMod = await import(resolve(specPath));
const spec: Spec = specMod.default;
if (!spec) {
  console.error(`spec module at ${specPath} did not default-export a Spec`);
  process.exit(1);
}

const t0 = Date.now();
const { checkpoints } = COMPILERS[compiler](spec, seed, { budgets: [budgetUnits] });
const [{ track, report }] = checkpoints;
const elapsedMs = Date.now() - t0;

mkdirSync(dirname(resolve(`${outPrefix}.track.json`)), { recursive: true });
writeFileSync(resolve(`${outPrefix}.track.json`), JSON.stringify(track, null, 2));
writeFileSync(resolve(`${outPrefix}.report.json`), JSON.stringify(report, null, 2));

// Console summary
// Terminal summary: small and sync-first. Full per-gap detail lives in the
// report JSON (and the dashboard); the terminal shows only what you scan for.
const contactSummary = report.contacts.reduce(
  (acc, c) => { acc[c.status]++; return acc; },
  { hit: 0, drift: 0, missing: 0 } as Record<string, number>,
);
const score = scoreDriftReport(report, { totalFrames: track.duration });
const axes = axisDetails(report);

// Per-axis mean |error| roll-up (which axis is hurting, without listing gaps).
const byAxis = AXES.map((name) => {
  const errs = axes.filter((a) => a.axis === name).map((a) => Math.abs(a.error));
  if (errs.length === 0) return null;
  const mean = errs.reduce((s, e) => s + e, 0) / errs.length;
  return `${name} ${mean.toFixed(2)}`;
}).filter((s): s is string => s !== null);

// The few worst-error gaps (target→achieved per axis on that gap).
const worstGaps = [...report.gaps]
  .map((g) => ({
    g,
    maxErr: Math.max(0, ...Object.values(g.axes).map((v) => Math.abs(v.error))),
  }))
  .filter((x) => x.maxErr > 0)
  .sort((a, b) => b.maxErr - a.maxErr)
  .slice(0, 5)
  .map(({ g }) => {
    const parts = Object.entries(g.axes)
      .map(([k, v]) => `${k} ${v.target.toFixed(2)}→${v.achieved.toFixed(2)}`)
      .join("  ");
    return `  g${g.gap_index} ${g.t_end.toFixed(1)}s  ${parts}`;
  });

const durS = (track.duration / FPS).toFixed(1);
const lines = [
  `compiled ${durS}s → ${track.lines.length} lines  (${elapsedMs}ms)`,
  `contacts  ${contactSummary.hit}/${report.contacts.length} hit · ${contactSummary.drift} drift · ` +
    `${contactSummary.missing} missing · ${report.off_beat_landings.length} off-beat`,
  `survival  ${report.terminus.reason}@${report.terminus.frame}   ` +
    `score ${score.score.toFixed(1)}   axis_rms ${score.axis_error_rms.toFixed(3)}`,
];
if (byAxis.length > 0) lines.push(`by axis (mean|err|):  ${byAxis.join("  ")}`);
if (worstGaps.length > 0) lines.push("worst gaps (target→achieved):", ...worstGaps);
lines.push(`full report → ${outPrefix}.report.json`);
console.log("\n" + lines.join("\n") + "\n");
