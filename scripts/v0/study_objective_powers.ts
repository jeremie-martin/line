/**
 * Which specs get a non-neutral proposal-utility exponent, and at which budgets.
 *
 * Static: it builds each case's spec profile and asks the production gate
 * function what it would resolve. Nothing is compiled and no engine runs.
 *
 * It reports ONE exponent. The future-quality exponent it used to report
 * alongside came from `objectiveBlendReadinessPowerForSpec`, whose production
 * call site went in 2026-07-28 on a +0.00 / SE 0.19 null and which was deleted
 * in 2026-08; nothing but this study read it in between.
 *
 * The budget axis stays, and it is the interesting one: the settled exponent's
 * two budget ramps are pinned (`mature` is exactly 1.0 from B = 250,000 up,
 * `scarce` exactly 0.0 from B = 225,000 up), so every row is identical across
 * the canonical grid and only the sub-250k rungs differ. That difference is
 * load-bearing — shipping the mature branch unconditionally measured -2.2 mean
 * score per run at 225k and worse below — so this table is how to see which
 * specs are carrying it.
 *
 * Usage:
 *   npm run study:objective-powers
 *   npm run study:objective-powers -- --budgets=75000,150000,225000,750000
 */
import { developmentCases, qualificationCases } from "../../benchmark/v2/catalog.ts";
import { benchmarkPolicy } from "../../benchmark/v2/policy.ts";
import { applyJolt } from "../produce/seed.ts";
import { resolveProposalUtilityPowersForSpec } from "./optimizer/handoff.ts";

const argv = process.argv.slice(2);
const argument = (name: string): string | undefined =>
  argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);

const budgets = (argument("budgets") ?? "75000,150000,225000,750000")
  .split(",").map((value) => Number(value.trim()));
if (budgets.some((budget) => !Number.isSafeInteger(budget) || budget <= 0)) {
  throw new Error(`--budgets must be positive integers`);
}
const includeQualification = argv.includes("--qualification");

const entries = [
  ...developmentCases.map((entry) => ({ scope: "development", entry })),
  ...(includeQualification
    ? qualificationCases.map((entry) => ({ scope: "qualification", entry }))
    : []),
];

type Row = {
  scope: string;
  id: string;
  settled: number | undefined;
};

for (const budget of budgets) {
  const rows: Row[] = entries.map(({ scope, entry }) => {
    const spec = applyJolt(entry.case.spec, benchmarkPolicy.transform.joltMs);
    const powers = resolveProposalUtilityPowersForSpec(spec, budget);
    return {
      scope,
      id: entry.case.metadata.id,
      settled: powers.settledIncomingQualityPower,
    };
  });

  const settledGated = rows.filter((row) => row.settled !== undefined);
  console.log(`\n=== budget ${budget} (${rows.length} cases) ===`);
  console.log(
    `settled power: ${settledGated.length}/${rows.length} ` +
      `= ${(100 * settledGated.length / rows.length).toFixed(1)}%`,
  );
  const byScope = new Map<string, number>();
  for (const row of settledGated) {
    byScope.set(row.scope, (byScope.get(row.scope) ?? 0) + 1);
  }
  for (const [scope, count] of byScope) console.log(`  ${scope}: ${count}`);
  if (settledGated.length > 0) {
    const values = [...new Set(settledGated.map((row) => row.settled))].sort((a, b) => a! - b!);
    console.log(`  distinct settled powers: ${values.join(", ")}`);
    console.log(`  cases: ${settledGated.map((row) => row.id).sort().join(", ")}`);
  }
}
