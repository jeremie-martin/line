import { describe, test, expect } from "vitest";
import { pruneBeam } from "../scripts/lib/beam_prune.ts";

type Item = { id: number; cost: number; bucket: string };

const byCost = (a: Item, b: Item) => a.cost - b.cost;
const ofBucket = (item: Item) => item.bucket;

describe("pruneBeam — basics", () => {
  test("empty input → empty output", () => {
    expect(pruneBeam<Item>([], byCost, ofBucket, { beamWidth: 4 })).toEqual([]);
  });

  test("beamWidth=0 → empty output", () => {
    const items = [{ id: 1, cost: 0, bucket: "x" }];
    expect(pruneBeam(items, byCost, ofBucket, { beamWidth: 0 })).toEqual([]);
  });

  test("non-positive beamWidth throws", () => {
    expect(() =>
      pruneBeam([{ id: 1, cost: 0, bucket: "x" }], byCost, ofBucket, { beamWidth: -1 }),
    ).toThrow(/non-negative integer/);
  });

  test("candidates ≤ beamWidth → all returned, sorted ascending", () => {
    const items: Item[] = [
      { id: 1, cost: 3, bucket: "a" },
      { id: 2, cost: 1, bucket: "b" },
      { id: 3, cost: 2, bucket: "c" },
    ];
    const out = pruneBeam(items, byCost, ofBucket, { beamWidth: 8 });
    expect(out.map((i) => i.id)).toEqual([2, 3, 1]);
  });

  test("respects beamWidth when no bucket pressure", () => {
    const items: Item[] = [
      { id: 1, cost: 4, bucket: "a" },
      { id: 2, cost: 1, bucket: "b" },
      { id: 3, cost: 3, bucket: "c" },
      { id: 4, cost: 2, bucket: "d" },
      { id: 5, cost: 5, bucket: "e" },
    ];
    const out = pruneBeam(items, byCost, ofBucket, { beamWidth: 3 });
    expect(out.map((i) => i.id)).toEqual([2, 4, 3]);
  });
});

describe("pruneBeam — diversity bucketing", () => {
  test("caps items per bucket at ⌈beamWidth/2⌉ by default", () => {
    // 10 items all in bucket "x", beamWidth=4 → maxPerBucket=2.
    // The 2 best-by-cost from bucket "x" get in; remaining 2 slots fall
    // through to the fallback fill (still from bucket "x" because no others).
    const items: Item[] = Array.from({ length: 10 }, (_, i) => ({
      id: i, cost: i, bucket: "x",
    }));
    const out = pruneBeam(items, byCost, ofBucket, { beamWidth: 4 });
    // First 2 by bucket cap (id 0, 1), then fallback fills with id 2, 3.
    expect(out.map((i) => i.id)).toEqual([0, 1, 2, 3]);
  });

  test("bucket cap blocks worse-bucket dominance when diverse alternatives exist", () => {
    // beamWidth=4, maxPerBucket=2. Bucket "a" has 4 of the 5 best items.
    // Bucket cap forces us to keep 2 from "a" + the best from "b" + fallback
    // from "a" (since no other buckets).
    const items: Item[] = [
      { id: 1, cost: 0, bucket: "a" },
      { id: 2, cost: 1, bucket: "a" },
      { id: 3, cost: 2, bucket: "a" },
      { id: 4, cost: 3, bucket: "a" },
      { id: 5, cost: 4, bucket: "b" },
    ];
    const out = pruneBeam(items, byCost, ofBucket, { beamWidth: 4 });
    // Walk: id 1 (a:1), id 2 (a:2 = cap), id 3 skipped, id 4 skipped, id 5 (b:1). out=[1,2,5], len=3.
    // Fallback: fill 1 more slot from sorted ignoring bucket cap. id 3 is next not-taken.
    expect(out.map((i) => i.id).sort()).toEqual([1, 2, 3, 5]);
  });

  test("custom maxPerBucket=1 forces full diversity", () => {
    const items: Item[] = [
      { id: 1, cost: 0, bucket: "a" },
      { id: 2, cost: 1, bucket: "a" },
      { id: 3, cost: 2, bucket: "b" },
      { id: 4, cost: 3, bucket: "c" },
    ];
    const out = pruneBeam(items, byCost, ofBucket, { beamWidth: 3, maxPerBucket: 1 });
    // Walk: id 1 (a:1=cap), id 2 skipped, id 3 (b:1=cap), id 4 (c:1=cap). out=[1,3,4].
    expect(out.map((i) => i.id)).toEqual([1, 3, 4]);
  });

  test("custom maxPerBucket >= beamWidth disables diversity (pure top-K)", () => {
    const items: Item[] = [
      { id: 1, cost: 0, bucket: "a" },
      { id: 2, cost: 1, bucket: "a" },
      { id: 3, cost: 2, bucket: "a" },
      { id: 4, cost: 3, bucket: "b" },
    ];
    const out = pruneBeam(items, byCost, ofBucket, { beamWidth: 3, maxPerBucket: 99 });
    expect(out.map((i) => i.id)).toEqual([1, 2, 3]);
  });

  test("maxPerBucket=0 throws", () => {
    expect(() =>
      pruneBeam([{ id: 1, cost: 0, bucket: "a" }], byCost, ofBucket,
        { beamWidth: 4, maxPerBucket: 0 }),
    ).toThrow(/maxPerBucket/);
  });
});

describe("pruneBeam — determinism", () => {
  test("ties are broken by input order (stable sort)", () => {
    // All same cost, different ids/buckets — order should be preserved
    // through pruning.
    const items: Item[] = [
      { id: 1, cost: 5, bucket: "a" },
      { id: 2, cost: 5, bucket: "b" },
      { id: 3, cost: 5, bucket: "c" },
      { id: 4, cost: 5, bucket: "d" },
      { id: 5, cost: 5, bucket: "e" },
    ];
    const out = pruneBeam(items, byCost, ofBucket, { beamWidth: 3 });
    expect(out.map((i) => i.id)).toEqual([1, 2, 3]);
  });

  test("two identical calls produce identical results", () => {
    const items: Item[] = [
      { id: 1, cost: 3, bucket: "a" },
      { id: 2, cost: 1, bucket: "b" },
      { id: 3, cost: 3, bucket: "a" },
      { id: 4, cost: 2, bucket: "b" },
      { id: 5, cost: 0, bucket: "c" },
    ];
    const a = pruneBeam(items, byCost, ofBucket, { beamWidth: 3 });
    const b = pruneBeam(items, byCost, ofBucket, { beamWidth: 3 });
    expect(a.map((i) => i.id)).toEqual(b.map((i) => i.id));
  });
});

describe("pruneBeam — does not mutate input", () => {
  test("input array order is preserved", () => {
    const items: Item[] = [
      { id: 1, cost: 5, bucket: "a" },
      { id: 2, cost: 1, bucket: "b" },
      { id: 3, cost: 3, bucket: "c" },
    ];
    const snapshot = items.map((i) => i.id);
    pruneBeam(items, byCost, ofBucket, { beamWidth: 2 });
    expect(items.map((i) => i.id)).toEqual(snapshot);
  });
});
