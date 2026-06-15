/**
 * Axis target curves — `f: (tSeconds) => number | undefined`.
 *
 * This is the authoring substrate that replaces the old piecewise-constant
 * `Section[]`. Each axis target is a function of absolute track time (seconds).
 * A `constant()` reproduces a single section; `keyframes(..., "hold")`
 * reproduces stacked step-function sections exactly (see the `hold` ease).
 *
 * `undefined` means "no pressure on this axis at this time" — the generalization
 * of "this axis is unset here", so an axis can be targeted over part of the
 * track and left free elsewhere.
 *
 * BANDWIDTH CAVEAT: downstream, a curve is effectively sampled once per gap
 * (the compiler fits one target per contact-to-contact span, ≥~0.4 s). Curve
 * variation finer than the contact spacing is averaged away inside the gap and
 * cannot be expressed in the rider's motion. This is the same resolution the
 * old sections had (a sub-gap section was already averaged), not a regression —
 * but author ramps/keyframes at gap granularity, not finer.
 */

import { AXES, type AxisCurves, type Curve, type AxisValues, type CurveMeta } from "../types.ts";

/**
 * Easing for a keyframe segment. A point's ease governs the segment FROM that
 * point to the next:
 *   - `hold`    — value stays at the left point until the next point (step).
 *   - `linear`  — straight interpolation.
 *   - `smooth`  — smoothstep (ease in and out).
 *   - `easeIn`  — slow start (quadratic).
 *   - `easeOut` — slow end (quadratic).
 */
export type Ease = "hold" | "linear" | "smooth" | "easeIn" | "easeOut";

/** Normalized easing functions on u ∈ [0, 1] → [0, 1]. `hold` handled separately. */
const EASE_FN: Record<Exclude<Ease, "hold">, (u: number) => number> = {
  linear: (u) => u,
  smooth: (u) => u * u * (3 - 2 * u),
  easeIn: (u) => u * u,
  easeOut: (u) => u * (2 - u),
};

/** Constant curve — the value `v` at every time. Reproduces a single section. */
export function constant(v: number): Curve {
  return withCurveMeta(() => v, {
    kind: "constant",
    points: [{ t: 0, v }],
  });
}

/**
 * Eased ramp from `v0` at `t0` to `v1` at `t1`. Clamps outside [t0, t1]
 * (before t0 → v0, after t1 → v1). A two-point `keyframes`.
 */
export function ramp(t0: number, v0: number, t1: number, v1: number, ease: Ease = "linear"): Curve {
  return withCurveMeta(keyframes([{ t: t0, v: v0, ease }, { t: t1, v: v1 }]), {
    kind: "ramp",
    defaultEase: ease,
    points: [{ t: t0, v: v0, ease }, { t: t1, v: v1 }],
  });
}

/** A keyframe point: value `v` at time `t`, with the ease toward the next point. */
export type Keyframe = { t: number; v: number; ease?: Ease };

/**
 * Piecewise curve through `points`. The ease on `points[i]` governs the segment
 * `[points[i], points[i+1]]`. Outside the range the curve clamps to the first
 * (before the first t) or last (after the last t) value.
 *
 * `hold` ease ⇒ the value steps at each keyframe ⇒ exactly reproduces the old
 * step-function sections.
 *
 * Points need not be pre-sorted; they are sorted by `t` on construction.
 */
export function keyframes(points: Keyframe[], defaultEase: Ease = "linear"): Curve {
  if (points.length === 0) {
    throw new Error("keyframes() requires at least one point");
  }
  const pts = [...points].sort((a, b) => a.t - b.t);
  const first = pts[0];
  const last = pts[pts.length - 1];
  return withCurveMeta((t: number) => {
    if (t <= first.t) return first.v;
    if (t >= last.t) return last.v;
    // Find segment [a, b] with a.t <= t < b.t. Linear scan: keyframe lists are short.
    let i = 0;
    while (i < pts.length - 1 && t >= pts[i + 1].t) i++;
    const a = pts[i];
    const b = pts[i + 1];
    const ease = a.ease ?? defaultEase;
    if (ease === "hold") return a.v;
    const u = (t - a.t) / (b.t - a.t);
    return a.v + (b.v - a.v) * EASE_FN[ease](u);
  }, {
    kind: "keyframes",
    defaultEase,
    points: pts.map((p) => ({ ...p })),
  });
}

function withCurveMeta(fn: (t: number) => number | undefined, meta: CurveMeta): Curve {
  const curve = fn as Curve;
  Object.defineProperty(curve, "meta", {
    value: meta,
    enumerable: false,
    configurable: true,
    writable: false,
  });
  return curve;
}
