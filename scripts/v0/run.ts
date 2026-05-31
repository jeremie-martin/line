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
import type { Budget } from "./optimizer/types.ts";
import type { Spec } from "./types.ts";

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
const budgetUnits = arg("budget") !== null ? parseInt(arg("budget")!, 10) : 200_000;
const budget: Budget = { kind: "work", units: budgetUnits };

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
const { track, report } = COMPILERS[compiler](spec, seed, { budget });
const elapsedMs = Date.now() - t0;

mkdirSync(dirname(resolve(`${outPrefix}.track.json`)), { recursive: true });
writeFileSync(resolve(`${outPrefix}.track.json`), JSON.stringify(track, null, 2));
writeFileSync(resolve(`${outPrefix}.report.json`), JSON.stringify(report, null, 2));

// Console summary
const hardOffBeats = report.off_beat_landings.length;
const contactSummary = report.contacts.reduce(
  (acc, c) => { acc[c.status]++; return acc; },
  { hit: 0, drift: 0, missing: 0 } as Record<string, number>,
);
const sectionSummary = report.sections.map((s) => {
  const axes = Object.entries(s.axes).map(([k, v]) =>
    `${k}=${v.achieved.toFixed(2)}(target ${v.target.toFixed(2)})`,
  ).join(" ");
  return `  §${s.section_index} survived=${s.survived} ${axes}`;
}).join("\n");

console.log(`
compiled in ${elapsedMs}ms → ${track.lines.length} lines
contacts: ${contactSummary.hit} hit / ${contactSummary.drift} drift / ${contactSummary.missing} missing
off-beat landings (hard violations): ${hardOffBeats}
terminus: ${report.terminus.reason} @ frame ${report.terminus.frame}
sections:
${sectionSummary}
`);
