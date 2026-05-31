/**
 * Higher-level proof that the curve paradigm produces the intended MOTION, not
 * just the intended targets. A `ramp` speed buildup must yield a per-gap
 * achieved-speed series that actually trends upward across the track — i.e. the
 * compiler, asked for a continuous build, delivers one. This is the end-to-end
 * payoff of the sections→curves refactor: a buildup authored as one curve,
 * something the old constant sections could only fake with many blocks.
 */
import { describe, expect, test } from "vitest";
import { compileHandoff } from "../scripts/v0/optimizer/handoff.ts";
import { ramp, constant } from "../scripts/v0/core/curves.ts";
import type { Contact, Spec } from "../scripts/v0/types.ts";

/** Least-squares slope of y over its index (sign tells trend direction). */
function slope(ys: number[]): number {
  const n = ys.length;
  const xMean = (n - 1) / 2;
  const yMean = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - xMean) * (ys[i] - yMean);
    den += (i - xMean) * (i - xMean);
  }
  return den === 0 ? 0 : num / den;
}

describe("curve paradigm — a ramp produces a rising achieved series", () => {
  test("speed ramp 0.45→0.85 yields an upward per-gap speed trend", () => {
    const contacts: Contact[] = [];
    for (let t = 0.6; t < 16; t += 0.5) contacts.push({ t: Number(t.toFixed(3)) });

    const spec: Spec = {
      duration: 16,
      contacts,
      axes: {
        // The expressive lever under test: one continuous speed build.
        speed: ramp(0, 0.45, 16, 0.85),
        // Hold air flat so speed is the only intentional trend.
        air: constant(0.55),
      },
      preroll: 5,
    };

    const { report } = compileHandoff(spec, 0, { budget: { kind: "work", units: 50_000 } });

    const speeds = report.gaps
      .map((g) => g.axes.speed?.achieved)
      .filter((v): v is number => v !== undefined);

    // Enough gaps measured to read a trend.
    expect(speeds.length).toBeGreaterThanOrEqual(8);

    // The achieved speed must trend upward (positive slope) and end clearly
    // higher than it began — the build is real, not flat. Physics adds noise and
    // a late saturation ceiling, so we assert direction, not exact values.
    expect(slope(speeds)).toBeGreaterThan(0);
    const head = speeds.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
    const tail = speeds.slice(-3).reduce((a, b) => a + b, 0) / 3;
    expect(tail).toBeGreaterThan(head);
  });
});
