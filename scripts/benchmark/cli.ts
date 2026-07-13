import { execFileSync } from "node:child_process";
import { availableParallelism } from "node:os";
import { format } from "node:util";
import { prepareBenchmarkV2, benchmarkV2Paths } from "./prepare.ts";
import { runBaselineBenchmark } from "../v0/benchmark_v2/baseline.ts";
import { startResourceMonitor } from "./resource_monitor.ts";
import { runDecisionCommand } from "../v0/benchmark_v2/decide.ts";
import { assertEvalArguments, runEvalCommand } from "../v0/benchmark_v2/eval.ts";
import { runMigrationCommand } from "../v0/benchmark_v2/migrate.ts";
import { runRebaselineCommand, runTransitionCommand } from "../v0/benchmark_v2/rebaseline.ts";
import { benchmarkEvalPolicy } from "../../benchmark/v2/eval-policy.ts";
import { runStatusCommand } from "../v0/benchmark_v2/status.ts";
import { runFamilyCommand } from "../v0/benchmark_v2/family.ts";

const COMMAND_ALIASES = new Set([
  "probe", "eval", "canonical", "baseline", "rebaseline", "transition", "decide", "migrate", "prepare", "explain",
  "status", "family", "help", "--probe", "--help", "-h",
]);
const raw = process.argv.slice(2);
const jsonOutput = raw.includes("--json");
const jsonCapture = jsonOutput ? installJsonOutputRouter() : null;
if (jsonOutput) process.env.LINE_BENCHMARK_JSON_STDOUT = "1";

try {
  await main(raw);
  jsonCapture?.flush(currentExitCode());
} catch (error) {
  if (!jsonOutput) throw error;
  jsonCapture!.flushError(error);
  process.exitCode = 1;
}

async function main(rawArgs: string[]): Promise<void> {
  const command = commandName(rawArgs);
  const args = rawArgs.filter((arg) => !COMMAND_ALIASES.has(arg));
  const commandArgs = args.filter((arg) =>
    arg !== "--no-resource-stats" && !arg.startsWith("--resource-interval=")
  );

  if (command === "help") {
    printHelp();
  } else if (command === "status") {
    process.exitCode = runStatusCommand(commandArgs);
  } else if (command === "explain") {
    if (jsonOutput) {
      throw new Error(`explain does not support --json; use --out=<path> for its report artifacts`);
    }
    execFileSync(process.execPath, ["--import", "tsx", "scripts/v0/benchmark_v2/explain.ts", ...commandArgs], {
      stdio: "inherit",
    });
  } else if (command === "decide") {
    process.exitCode = await runDecisionCommand(commandArgs);
  } else if (command === "migrate") {
    process.exitCode = await runMigrationCommand(commandArgs);
  } else if (command === "transition") {
    process.exitCode = runTransitionCommand(commandArgs);
  } else if (command === "family") {
    const action = commandArgs.find((arg) => !arg.startsWith("--"));
    if (action === "run") {
      const prepared = await prepareBenchmarkV2();
      console.log(
        `Prepared ${prepared.developmentCases} development + ${prepared.qualificationCases} qualification cases; ` +
        `audit ${prepared.auditFingerprint.slice(0, 16)}; listening review ${prepared.listeningReviewStatus}`,
      );
      process.exitCode = await monitored("family", args, () => runFamilyCommand(commandArgs));
    } else {
      process.exitCode = await runFamilyCommand(commandArgs);
    }
  } else {
    // Validate eval mode-specific flags before deterministic preparation. This
    // keeps a misspelled output destination from doing any paid work.
    if (command === "probe" || command === "eval") assertEvalArguments(commandArgs);
    const prepared = await prepareBenchmarkV2();
    console.log(
      `Prepared ${prepared.developmentCases} development + ${prepared.qualificationCases} qualification cases; ` +
      `audit ${prepared.auditFingerprint.slice(0, 16)}; listening review ${prepared.listeningReviewStatus}`,
    );
    if (command === "prepare") {
      // Preparation above is the complete command.
    } else if (command === "probe" || command === "eval") {
      if (command === "probe") {
        console.log(`note: probe is the eval chain's stage 0; \`npm run benchmark -- eval\` is the primary spelling`);
      }
      process.exitCode = await monitored("eval", args, () => runEvalCommand(commandArgs));
    } else if (command === "rebaseline") {
      process.exitCode = await monitored("rebaseline", args, () => runRebaselineCommand(commandArgs));
    } else if (command === "canonical") {
      throw new Error(`the one-shot canonical path was retired after the eval chain's live validation; use \`npm run benchmark -- eval --to-verdict\``);
    } else if (command === "baseline") {
      await monitored("baseline", args, () => runBaselineBenchmark(benchmarkArgs("canonical", args)));
    } else {
      throw new Error(`unknown benchmark command ${command}`);
    }
  }
}

