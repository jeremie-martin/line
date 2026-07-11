import { runBenchmarkV2 } from "./runner.ts";

const args = process.argv.slice(2);
const modeArgument = args.find((arg) => arg.startsWith("--runner-mode="));
const mode = modeArgument?.slice("--runner-mode=".length);
if (mode !== "development" && mode !== "qualification") {
  throw new Error(`--runner-mode must be development or qualification`);
}
await runBenchmarkV2(mode, args.filter((arg) => !arg.startsWith("--runner-mode=")));
