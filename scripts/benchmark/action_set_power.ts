/**
 * Action-set power — what a clean preview actually excludes.
 *
 * THE QUESTION IT ANSWERS
 *   Not "did the preview look good" but: *given how few cells the candidate
 *   could even touch, what failure rate would the observed zero have ruled
 *   out?* A preview that changes 14 cells and loses nothing has excluded
 *   nothing below ~20% — and a mechanism whose break-even loss rate is 0.3%
 *   was never in scope for that preview at all.
 *
 * THE CASE THAT PAID FOR THIS (budget-unification phase 1b, docs/budget-aware-map.md §6.1)
 *   Graded rollout-depth pressure previewed clean: +0.675 headline, capability
 *   +4.50, controls bit-identical, zero validity loss. It changed 14 cells. At
 *   N=48 it read −5.41 with four lost completions and capability −36.09.
 *
 *   - action set = 14 changed cells, 0 adverse events;
 *   - 95% exclusion bound = 19.3% exact (21.4% by the rule of three) — the
 *     preview excluded only failure rates above roughly a fifth of the cells;
 *   - the rate the eval later measured was 4/90 = 4.4%, giving
 *     P(zero in 14 cells) = 0.53 — the clean preview was a coin flip;
 *   - break-even was ~0.3% (upside +13 headline points against ~50 points per
 *     lost completion, over ~88 changed cells), and excluding 0.3% at 95% with
 *     a zero observation needs 997 changed cells. No preview of that mechanism
 *     could ever have been decisive; only the arithmetic says so.
 *
 * HOW TO READ THE OUTPUT
 *   `exclusionBound` is the exact one-sided Clopper-Pearson upper bound: the
 *   largest per-changed-cell failure rate under which the observation is still
 *   at least 5% likely. `ruleOfThree` is the familiar 3/n approximation, valid
 *   only at zero events and always the looser of the two. `breakEven.rate` is
 *   value/(eventCost x changedCells) — the loss rate at which the mechanism
 *   stops paying. `powered` is the only verdict that matters: is the exclusion
 *   bound at or below break-even? If not, the preview cannot support a
 *   promotion argument no matter how clean it looks.
 *
 * LIMITS
 *   This prices the *action set*, not the mechanism. It assumes changed cells
 *   fail independently at a common rate — the conservative reading, since a
 *   correlated failure mode concentrated in one source block is worse, not
 *   better. It says nothing about the size of a favourable effect.
 */

const CONFIDENCE = 0.95;

export type BreakEvenInput = {
  /** Total value of the mechanism, in the same units as `eventCost`. */
  value: number;
  /** Cost of one adverse event, in the same units as `value`. */
  eventCost: number;
  /**
   * Changed cells the `value` was measured over. Break-even is a property of
   * the mechanism, not of this observation: value scales with the action set,
   * so the rate is value-per-changed-cell over event cost and is the same
   * number whether you previewed 14 cells or evaluated 88. Defaults to this
   * observation's action set, which is only right when the value figure came
   * from this same grid.
   */
  valueCells?: number;
};

export type BreakEven = Required<BreakEvenInput> & {
  /** Value delivered per changed cell. */
  valuePerCell: number;
  /** How many adverse events this observation's action set can absorb. */
  tolerableEvents: number;
  /** Break-even per-changed-cell failure rate. */
  rate: number;
  /** Changed cells needed for a zero observation to exclude `rate` at `confidence`. */
  requiredChangedCells: number;
  /** Does the observation exclude the break-even rate? */
  powered: boolean;
  /** Is the observed rate already above break-even? */
  refuted: boolean;
};

export type ActionSetPower = {
  /** Cells the candidate can change — the action set, not the grid. */
  changedCells: number;
  /** Cells in the grid, for the share the action set represents. */
  totalCells: number | null;
  adverseEvents: number;
  confidence: number;
  /** Exact one-sided binomial upper bound on the per-changed-cell rate. */
  exclusionBound: number | null;
  /** 3/n — the rule of three, meaningful only at zero observed events. */
  ruleOfThree: number | null;
  /** Observed rate, when there is an action set to divide by. */
  observedRate: number | null;
  breakEven: BreakEven | null;
  /** P(zero adverse events in this action set) at named reference rates. */
  zeroProbability: Array<{ label: string; rate: number; probability: number }>;
};

/**
 * Exact one-sided upper confidence bound on a binomial rate: the largest p for
 * which P(X <= events; n, p) >= 1 - confidence. At events = 0 this is the
 * closed form 1 - alpha^(1/n); above it, bisection on a monotone CDF.
 */
