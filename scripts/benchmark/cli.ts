import { execFileSync } from "node:child_process";
import { availableParallelism } from "node:os";
import { format } from "node:util";
import { prepareBenchmarkV2, benchmarkV2Paths } from "./prepare.ts";
import { runBaselineBenchmark } from "../v0/benchmark_v2/baseline.ts";
import { startResourceMonitor } from "./resource_monitor.ts";
import { runDecisionCommand } from "../v0/benchmark_v2/decide.ts";
import { assertEvalArguments, runEvalCommand } from "../v0/benchmark_v2/eval.ts";
import { runRebaselineCommand } from "../v0/benchmark_v2/rebaseline.ts";
import { runStatusCommand } from "../v0/benchmark_v2/status.ts";
import { runFamilyCommand } from "../v0/benchmark_v2/family.ts";
import { runBaselineCacheCommand } from "../v0/benchmark_v2/baseline_cache_command.ts";
import { runCampaignBootstrapCommand } from "../v0/benchmark_v2/campaign_bootstrap.ts";
import {
  assertScaleCommandArguments,
  runScaleBenchmarkCommand,
} from "../v0/benchmark_v2/scale_benchmark.ts";

const COMMAND_ALIASES = new Set([
  "probe", "eval", "canonical", "baseline", "bootstrap", "rebaseline", "decide", "prepare", "explain",
  "status", "family", "baseline-cache", "scale", "help", "--probe", "--help", "-h",
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
  // `baseline-cache status` uses `status` as a subcommand, not the top-level
  // status command.  Keep it after selecting the command so the cache parser
  // can see its verb.
  const args = rawArgs.filter((arg) =>
    !COMMAND_ALIASES.has(arg) ||
    (command === "baseline-cache" && arg === "status") ||
    (command === "scale" && (arg === "baseline" || arg === "eval"))
  );
  const commandArgs = args.filter((arg) =>
    arg !== "--no-resource-stats" && !arg.startsWith("--resource-interval=")
  );

  if (command === "help") {
    printHelp();
  } else if (command === "status") {
    process.exitCode = runStatusCommand(commandArgs);
  } else if (command === "baseline-cache") {
    const action = commandArgs.find((arg) => !arg.startsWith("--"));
    if (action === "status") {
      process.exitCode = runBaselineCacheCommand(commandArgs);
    } else {
      const prepared = await prepareBenchmarkV2();
      console.log(
        `Prepared ${prepared.developmentCases} development + ${prepared.qualificationCases} qualification cases; ` +
        `audit ${prepared.auditFingerprint.slice(0, 16)}; listening review ${prepared.listeningReviewStatus}`,
      );
      process.exitCode = await monitored("baseline-cache", args, async () => runBaselineCacheCommand(commandArgs));
    }
  } else if (command === "scale") {
    assertScaleCommandArguments(commandArgs);
    const action = commandArgs.find((arg) => !arg.startsWith("--"));
    if (action === "compare") {
      process.exitCode = await runScaleBenchmarkCommand(commandArgs);
    } else {
      const prepared = await prepareBenchmarkV2({ requireSequentialCalibration: false });
      console.log(
        `Prepared ${prepared.developmentCases} development + ${prepared.qualificationCases} qualification cases; ` +
        `audit ${prepared.auditFingerprint.slice(0, 16)}; listening review ${prepared.listeningReviewStatus}`,
      );
      process.exitCode = await monitored("scale", args, () => runScaleBenchmarkCommand(commandArgs));
    }
  } else if (command === "explain") {
    if (jsonOutput) {
      throw new Error(`explain does not support --json; use --out=<path> for its report artifacts`);
    }
    execFileSync(process.execPath, ["--import", "tsx", "scripts/v0/benchmark_v2/explain.ts", ...commandArgs], {
      stdio: "inherit",
    });
  } else if (command === "decide") {
    process.exitCode = await runDecisionCommand(commandArgs);
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
    if (command === "eval") assertEvalArguments(commandArgs);
    const prepared = await prepareBenchmarkV2({
      requireSequentialCalibration: command !== "bootstrap" && command !== "baseline",
    });
    console.log(
      `Prepared ${prepared.developmentCases} development + ${prepared.qualificationCases} qualification cases; ` +
      `audit ${prepared.auditFingerprint.slice(0, 16)}; listening review ${prepared.listeningReviewStatus}`,
    );
    if (command === "prepare") {
      // Preparation above is the complete command.
    } else if (command === "eval") {
      process.exitCode = await monitored("eval", args, () => runEvalCommand(commandArgs));
    } else if (command === "rebaseline") {
      process.exitCode = await monitored("rebaseline", args, () => runRebaselineCommand(commandArgs));
    } else if (command === "canonical") {
      throw new Error(`canonical is no longer a separate workflow; use \`npm run benchmark -- eval --seeds=48\``);
    } else if (command === "baseline") {
      await monitored("baseline", args, () => runBaselineBenchmark(benchmarkArgs("canonical", args)));
    } else if (command === "bootstrap") {
      process.exitCode = await monitored("bootstrap", args, () => runCampaignBootstrapCommand(commandArgs));
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
): "eval" | "canonical" | "baseline" | "bootstrap" | "rebaseline" | "decide" | "prepare" | "explain" | "status" | "family" | "baseline-cache" | "scale" | "help" {
  if (args.includes("full") || args.includes("--full")) {
    throw new Error(`the full alias was retired; the active campaign command is \`eval --seeds=48\``);
  }
  if (args.includes("help") || args.includes("--help") || args.includes("-h")) return "help";
  if (args.includes("scale")) return "scale";
  if (args.includes("baseline-cache")) return "baseline-cache";
  if (args.includes("status")) return "status";
  if (args.includes("family")) return "family";
  if (args.includes("probe") || args.includes("--probe")) return "eval";
  if (args.includes("eval")) return "eval";
  if (args.includes("canonical")) return "canonical";
  if (args.includes("bootstrap")) return "bootstrap";
  if (args.includes("rebaseline")) return "rebaseline";
  if (args.includes("baseline")) return "baseline";
  if (args.includes("decide")) return "decide";
  if (args.includes("prepare")) return "prepare";
  if (args.includes("explain")) return "explain";
  const unknown = args.find((arg) => !arg.startsWith("--"));
  if (unknown !== undefined) throw new Error(`unknown benchmark command ${unknown}`);
  return "eval";
}

function printHelp(): void {
  console.log(`Benchmark V2\n\n` +
    `  npm run benchmark -- eval --seeds=48 [--jobs=48] [--resume]\n` +
    `                                   Active 750k improvement; strict N=8/16/32/48 looks, N=48 maximum\n` +
    `  npm run benchmark -- status\n` +
    `                                   Read-only campaign baseline/cache readiness and exact compute required\n` +
    `  npm run benchmark -- baseline-cache status|extend --seeds=LOOK\n` +
    `                                   Verify or append an N=8/16/32/48 active baseline prefix\n` +
    `  npm run benchmark -- scale baseline --seeds=16 --out=BASELINE.json\n` +
    `  npm run benchmark -- scale eval --baseline=BASELINE.json --seeds=8 [--out=RUN.json] [--artifact=COMPARISON.json]\n` +
    `  npm run benchmark -- scale compare --baseline=BASELINE.json --candidate=RUN.json\n` +
    `                                   Compact paired multi-budget profile; 4/8/16 looks; eval supports --extend-from and --breadth-policy\n` +
    `  npm run benchmark -- family capture NAME --variant=ID [--note=TEXT]\n` +
    `  npm run benchmark -- family run NAME [--seeds=6] [--jobs=N]\n` +
    `  npm run benchmark -- family select NAME --variant=ID [--reason=TEXT]\n` +
    `                                   Shared-seed descriptive variant exploration\n` +
    `  npm run benchmark -- rebaseline --from=COMPARISON --label=LABEL\n` +
    `                                   Promote a favorable 750k comparison without compiling deferred budgets\n` +
    `  npm run benchmark -- baseline    Explicit full baseline freeze for bootstrap or suite replacement\n` +
    `  npm run benchmark -- bootstrap --label=NAME --budget=750000 --seeds=48 --jobs=48 [--resume|--publish]\n` +
    `                                   Scorer-bound 750k/N=48 active-campaign baseline bootstrap\n` +
    `  npm run benchmark -- decide ARCHIVE [--base=BASE] [--mode=simplification --margin=POINTS]\n` +
    `                                   Standalone archive diagnostic; normal work uses eval\n` +
    `  npm run benchmark -- prepare     Regenerate and validate catalog evidence\n` +
    `  npm run benchmark -- explain <archive.json>\n\n` +
    `  Common execution flags: --jobs=N, --no-resource-stats, --resource-interval=SECONDS\n` +
    `  Eval paths: --out=RUN.json and --artifact=COMPARISON.json\n\n` +
    `Active improvements declare N=48 once, decide complete N=8/16/32/48 prefixes, and never recompute cached baseline rows.\n` +
    `With --json, invoke through \`npm run --silent benchmark -- ...\` or call this CLI directly so npm's script banner does not prefix stdout.\n` +
    `Eval exit codes: 0 completed, 1 invalid. The comparison result lives in the artifact, not the process exit code.\n` +
    `Compiler execution defaults to 48 workers and prints resource samples every five seconds.`);
}
