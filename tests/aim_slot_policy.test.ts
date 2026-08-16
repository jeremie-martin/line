import { describe, expect, test } from "vitest";
import { orderExploitThenExplore } from
  "../scripts/v0/optimizer/aim_slot_policy.ts";

type Choice = Readonly<{ id: string; exploit: number; explore: number }>;
const exploit = (left: Choice, right: Choice): number =>
  right.exploit - left.exploit;
const explore = (left: Choice, right: Choice): number =>
  right.explore - left.explore;

describe("aim exploit/explore slot ordering", () => {
  const choices: Choice[] = [
    { id: "a", exploit: 4, explore: 1 },
    { id: "b", exploit: 3, explore: 8 },
    { id: "c", exploit: 2, explore: 9 },
    { id: "d", exploit: 1, explore: 7 },
  ];

  test("preserves the complete incumbent order when disabled", () => {
    expect(
      orderExploitThenExplore(choices, exploit, explore, false).map((x) => x.id),
    ).toEqual(["a", "b", "c", "d"]);
  });

  test("keeps the incumbent first choice and reorders only its remainder", () => {
    const ordered = orderExploitThenExplore(choices, exploit, explore, true);
    expect(ordered[0]).toBe(choices[0]);
    expect(ordered.map((x) => x.id)).toEqual(["a", "c", "b", "d"]);
  });

  test("does not manufacture choices for an empty or singleton pool", () => {
    expect(orderExploitThenExplore([], exploit, explore, true)).toEqual([]);
    expect(orderExploitThenExplore([choices[2]], exploit, explore, true))
      .toEqual([choices[2]]);
  });
});
