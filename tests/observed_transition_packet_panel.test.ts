import { describe, expect, test } from "vitest";
import {
  buildObservedTransitionPacketSetup,
  OBSERVED_TRANSITION_PACKET_CASE_IDS,
  OBSERVED_TRANSITION_PACKET_CASES,
} from "../scripts/v0/trajectory/observed_transition_packet_panel.ts";

describe("observed transition packet panel", () => {
  test("freezes a cross-regime authored roster", () => {
    expect(OBSERVED_TRANSITION_PACKET_CASE_IDS).toEqual([
      "ordinary", "dense", "dense240", "pickup", "pickup_shifted",
      "frontier3", "frontier4", "frontier5", "frontier6", "frontier7",
    ]);
    expect(new Set(OBSERVED_TRANSITION_PACKET_CASES.map((panel) => panel.category)))
      .toEqual(new Set(["ordinary", "dense", "pickup", "low_air"]));
  });

  test("materializes every declared target as a contiguous contact transition", () => {
    for (const panel of OBSERVED_TRANSITION_PACKET_CASES) {
      const setup = buildObservedTransitionPacketSetup(panel);
      const current = setup.gaps[panel.targetGap];
      const outgoing = setup.gaps[panel.targetGap + 1];
      expect(current?.endsWithContact).toBe(true);
      expect(outgoing?.endsWithContact).toBe(true);
      expect(outgoing?.startFrame).toBe(current?.endFrame);
      if (panel.expectedOutgoingFrames !== undefined) {
        expect(outgoing!.endFrame - outgoing!.startFrame).toBe(panel.expectedOutgoingFrames);
      }
    }
  });
});
