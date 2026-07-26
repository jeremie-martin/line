/**
 * Which specs get a non-neutral proposal-utility exponent, and at which budgets.
 *
 * Static: it builds each case's spec profile and asks the production gate
 * functions what they would resolve. Nothing is compiled and no engine runs.
 *
 * The question it exists to answer: `objectiveBlendReadinessPowerForSpec` is
 * named for readiness and was accepted (M75, 2026-07-04) when the objective was
 * `current^p x readiness^q` and the exponent reached readiness alone. Since the
 * contact-indexed pipeline landed, `proposalUtility` applies that same exponent
 * to projected outgoing quality as well. This counts how much of the suite is
 * actually affected.
 *
 * Usage:
 *   npm run study:objective-powers
 *   npm run study:objective-powers -- --budgets=75000,250000,500000,750000
 */
import { developmentCases, qualificationCases } from "../../benchmark/v2/catalog.ts";
import { benchmarkPolicy } from "../../benchmark/v2/policy.ts";
import { applyJolt } from "../produce/seed.ts";
import { resolveProposalUtilityPowersForSpec } from "./optimizer/handoff.ts";

const argv = process.argv.slice(2);
const argument = (name: string): string | undefined =>
  argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);

const budgets = (argument("budgets") ?? "75000,250000,500000,750000")
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
  future: number | undefined;
};

for (const budget of budgets) {
  const rows: Row[] = entries.map(({ scope, entry }) => {
    const spec = applyJolt(entry.case.spec, benchmarkPolicy.transform.joltMs);
    const powers = resolveProposalUtilityPowersForSpec(spec, budget);
    return {
      scope,
      id: entry.case.metadata.id,
      settled: powers.settledIncomingQualityPower,
      future: powers.futureQualityPower,
    };
  });

  const futureGated = rows.filter((row) => row.future !== undefined);
  const settledGated = rows.filter((row) => row.settled !== undefined);
  console.log(`\n=== budget ${budget} (${rows.length} cases) ===`);
  console.log(
    `future power (hits projected AND readiness): ${futureGated.length}/${rows.length} ` +
      `= ${(100 * futureGated.length / rows.length).toFixed(1)}%`,
  );
  console.log(
    `settled power:                              ${settledGated.length}/${rows.length} ` +
      `= ${(100 * settledGated.length / rows.length).toFixed(1)}%`,
  );
  const byScope = new Map<string, number>();
  for (const row of futureGated) {
    byScope.set(row.scope, (byScope.get(row.scope) ?? 0) + 1);
  }
  for (const [scope, count] of byScope) console.log(`  ${scope}: ${count}`);
  if (futureGated.length > 0) {
    const values = [...new Set(futureGated.map((row) => row.future))].sort();
    console.log(`  distinct future powers: ${values.join(", ")}`);
    console.log(`  cases: ${futureGated.map((row) => row.id).sort().join(", ")}`);
  }
}
