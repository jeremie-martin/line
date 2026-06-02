import { describe, expect, test } from "vitest";
import { arcToLines } from "../scripts/v0/arc.ts";
import {
  resetArcPlacementStats,
  sampleImpactAnchoredArc,
  snapshotArcPlacementStats,
} from "../scripts/v0/arc_placement.ts";
import type { TrackLine } from "../scripts/v0/types.ts";

function rngFrom(values: number[]): () => number {
  let index = 0;
  return () => values[index++] ?? 0.5;
}

function pointSegmentDistance(px: number, py: number, line: TrackLine): number {
  const dx = line.x2 - line.x1;
  const dy = line.y2 - line.y1;
  const len2 = dx * dx + dy * dy;
  if (len2 <= 0) return Math.hypot(px - line.x1, py - line.y1);
  const t = Math.max(0, Math.min(1, ((px - line.x1) * dx + (py - line.y1) * dy) / len2));
  return Math.hypot(px - (line.x1 + dx * t), py - (line.y1 + dy * t));
}

function lineAngleDeg(line: TrackLine): number {
  return (Math.atan2(line.y2 - line.y1, line.x2 - line.x1) * 180) / Math.PI;
}

function axisAngleDistanceDeg(a: number, b: number): number {
  const delta = Math.abs(((((a - b) % 180) + 270) % 180) - 90);
  return delta;
}

describe("impact-anchored arc placement", () => {
  test("biases the impact tangent toward the target-frame velocity axis", () => {
    const previousMode = process.env.LR_ARC_PLACEMENT;
    process.env.LR_ARC_PLACEMENT = "impact_anchor";
    resetArcPlacementStats();
    const target = { sledX: 100, sledY: 50, speed: 12, angleDeg: 35 };
    try {
      const arc = sampleImpactAnchoredArc(
        // impactT=0.5 (center, no jitter), zero tangent offset, zero anchor jitter.
        rngFrom([0.5, 0.5, 0.5, 0.5]),
        target,
        {},
        100,
        -75,
        65,
        10,
        0,
        true, // tangentBias: rotate the arc so the impact tangent == target.angleDeg
      );
      const lines = arcToLines(arc, 1);
      const nearest = lines.reduce((best, line) => {
        const distance = pointSegmentDistance(target.sledX, target.sledY, line);
        const bestDistance = pointSegmentDistance(target.sledX, target.sledY, best);
        return distance < bestDistance ? line : best;
      });

      expect(pointSegmentDistance(target.sledX, target.sledY, nearest)).toBeLessThan(1e-9);
      expect(axisAngleDistanceDeg(lineAngleDeg(nearest), target.angleDeg)).toBeLessThan(1e-9);
      expect(snapshotArcPlacementStats()?.tangent_biased).toBe(1);
    } finally {
      if (previousMode === undefined) {
        delete process.env.LR_ARC_PLACEMENT;
      } else {
        process.env.LR_ARC_PLACEMENT = previousMode;
      }
    }
  });
});
