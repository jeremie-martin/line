import { spawnSync } from "node:child_process";
import { describe, expect, test } from "vitest";

const TSX = "./node_modules/.bin/tsx";

function runCli(args: string[]) {
  return spawnSync(TSX, args, {
    cwd: process.cwd(),
    encoding: "utf8",
  });
}

function combinedOutput(result: ReturnType<typeof runCli>): string {
  return `${result.stdout}\n${result.stderr}`;
}

describe("v0 CLI compiler validation", () => {
  test("golden rejects inherited Object keys as compiler names", () => {
    const result = runCli(["scripts/v0/golden.ts", "--compiler=toString", "--fast"]);

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(combinedOutput(result)).toContain('--compiler must be "handoff", got toString');
  });

  test("run CLI rejects inherited Object keys as compiler names", () => {
    const result = runCli([
      "scripts/v0/run.ts",
      "--spec=scripts/v0/specs/first.ts",
      "--compiler=constructor",
    ]);

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(combinedOutput(result)).toContain("unknown --compiler=constructor (expected handoff)");
  });
});