function installJsonOutputRouter(): {
  flush: (exitCode: number) => void;
  flushError: (error: unknown) => void;
} {
  const diagnostic = console.error.bind(console);
  let payload: unknown;
  let payloadCount = 0;
  console.log = (...values: unknown[]): void => {
    if (values.length === 1 && typeof values[0] === "string") {
      try {
        payload = JSON.parse(values[0]);
        payloadCount++;
        return;
      } catch {
        // Ordinary progress text belongs on stderr in JSON mode.
      }
    }
    diagnostic(format(...values));
  };
  const write = (value: unknown): void => {
    process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
  };
  return {
    flush: (exitCode): void => {
      if (payloadCount > 1) {
        write(cliResult(exitCode, "invalid", {
          name: "JsonOutputError",
          message: `command emitted ${payloadCount} structured payloads; expected exactly one`,
        }));
        process.exitCode = 1;
        return;
      }
      write(payloadCount === 1 ? payload : cliResult(exitCode, exitStatus(exitCode)));
    },
    flushError: (error): void => {
      const normalized = error instanceof Error
        ? { name: error.name, message: error.message }
        : { name: "Error", message: String(error) };
      write(cliResult(1, "invalid", normalized));
    },
  };
}

function cliResult(exitCode: number, status: string, error?: { name: string; message: string }): Record<string, unknown> {
  return {
    schema: "line.benchmark-v2.cli-result.v1",
    ok: exitCode !== 1,
    exitCode,
    status,
    ...(error === undefined ? {} : { error }),
  };
}

function exitStatus(exitCode: number): string {
  if (exitCode === 0) return "completed";
  if (exitCode === 2) return "inconclusive";
  if (exitCode === 3) return "reject";
  if (exitCode === 4) return "futility-stop";
  return "invalid";
}

function currentExitCode(): number {
  return typeof process.exitCode === "number" ? process.exitCode : Number(process.exitCode ?? 0);
}

function benchmarkArgs(profile: "probe" | "canonical", args: string[]): string[] {
  const reserved = [
    "manifest", "heldout-manifest", "suite", "characterization", "audit", "review", "listening-review", "profile",
  ];
  const forwarded = args.filter((arg) =>
    !reserved.some((name) => arg.startsWith(`--${name}=`)) &&
    arg !== "--no-resource-stats" && !arg.startsWith("--resource-interval=")
  );
  if (!forwarded.some((arg) => arg.startsWith("--jobs="))) {
    forwarded.push(`--jobs=${Math.min(48, availableParallelism())}`);
  }
  return [
    `--profile=${profile}`,
    `--manifest=${benchmarkV2Paths.sourceManifest}`,
    `--heldout-manifest=${benchmarkV2Paths.heldoutManifest}`,
    `--suite=${benchmarkV2Paths.suiteManifest}`,
    `--characterization=${benchmarkV2Paths.characterization}`,
    `--audit=${benchmarkV2Paths.audit}`,
    `--review=${benchmarkV2Paths.review}`,
    `--listening-review=${benchmarkV2Paths.listeningReview}`,
    ...forwarded,
  ];
}

async function monitored<T>(label: string, args: string[], run: () => Promise<T>): Promise<T> {
  if (args.includes("--no-resource-stats")) return run();
  const rawInterval = args.find((arg) => arg.startsWith("--resource-interval="))?.split("=")[1];
  const interval = rawInterval === undefined ? 5 : Number(rawInterval);
  if (!Number.isFinite(interval) || interval < 1) throw new Error(`--resource-interval must be at least 1 second`);
  const monitor = startResourceMonitor(label, interval);
  try {
    return await run();
  } finally {
    monitor.stop();
  }
}

