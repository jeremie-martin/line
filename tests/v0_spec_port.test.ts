/**
 * Tier 1 (spec port) — every golden spec that was ported from the old `sections`
 * form must resolve to byte-identical per-frame axis targets as that original
 * section form. The fixture `tests/fixtures/golden_axis_resolution.json` was
 * captured from the pre-port section specs, so it defines exactly which specs
 * this check covers. Curve-native specs added later (never sections) have no
 * fixture entry and are intentionally out of scope here.
 *
 * This proves the idiomatic `keyframes(..., "hold")` / `constant()` rewrites
 * build the same step functions the sections did — independent of the compiler.
 * The compiler now ignores authored `grain`, so fixture expectations are
 * compared after dropping that axis.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { loadGoldenSpec, type GoldenSpecName } from "../scripts/v0/golden_suite.ts";
import { axesAtFrame } from "../scripts/v0/core/substrate.ts";
import { secToFrame } from "../scripts/v0/types.ts";

const fixture = JSON.parse(
  readFileSync(resolve("tests/fixtures/golden_axis_resolution.json"), "utf8"),
) as Record<string, Record<string, Record<string, number>>>;

function withoutIgnoredAxes(axes: Record<string, number>): Record<string, number> {
  const { grain: _grain, ...activeAxes } = axes;
  return activeAxes;
}

describe("Tier 1: ported curve specs reproduce section resolution", () => {
  for (const name of Object.keys(fixture)) {
    test(`${name}: per-frame axes identical to captured section fixture`, async () => {
      const spec = await loadGoldenSpec(name as GoldenSpecName, "base");
      expect(spec.axes, `${name} should be ported to axes`).toBeDefined();

      const expected = fixture[name];
      const durationFrames = secToFrame(spec.duration);
      for (let f = 0; f <= durationFrames; f++) {
        expect(axesAtFrame(f, spec), `${name} frame ${f}`).toEqual(withoutIgnoredAxes(expected[String(f)]));
      }
    });
  }
});
