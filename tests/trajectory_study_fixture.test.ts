import { describe, expect, test } from "vitest";
import {
  makePhysicalPrefixFixture,
  makePhysicalPrefixFixtureAtGap,
  replayHandoffPrefix,
} from "../scripts/v0/trajectory/study_fixture.ts";
import type { HandoffNode } from "../scripts/v0/optimizer/handoff.ts";

describe("physical-prefix projection", () => {
  test("cuts an earlier immutable prefix from a selected deeper path", () => {
    const first = { lines: [line(1)], cost: 1.25 };
    const later = { lines: [line(2), line(3)], cost: 3.5 };
    const node = {
      search: {
        gapIndex: 3,
        prefixFits: [first, null, later],
        prefixNextLineId: 5,
        cumulativeCost: 4.75,
      },
      startState: { position: { x: 0, y: 0 }, velocity: { x: 1, y: 0 } },
      startLines: [line(0)],
      searchSeed: 123,
    } as unknown as HandoffNode;

    const projected = makePhysicalPrefixFixtureAtGap(node, 2);
    expect(projected).toMatchObject({
      gapIndex: 2,
      prefixNextLineId: 3,
      cumulativeCost: 1.25,
      searchSeed: 123,
      prefixFitLines: [[expect.objectContaining({ id: 1 })], null],
    });
    expect(makePhysicalPrefixFixture(node).prefixFitLines).toHaveLength(3);

    first.lines[0]!.x1 = 99;
    expect(projected.prefixFitLines[0]![0]!.x1).toBe(1);
    expect(() => makePhysicalPrefixFixtureAtGap(node, 4)).toThrow(/cannot project physical prefix/);
  });

  test("replays a target ancestor without consulting a donor's final engine", () => {
    const node = {
      search: {
        gapIndex: 2,
        prefixFits: [{ lines: [line(1)], cost: 1 }, { lines: [line(2)], cost: 2 }],
        // A tail donor's final engine is intentionally irrelevant to its projected prefix.
        prefixEngine: null,
        prefixNextLineId: 4,
        cumulativeCost: 3,
      },
      startState: { position: { x: 0, y: 0 }, velocity: { x: 1, y: 0 } },
      startLines: [line(0)],
      searchSeed: 123,
    } as unknown as HandoffNode;

    const projected = replayHandoffPrefix(node, 1);
    expect(projected).toMatchObject({ gapIndex: 1, prefixNextLineId: 3, cumulativeCost: 1 });
    expect(() => replayHandoffPrefix({
      ...node,
      search: { ...node.search, prefixNextLineId: 99 },
    } as HandoffNode, 1)).toThrow(/root-plus-extend accounting/);
  });
});

function line(id: number) {
  return {
    id,
    type: 0,
    x1: id,
    y1: 0,
    x2: id + 1,
    y2: 1,
    flipped: false,
    leftExtended: false,
    rightExtended: false,
  };
}
