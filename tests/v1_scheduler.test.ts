import { describe, expect, test } from "vitest";
import { createDeterministicEpochScheduler } from "../scripts/v1/scheduler.ts";

describe("v1 deterministic epoch scheduler", () => {
  test("alternates coverage and recovery without using a total budget", () => {
    const scheduler = createDeterministicEpochScheduler();
    const actions = [
      scheduler.nextAction({ coverageActive: true, recoveryActive: true }),
      scheduler.nextAction({ coverageActive: true, recoveryActive: true }),
      scheduler.nextAction({ coverageActive: true, recoveryActive: true }),
      scheduler.nextAction({ coverageActive: true, recoveryActive: true }),
    ];

    expect(actions.map((action) => action?.kind)).toEqual([
      "RunCoverageEpoch",
      "RunRecoveryEpoch",
      "RunCoverageEpoch",
      "RunRecoveryEpoch",
    ]);
  });

  test("falls back to whichever deterministic stream is still active", () => {
    const scheduler = createDeterministicEpochScheduler();

    expect(scheduler.nextAction({ coverageActive: false, recoveryActive: true })?.kind)
      .toBe("RunRecoveryEpoch");
    expect(scheduler.nextAction({ coverageActive: true, recoveryActive: false })?.kind)
      .toBe("RunCoverageEpoch");
    expect(scheduler.nextAction({ coverageActive: false, recoveryActive: false }))
      .toBeNull();
  });
});
