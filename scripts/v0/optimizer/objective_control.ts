/**
 * Declarative control configurations for the proposal objective's exponents.
 *
 * Sibling of `arc_control.ts`, and deliberately the same shape: this module
 * contains no scoring and no study-specific choices, only the description of a
 * configuration and the enumeration of a product of independent axes. The real
 * compiler reads `OBJECTIVE_CONTROL_DEFAULT` through the same env variables a
 * matrix arm sets, so there is one parametrized production path and no parallel
 * implementation.
 *
 * The axes are the three exponents in `objective.ts` `proposalUtility`:
 *
 *   settledIncomingQuality ^ settled
 *   x projectedOutgoingQuality ^ future
 *   x readiness ^ readiness
 *
 * `readiness: null` means UNSET, which is not the same as 1: unset makes the
 * readiness exponent follow the future exponent, reproducing the two-exponent
 * compiler. (It used to also preserve a per-spec 0.75 that handoff.ts resolved
 * for five specs; that gate was deleted in 2026-08, so today "follow" just means
 * follow whatever the future exponent is set to.) A cell that pins readiness to
 * 1 is therefore a real arm, not the default.
 */

/** Matches `objective.ts` `normalizeObjectivePower`. A cell outside this range
 *  would be silently clamped, which would make two distinct ids the same
 *  compiler. */
export const OBJECTIVE_POWER_MIN = 0.25;
export const OBJECTIVE_POWER_MAX = 4;

export type ObjectiveControlConfiguration = Readonly<{
  /** Stable, readable identity. */
  id: string;
  settledPower: number;
  futurePower: number;
  /** `null` = unset = follow `futurePower`. */
  readinessPower: number | null;
  /** `readiness -> floor + (1 - floor) * readiness`. 0 = identity. */
  readinessFloor: number;
}>;

/** The source default: all neutral, readiness following future, no floor. */
export const OBJECTIVE_CONTROL_DEFAULT: ObjectiveControlConfiguration = {
  id: "settled1--future1--readinessfollow",
  settledPower: 1,
  futurePower: 1,
  readinessPower: null,
  readinessFloor: 0,
};

export type ObjectiveControlMatrixOptions = Readonly<{
  settledPowers?: readonly number[];
  futurePowers?: readonly number[];
  /** `null` entries enumerate the follow-the-future-exponent cell. */
  readinessPowers?: readonly (number | null)[];
  readinessFloors?: readonly number[];
}>;

function powerToken(power: number | null): string {
  return power === null ? "follow" : String(power);
}

/** The floor is omitted from the id when it is 0, so ids minted before the axis
 *  existed still name the same cell. */
export function objectiveConfigurationId(
  settledPower: number,
  futurePower: number,
  readinessPower: number | null,
  readinessFloor: number,
): string {
  return `settled${powerToken(settledPower)}` +
    `--future${powerToken(futurePower)}` +
    `--readiness${powerToken(readinessPower)}` +
    (readinessFloor === 0 ? "" : `--floor${readinessFloor}`);
}

function assertPower(power: number, axis: string): void {
  if (!Number.isFinite(power) || power <= 0) {
    throw new Error(`invalid ${axis} exponent ${power}`);
  }
  if (power < OBJECTIVE_POWER_MIN || power > OBJECTIVE_POWER_MAX) {
    throw new Error(
      `${axis} exponent ${power} is outside the compiler's clamp ` +
        `[${OBJECTIVE_POWER_MIN}, ${OBJECTIVE_POWER_MAX}]; it would be silently ` +
        `clamped and two cells would name the same compiler`,
    );
  }
}

/**
 * Enumerate the direct product. Order is settled-major, then future, then
 * readiness, so a truncated run still sweeps whole sub-grids.
 */
export function enumerateObjectiveControlConfigurations(
  options: ObjectiveControlMatrixOptions,
): ObjectiveControlConfiguration[] {
  const settledPowers = options.settledPowers === undefined
    ? [OBJECTIVE_CONTROL_DEFAULT.settledPower]
    : [...options.settledPowers];
  const futurePowers = options.futurePowers === undefined
    ? [OBJECTIVE_CONTROL_DEFAULT.futurePower]
    : [...options.futurePowers];
  const readinessPowers = options.readinessPowers === undefined
    ? [OBJECTIVE_CONTROL_DEFAULT.readinessPower]
    : [...options.readinessPowers];
  const readinessFloors = options.readinessFloors === undefined
    ? [OBJECTIVE_CONTROL_DEFAULT.readinessFloor]
    : [...options.readinessFloors];
  for (const power of settledPowers) assertPower(power, "settled");
  for (const power of futurePowers) assertPower(power, "future");
  for (const power of readinessPowers) {
    if (power !== null) assertPower(power, "readiness");
  }
  for (const floor of readinessFloors) {
    if (!Number.isFinite(floor) || floor < 0 || floor >= 1) {
      throw new Error(
        `invalid readiness floor ${floor}; must be in [0, 1) — a floor of 1 ` +
          `would erase readiness from the ordering entirely`,
      );
    }
  }
  const configurations = settledPowers.flatMap((settledPower) =>
    futurePowers.flatMap((futurePower) =>
      readinessPowers.flatMap((readinessPower) =>
        readinessFloors.map((readinessFloor) => ({
          id: objectiveConfigurationId(
            settledPower,
            futurePower,
            readinessPower,
            readinessFloor,
          ),
          settledPower,
          futurePower,
          readinessPower,
          readinessFloor,
        }))
      )
    )
  );
  const ids = new Set(configurations.map((configuration) => configuration.id));
  if (ids.size !== configurations.length) {
    throw new Error(`objective control enumeration produced duplicate cells`);
  }
  return configurations;
}

