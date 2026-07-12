import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  assertCompilerSourcesCommitted,
  compilerDirtyPathsAgainstHead,
} from "../scripts/v0/benchmark_v2/compiler_identity.ts";

describe("Benchmark V2 compiler source cleanliness", () => {
  test("reports only modified and untracked paths inside the compiler boundary", () => {
    const cwd = mkdtempSync(join(tmpdir(), "v2-compiler-clean-"));
    const git = (args: string[]): void => {
      execFileSync("git", ["-C", cwd, ...args], { stdio: "ignore" });
    };
    git(["init"]);
    git(["config", "user.email", "benchmark-v2@example.invalid"]);
    git(["config", "user.name", "Benchmark V2 Test"]);
    writeFileSync(join(cwd, "compiler.ts"), "export const value = 1;\n");
    writeFileSync(join(cwd, "unrelated.ts"), "export const value = 1;\n");
    git(["add", "."]);
    git(["commit", "-m", "initial"]);

    expect(compilerDirtyPathsAgainstHead(["compiler.ts"], cwd)).toEqual([]);
    expect(() => assertCompilerSourcesCommitted(["compiler.ts"], cwd)).not.toThrow();

    writeFileSync(join(cwd, "unrelated.ts"), "export const value = 2;\n");
    expect(compilerDirtyPathsAgainstHead(["compiler.ts"], cwd)).toEqual([]);

    writeFileSync(join(cwd, "compiler.ts"), "export const value = 2;\n");
    writeFileSync(join(cwd, "compiler-extra.ts"), "export const extra = true;\n");
    expect(compilerDirtyPathsAgainstHead(["compiler.ts", "compiler-extra.ts"], cwd)).toEqual([
      "compiler-extra.ts",
      "compiler.ts",
    ]);
    expect(() => assertCompilerSourcesCommitted(["compiler.ts", "compiler-extra.ts"], cwd))
      .toThrow(/compiler-extra\.ts, compiler\.ts/);
  });
});
