import { mkdirSync, rmSync, mkdtempSync } from "node:fs";
import { basename, resolve } from "node:path";
import { describe, expect, test } from "vitest";
import {
  parseSeedList,
  runNameInUse,
  uniqueRunName,
} from "../scripts/serve.ts";

describe("spec dashboard calibration helpers", () => {
  test("rejects empty seed entries before numeric coercion", () => {
    expect(() => parseSeedList("4,5,")).toThrow(/comma-separated/);
    expect(() => parseSeedList("4,,5")).toThrow(/comma-separated/);
  });

  test("dedupes and sorts valid seed lists", () => {
    expect(parseSeedList("9,4,9")).toEqual([4, 9]);
  });

  test("calibration archive directories reserve run names", () => {
    const root = resolve("generated", "spec-calibration");
    mkdirSync(root, { recursive: true });
    const archiveDir = mkdtempSync(resolve(root, "unit-calibration-"));
    const name = basename(archiveDir);
    try {
      expect(runNameInUse(name)).toBe(true);
      expect(uniqueRunName(name)).toBe(`${name}_2`);
    } finally {
      rmSync(archiveDir, { recursive: true, force: true });
    }
  });
});
