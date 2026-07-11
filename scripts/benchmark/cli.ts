import { execFileSync } from "node:child_process";
import { availableParallelism } from "node:os";
import { prepareBenchmarkV2, benchmarkV2Paths } from "./prepare.ts";
import { runBaselineBenchmark } from "../v0/benchmark_v2/baseline.ts";
import { runCanonicalConfirmation } from "../v0/benchmark_v2/confirmation.ts";
import { runBenchmarkV2 } from "../v0/benchmark_v2/runner.ts";
import { startResourceMonitor } from "./resource_monitor.ts";
import { runDecisionCommand } from "../v0/benchmark_v2/decide.ts";
import { runEvalCommand } from "../v0/benchmark_v2/eval.ts";
import { runMigrationCommand } from "../v0/benchmark_v2/migrate.ts";
import { runRebaselineCommand, runTransitionCommand } from "../v0/benchmark_v2/rebaseline.ts";

const COMMAND_ALIASES = new Set([
  "probe", "eval", "canonical", "baseline", "rebaseline", "transition", "decide", "migrate", "prepare", "explain",
  "help", "--probe", "--help", "-h",
]);
const raw = process.argv.slice(2);
const command = commandName(raw);
const args = raw.filter((arg) => !COMMAND_ALIASES.has(arg));

if (command === "help") {
  printHelp();
} else if (command === "explain") {
  execFileSync(process.execPath, ["--import", "tsx", "scripts/v0/benchmark_v2/explain.ts", ...args], {
    stdio: "inherit",
  });
} else if (command === "decide") {
  process.exitCode = await runDecisionCommand(args);
} else if (command === "migrate") {
  process.exitCode = await runMigrationCommand(args);
} else if (command === "transition") {
  process.exitCode = runTransitionCommand(args);
} else {
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
    process.exitCode = await monitored("eval", args, () => runEvalCommand(args));
  } else if (command === "rebaseline") {
    process.exitCode = await monitored("rebaseline", args, () => runRebaselineCommand(args));
  } else if (command === "canonical") {
    await monitored("canonical", args, () => runCanonicalConfirmation(benchmarkArgs("canonical", args)));
  } else if (command === "baseline") {
    await monitored("baseline", args, () => runBaselineBenchmark(benchmarkArgs("canonical", args)));
  } else {
    throw new Error(`unknown benchmark command ${command}`);
  }
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
): "probe" | "eval" | "canonical" | "baseline" | "rebaseline" | "transition" | "decide" | "migrate" | "prepare" | "explain" | "help" {
  if (args.includes("full") || args.includes("--full")) {
    throw new Error(`the full profile was retired; use the canonical command`);
  }
  if (args.includes("help") || args.includes("--help") || args.includes("-h")) return "help";
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
  console.log(`Benchmark V2\n\n` +
    `  npm run benchmark -- eval        Stage 0: informational screen of the current tree vs the baseline (probe is a deprecated alias)\n` +
    `  npm run benchmark -- eval --to-verdict [--mode=improve|simplify --margin=POINTS] [--depth=N] [--acknowledge-retry] [--resume] [--json]\n` +
    `                                   Declared, certified confirmation: fresh paired epoch, futility looks, verdict\n` +
    `  npm run benchmark -- rebaseline --label=LABEL   After an accepted eval attempt: light rebaseline (era record + fresh probe reference)\n` +
    `  npm run benchmark -- transition --reason=...    Ledger an operator transition (no budget reset)\n` +
    `  npm run benchmark -- canonical   [legacy] Fresh paired one-shot confirmation (retires after the eval chain is validated)\n` +
    `  npm run benchmark -- baseline    [legacy] Freeze all baseline evidence from a canonical bundle\n` +
    `  npm run benchmark -- decide CANDIDATE [--base=BASE] [--mode=simplification --margin=POINTS]\n` +
    `  npm run benchmark -- migrate --scope=protocol|calibration|inference --alters-decision-behavior=yes|no --reason=... --approve\n` +
    `  npm run benchmark -- prepare     Regenerate and validate catalog evidence\n` +
    `  npm run benchmark -- explain <archive.json>\n\n` +
    `Stage 0 is reusable screening only; --to-verdict is a predeclared certified promotion gate. Qualification is an indicative sidecar.\n` +
    `Eval verdict exit codes: 0 accept, 2 inconclusive, 3 reject, 4 futility stop, 1 invalid; stage 0 emits 0/1. Decide: 0 favorable, 2 unresolved, 3 unfavorable, 1 invalid.\n` +
    `Compiler execution defaults to 48 workers and prints resource samples every five seconds.`);
}
