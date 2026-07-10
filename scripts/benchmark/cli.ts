import { execFileSync } from "node:child_process";
import { availableParallelism } from "node:os";
import { prepareBenchmarkV2, benchmarkV2Paths } from "./prepare.ts";
import { runCanonicalBenchmark } from "../v0/benchmark_v2/canonical.ts";
import { runBenchmarkV2 } from "../v0/benchmark_v2/runner.ts";
import { startResourceMonitor } from "./resource_monitor.ts";

const COMMAND_ALIASES = new Set([
  "probe", "canonical", "prepare", "explain", "help", "--probe", "--help", "-h",
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
} else {
  const prepared = await prepareBenchmarkV2();
  console.log(
    `Prepared ${prepared.developmentCases} development + ${prepared.qualificationCases} qualification cases; ` +
    `audit ${prepared.auditFingerprint.slice(0, 16)}`,
  );
  if (command === "prepare") {
    // Preparation above is the complete command.
  } else if (command === "probe") {
    await monitored("probe", args, () => runBenchmarkV2("development", benchmarkArgs("probe", args)));
  } else if (command === "canonical") {
    await monitored("canonical", args, () => runCanonicalBenchmark(benchmarkArgs("canonical", args)));
  } else {
    throw new Error(`unknown benchmark command ${command}`);
  }
}

function benchmarkArgs(profile: "probe" | "canonical", args: string[]): string[] {
  const reserved = ["manifest", "heldout-manifest", "suite", "characterization", "audit", "review", "profile"];
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

function commandName(args: string[]): "probe" | "canonical" | "prepare" | "explain" | "help" {
  if (args.includes("full") || args.includes("--full")) {
    throw new Error(`the full profile was retired; use the canonical command`);
  }
  if (args.includes("help") || args.includes("--help") || args.includes("-h")) return "help";
  if (args.includes("canonical")) return "canonical";
  if (args.includes("prepare")) return "prepare";
  if (args.includes("explain")) return "explain";
  const unknown = args.find((arg) => !arg.startsWith("--"));
  if (unknown !== undefined && unknown !== "probe") throw new Error(`unknown benchmark command ${unknown}`);
  return "probe";
}

function printHelp(): void {
  console.log(`Benchmark V2\n\n` +
    `  npm run benchmark -- probe       Development headline, probe allocation\n` +
    `  npm run benchmark -- canonical   Development canonical run plus linked qualification monitor\n` +
    `  npm run benchmark -- prepare     Regenerate and validate catalog evidence\n` +
    `  npm run benchmark -- explain <archive.json>\n\n` +
    `The same development catalog is used by probe and canonical. Qualification runs only as a canonical sidecar.\n` +
    `Compiler execution defaults to 48 workers and prints resource samples every five seconds.`);
}
