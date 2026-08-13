import { describe, expect, test } from "vitest";
import {
  runWeightedPool,
  scaleWorkerSlotWeight,
} from "../scripts/v0/benchmark_v2/weighted_pool.ts";

describe("benchmark V2 weighted worker pool", () => {
  test("scales only trace work with execution budget", () => {
    expect(scaleWorkerSlotWeight(4_000_000, "off")).toBe(1);
    expect(scaleWorkerSlotWeight(150_000, "summary")).toBe(1);
    expect(scaleWorkerSlotWeight(1_500_000, "summary")).toBe(1);
    expect(scaleWorkerSlotWeight(2_500_000, "summary")).toBe(2);
    expect(scaleWorkerSlotWeight(4_000_000, "summary")).toBe(3);
    expect(scaleWorkerSlotWeight(150_000, "trace")).toBe(1);
    expect(scaleWorkerSlotWeight(1_500_000, "trace")).toBe(1);
    expect(scaleWorkerSlotWeight(2_500_000, "trace")).toBe(2);
    expect(scaleWorkerSlotWeight(4_000_000, "trace")).toBe(3);
    expect(scaleWorkerSlotWeight(11_600_000, "trace")).toBe(8);
  });

  test("never exceeds slot capacity and still runs an overweight task alone", async () => {
    const tasks = [1, 1, 2, 3, 9, 1];
    let occupied = 0;
    let peak = 0;
    const starts: number[] = [];
    await runWeightedPool(tasks, 4, (weight) => weight, async (weight) => {
      const charged = Math.min(4, weight);
      occupied += charged;
      peak = Math.max(peak, occupied);
      starts.push(weight);
      await new Promise((resolve) => setTimeout(resolve, 1));
      occupied -= charged;
    });
    expect(peak).toBeLessThanOrEqual(4);
    expect(starts).toHaveLength(tasks.length);
    expect(starts).toContain(9);
  });

  test("rejects invalid pool inputs", async () => {
    await expect(runWeightedPool([1], 0, () => 1, async () => {}))
      .rejects.toThrow(/capacity/);
    await expect(runWeightedPool([1], 4, () => 0, async () => {}))
      .rejects.toThrow(/weight/);
  });
});
