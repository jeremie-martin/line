import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

describe("v0 compiler metering coverage", () => {
  test("routes engine trajectory work through metered wrappers", () => {
    const source = readFileSync("scripts/v0/compile.ts", "utf8");

    expect(source.match(/rawExtractRawTrajectoryWindow\(/g) ?? []).toHaveLength(1);
    expect(source.match(/\.getRider\(/g) ?? []).toHaveLength(1);
  });
});
