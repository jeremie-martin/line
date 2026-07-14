import { describe, expect, test } from "vitest";
import { parseContinuousSupportCurveCliArguments } from "../scripts/v0/trajectory/continuous_support_curve_cli.ts";

describe("continuous support curve CLI", () => {
  test("accepts exactly one immutable fixture and optional unused output destination", () => {
    expect(parseContinuousSupportCurveCliArguments(["--fixture=fixture.json"])).toEqual({
      fixturePath: "fixture.json",
      explicitOut: undefined,
    });
    expect(parseContinuousSupportCurveCliArguments(["--fixture=fixture.json", "--out=result.json"])).toEqual({
      fixturePath: "fixture.json",
      explicitOut: "result.json",
    });
  });

  test("rejects injected action, phase, and duplicate path controls before replay", () => {
    expect(() => parseContinuousSupportCurveCliArguments([])).toThrow(/fixture/);
    expect(() => parseContinuousSupportCurveCliArguments(["--fixture="])).toThrow(/non-empty/);
    expect(() => parseContinuousSupportCurveCliArguments(["--fixture=a", "--fixture=b"])).toThrow(/exactly once/);
    expect(() => parseContinuousSupportCurveCliArguments(["--fixture=a", "--phase=3"])).toThrow(/unsupported/);
    expect(() => parseContinuousSupportCurveCliArguments(["--fixture=a", "unexpected-positional-input"])).toThrow(/unsupported/);
    expect(() => parseContinuousSupportCurveCliArguments(["--fixture=a", "--out=x", "--out=y"])).toThrow(/out/);
  });
});
