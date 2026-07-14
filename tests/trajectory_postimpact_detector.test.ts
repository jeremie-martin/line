import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import {
  detect,
  extractRawTrajectoryWindow,
  type RawFrame,
} from "../scripts/lib/detector.ts";
import { detectPostimpactWindow } from "../scripts/v0/trajectory/postimpact_detector.ts";

describe("post-impact detector leaf", () => {
  test("matches the canonical raw extractor and detector over an absolute-frame window", () => {
    const actualEngine = makeReplayableEngine();
    const actual = detectPostimpactWindow(actualEngine, 3, 12);

    expect(actualEngine.framesRead).toEqual([3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(actualEngine.candidateWindowReads).toBe(0);
    expect(actual.frameOffset).toBe(3);
    expect(actual.events).toEqual([{ type: "landing", frame: 9, airborneFrom: 3 }]);
    expect(actual.terminus).toEqual({ frame: 12, reason: "endOfSpec" });
    expect(actual.measurements.position).toHaveLength(10);
    expect(actual.measurements.sledContacts[6]).toEqual(["TAIL"]);

    const expectedEngine = makeReplayableEngine();
    const expected = detect(extractRawTrajectoryWindow(expectedEngine, 3, 12));
    const { frameOffset: _frameOffset, ...actualDetection } = actual;
    expect(actualDetection).toEqual(expected);
  });

  test("clamps a negative start exactly once and preserves detector behavior", () => {
    const engine = makeReplayableEngine();
    const result = detectPostimpactWindow(engine, -4, 4);

    expect(result.frameOffset).toBe(0);
    expect(engine.framesRead).toEqual([0, 1, 2, 3, 4]);
    expect(result.terminus).toEqual({ frame: 4, reason: "endOfSpec" });
    expect(result.measurements.position[0]).toEqual({ x: 0, y: 100 });
  });

  test("has a detector-only static import boundary", () => {
    const source = readFileSync(
      new URL("../scripts/v0/trajectory/postimpact_detector.ts", import.meta.url),
      "utf8",
    );
    const imports = [...source.matchAll(/from\s+["']([^"']+)["']/g)].map((match) => match[1]);

    expect(imports).toEqual(["../../lib/detector.ts"]);
    expect(source).not.toMatch(/(?:core\/candidate|optimizer\/|benchmark\/|panel\/|study_)/);
  });
});

type ReplayableEngine = {
  framesRead: number[];
  candidateWindowReads: number;
  getRawFrameAtFrame(frame: number): RawFrame;
  getCandidateWindow(): never;
};

function makeReplayableEngine(): ReplayableEngine {
  return {
    framesRead: [],
    candidateWindowReads: 0,
    getRawFrameAtFrame(frame: number): RawFrame {
      this.framesRead.push(frame);
      const grounded = frame >= 9;
      return {
        frame,
        position: { x: frame, y: 100 },
        velocity: { x: 1, y: 0 },
        sledContacts: grounded ? ["TAIL"] : [],
        contactLineIds: grounded ? [17] : [],
        sledBroken: false,
        riderEjected: false,
      };
    },
    getCandidateWindow(): never {
      this.candidateWindowReads++;
      throw new Error("post-impact detector must not use a candidate-window fast path");
    },
  };
}
