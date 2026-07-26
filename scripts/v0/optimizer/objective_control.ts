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
 * compiler and preserving `objectiveBlendReadinessPowerForSpec`'s per-spec 0.75
 * on both terms. A cell that pins readiness to 1 is therefore a real arm, not
 * the default.
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
}>;

/** The source default: all neutral, readiness following future. */
export const OBJECTIVE_CONTROL_DEFAULT: ObjectiveControlConfiguration = {
  id: "settled1--future1--readinessfollow",
  settledPower: 1,
  futurePower: 1,
  readinessPower: null,
};

export type ObjectiveControlMatrixOptions = Readonly<{
  settledPowers?: readonly number[];
  futurePowers?: readonly number[];
  /** `null` entries enumerate the follow-the-future-exponent cell. */
  readinessPowers?: readonly (number | null)[];
}>;

function powerToken(power: number | null): string {
  return power === null ? "follow" : String(power);
}

export function objectiveConfigurationId(
  settledPower: number,
  futurePower: number,
  readinessPower: number | null,
): string {
  return `settled${powerToken(settledPower)}` +
    `--future${powerToken(futurePower)}` +
    `--readiness${powerToken(readinessPower)}`;
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
  for (const power of settledPowers) assertPower(power, "settled");
  for (const power of futurePowers) assertPower(power, "future");
  for (const power of readinessPowers) {
    if (power !== null) assertPower(power, "readiness");
  }
  const configurations = settledPowers.flatMap((settledPower) =>
    futurePowers.flatMap((futurePower) =>
      readinessPowers.map((readinessPower) => ({
        id: objectiveConfigurationId(settledPower, futurePower, readinessPower),
        settledPower,
        futurePower,
        readinessPower,
      }))
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
    configuration.readinessPower === OBJECTIVE_CONTROL_DEFAULT.readinessPower;
}

/**
 * The compiler environment for one cell. `{}` for the source default, so the
 * baseline arm is the production compiler itself.
 *
 * NOTE what setting `LR_OBJECTIVE_SETTLED_POWER` / `LR_OBJECTIVE_FUTURE_POWER`
 * also does: `handoff.ts` disables its per-spec exponent gates when either is
 * present. That is intended for a sweep — an arm that pins an exponent should
 * mean it globally, not have five specs quietly overridden — but it does mean a
 * non-default cell is testing "this exponent everywhere" rather than "this
 * exponent plus the existing signature gates".
 */
export function objectiveControlEnvironment(
  configuration: ObjectiveControlConfiguration,
): Record<string, string> {
  if (isObjectiveControlSourceDefault(configuration)) return {};
  return {
    LR_OBJECTIVE_SETTLED_POWER: String(configuration.settledPower),
    LR_OBJECTIVE_FUTURE_POWER: String(configuration.futurePower),
    ...(configuration.readinessPower === null
      ? {}
      : { LR_OBJECTIVE_READINESS_POWER: String(configuration.readinessPower) }),
  };
}
