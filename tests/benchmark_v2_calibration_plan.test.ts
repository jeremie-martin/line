import { spawnSync } from "node:child_process";
import { describe, expect, test } from "vitest";
import {
  validationExecutionPlan,
  validationExecutionPlanFingerprint,
} from "../scripts/benchmark/validate_independent_reference.ts";

describe("independent-reference worker execution plan", () => {
  const plan = {
    depth: 300,
    futilitySchedule: [],
    futilityAlpha: 0.05,
    criticalAlpha: 0.01,
    centralCriticalLevel: 0.99,
    centralNominalLevel: 0.95,
  } as const;

  test("carries an exact, immutable-depth plan into workers", () => {
    const normalized = validationExecutionPlan(plan);
    expect(normalized).toEqual(plan);
    expect(normalized).not.toBe(plan);
    expect(validationExecutionPlanFingerprint(normalized)).toMatch(/^[a-f0-9]{64}$/);
    expect(validationExecutionPlanFingerprint(normalized))
      .not.toBe(validationExecutionPlanFingerprint(validationExecutionPlan({ ...plan, depth: 48 })));
  });

  test("refuses malformed depth and futility schedules before simulation", () => {
    expect(() => validationExecutionPlan({ ...plan, depth: 0 })).toThrow(/positive integer/);
    expect(() => validationExecutionPlan({ ...plan, futilitySchedule: [16, 8] })).toThrow(/strictly increasing/);
    expect(() => validationExecutionPlan({ ...plan, futilitySchedule: [300] })).toThrow(/below depth/);
    expect(() => validationExecutionPlan({ ...plan, criticalAlpha: 1 })).toThrow(/must be in \(0, 1\)/);
  });

  test("does not let a trial-count override forge a certification declaration", () => {
    const run = spawnSync(process.execPath, [
      "--import", "tsx", "scripts/benchmark/validate_independent_reference.ts", "--trials-per-stream=1",
    ], { cwd: process.cwd(), encoding: "utf8" });
    expect(run.status).not.toBe(0);
    expect(`${run.stdout}\n${run.stderr}`).toMatch(/trials-per-stream is not supported/);
  });
});