export function binomialUpperBound(n: number, events: number, confidence = CONFIDENCE): number {
  if (!Number.isSafeInteger(n) || n < 0) throw new Error(`changed cells must be a non-negative integer`);
  if (!Number.isSafeInteger(events) || events < 0 || events > n) {
    throw new Error(`adverse events must be an integer in [0, ${n}]`);
  }
  if (!(confidence > 0 && confidence < 1)) throw new Error(`confidence must be in (0, 1)`);
  if (n === 0) return 1;
  if (events === n) return 1;
  const alpha = 1 - confidence;
  if (events === 0) return 1 - Math.pow(alpha, 1 / n);
  let low = events / n;
  let high = 1;
  for (let step = 0; step < 200; step++) {
    const mid = (low + high) / 2;
    if (binomialAtMost(events, n, mid) >= alpha) low = mid;
    else high = mid;
  }
  return (low + high) / 2;
}

/** P(X <= k) for X ~ Binomial(n, p), summed in log space for stability. */
export function binomialAtMost(k: number, n: number, p: number): number {
  if (p <= 0) return 1;
  if (p >= 1) return k >= n ? 1 : 0;
  let total = 0;
  for (let i = 0; i <= k; i++) {
    total += Math.exp(logChoose(n, i) + i * Math.log(p) + (n - i) * Math.log1p(-p));
  }
  return Math.min(1, total);
}

/** P(no adverse event across `n` independent changed cells at rate `p`). */
export function zeroEventProbability(n: number, p: number): number {
  if (p <= 0) return 1;
  if (p >= 1) return n === 0 ? 1 : 0;
  return Math.exp(n * Math.log1p(-p));
}

/** Smallest action set whose zero observation excludes `rate` at `confidence`. */
export function requiredChangedCells(rate: number, confidence = CONFIDENCE): number {
  if (!(rate > 0 && rate < 1)) throw new Error(`break-even rate must be in (0, 1)`);
  return Math.ceil(Math.log(1 - confidence) / Math.log1p(-rate));
}

export function breakEvenRate(input: BreakEvenInput, changedCells: number): BreakEven {
  if (!(input.eventCost > 0)) throw new Error(`--event-cost must be positive`);
  if (!(input.value > 0)) throw new Error(`--value must be positive`);
  if (changedCells <= 0) throw new Error(`break-even needs a non-empty action set`);
  const valueCells = input.valueCells ?? changedCells;
  if (!(valueCells > 0)) throw new Error(`--value-cells must be positive`);
  const valuePerCell = input.value / valueCells;
  const rate = Math.min(1, valuePerCell / input.eventCost);
  return {
    value: input.value,
    eventCost: input.eventCost,
    valueCells,
    valuePerCell,
    tolerableEvents: rate * changedCells,
    rate,
    requiredChangedCells: rate >= 1 ? changedCells : requiredChangedCells(rate),
    powered: false,
    refuted: false,
  };
}

export function actionSetPower(input: {
  changedCells: number;
  adverseEvents: number;
  totalCells?: number | null;
  breakEven?: BreakEvenInput | null;
  /** Extra rates to report P(zero) at, e.g. a rate measured elsewhere. */
  referenceRates?: Array<{ label: string; rate: number }>;
  confidence?: number;
}): ActionSetPower {
  const confidence = input.confidence ?? CONFIDENCE;
  const { changedCells, adverseEvents } = input;
  const exclusionBound = changedCells === 0 ? null : binomialUpperBound(changedCells, adverseEvents, confidence);
  const breakEven = input.breakEven == null || changedCells === 0
    ? null
    : breakEvenRate(input.breakEven, changedCells);
  if (breakEven !== null && exclusionBound !== null) {
    breakEven.powered = exclusionBound <= breakEven.rate;
    breakEven.refuted = adverseEvents / changedCells > breakEven.rate;
  }
  const zeroProbability = [
    ...(breakEven === null ? [] : [{ label: "break-even", rate: breakEven.rate }]),
    ...(input.referenceRates ?? []),
  ]
    .filter((entry) => entry.rate > 0 && entry.rate < 1)
    .map((entry) => ({ ...entry, probability: zeroEventProbability(changedCells, entry.rate) }));
  return {
    changedCells,
    totalCells: input.totalCells ?? null,
    adverseEvents,
    confidence,
    exclusionBound,
    ruleOfThree: changedCells === 0 ? null : 3 / changedCells,
    observedRate: changedCells === 0 ? null : adverseEvents / changedCells,
    breakEven,
    zeroProbability,
  };
}

/**
 * The footer every mover-grid report ends with. Deliberately unavoidable: a
 * preview without its power statement is not evidence, so the instrument
 * cannot emit one without the other.
 */
