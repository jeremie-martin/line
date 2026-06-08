#!/usr/bin/env python3
"""
Track-shape / "interestingness" analysis — a qualitative companion to the numeric
contract score (scripts/v0/score.ts).

The contract score only asks "did the rider hit the beats and roughly match the
axes". It has NO term for "is the ride actually varied and fun to watch", so a
track can score ~720 and still be a flat, monotonous glide. This tool surfaces
that gap from the rider's own trajectory.

It is intentionally DESCRIPTIVE, not a single optimisation target: the goal is a
COOL, music-synced track, not a maximally bumpy one. So it reports a profile
(pops, sag, airborne/slide runs, speed variety, vertical relief) and only raises
soft FLAGS for the failure mode we actually see (everything flat / identical),
leaving the aesthetic judgement to the reader.

Input: shakedown/<name>/detection.json — written by scripts/inspect.ts (the
trajectory extraction runs even with --no-render, so the fast loop is:
  run.ts  →  inspect.ts --no-render  →  analyze_track_shape.py).

Usage:
  python scripts/analyze_track_shape.py NAME [NAME2 ...]
      [--root shakedown] [--plot PATH] [--no-plot] [--json PATH] [--fps 40]

Needs numpy (+ matplotlib only when plotting). Run via the mm310 venv:
  /tmp/mm310/bin/python scripts/analyze_track_shape.py shelter_curves
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from typing import Any

import numpy as np

# Thresholds for the soft flatness flags (px, in engine units). These describe
# the "boring glide" failure mode; they are deliberately loose — a flag is a
# prompt to look, not a verdict.
POP_FLAT_PX = 6.0       # median upward pop below this ⇒ "no real jumps"
RELIEF_FLAT_PX = 200.0  # detrended vertical band below this ⇒ "visually flat"


def _runs(mask: np.ndarray) -> list[tuple[int, int]]:
    """Inclusive [start, end] index runs where mask is True."""
    out: list[tuple[int, int]] = []
    i, n = 0, len(mask)
    while i < n:
        if mask[i]:
            j = i
            while j < n and mask[j]:
                j += 1
            out.append((i, j - 1))
            i = j
        else:
            i += 1
    return out


def compute_metrics(det: dict[str, Any], fps: int = 40) -> dict[str, Any]:
    """Trajectory-shape metrics for one detection.json. Pure / importable."""
    m = det.get("measurements", {})
    pos = m.get("position") or []
    if len(pos) < 3:
        raise ValueError("trajectory too short / missing 'measurements.position'")
    x = np.array([p["x"] for p in pos], dtype=float)
    y = np.array([p["y"] for p in pos], dtype=float)  # engine units; sign-agnostic below
    air = np.array(m.get("airborne", [False] * len(pos)), dtype=bool)
    spd = np.array(m.get("speed", [0.0] * len(pos)), dtype=float)
    F = len(x)

    # Per-airborne-arc pop: peak height ABOVE the takeoff→landing chord. A real
    # visible "jump" launches the rider above the straight line between contacts;
    # pure ballistic sag stays at/below it (≈0). Sign convention from net drift:
    # whichever y-direction the ride trends is "down", so "up" = -trend.
    trend = np.polyfit(np.arange(F), y, 1)[0]
    up = -np.sign(trend) if trend != 0 else 1.0  # +1 means larger y is "up"
    yu = y * up  # yu increases upward

    pops, sags, air_lens = [], [], []
    air_paths, air_chords, air_vertical_spans = [], [], []
    for a0, b0 in _runs(air):
        a = max(0, a0 - 1)
        b = min(F - 1, b0 + 1)
        seg = np.arange(a, b + 1)
        air_lens.append((b0 - a0 + 1))
        if len(seg) >= 2:
            dx = np.diff(x[seg])
            dy = np.diff(y[seg])
            path_len = float(np.hypot(dx, dy).sum())
            chord_len = float(np.hypot(x[b] - x[a], y[b] - y[a]))
            air_paths.append(path_len)
            air_chords.append(chord_len)
            air_vertical_spans.append(float(y[seg].max() - y[seg].min()))
        if len(seg) >= 3:
            chord = np.linspace(yu[a], yu[b], len(seg))
            dev = yu[seg] - chord
            pops.append(float(dev.max()))    # most above the chord (a pop)
            sags.append(float(-dev.min()))   # most below the chord (a dip)
    pops = np.array(pops) if pops else np.array([0.0])
    sags = np.array(sags) if sags else np.array([0.0])
    air_lens = np.array(air_lens) if air_lens else np.array([0])
    air_paths = np.array(air_paths) if air_paths else np.array([0.0])
    air_chords = np.array(air_chords) if air_chords else np.array([0.0])
    air_vertical_spans = np.array(air_vertical_spans) if air_vertical_spans else np.array([0.0])
    chord_ratio = air_paths / np.maximum(1e-6, air_chords)

    slide_lens = np.array([e - s + 1 for s, e in _runs(~air)]) if F else np.array([0])

    # Detrended vertical relief: residual band after removing the overall glide.
    t = np.arange(F)
    resid = yu - np.polyval(np.polyfit(t, yu, 1), t)
    relief = float(resid.max() - resid.min())

    summary = det.get("summary", {})
    return {
        "frames": F,
        "duration_s": round(F / fps, 2),
        "airborne_pct": round(float(air.mean()) * 100, 1),
        "x_span_px": round(float(x.max() - x.min())),
        "net_dy_px": round(float(y[-1] - y[0])),
        # pops = the missing ingredient when a track is flat
        "pop_px_mean": round(float(pops.mean()), 1),
        "pop_px_median": round(float(np.median(pops)), 1),
        "pop_px_p75": round(float(np.percentile(pops, 75)), 1),
        "pop_px_p90": round(float(np.percentile(pops, 90)), 1),
        "pop_px_max": round(float(pops.max()), 1),
        "pops_gt25": int((pops > 25).sum()),
        "big_pops_gt40": int((pops > 40).sum()),
        "n_airborne_arcs": int(len(pops)),
        "sag_px_median": round(float(np.median(sags)), 1),
        "air_arc_frames_median": round(float(np.median(air_lens)), 1),
        "air_arc_frames_p90": round(float(np.percentile(air_lens, 90)), 1),
        "air_arc_path_px_median": round(float(np.median(air_paths)), 1),
        "air_arc_path_px_p90": round(float(np.percentile(air_paths, 90)), 1),
        "air_arc_path_px_max": round(float(air_paths.max()), 1),
        "air_arc_chord_px_median": round(float(np.median(air_chords)), 1),
        "air_arc_chord_px_p90": round(float(np.percentile(air_chords, 90)), 1),
        "air_arc_path_chord_ratio_p90": round(float(np.percentile(chord_ratio, 90)), 3),
        "air_arc_vertical_span_px_median": round(float(np.median(air_vertical_spans)), 1),
        "air_arc_vertical_span_px_p90": round(float(np.percentile(air_vertical_spans, 90)), 1),
        "air_arc_vertical_span_px_max": round(float(air_vertical_spans.max()), 1),
        "vertical_relief_px": round(relief, 1),
        "airborne_run_max_frames": int(air_lens.max()),
        "slide_run_max_frames": int(slide_lens.max()) if len(slide_lens) else 0,
        "slide_run_mean_frames": round(float(slide_lens.mean()), 1) if len(slide_lens) else 0.0,
        "speed_mean": round(float(spd.mean()), 2),
        "speed_std": round(float(spd.std()), 2),
        "speed_range_over_mean": round(float((spd.max() - spd.min()) / max(1e-6, spd.mean())), 2),
        "longest_airborne_run_frames": summary.get("longestAirborneRun"),
        "_arrays": {"x": x, "yu": yu, "air": air},  # for plotting; not serialised
    }


def flags(mx: dict[str, Any]) -> list[str]:
    out = []
    if mx["pop_px_median"] < POP_FLAT_PX:
        out.append(f"NO REAL JUMPS (median pop {mx['pop_px_median']}px < {POP_FLAT_PX})")
    if mx["vertical_relief_px"] < RELIEF_FLAT_PX:
        out.append(f"VISUALLY FLAT (relief {mx['vertical_relief_px']}px < {RELIEF_FLAT_PX})")
    if mx["big_pops_gt40"] == 0:
        out.append("no big airs (>40px)")
    return out


def report(name: str, mx: dict[str, Any]) -> None:
    print(f"=== {name}  ({mx['duration_s']}s, {mx['frames']}f) ===")
    print(f"  airborne {mx['airborne_pct']}%   x-span {mx['x_span_px']}px   net Δy {mx['net_dy_px']}px")
    print(f"  POP above chord  median {mx['pop_px_median']:5.1f}  p75 {mx['pop_px_p75']:5.1f}  "
          f"p90 {mx['pop_px_p90']:5.1f}  max {mx['pop_px_max']:5.1f}   "
          f"pops(>25px) {mx['pops_gt25']}  big airs(>40px) {mx['big_pops_gt40']}  / {mx['n_airborne_arcs']} arcs")
    print(f"  air arcs  frames median {mx['air_arc_frames_median']:4.1f}  p90 {mx['air_arc_frames_p90']:4.1f}  "
          f"path p90 {mx['air_arc_path_px_p90']:6.1f}px  max {mx['air_arc_path_px_max']:6.1f}px  "
          f"vertical span p90 {mx['air_arc_vertical_span_px_p90']:5.1f}px  max {mx['air_arc_vertical_span_px_max']:5.1f}px")
    print(f"  vertical relief (detrended)  {mx['vertical_relief_px']:6.1f}px      sag median {mx['sag_px_median']}px")
    print(f"  runs: longest air {mx['airborne_run_max_frames']}f  longest slide {mx['slide_run_max_frames']}f  "
          f"mean slide {mx['slide_run_mean_frames']}f")
    print(f"  speed  mean {mx['speed_mean']}  std {mx['speed_std']}  range/mean {mx['speed_range_over_mean']}")
    fl = flags(mx)
    print(f"  FLAGS: {'  ·  '.join(fl) if fl else 'none — has relief and/or pops'}")


def plot(results: list[tuple[str, dict[str, Any]]], path: str) -> None:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    n = len(results)
    fig, axes = plt.subplots(n, 1, figsize=(16, 4.0 * n), squeeze=False)
    for r, (name, mx) in enumerate(results):
        arr = mx["_arrays"]
        ax = axes[r][0]
        ax.plot(arr["x"], arr["yu"], color="#3a6", lw=0.8, alpha=0.5, zorder=1)
        ax.scatter(arr["x"][arr["air"]], arr["yu"][arr["air"]], s=3, color="#e84", zorder=2, label="airborne")
        ax.scatter(arr["x"][~arr["air"]], arr["yu"][~arr["air"]], s=2, color="#48c", zorder=2, label="grounded")
        fl = flags(mx)
        ax.set_title(f"{name}   relief {mx['vertical_relief_px']}px · median pop {mx['pop_px_median']}px"
                     + (f"   [{fl[0]}]" if fl else ""), fontsize=10)
        ax.set_aspect("equal")
        ax.legend(loc="upper left", fontsize=8)
        ax.grid(alpha=0.15)
    plt.tight_layout()
    plt.savefig(path, dpi=90, bbox_inches="tight")
    print(f"\nwrote {path}")


def main() -> int:
    ap = argparse.ArgumentParser(description="Track-shape / interestingness analysis")
    ap.add_argument("names", nargs="*", default=["shelter_curves", "believer_curves"],
                    help="run name(s) under <root>/<name>/detection.json")
    ap.add_argument("--root", default="shakedown")
    ap.add_argument("--plot", default="shakedown/track_shape_analysis.png", help="output PNG path")
    ap.add_argument("--no-plot", action="store_true")
    ap.add_argument("--json", default=None, help="also write metrics as JSON to this path")
    ap.add_argument("--fps", type=int, default=40)
    args = ap.parse_args()

    results: list[tuple[str, dict[str, Any]]] = []
    for name in args.names:
        det_path = os.path.join(args.root, name, "detection.json")
        if not os.path.exists(det_path):
            print(f"!! skip {name}: {det_path} not found", file=sys.stderr)
            continue
        try:
            mx = compute_metrics(json.load(open(det_path)), fps=args.fps)
        except Exception as e:  # noqa: BLE001 — observe-and-record, don't crash the sweep
            print(f"!! skip {name}: {e}", file=sys.stderr)
            continue
        report(name, mx)
        results.append((name, mx))

    if not results:
        print("no analysable tracks", file=sys.stderr)
        return 1

    if args.json:
        serial = {n: {k: v for k, v in mx.items() if k != "_arrays"} for n, mx in results}
        json.dump(serial, open(args.json, "w"), indent=2)
        print(f"wrote {args.json}")
    if not args.no_plot:
        plot(results, args.plot)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
