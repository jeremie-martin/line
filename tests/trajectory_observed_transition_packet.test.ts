import { describe, expect, test } from "vitest";
import {
  bindFinalOutputSnapshot,
  linesForHandoffNode,
  selectedTransitionAvailability,
} from "../scripts/v0/trajectory/observed_transition_packet.ts";
import type { GapFit } from "../scripts/v0/core/substrate.ts";
import type { HandoffNode, HandoffNodeSnapshot } from "../scripts/v0/optimizer/handoff.ts";
import type { TrackLine } from "../scripts/v0/types.ts";

function line(id: number): TrackLine {
  return { id, type: 0, x1: id, y1: 0, x2: id + 1, y2: 1, flipped: false, leftExtended: false, rightExtended: false };
}

function fit(...lines: TrackLine[]): GapFit {
  return { arc: null, geometry: "lines", lines, achieved: {}, cost: 0 };
}

function node(fits: Array<GapFit | null>, options: { skipped?: number; gapIndex?: number } = {}): HandoffNode {
  return { startLines: [line(0)], skippedContacts: options.skipped ?? 0, search: {
    prefixFits: fits, gapIndex: options.gapIndex ?? fits.length,
  } } as HandoffNode;
}

function snapshot(value: HandoffNode): HandoffNodeSnapshot {
  return { node: value, key: {} as HandoffNodeSnapshot["key"], event: {
    phase: "frontier", simFrames: 1, fullDuration: false, outputDurationFrames: 1,
    improved: true, improvementCount: 1, consideredCount: 1,
  } };
}

describe("observed transition final-path binding", () => {
  test("requires the last retained final snapshot to reconstruct emitted lines", () => {
    const winner = snapshot(node([fit(line(1)), fit(line(2))]));
    expect(bindFinalOutputSnapshot(winner, [line(0), line(1), line(2)])).toMatchObject({ status: "bound" });
    expect(bindFinalOutputSnapshot(winner, [line(0), line(2), line(1)])).toMatchObject({
      status: "invalid_output_binding",
    });
  });

  test("uses only the final clean selected path and never borrows an earlier visit", () => {
    const selected = node([fit(line(1)), fit(line(2)), fit(line(3)), fit(line(4))]);
    const available = selectedTransitionAvailability(selected, 1);
    expect(available.status).toBe("available");
    expect(available.groups.ids).toEqual({ prior: [0, 1], current: [2], next: [3], later: [4] });
    expect(linesForHandoffNode(selected)).toEqual(available.groups.all);

    expect(selectedTransitionAvailability(node([fit(line(1)), null, fit(line(3))]), 1)).toMatchObject({
      status: "unavailable", reason: "target_gap_not_reached_on_final_clean_path",
    });
    expect(selectedTransitionAvailability(node([fit(line(1)), fit(line(2))], { gapIndex: 1 }), 1)).toMatchObject({
      status: "unavailable", reason: "target_gap_not_reached_on_final_clean_path",
    });
  });

  test("rejects malformed line identity and target indices", () => {
    expect(() => selectedTransitionAvailability(node([fit(line(1)), fit(line(1))]), 1)).toThrow(/reuses line id/);
    expect(() => selectedTransitionAvailability(node([]), -1)).toThrow(/non-negative safe integer/);
  });
});
