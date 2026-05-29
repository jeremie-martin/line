export type SearchAction =
  | { kind: "RunCoverageEpoch" }
  | { kind: "RunRecoveryEpoch" };

export type SchedulerAvailability = {
  coverageActive: boolean;
  recoveryActive: boolean;
};

export type Scheduler = {
  nextAction(availability: SchedulerAvailability): SearchAction | null;
};

export function createDeterministicEpochScheduler(): Scheduler {
  let preferRecovery = false;

  return {
    nextAction(availability) {
      if (!availability.coverageActive && !availability.recoveryActive) return null;

      if (preferRecovery && availability.recoveryActive) {
        preferRecovery = false;
        return { kind: "RunRecoveryEpoch" };
      }

      if (availability.coverageActive) {
        preferRecovery = true;
        return { kind: "RunCoverageEpoch" };
      }

      return { kind: "RunRecoveryEpoch" };
    },
  };
}
