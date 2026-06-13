import { describe, expect, test } from "vitest";
import { defaultJobsForParallelism, parseArgValue } from "../scripts/v0/golden.ts";

describe("golden runner flag parsing", () => {
  test("reads the attached --name=value form", () => {
    expect(parseArgValue(["--jobs=32"], "jobs")).toBe("32");
    expect(parseArgValue(["--specs=tiny_dance", "--jobs=8"], "specs")).toBe("tiny_dance");
  });

  test("reads the space-separated --name value form", () => {
    expect(parseArgValue(["--jobs", "32"], "jobs")).toBe("32");
    expect(parseArgValue(["--specs", "tiny_dance", "--jobs", "8"], "jobs")).toBe("8");
  });

  test("attached form wins and both forms agree on the canonical command", () => {
    const argv = ["--specs=tiny_dance", "--seed=0", "--budgets=50000", "--jobs", "8", "--json"];
    expect(parseArgValue(argv, "jobs")).toBe("8");
    expect(parseArgValue(argv, "seed")).toBe("0");
  });

  test("a bare flag does not swallow a following --flag as its value", () => {
    // `--variants` is boolean; the next token is another flag, not its value.
    expect(parseArgValue(["--variants", "--jobs=8"], "variants")).toBeNull();
    expect(parseArgValue(["--variants", "--jobs", "8"], "jobs")).toBe("8");
  });

  test("missing flag returns null", () => {
    expect(parseArgValue(["--json"], "jobs")).toBeNull();
    expect(parseArgValue([], "jobs")).toBeNull();
  });

  test("space form at the end of argv with no value returns null", () => {
    expect(parseArgValue(["--json", "--jobs"], "jobs")).toBeNull();
  });

  test("default job count uses half the available processors", () => {
    expect(defaultJobsForParallelism(1)).toBe(1);
    expect(defaultJobsForParallelism(2)).toBe(1);
    expect(defaultJobsForParallelism(3)).toBe(1);
    expect(defaultJobsForParallelism(4)).toBe(2);
    expect(defaultJobsForParallelism(32)).toBe(16);
  });
});
