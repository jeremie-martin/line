import { execFileSync } from "node:child_process";
import { describe, expect, test } from "vitest";

describe("sync_catalog --check", () => {
  test("committed compatibility files match a regeneration from the typed catalog", () => {
    const stdout = execFileSync(
      process.execPath,
      ["--import", "tsx", "scripts/benchmark/sync_catalog.ts", "--check"],
      { encoding: "utf8" },
    );
    expect(stdout).toContain("catalog check: 4 generated files match");
  });
});