export function formatActionSetPower(power: ActionSetPower, eventName = "adverse event"): string {
  const percent = (value: number): string => `${(100 * value).toFixed(2)}%`;
  const lines: string[] = [`ACTION-SET POWER  (what this observation excludes)`];
  const row = (label: string, text: string): void => {
    lines.push(`  ${label.padEnd(20)}${text}`);
  };
  const share = power.totalCells === null || power.totalCells === 0
    ? ""
    : ` of ${power.totalCells} grid cells (${percent(power.changedCells / power.totalCells)})`;
  row("action set", `${power.changedCells} changed cells${share}`);
  row(
    `${eventName}s`,
    `${power.adverseEvents} observed` +
    (power.observedRate === null ? "" : `  (${percent(power.observedRate)} of the action set)`),
  );
  if (power.exclusionBound === null) {
    row("exclusion bound", `none — the candidate changed nothing, so nothing was tested`);
    return lines.join("\n");
  }
  row(
    "exclusion bound",
    `rates above ${percent(power.exclusionBound)} are excluded at ${(100 * power.confidence).toFixed(0)}%` +
    (power.adverseEvents === 0
      ? `  (rule of three ${percent(power.ruleOfThree!)})`
      : `  (exact, ${power.adverseEvents} events)`),
  );
  if (power.breakEven === null) {
    row(
      "break-even",
      `not supplied — pass --value=<points> --event-cost=<points per ${eventName}> to price this action set`,
    );
  } else {
    const { value, eventCost, valueCells, tolerableEvents, rate, requiredChangedCells: needed } = power.breakEven;
    row(
      "break-even",
      `${percent(rate)}  (${value} points upside over ${valueCells} changed cells / ${eventCost} points per ` +
      `${eventName} = ${tolerableEvents.toFixed(2)} tolerable here)`,
    );
    row(
      "verdict",
      `${power.breakEven.refuted ? "REFUTED" : power.breakEven.powered ? "POWERED" : "UNDERPOWERED"} — ` +
      (power.breakEven.refuted
        ? `the observed ${percent(power.observedRate!)} is already above break-even; the mechanism does not pay at this rate`
        : power.breakEven.powered
        ? `the observation excludes the break-even rate`
        : `excluding ${percent(rate)} at ${(100 * power.confidence).toFixed(0)}% with a clean run needs ` +
          `${needed} changed cells; this action set has ${power.changedCells}`),
    );
  }
  for (const entry of power.zeroProbability) {
    row(
      `P(zero | ${percent(entry.rate)})`,
      `${entry.probability.toFixed(3)}  at the ${entry.label} rate` +
      (entry.probability > 0.2 && power.adverseEvents === 0 ? ` — a clean run here is not informative` : ""),
    );
  }
  return lines.join("\n");
}

function logChoose(n: number, k: number): number {
  return logGamma(n + 1) - logGamma(k + 1) - logGamma(n - k + 1);
}

/** Lanczos approximation; exact enough far past any grid size we run. */
function logGamma(x: number): number {
  const coefficients = [
    676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012,
    9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  const z = x - 1;
  let series = 0.99999999999980993;
  for (let i = 0; i < coefficients.length; i++) series += coefficients[i] / (z + i + 1);
  const t = z + coefficients.length - 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(series);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const argument = (name: string): string | undefined =>
    process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
  const number = (name: string, fallback?: number): number | undefined => {
    const raw = argument(name);
    if (raw === undefined) return fallback;
    const value = Number(raw);
    if (!Number.isFinite(value)) throw new Error(`--${name} must be a number`);
    return value;
  };
  const changedCells = number("changed");
  if (changedCells === undefined) {
    console.log(
      `action-set power\n` +
      `  --changed=<n>          cells the candidate can change (the action set)\n` +
      `  --events=<n>           adverse events observed (default 0)\n` +
      `  --total=<n>            grid cells, for the action-set share (optional)\n` +
      `  --value=<points>       total upside of the mechanism (optional)\n` +
      `  --value-cells=<n>      changed cells the upside was measured over (default: --changed)\n` +
      `  --event-cost=<points>  cost of one adverse event (optional)\n` +
      `  --rate=<p>             extra rate to report P(zero) at (optional)\n` +
      `  --event-name=<text>    what an adverse event is called (default "adverse event")\n\n` +
      `  the 1b case:  --changed=14 --events=0 --value=13 --value-cells=88 --event-cost=50 --rate=0.0444`,
    );
    process.exit(2);
  }
  const value = number("value");
  const eventCost = number("event-cost");
  const valueCells = number("value-cells");
  const rate = number("rate");
  console.log(formatActionSetPower(
    actionSetPower({
      changedCells,
      adverseEvents: number("events", 0)!,
      totalCells: number("total") ?? null,
      breakEven: value === undefined || eventCost === undefined ? null : { value, eventCost, valueCells },
      referenceRates: rate === undefined ? [] : [{ label: "supplied", rate }],
    }),
    argument("event-name") ?? "adverse event",
  ));
}