function commandName(
  args: string[],
): "probe" | "eval" | "canonical" | "baseline" | "rebaseline" | "transition" | "decide" | "migrate" | "prepare" | "explain" | "status" | "family" | "help" {
  if (args.includes("full") || args.includes("--full")) {
    throw new Error(`the full profile was retired; use \`eval --to-verdict\` for certified confirmation`);
  }
  if (args.includes("help") || args.includes("--help") || args.includes("-h")) return "help";
  if (args.includes("status")) return "status";
  if (args.includes("family")) return "family";
  if (args.includes("eval")) return "eval";
  if (args.includes("canonical")) return "canonical";
  if (args.includes("rebaseline")) return "rebaseline";
  if (args.includes("baseline")) return "baseline";
  if (args.includes("transition")) return "transition";
  if (args.includes("decide")) return "decide";
  if (args.includes("migrate")) return "migrate";
  if (args.includes("prepare")) return "prepare";
  if (args.includes("explain")) return "explain";
  const unknown = args.find((arg) => !arg.startsWith("--"));
  if (unknown !== undefined && unknown !== "probe") throw new Error(`unknown benchmark command ${unknown}`);
  return "probe";
}

function printHelp(): void {
  const menu = benchmarkEvalPolicy.operatingPoints.map((point) =>
    `    ${point.id}: ${point.mode}` +
    `${point.margin === null ? "" : `, margin ${point.margin}`}, depth ${point.depth}` +
    `${point.futilitySchedule.length === 0 ? ", no interim looks" : `, looks ${point.futilitySchedule.join("/")}`}`
  ).join("\n");
  console.log(`Benchmark V2\n\n` +
    `  npm run benchmark -- eval        Stage 0: informational screen of the current tree vs the baseline (probe is a deprecated alias)\n` +
    `  npm run benchmark -- status      Read-only baseline, era budget, certified cost, timing, and rebaseline blockers\n` +
    `  npm run benchmark -- family capture NAME --variant=ID [--note=TEXT]\n` +
    `  npm run benchmark -- family run NAME [--seeds=6] [--jobs=N]\n` +
    `  npm run benchmark -- family select NAME --variant=ID [--reason=TEXT]\n` +
    `                                   Shared-seed descriptive variant exploration; selection then enters fresh certified eval\n` +
    `  npm run benchmark -- eval --to-verdict [--mode=improve] [--acknowledge-retry] [--resume] [--json]\n` +
    `  npm run benchmark -- eval --to-verdict --mode=simplify --margin=5 [--acknowledge-retry] [--resume] [--json]\n` +
    `                                   Declared, certified confirmation: fresh paired epoch, futility looks, verdict\n` +
    `  npm run benchmark -- eval --abort-in-flight --reason=...\n` +
    `                                   Settle an infrastructure-broken attempt; its declared spend remains charged\n` +
    `  npm run benchmark -- rebaseline --label=LABEL   After an accepted eval attempt: light rebaseline (era record + fresh probe reference)\n` +
    `  npm run benchmark -- transition --reason=...    Ledger an operator transition (no budget reset)\n` +
    `  npm run benchmark -- baseline    Bootstrap or suite-rollover full freeze (within a suite, use rebaseline)\n` +
    `  npm run benchmark -- decide PROBE_ARCHIVE [--base=BASE] [--mode=simplification --margin=POINTS]\n` +
    `  npm run benchmark -- migrate --scope=protocol|calibration|inference --alters-decision-behavior=yes|no --reason=... --approve\n` +
    `  npm run benchmark -- prepare     Regenerate and validate catalog evidence\n` +
    `  npm run benchmark -- explain <archive.json>\n\n` +
    `  Certified operating points:\n${menu}\n\n` +
    `  Common execution flags: --jobs=N, --no-resource-stats, --resource-interval=SECONDS\n` +
    `  Eval paths: stage 0 --out=FILE; confirmation --out-dir=DIR --archive-dir=DIR\n\n` +
    `Stage 0 is reusable screening only; --to-verdict is a predeclared certified promotion gate. Standalone decide is probe analysis only. Qualification is an indicative sidecar.\n` +
    `With --json, invoke through \`npm run --silent benchmark -- ...\` or call this CLI directly so npm's script banner does not prefix stdout.\n` +
    `Eval verdict exit codes: 0 accept, 2 inconclusive, 3 reject, 4 futility stop, 1 invalid; stage 0 emits 0/1. Decide: 0 favorable, 2 unresolved, 3 unfavorable, 1 invalid.\n` +
    `Compiler execution defaults to 48 workers and prints resource samples every five seconds.`);
}
