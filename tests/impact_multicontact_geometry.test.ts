import { describe, expect, test } from "vitest";
import {
  compileHandoff,
  setHandoffPoolProbeHook,
  type HandoffPoolProbeRecord,
} from "../scripts/v0/optimizer/handoff.ts";
import { loadGoldenSpec } from "../scripts/v0/golden_suite.ts";

describe("deferred multi-contact geometry observer", () => {
  test("replays candidate-owned target geometry only after compilation", async () => {
    const spec = await loadGoldenSpec("tiny_dance", "base");
    let record: HandoffPoolProbeRecord | null = null;
    setHandoffPoolProbeHook((next) => {
      if (record === null && next.candidates.length > 0) record = next;
    });
    try {
      compileHandoff(spec, 0, { budget: 40_000, maxNodes: 12, polish: false });
    } finally {
      setHandoffPoolProbeHook(null);
    }
    expect(record).not.toBeNull();
    const observation = record!.contactGeometryAtQualityRank(record!.candidates[0]!.qualityRank);
    expect(observation).not.toBeNull();
    expect(observation!.lines.length).toBeGreaterThan(0);
    expect(observation!.lines.every((line) =>
      [line.x1, line.y1, line.x2, line.y2].every(Number.isFinite)
    )).toBe(true);
  }, 120_000);
});
