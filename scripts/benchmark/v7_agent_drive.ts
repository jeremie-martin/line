/**
 * V7 agent-operability drill: drive one full eval confirmation using ONLY
 * exit codes and --json output — no human parsing of prose. The driver
 * reacts to actionable refusals (era-budget exhaustion) the way an agent
 * would, and on a favorable verdict executes the artifact's `nextCommand`
 * VERBATIM.
 *
 *   LR_ENGINE=wasm node --import tsx scripts/benchmark/v7_agent_drive.ts \
 *     --mode=simplify --margin=5
 */

import { execFileSync, execSync } from "node:child_process";

function argument(name: string): string | undefined {
  return process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
}

type Invocation = { code: number; stdout: string };

function benchmark(args: string[]): Invocation {
  console.log(`\n$ npm run benchmark -- ${args.join(" ")}`);
  try {
    const stdout = execFileSync(process.execPath, [
      "--import", "tsx", "scripts/benchmark/cli.ts", ...args, "--no-resource-stats",
    ], { encoding: "utf8", env: { ...process.env, LR_ENGINE: "wasm" }, stdio: ["ignore", "pipe", "inherit"] });
    return { code: 0, stdout };
  } catch (error) {
    const failure = error as { status?: number; stdout?: string };
    return { code: failure.status ?? 1, stdout: failure.stdout?.toString() ?? "" };
  }
}

function parseJson(stdout: string): any {
  return JSON.parse(stdout);
}

const mode = argument("mode") ?? "simplify";
const margin = argument("margin");
const modeArgs = mode === "simplify" ? [`--mode=simplify`, `--margin=${margin ?? "5"}`] : [];

// 1. Stage 0: informational; only the exit code gates continuing.
const stage0 = benchmark(["eval", "--json"]);
console.log(`driver: stage0 exit=${stage0.code}`);
if (stage0.code !== 0) process.exit(1);
const screen = parseJson(stage0.stdout);
console.log(`driver: screen delta=${screen.result.delta} identical=${screen.scoreIdenticalFraction}`);

// 2. Confirmation. On era-budget exhaustion (exit 1), react like an agent:
//    raise the cap with a ledgered override and retry once.
let verdict = benchmark(["eval", "--to-verdict", ...modeArgs, "--json"]);
if (verdict.code === 1) {
  const refusal = parseJson(verdict.stdout);
  if (!refusal.error?.message?.includes("era budget")) {
    throw new Error(`driver: confirmation failed: ${refusal.error?.message ?? "unknown invalid outcome"}`);
  }
  console.log(`driver: declare refused; raising the era cap with a ledgered override and retrying once`);
  verdict = benchmark([
    "eval", "--to-verdict", ...modeArgs, "--json",
    "--override-era-budget=0.08",
    "--reason=V7 agent drill: prior validation attempts consumed the era budget",
    "--operator=v7-agent-driver",
  ]);
}
console.log(`driver: verdict exit=${verdict.code}`);

// 3. Per-mode exit-code contract: 0 accept, 2 inconclusive, 3 reject,
//    4 futility stop, 1 invalid.
if (verdict.code === 4) {
  console.log(`driver: futility stop; done (nothing to promote)`);
  process.exit(0);
}
if (verdict.code === 2 || verdict.code === 3) {
  console.log(`driver: unfavorable/unresolved verdict; done (nothing to promote)`);
  process.exit(0);
}
if (verdict.code !== 0) process.exit(1);

// 4. Accept: execute nextCommand verbatim.
const artifact = parseJson(verdict.stdout);
const nextCommand: string = artifact.artifact.nextCommand;
console.log(`driver: ACCEPT; executing nextCommand verbatim: ${nextCommand}`);
execSync(nextCommand, { stdio: "inherit", env: { ...process.env, LR_ENGINE: "wasm" } });
console.log(`driver: nextCommand completed; chain closed`);
