/**
 * Real-compiler readiness-factor ablation matrix.
 *
 * Each member is a normal canonical cached comparison whose compiler snapshot
 * records one explicit study environment value. Baseline rows are reused.
 *
 *   npm run benchmark:readiness:ablations -- --seeds=1 --jobs=48
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import {
  type ReadinessStudyAblation,
} from "./optimizer/readiness.ts";

const VARIANTS: readonly ReadinessStudyAblation[] = [
  "normal",
  "neutral",
  "without-catchability",
  "without-speed",
  "without-air",
  "without-impact",
  "without-elevation",
];

const argv = process.argv.slice(2);
const argValue = (name: string): string | undefined =>
  argv.find((arg) => arg.startsWith(`--${name}=`))
    ?.slice(name.length + 3);
const seeds = positiveInteger(argValue("seeds") ?? "1", "seeds", 300);
const totalJobs = positiveInteger(argValue("jobs") ?? "48", "jobs", 512);
const runId = new Date().toISOString().replaceAll(/[:.]/g, "-");
const outputDirectory = resolve(
  argValue("out-dir") ??
    `generated/benchmark-v2/readiness-ablations/N${seeds}-${runId}`,
);
mkdirSync(outputDirectory, { recursive: true });

console.error(
  `readiness ablations: ${VARIANTS.length} variants, N=${seeds}, ` +
    `${totalJobs} jobs`,
);

const results: VariantResult[] = [];
for (const variant of VARIANTS) {
  results.push(await runVariant(variant));
}

const summary = {
  schema: "line.readiness-compiler-ablation-matrix.v1",
  generatedAt: new Date().toISOString(),
  seeds,
  totalJobs,
  variants: results,
};
const summaryPath = resolve(outputDirectory, "summary.json");
writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
printSummary(results);
console.log(`\nsummary: ${relativeToCwd(summaryPath)}`);

type VariantResult = {
  variant: ReadinessStudyAblation;
  comparisonPath: string;
  baseHeadline: number;
  candidateHeadline: number;
  delta: number;
  valid: {
    base: number;
    candidate: number;
    total: number;
  };
  budgets: Array<{
    budget: number;
    base: number;
    candidate: number;
    delta: number;
  }>;
  strata: Array<{
    stratum: string;
    base: number;
    candidate: number;
    delta: number;
  }>;
};

async function runVariant(
  variant: ReadinessStudyAblation,
): Promise<VariantResult> {
  const archivePath = resolve(outputDirectory, `${variant}.json`);
  const comparisonPath = `${archivePath}.comparison.json`;
  if (existsSync(comparisonPath)) {
    throw new Error(
      `completed readiness ablation already exists: ` +
        `${relativeToCwd(comparisonPath)}`,
    );
  }
  const resume = existsSync(`${archivePath}.request.json`);
  const env = { ...process.env };
  if (variant === "normal") {
    delete env.LR_READINESS_STUDY_ABLATION;
  } else {
    env.LR_READINESS_STUDY_ABLATION = variant;
  }
  console.error(`[${variant}] ${resume ? "resuming" : "starting"}`);
  await runCommand(
    [
      "--import",
      "tsx",
      "scripts/benchmark/cli.ts",
      "eval",
      `--seeds=${seeds}`,
      `--jobs=${totalJobs}`,
      `--out=${archivePath}`,
      ...(resume ? ["--resume"] : []),
    ],
    env,
    variant,
  );
  const comparison = JSON.parse(
    readFileSync(comparisonPath, "utf8"),
  ) as any;
  if (
    comparison.status !== "complete" ||
    comparison.decision?.result === undefined
  ) {
    throw new Error(`incomplete comparison for ${variant}`);
  }
  const result = comparison.decision.result;
  const recorded =
    comparison.candidate?.snapshot?.compilerEnvironment
      ?.LR_READINESS_STUDY_ABLATION;
  if (
    (variant === "normal" && recorded !== undefined) ||
    (variant !== "normal" && recorded !== variant)
  ) {
    throw new Error(`compiler environment mismatch for ${variant}`);
  }
  return {
    variant,
    comparisonPath: relativeToCwd(comparisonPath),
    baseHeadline: result.baseHeadline,
    candidateHeadline: result.candidateHeadline,
    delta: result.delta,
    valid: {
      base: result.validity.baseValid,
      candidate: result.validity.candidateValid,
      total: result.validity.total,
    },
    budgets: result.perBudget.map((row: any) => ({
      budget: row.budget,
      base: row.base,
      candidate: row.candidate,
      delta: row.delta,
    })),
    strata: result.perStratum.map((row: any) => ({
      stratum: row.stratum,
      base: row.base,
      candidate: row.candidate,
      delta: row.delta,
    })),
  };
}

function runCommand(
  args: string[],
  env: NodeJS.ProcessEnv,
  variant: string,
): Promise<void> {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(process.execPath, args, {
      cwd: process.cwd(),
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    pipePrefixed(child.stdout, variant, process.stdout);
    pipePrefixed(child.stderr, variant, process.stderr);
    child.once("error", rejectRun);
    child.once("close", (code, signal) => {
      if (code === 0) {
        resolveRun();
      } else {
        rejectRun(
          new Error(
            `${variant} failed (code ${code}, signal ${signal ?? "none"})`,
          ),
        );
      }
    });
  });
}

function pipePrefixed(
  input: NodeJS.ReadableStream,
  prefix: string,
  output: NodeJS.WritableStream,
): void {
  let pending = "";
  input.setEncoding("utf8");
  input.on("data", (chunk: string) => {
    pending += chunk;
    while (true) {
      const end = pending.indexOf("\n");
      if (end < 0) return;
      output.write(`[${prefix}] ${pending.slice(0, end + 1)}`);
      pending = pending.slice(end + 1);
    }
  });
  input.on("end", () => {
    if (pending !== "") output.write(`[${prefix}] ${pending}\n`);
  });
}

function printSummary(results: readonly VariantResult[]): void {
  console.log(`Readiness compiler ablations — N=${seeds}`);
  for (const result of results) {
    console.log(
      `  ${result.variant.padEnd(22)} ` +
        `${result.candidateHeadline.toFixed(2)} ` +
        `(baseline ${result.delta >= 0 ? "+" : ""}` +
        `${result.delta.toFixed(2)}; ` +
        `valid ${result.valid.candidate}/${result.valid.total})`,
    );
  }
}

function positiveInteger(
  value: string,
  name: string,
  maximum: number,
): number {
  const parsed = Number(value);
  if (
    !Number.isSafeInteger(parsed) ||
    parsed < 1 ||
    parsed > maximum
  ) {
    throw new Error(`--${name} must be an integer in 1..${maximum}`);
  }
  return parsed;
}

function relativeToCwd(path: string): string {
  const cwd = `${resolve(".")}/`;
  return path.startsWith(cwd) ? path.slice(cwd.length) : path;
}
