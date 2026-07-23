/**
 * Diagnostic-only 99% versus 98% promotion-critical comparison.
 *
 * This does not simulate new trials and cannot authorize a policy row. It
 * anchors a transparent Gaussian-shift projection to the retained depth-48
 * empirical power cells, and preserves the empirical 99%/95% null and stress
 * observations as context. A real 98% row still requires the normal governed
 * menu plus independent-holdout certification.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { studentTQuantile } from "../v0/benchmark_v2/decision_model.ts";
import { writeFileAtomicDurable } from "../v0/benchmark_v2/durable_fs.ts";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const GENERATOR = "scripts/benchmark/analyze_alpha_counterfactual.ts";

export type AlphaCounterfactual = ReturnType<typeof buildAlphaCounterfactual>;

export function buildAlphaCounterfactual(menu: any, powerGrid: any, powerGridSha256: string): {
  schema: "line.benchmark-v2.alpha-counterfactual.v1";
  authority: "diagnostic-only";
  statement: string;
  suiteFingerprint: string;
  decisionInferenceFingerprint: string;
  comparison: {
    currentCriticalAlpha: number;
    counterfactualCriticalAlpha: number;
    depth: number;
    criticals: {
      df47: { current: number; counterfactual: number; reduction: number };
      normal: { current: number; counterfactual: number; reduction: number };
    };
  };
  finalPowerProjection: Array<{
    trueEffect: number;
    retainedPowerAt99: number;
    projectedPowerAt98: number;
    projectedGainPercentagePoints: number;
    retainedWilson95: [number, number];
    projectedFromWilsonEndpoints: [number, number];
  }>;
  currentDepth48Risk: Array<{
    id: string;
    scenario: string;
    acceptRateAt99: number;
    wilson95UpperAt99: number;
  }>;
  empiricalCriticalContext: Array<{
    depth: number;
    scenario: string;
    acceptRateAt99: number;
    acceptRateAt95: number;
    wilson95UpperAt99: number;
    wilson95UpperAt95: number;
  }>;
  limitations: string[];
  conclusion: string;
} {
  if (
    menu?.schema !== "line.benchmark-v2.independent-validation.v4" ||
    powerGrid?.schema !== "line.benchmark-v2.power-grid-study.v2" ||
    menu.upstream?.powerGrid?.sha256 !== powerGridSha256 ||
    menu.predeclared?.depth !== 48 || menu.predeclared?.criticalAlpha !== 0.01 ||
    !Array.isArray(powerGrid.config?.criticals) ||
    !powerGrid.config.criticals.includes(0.01) || !powerGrid.config.criticals.includes(0.05)
  ) throw new Error(`counterfactual inputs are not bound to the current depth-48 99% evidence`);

  const currentAlpha = 0.01;
  const counterfactualAlpha = 0.02;
  const critical99 = studentTQuantile(1 - currentAlpha, 47);
  const critical98 = studentTQuantile(1 - counterfactualAlpha, 47);
  const normal99 = studentTQuantile(1 - currentAlpha, Infinity);
  const normal98 = studentTQuantile(1 - counterfactualAlpha, Infinity);
  const ids = new Map([
    [2, "improve_power_2"],
    [3, "improve_power_3"],
    [5, "improve_power_5"],
  ]);
  const cells = new Map(menu.cells.map((cell: any) => [cell.id, cell]));
  const finalPowerProjection = [...ids].map(([trueEffect, id]) => {
    const cell: any = cells.get(id);
    if (cell?.combined?.accept?.total !== 1_000) throw new Error(`missing retained depth-48 power cell ${id}`);
    const retained = cell.combined.accept.rate;
    const interval = cell.combined.accept.wilson95 as [number, number];
    const project = (power: number): number => {
      const clipped = Math.min(1 - 1e-9, Math.max(1e-9, power));
      const effectiveSignal = critical99 + studentTQuantile(clipped, Infinity);
      return normalCdf(effectiveSignal - critical98);
    };
    const projected = project(retained);
    return {
      trueEffect,
      retainedPowerAt99: round6(retained),
      projectedPowerAt98: round6(projected),
      projectedGainPercentagePoints: round6((projected - retained) * 100),
      retainedWilson95: interval,
      projectedFromWilsonEndpoints: [
        round6(project(interval[0])),
        round6(project(interval[1])),
      ] as [number, number],
    };
  });

  const riskIds = [
    "improve_null_empirical",
    "improve_null_validity_flips",
    "improve_null_hard_zero",
    "futility_null",
  ];
  const currentDepth48Risk = riskIds.map((id) => {
    const cell: any = cells.get(id);
    const statistic = id === "futility_null" ? cell?.combined?.netAccept : cell?.combined?.accept;
    if (statistic === undefined) throw new Error(`missing retained depth-48 risk cell ${id}`);
    return {
      id,
      scenario: cell.scenario,
      acceptRateAt99: statistic.rate,
      wilson95UpperAt99: statistic.wilson95[1],
    };
  });

  const empiricalCriticalContext: Array<{
    depth: number;
    scenario: string;
    acceptRateAt99: number;
    acceptRateAt95: number;
    wilson95UpperAt99: number;
    wilson95UpperAt95: number;
  }> = [];
  for (const cell of [...powerGrid.improvementCells, ...powerGrid.stressCells]) {
    if (cell.trueDelta !== 0 || ![32, 64].includes(cell.depth)) continue;
    const bucket = cell.kind === "improvement" ? "impr" : "null";
    const at99 = cell.combined.byCritical["0.01"][bucket].accept;
    const at95 = cell.combined.byCritical["0.05"][bucket].accept;
    empiricalCriticalContext.push({
      depth: cell.depth,
      scenario: cell.scenario,
      acceptRateAt99: at99.rate,
      acceptRateAt95: at95.rate,
      wilson95UpperAt99: at99.wilson95[1],
      wilson95UpperAt95: at95.wilson95[1],
    });
  }

  return {
    schema: "line.benchmark-v2.alpha-counterfactual.v1",
    authority: "diagnostic-only",
    statement:
      "The 98% values are model-based projections anchored to retained depth-48 power, not empirical certification or promotion authority.",
    suiteFingerprint: menu.suiteFingerprint,
    decisionInferenceFingerprint: menu.decisionInferenceFingerprint,
    comparison: {
      currentCriticalAlpha: currentAlpha,
      counterfactualCriticalAlpha: counterfactualAlpha,
      depth: 48,
      criticals: {
        df47: { current: round6(critical99), counterfactual: round6(critical98), reduction: round6(critical99 - critical98) },
        normal: { current: round6(normal99), counterfactual: round6(normal98), reduction: round6(normal99 - normal98) },
      },
    },
    finalPowerProjection,
    currentDepth48Risk,
    empiricalCriticalContext,
    limitations: [
      "No trial was re-judged at criticalAlpha 0.02; the projection assumes a local Gaussian location shift after anchoring each effect to its observed 99% power.",
      "The retained 99% and 95% null/stress cells show empirical sensitivity to the critical, but they do not interpolate or bound the unmeasured 98% false-accept rate.",
      "Futility behavior and historical false-accept estimates at 98% are unknown until the full chain is rerun on calibration and independent holdout streams.",
      "Changing the promotion critical requires an inference migration and fresh certification; this artifact intentionally changes no policy.",
    ],
    conclusion:
      "98% appears to buy moderate, not transformative, power. Retain 99% unless a full 98% study demonstrates an acceptable risk/power frontier.",
  };
}

function normalCdf(value: number): number {
  const sign = value < 0 ? -1 : 1;
  const x = Math.abs(value) / Math.sqrt(2);
  const t = 1 / (1 + 0.3275911 * x);
  const erf = sign * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x));
  return 0.5 * (1 + erf);
}

function round6(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const argument = (name: string): string | undefined =>
    args.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
  const menuPath = resolve(REPO, argument("menu") ?? "benchmark/v2/studies/menu-certification.json");
  const gridPath = resolve(REPO, argument("power-grid") ?? "benchmark/v2/studies/power-grid.json");
  const outPath = resolve(REPO, argument("out") ?? "generated/benchmark-v2/studies/alpha-98-counterfactual.json");
  const menuBytes = readFileSync(menuPath);
  const gridBytes = readFileSync(gridPath);
  const menu = JSON.parse(menuBytes.toString("utf8"));
  const gridSha256 = sha256(gridBytes);
  if (menu.upstream?.powerGrid?.sha256 !== gridSha256) {
    throw new Error(`menu certification is not bound to the supplied power grid`);
  }
  const result = {
    ...buildAlphaCounterfactual(menu, JSON.parse(gridBytes.toString("utf8")), gridSha256),
    generatedAt: new Date().toISOString(),
    inputs: {
      menu: { path: relative(menuPath), sha256: sha256(menuBytes) },
      powerGrid: { path: relative(gridPath), sha256: gridSha256 },
    },
    generator: { path: GENERATOR, sha256: sha256(readFileSync(resolve(REPO, GENERATOR))) },
  };
  const bytes = `${JSON.stringify(result, null, 2)}\n`;
  writeFileAtomicDurable(outPath, bytes);
  writeFileAtomicDurable(`${outPath}.sha256`, `${sha256(bytes)}  ${relative(outPath)}\n`);
  console.log(`99% -> 98% diagnostic (not certification)`);
  for (const row of result.finalPowerProjection) {
    console.log(
      `  true +${row.trueEffect}: ${(row.retainedPowerAt99 * 100).toFixed(1)}% retained -> ` +
      `${(row.projectedPowerAt98 * 100).toFixed(1)}% projected (${row.projectedGainPercentagePoints >= 0 ? "+" : ""}${row.projectedGainPercentagePoints.toFixed(1)} pp)`,
    );
  }
  console.log(`  ${result.conclusion}`);
  console.log(`  artifact: ${relative(outPath)}`);
}

function relative(path: string): string {
  const prefix = `${REPO}/`;
  return path.startsWith(prefix) ? path.slice(prefix.length) : path;
}

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) await main();
