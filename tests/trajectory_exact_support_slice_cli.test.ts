import { describe, expect, test } from "vitest";
import { parseExactSupportSliceCliArguments } from "../scripts/v0/trajectory/exact_support_slice_cli.ts";

describe("exact support slice CLI", () => {
  test("accepts one non-empty fixture and optional output path", () => {
    expect(parseExactSupportSliceCliArguments(["--fixture=input.json"])).toEqual({
      fixturePath: "input.json",
      explicitOut: undefined,
    });
    expect(parseExactSupportSliceCliArguments(["--fixture=input.json", "--out=report.json"])).toEqual({
      fixturePath: "input.json",
      explicitOut: "report.json",
    });
  });

  test("rejects ambiguous, empty, and unsupported controls before replay", () => {
    expect(() => parseExactSupportSliceCliArguments([])).toThrow(/fixture/);
    expect(() => parseExactSupportSliceCliArguments(["--fixture="])).toThrow(/non-empty/);
    expect(() => parseExactSupportSliceCliArguments(["--fixture=a", "--fixture=b"])).toThrow(/only once/);
    expect(() => parseExactSupportSliceCliArguments(["--fixture=a", "--out=x", "--out=y"])).toThrow(/only once/);
    expect(() => parseExactSupportSliceCliArguments(["--fixture=a", "--budget=1"])).toThrow(/unsupported/);
  });
});
