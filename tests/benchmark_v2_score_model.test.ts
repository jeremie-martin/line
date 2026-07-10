import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import {
  buildBenchmarkScore,
  loadBenchmarkScore,
  type BenchmarkScoreDocument,
} from "../scripts/v0/benchmark_v2/score_model.ts";

describe("Benchmark V2 score documents", () => {
  test("expands explicit phrase placements deterministically", () => {
    const first = loadBenchmarkScore("benchmark/v2/archive/prototype-v2.0/specs-v2/scores/river_reentry.json");
    const second = loadBenchmarkScore("benchmark/v2/archive/prototype-v2.0/specs-v2/scores/river_reentry.json");
    expect(first.events).toEqual(second.events);
    expect(first.spec.contacts).toEqual(second.spec.contacts);
    expect(first.events).toHaveLength(88);
    expect(first.events.every((event) => event.phrase.length > 0 && event.impact >= 0 && event.impact <= 1)).toBe(true);
  });

  test("rejects duplicate expanded events and unsupported axes by construction", () => {
    const source = JSON.parse(readFileSync("benchmark/v2/archive/prototype-v2.0/specs-v2/scores/river_reentry.json", "utf8")) as BenchmarkScoreDocument;
    const duplicate = structuredClone(source);
    duplicate.placements.push({ ...duplicate.placements[0] });
    expect(() => buildBenchmarkScore(duplicate)).toThrow(/duplicate or unsorted/);

    const invalidImpact = structuredClone(source);
    invalidImpact.phrases.arrival[0].impact = 1.1;
    expect(() => buildBenchmarkScore(invalidImpact)).toThrow(/impact must be in/);

    const invalidAxis = structuredClone(source);
    invalidAxis.axes.air[1].t = invalidAxis.axes.air[0].t;
    expect(() => buildBenchmarkScore(invalidAxis)).toThrow(/invalid air keyframe/);
  });
});