export function isObjectiveControlSourceDefault(
  configuration: ObjectiveControlConfiguration,
): boolean {
  return configuration.settledPower === OBJECTIVE_CONTROL_DEFAULT.settledPower &&
    configuration.futurePower === OBJECTIVE_CONTROL_DEFAULT.futurePower &&
    configuration.readinessPower === OBJECTIVE_CONTROL_DEFAULT.readinessPower &&
    configuration.readinessFloor === OBJECTIVE_CONTROL_DEFAULT.readinessFloor;
}

/**
 * The compiler environment for one cell. `{}` for the source default, so the
 * baseline arm is the production compiler itself.
 *
 * EACH VARIABLE IS EMITTED ONLY WHEN IT IS NON-DEFAULT, and that is a
 * correctness requirement rather than tidiness. `handoff.ts` disables its one
 * surviving per-spec exponent gate (`objectiveBlendCurrentPowerForSpec`) when
 * `LR_OBJECTIVE_SETTLED_POWER` is present at all, whatever its value (the
 * future/readiness gate and its three LR_M* kill-switches were deleted in
 * d7c839f; `LR_OBJECTIVE_FUTURE_POWER` no longer disables anything). Emitting
 * unconditionally therefore made every non-default cell ALSO a gates-disabled
 * cell, so a cell varying only the readiness floor would have been confounded
 * with the gate change on the 40-of-44 specs the settled gate touches.
 *
 * Sweep A (`objective-sweep-a-16s01`) ran under the earlier all-or-nothing rule.
 * That is why its `settled1--future1--readiness1` cell differs from the source
 * default at all — same exponents, gates disabled — and its +1.95 is the
 * combined price of both gates rather than an exponent result. Cells from that
 * sweep are not directly comparable to cells minted after this change; the
 * matrix schema is bumped so a resume cannot silently mix them.
 *
 * There is no targeted kill-switch for the settled gate: `disableSpecGates`
 * below (which pins `LR_OBJECTIVE_SETTLED_POWER` into every cell) is the one
 * deliberate way to turn it off.
 */
export type ObjectiveControlEnvironmentOptions = Readonly<{
  /**
   * Emit `LR_OBJECTIVE_SETTLED_POWER` and `LR_OBJECTIVE_FUTURE_POWER` in EVERY
   * cell, including cells that leave them at 1, which turns handoff's per-spec
   * exponent gates off everywhere.
   *
   * Needed by any sweep comparing exponent RATIOS across cells. Under minimal
   * emission a cell varying only `futurePower` leaves the settled gate live
   * while a cell varying `settledPower` turns it off, so two cells with the
   * same ratio are not the same compiler and the comparison is invalid. This
   * makes "gates off" an explicit, named property of a sweep rather than a
   * side effect of which variables happened to be non-default. (Since d7c839f
   * only the settled gate exists; the `LR_OBJECTIVE_FUTURE_POWER` pin is kept
   * for cell-env stability and is inert as a gate control.)
   */
  disableSpecGates?: boolean;
}>;

export function objectiveControlEnvironment(
  configuration: ObjectiveControlConfiguration,
  options: ObjectiveControlEnvironmentOptions = {},
): Record<string, string> {
  const environment: Record<string, string> = {};
  const pin = options.disableSpecGates === true;
  if (pin || configuration.settledPower !== OBJECTIVE_CONTROL_DEFAULT.settledPower) {
    environment.LR_OBJECTIVE_SETTLED_POWER = String(configuration.settledPower);
  }
  if (pin || configuration.futurePower !== OBJECTIVE_CONTROL_DEFAULT.futurePower) {
    environment.LR_OBJECTIVE_FUTURE_POWER = String(configuration.futurePower);
  }
  if (configuration.readinessPower !== null) {
    environment.LR_OBJECTIVE_READINESS_POWER = String(
      configuration.readinessPower,
    );
  }
  if (configuration.readinessFloor !== OBJECTIVE_CONTROL_DEFAULT.readinessFloor) {
    environment.LR_OBJECTIVE_READINESS_FLOOR = String(
      configuration.readinessFloor,
    );
  }
  return environment;
}
