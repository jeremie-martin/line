import { describe, expect, test } from "vitest";
import { developmentCases, normativeCases, qualificationCases, variantCases } from "../benchmark/v2/catalog.ts";
import { caseAxisValuesAtContacts } from "../benchmark/v2/cases/case.ts";
import {
  loadSourceManifest,
  loadSourceSpec,
  resolveSources,
} from "../scripts/v0/benchmark_v2/model.ts";
import { FPS, TARGET_AXES, secToFrame } from "../scripts/v0/types.ts";

describe("Benchmark V2 typed catalog", () => {
  test("has the deliberate variant inventory and complete phase metadata", () => {
    expect(normativeCases).toHaveLength(21);
    expect(variantCases).toHaveLength(23);
    expect(developmentCases).toHaveLength(44);
    expect(qualificationCases).toHaveLength(5);
    for (const parent of normativeCases) {
      const parentId = parent.case.metadata.id;
      const expectedVariants = parentId === "frontier_low_air_endurance" ? 3 : 1;
      expect(variantCases.filter((entry) => entry.case.metadata.variant?.parentId === parentId), parentId)
        .toHaveLength(expectedVariants);
    }
    for (const entry of developmentCases) {
      expect(entry.case.metadata.phases.length, entry.case.metadata.id).toBeGreaterThan(0);
      expect(entry.case.metadata.eligibleComponents).toContain("sync");
      expect(entry.case.metadata.eligibleComponents).toContain("survival");
    }
  });

  test("preserves every normative compiler input from the reviewed V2 prototype", async () => {
    const legacy = new Map(resolveSources(loadSourceManifest("benchmark/v2/archive/prototype-v2.0/source-manifest.json"))
      .map((source) => [source.id, source]));
    for (const entry of normativeCases) {
      const id = entry.case.metadata.id;
      const beforeSource = legacy.get(id);
      expect(beforeSource, id).toBeDefined();
      const before = await loadSourceSpec(beforeSource!);
      const after = entry.case.spec;
      expect(secToFrame(after.duration), id).toBe(secToFrame(before.duration));
      expect(after.preroll, id).toEqual(before.preroll);
      expect(after.start, id).toEqual(before.start);
      expect(after.contacts.map((contact) => ({ frame: secToFrame(contact.t), impact: contact.impact })), id)
        .toEqual(before.contacts.map((contact) => ({ frame: secToFrame(contact.t), impact: contact.impact })));
      for (let frame = 0; frame <= secToFrame(before.duration); frame++) {
        for (const axis of TARGET_AXES) {
          const expected = before.axes[axis]?.(frame / FPS);
          const actual = after.axes[axis]?.(frame / FPS);
          if (expected === undefined) expect(actual, `${id}:${axis}@${frame}`).toBeUndefined();
          else expect(actual, `${id}:${axis}@${frame}`).toBeCloseTo(expected, 12);
        }
      }
    }
  }, 30_000);

  test("variants change behavior without changing which target axes are authored", () => {
    const parents = new Map(normativeCases.map((entry) => [entry.case.metadata.id, entry.case]));
    for (const entry of variantCases) {
      const parent = parents.get(entry.case.metadata.variant!.parentId)!;
      expect(Object.keys(entry.case.spec.axes).sort(), entry.case.metadata.id)
        .toEqual(Object.keys(parent.spec.axes).sort());
      const sameContacts = JSON.stringify(entry.case.spec.contacts) === JSON.stringify(parent.spec.contacts);
      const sameDuration = entry.case.spec.duration === parent.spec.duration;
      const sameTargets = JSON.stringify(caseAxisValuesAtContacts(entry.case)) ===
        JSON.stringify(caseAxisValuesAtContacts(parent));
      expect(sameContacts && sameDuration && sameTargets, entry.case.metadata.id).toBe(false);
    }
  });
});
