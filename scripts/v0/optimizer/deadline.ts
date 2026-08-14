/**
 * The compile's ONE live deadline signal: the margin.
 *
 *     margin = remaining policy budget / estimated remaining work to the end
 *
 * ONE term in that denominator, in each of the compile's two phases:
 *
 *     pre-completion    work = structural suffix x law scale x correction
 *     post-completion   work = incumbent's measured cost-to-end x correction
 *
 * and nothing else. There was a third, blended term — the compile's own episode
 * pace, folded into the pre-completion form — and it is gone; the tombstone
 * below the imports carries the decision and its evidence, and
 * `tests/deadline_signal.test.ts` pins that the pre-completion margin is exactly
 * the law-scaled structural base with no other factor in it.
 *
 * A pure, per-node read over search-owned deterministic state (charged frames,
 * how far the traversal has reached, the spec's own structure) and the budget
 * estimator's pure functions. At the first node it *is* the static structural
 * estimate; it updates as the search spends and progresses; it keeps its meaning
 * after first completion, where the incumbent's measured cost-to-end profile
 * replaces the structural suffix — a profile `handoff.ts` establishes at the
 * instant the first completion is ADOPTED, so the switch happens exactly when
 * the phase does. (It used to wait for the repair phase, which left the margin
 * projecting compile-global spend over per-node progress for the whole
 * pre-repair window and for every compile below the repair minimum;
 * `tests/deadline_signal.test.ts` pins the corrected behaviour.) It is the
 * single answer to "am I behind?" — the three
 * competing answers it replaced (`observedTraversalBudgetSlack`'s paced slack,
 * the online lane's spend-vs-progress comparator, and the aim lane's copy of the
 * first) are gone.
 *
 * The SIGNAL is live for the whole compile. Which consumers act on it after
 * first completion is a policy question this module does not answer: Phase 1a
 * holds the two pool-affecting consumers to the pre-completion phase (the
 * boundary is in `handoff.ts` `rankedOptions`, with the measurements that drew
 * it), and the post-completion arm is Phase 1b's. Everything below — including
 * the cost-to-end path base — is computed regardless, so the observation hook
 * can price what a post-completion consumer would have seen.
 *
 * Two coordinates, one signal each (docs/budget-unification-plan.md):
 *  - DIFFICULTY is `budgetSlack` — `TRAVERSAL_BUDGET_MODEL_V1`, static per
 *    compile, chooses the SHAPE of spend. Not this module.
 *  - DEADLINE is this margin — live, per node, chooses the PRESSURE on spend.
 *
 * ## What it reads
 *
 * The estimate is `estimateRemainingBudgetWork` — the same pure functions the
 * telemetry recorder calls, never its state — over a structural suffix this
 * module tabulates itself from the estimator's own model:
 *
 *   - the SHAPE is `BUDGET_ESTIMATOR_TRAVERSAL_MODEL`, the artifact's structural
 *     coefficients (intercept 23,860.07, contact 3,699.92, duration 18.35),
 *     passed EXPLICITLY at both call sites. `structuralRemainingWork` used to
 *     default to `TRAVERSAL_BUDGET_MODEL_V1`, and taking that default silently
 *     is how this module spent one era computing a looser signal than the one it
 *     documented — the decision section below is that measurement. The default
 *     is gone (every caller now names its model) and
 *     `tests/deadline_signal.test.ts` pins the argument so it cannot be dropped
 *     again;
 *   - the SCALE is the artifact's budget law, `budgetEstimatorStructuralScale`
 *     = (B / 750k)^0.825;
 *   - the correction factor is the artifact's, and so is the pace weight: the
 *     artifact selects `paceSchedule: "none"` and policy now runs the artifact
 *     as written, so `estimateRemainingBudgetWork` is called with `pace: null`
 *     and no local copy of the model exists.
 *
 * So the base IS the estimate the recorder records — the two sides now run the
 * same model as well as the same function, which they did not while the
 * override existed — and the accuracy numbers below are numbers about the
 * quantity computed here.
 *
 * ## Where the policy/telemetry boundary sits (2026-08-04)
 *
 * POLICY — this module — reads the artifact's structural coefficients, its
 * budget law and its two correction factors, and nothing else from the
 * estimator's combination block. It consumes `paceSchedule` only in the sense
 * that the artifact says `"none"` and this module no longer contradicts it;
 * there is no policy-side override of any artifact field left in the tree.
 *
 * TELEMETRY — `budget_telemetry.ts`, `analyze_budget_telemetry.ts`,
 * `describe_budget_telemetry.ts`, `calibrate_budget_estimator.ts` — keeps the
 * whole pace apparatus: the recorder still records
 * `episode_pace_work_estimate_frames` and `structural_progress_fraction` on
 * every observation, the artifact schema still carries a `paceSchedule` field,
 * and the calibrator still sweeps the four schedules behind `--pace-schedule`.
 * Those are MEASUREMENT: they let a future recalibration fit pace weights for an
 * accuracy claim, and they let the analyzer say what the pace estimate would
 * have read. None of them is on the deadline's path. If a recalibration ever
 * selects a non-`"none"` schedule, policy will pick it up automatically —
 * through the artifact, which is the only way it should ever arrive.
 *
 * ONE residue of the split is worth naming so nobody hunts it as a bug: the
 * recorder passes its non-null `pace` into the artifact's ZERO-weight blend and
 * therefore gets `exp(log(base))`, while this module passes `pace: null` and
 * gets `base`. The two estimates differ by that round-trip — at most an ulp,
 * never a term — and closing it would mean the recorder computing a pace it
 * then declines to use, which is worth less than the observation it records.
 *
 * Policy consumes the RAW POINT RATIO at every budget. The estimator's
 * `applicability` nulling (`hard_completion_margin` is null outside the
 * artifact's fitted policy-budget domain, currently [250k, 1.5M]) governs what
 * the recorder may CLAIM is calibrated; it is not a statement that the predictor
 * is unusable there.
 *
 * The measured accuracy is over 129,481 archived pre-terminal observations
 * (phase0/signal-comparison.md §Answer 2) — median absolute percentage error
 * against realized remaining first-completion work:
 *
 *     75k 30.5% | 150k 10.2% | 300k 6.9% | 750k 5.3% | 1.5M 4.4% | 2.25M 6.9%
 *
 * against 262% / 53.8% / 22.5% / 82.4% / 108% / 118% for the paced slack it
 * replaced — a 3x to 25x win at every budget, in and out of domain. Rank
 * agreement with the realized margin is 0.80-0.97 (Spearman) where the paced
 * blend goes ANTI-correlated above 300k. Those are the structural base alone,
 * which since the pace term's removal is the whole pre-completion estimate —
 * the accuracy table and the shipped signal are now the same quantity. The one
 * place the estimate is genuinely weak is 75k, where the law extrapolates two
 * octaves below its corpus — and where the ramp is engaged on three quarters of
 * observations anyway, so the pressure decision there barely depends on its
 * precision.
 *
 * ## The base shape was a decision, and it is measured (2026-08-03)
 *
 * Until this change the module passed no model argument, so the shipped base was
 * V1-SHAPED under the artifact's law scale. V1 predicts 37% of the artifact's
 * remaining work at a root node — median over the 44 canonical sources; the
 * artifact's contact coefficient is 4.6x V1's and its duration coefficient
 * 0.62x, so the ratio runs 2.72x at the root and narrows to 1.63x over the last
 * three gaps. A smaller denominator is a LARGER margin, so the shipped signal
 * read about 1.9x loose and a ramp whose anchors were derived on the
 * artifact-shaped estimate (see below) barely engaged.
 *
 * That was recorded as a known deviation and argued to be plausibly
 * load-bearing: it reconstructed `observedTraversalBudgetSlack`'s architecture,
 * a deliberately STALE structural prior corrected toward measured pace, which
 * the map's Cluster E1(iii) says the correction needs something independent to
 * pull against. The argument does not survive its measurement:
 *
 *   - PAIRED SIGNAL COMPARISON — both shapes computed inside one
 *     `CompileDeadline` over the same compiles (8 capability sources x 2 seeds),
 *     counted at pre-completion pool builds, the decision-weighted population.
 *     At 750k the ramp goes from 21.5% engaged / 4.5% at full pressure to 64.3%
 *     / 32.6% (median margin 3.32 -> 1.52); at 150k from 63.0% / 44.4% to 98.6%
 *     / 75.1%. POST-completion builds are bit-identical under either shape,
 *     because there the base is the incumbent's measured cost-to-end and no
 *     model touches it: the whole action is pre-completion.
 *   - CAPABILITY MOVER GRID — 48 seeds at 750k, paired against the V1-shaped
 *     tree. 243 of 528 cells change, ZERO completions lost, three gained, and
 *     the two canonical groups that engage move +52.89 (`rapid_pickup_frontier`)
 *     and +26.85 (`dense_recovery_frontier`). `low_air_frontier`, which engages
 *     on ~1% of builds either way, is -0.34; the three back-filled controls are
 *     flat (0.00 / -0.06 / 0.00). First completion arrives earlier on the
 *     pressed specs, which is the mechanism doing the thing it exists for.
 *
 * The stale-prior finding survives where it was actually made — the DIFFICULTY
 * coordinate, Cluster E1. It did NOT survive here: the pace term was this
 * module's version of it, an accurate base corrected toward the compile's own
 * evidence, and the correction was measured worthless at two budgets and
 * removed (the tombstone below). What staleness never licensed, either way, was
 * an inaccurate base: it bought a wider margin, not more information.
 *
 * ## The constants, in margin units
 *
 * `pacedSlack`'s 1.0/1.5 could not be carried across: its median runs 0.63 ->
 * 6.83 across 75k..2.25M (it is nearly linear in the budget), where the margin's
 * runs 1.32 -> 3.30 and tracks the REALIZED margin at every budget. The two
 * anchors here are read off the 150k threshold sweep in
 * phase0/signal-comparison-table.md §H (28,625 observations, 29/352 compiles
 * never complete), the only corpus with a non-degenerate completion label. That
 * derivation used the ARTIFACT's structural coefficients — the shape this module
 * computes — so signal and anchors are derived on one quantity, and the
 * base-shape swap needed no re-anchor: re-deriving them from the coefficients
 * rather than from the recorder's stored estimate returns Youden-optimal 1.30
 * and smallest zero-FPR threshold 1.90 at 150k. On the V1 shape the same corpus
 * asks for 3.00 / 3.40 instead, which is the other half of why the deviation had
 * to go.
 *
 * The sweep was scored with the pace blend switched on, and the blend is now
 * gone — but that does NOT re-stale the pair: the pace-free arm of the same
 * corpus picks the same 1.25 (J 0.852 there, against 0.815 with the blend), so
 * the blend moved the tail and never the anchor. See
 * `DEADLINE_MARGIN_FULL_PRESSURE`.
 *
 * The Phase 1a brackets (no-pressure endpoint 1.5/3/4/6 = -2.60/-2.89/-0.06/
 * -0.11 against 2.0) were taken on the V1-shaped signal and are STALE by the
 * stale-sweep rule — a neighbouring mechanism changed what the constant means,
 * and the ramp now engages three to seven times as often at 750k. Re-bracketing
 * the pair on the corrected signal is filed work, not a blocker: the corpus
 * derivation and the shipped pair agree to the rounding. The re-bracket runs
 * through `LR_STUDY_DEADLINE_NO_PRESSURE` / `LR_STUDY_DEADLINE_FULL_PRESSURE`
 * (see `deadlineMarginAnchors`), which is why those exist.
 *
 * They are TWO and not three by design: one point where the response saturates
 * and one where it starts. A third anchor at `margin < 1` shipped with Phase 1a
 * for the online-continuation lane alone and is gone — see
 * `underFullDeadlinePressure`.
 */

import type { Gap } from "../types.ts";
import { compileScopedEnv } from "../env_flags.ts";
import {
  BUDGET_ESTIMATOR_MODEL,
  BUDGET_ESTIMATOR_TRAVERSAL_MODEL,
  budgetEstimateInterval,
  budgetEstimatorStructuralScale,
  estimateRemainingBudgetWork,
  structuralRemainingWork,
} from "./budget_estimator.ts";

/*
 * TOMBSTONE — the episode-pace term (removed 2026-08-04).
 *
 * For one era this module kept a LOCAL COPY of the estimator artifact with
 * `paceSchedule` forced from the artifact's `"none"` to `"linear_progress"`,
 * plus a load-time assert guarding that override and an `LR_STUDY_PACE_WEIGHT`
 * knob to re-price it. All four are gone and the term with them. The argument
 * for it was real and is worth keeping legible, because it is the argument any
 * proposal to bring it back will make again:
 *
 *   the structural coefficients are a regression over spec STRUCTURE, so on a
 *   spec that costs two or three times the fitted rate per contact they
 *   under-predict for the whole compile and the margin reports "on course"
 *   while the search grinds. `episode_pace` — this compile's own charged
 *   frames per unit of structural progress, projected over the suffix it has
 *   left — is the cheapest available correction, and it is the LOWEST-error
 *   estimator component at 75k (9.3%), 150k (8.8%) and 300k (6.2%).
 *
 * The price on record that bought it (-21.6 on the capability stratum, recovered
 * to -0.8) was taken on the V1-SHAPED base, where the structure under-predicted
 * by roughly the amount pace had to make up. Under the artifact shape the base
 * is ~2.7x larger at a root node, and re-priced there the term is worth nothing:
 *
 *   - 750k, 44 sources x 8 seeds (352 paired cells): weight 0 = **-0.016 +/-
 *     0.381**; weight 0.5 = +0.113 +/- 0.273; weight 1.5 = -0.149 +/- 0.176. It
 *     bites at all on only 83 of 352 cells (23.6% of tracks).
 *   - 250k, the budget the keep-argument reserved — STABLE-40 x 40 seeds =
 *     **-0.224 [-1.051, +0.578]** suite-weighted, both pre-registered clauses
 *     pass: **DECIDED-SUPPORTED**. Whole-suite 250k consequence -1.25
 *     [-3.11, +0.65]. The term is ACTIVE there, not inert: it changes 55.4% of
 *     tracks.
 *   - the knife-edge completions that argument was really about were ledgered
 *     separately at 240 frontier seeds: rescued 155 / lost 175, rescue share
 *     0.470 [0.417, 0.524], p=0.296 — **a seed lottery the term reshuffles
 *     without winning or losing.**
 *   - 150k colour: null.
 *
 * And the premise INVERTED under measurement. The term was kept because pace
 * would add pressure where structure was optimistic; at 250k — the budget where
 * it is most active — the pace estimate sits BELOW the structural base and
 * RELIEVES pressure instead. (At 150k it does add pressure, as predicted, and
 * still does not pay.) So the surviving reading is not "free to keep at 750k,
 * load-bearing lower down": it was measured at both budgets it was reserved
 * for, and at the more active one it runs against its own argument.
 *
 * Do not re-derive this term from the accuracy table above. `episode_pace`
 * being the lowest-error COMPONENT is the fact that motivated it, and it is
 * still true; it is not evidence, because two budgets of paired compiles now say
 * the margin's consumers do not convert that accuracy into score. Re-opening
 * needs NEW evidence: a consumer that reads the margin differently, or a budget
 * regime below 150k that nothing here has measured.
 *
 * Methodology fact that came out of the same work, cheap to lose and expensive
 * to rediscover: an 8-seed 250k panel reading of a margin-side knob is NOT
 * reproducible — two independent 8-seed halves straddled both decision bars.
 * 250k evidence panels for this coordinate need >= 40 seeds.
 *
 * The observation side was deliberately NOT touched; see the policy/telemetry
 * boundary section in the module header for exactly what stayed and why.
 */

/**
 * Full deadline pressure at and below this margin.
 *
 * Youden-optimal completion gate over the 150k sweep: J = 0.815 at 1.25,
 * against 0.717 at 1.5, 0.541 at 1.0 and 0.444 at 1.75 (and `pacedSlack`'s
 * best, 0.806 at its own 1.0). It is also where the population the old rule
 * called "behind" sits: observations with `pacedSlack < 1.0` have median
 * margin 1.27. That sweep was scored with the episode-pace blend on; the
 * pace-free arm of the same corpus — which since 2026-08-04 IS the shipped
 * signal — puts its maximum at the same 1.25 (J 0.852 there). The blend moved
 * the tail and never the anchor, which is why removing it left this constant
 * where it was.
 */
export const DEADLINE_MARGIN_FULL_PRESSURE = 1.25;

/**
 * No deadline pressure at or above this margin.
 *
 * The smallest round margin at which the 150k sweep records a false-positive
 * rate of exactly **0.000** — not one observation belonging to a compile that
 * never completed lies above it (1.75 still holds 0.3% of them and 1.5 holds
 * 2.9%). No measured deadline risk, so no deadline pressure. The resulting ramp
 * width, 0.75, is independently the old ramp width carried across by units:
 * 0.5 in paced-slack units times the 150k median ratio 1.65/1.06 = 0.78.
 *
 * Measured engagement `P(margin < 2.0)` over the archived panels, for the shape
 * this module computes: 75% at 75k, 71% at 150k, 49% at 300k, 19% at 750k, 10%
 * at 1.5M, 7% at 2.25M. That is a far flatter budget profile than the ramp it
 * replaces (100% / 12.5% / 2.3% at 150k / 300k / 750k) — deliberately: the old
 * profile was `pacedSlack`'s unit drift, not a statement about deadlines, and a
 * scale-free signal cannot reproduce it. The mechanism is consequently LIVE at
 * 750k, where it used to be effectively absent.
 *
 * Those are OBSERVATION-weighted over the recorder's panels. The population a
 * consumer sees is different and denser: over pre-completion pool builds on the
 * capability sources at 750k the ramp engages on 64.3% of builds and saturates
 * on 32.6%.
 */
export const DEADLINE_MARGIN_NO_PRESSURE = 2;

/**
 * STUDY-ONLY re-bracket of the two anchors above.
 *
 * The pair was derived once, on the 150k sweep, and the neighbourhood has moved
 * three times since: the base swapped from V1-shaped to the artifact shape (the
 * header's decision section), the post-completion margin validity fix landed
 * (`handoff.ts` supplies `costToEnd` at adoption), and the depth-1 promotion
 * changed what the head ramp is narrowing. The module header already files the
 * pair as STALE by the stale-sweep rule. These two variables are how that
 * re-bracket is measured without editing a constant per arm.
 *
 * Both REFUSE rather than clamp — an arm that silently ran at the shipped pair
 * because its env said `two` is worse than no arm — and the pair is refused
 * when it is degenerate (`full >= no` inverts or collapses the ramp, and
 * `deadlinePressure` would divide by zero or by a negative width).
 *
 * Unset/empty is exactly the shipped pair, so production is byte-identical.
 *
 * RE-BRACKETED 2026-08-04 on the corrected signal, at 44 sources x 8 seeds x
 * 750k (352 paired cells per arm), six pairs. **Every arm is a measured null**
 * — largest |t| = 1.20, and the 95% interval of the best arm
 * (2.5/1.5, +0.245 +/- 0.650) excludes nothing worth having:
 *
 *     1.75/1.25  -0.294 +/- 0.414   2.0/1.0   -0.762 +/- 0.760
 *     2.5 /1.25  +0.068 +/- 0.630   2.0/1.5   -0.034 +/- 0.333
 *     3.0 /1.25  -0.876 +/- 0.729   2.5/1.5   +0.245 +/- 0.650
 *
 * The dose is real and large — pre-completion ramp engagement walks
 * 15.3% -> 23.6% (shipped) -> 46.5% -> 60.1% of pool builds across
 * NO = 1.75/2.0/2.5/3.0, and full-pressure saturation walks 0.01% -> 0.28% ->
 * 1.96% across FULL = 1.0/1.25/1.5 — so this is not a knob that failed to move
 * anything. The finding is that **the pre-completion consumers are insensitive
 * to it in aggregate at 750k**: a 2.5x change in how often the ramp engages
 * costs 0.9 panel points, inside noise. The shipped pair stays, now on evidence
 * rather than on an un-re-derived 150k sweep, and the stale-sweep flag above is
 * discharged. Re-open only from a budget where the ramp is not nearly-dormant
 * (full pressure is 0.28% of pre-completion builds at 750k), i.e. 250k and
 * below, where the evidence surface is the standing low-budget reading.
 */
const readStudyNoPressure = compileScopedEnv("LR_STUDY_DEADLINE_NO_PRESSURE");
const readStudyFullPressure = compileScopedEnv("LR_STUDY_DEADLINE_FULL_PRESSURE");

/** Margin anchors in force for this compile: the shipped pair unless a study
 *  arm overrode one or both of them. */
export function deadlineMarginAnchors(): { noPressure: number; fullPressure: number } {
  const noPressure = studyAnchor(
    "LR_STUDY_DEADLINE_NO_PRESSURE",
    readStudyNoPressure(),
    DEADLINE_MARGIN_NO_PRESSURE,
  );
  const fullPressure = studyAnchor(
    "LR_STUDY_DEADLINE_FULL_PRESSURE",
    readStudyFullPressure(),
    DEADLINE_MARGIN_FULL_PRESSURE,
  );
  if (!(fullPressure < noPressure)) {
    throw new Error(
      `LR_STUDY_DEADLINE_FULL_PRESSURE (${fullPressure}) must be strictly below ` +
        `LR_STUDY_DEADLINE_NO_PRESSURE (${noPressure}): the ramp has no width otherwise ` +
        "(STUDY-ONLY; never set either in production or in an eval)",
    );
  }
  return { noPressure, fullPressure };
}

function studyAnchor(name: string, raw: string | undefined, shipped: number): number {
  if (raw === undefined || raw === "") return shipped;
  const n = Number.parseFloat(raw);
  // The window is wide on purpose: it exists to catch a typo or a unit error,
  // not to express an opinion about where the anchor belongs. A margin is a
  // ratio of frames to frames, so 0 and 10 bracket every anchor any sweep has
  // ever proposed by a factor of three on both sides.
  if (!Number.isFinite(n) || n <= 0 || n > 10) {
    throw new Error(
      `${name} must be a finite number in (0, 10] (STUDY-ONLY; never set it in production ` +
        `or in an eval), got "${raw}"`,
    );
  }
  return n;
}

/**
 * Deadline pressure in [0, 1]: 0 while the compile is comfortably on course, 1
 * once it is at or past the Youden point. One ramp, read by every consumer, so
 * "how hard is this compile pressed" has a single definition.
 */
export function deadlinePressure(margin: number): number {
  const { noPressure, fullPressure } = deadlineMarginAnchors();
  const raw = (noPressure - margin) / (noPressure - fullPressure);
  return raw <= 0 || Number.isNaN(raw) ? 0 : raw >= 1 ? 1 : raw;
}

/**
 * Whether the compile is at the ramp's full-pressure end.
 *
 * The boolean face of the same anchor the ramp saturates at, so a consumer that
 * can only be on or off (the aim-lane throttle, the online-continuation
 * dominance filter) turns on exactly where a graded consumer reaches full
 * response. There is no second, stricter alarm: `margin < 1` — "the budget left
 * no longer covers the work left" — used to be one, and it bought nothing that
 * this anchor does not already contain (its 331 firings in the instrumented
 * 150k corpus were a strict late subset of `margin <= 1.25`), while splitting
 * maximum response across two numbers made "how pressed is this compile" a
 * per-consumer question again.
 */
export function underFullDeadlinePressure(margin: number): boolean {
  return margin <= deadlineMarginAnchors().fullPressure;
}

/**
 * Live margin for one compile.
 *
 * Deterministic in (spec, seed, budget): every input is either fixed at
 * construction or a counter the search owns. The per-gap structural suffix is
 * tabulated once here — `structuralRemainingWork` allocates, and this is read
 * once per expanded node — by calling the same pure function the recorder does
 * with the same model. Both arguments are load-bearing: the function's default
 * model is a DIFFERENT regression, and taking it silently is the deviation the
 * header's decision section closed.
 */
export class CompileDeadline {
  private readonly policyBudgetFrames: number;
  private readonly anchorGapIndex: number;
  private readonly includeStartup: boolean;
  /** Law-scaled structural remaining work by gap index, startup excluded. */
  private readonly structuralByGap: readonly number[];
  /** The same at the anchor, with the one-time startup intercept still due. */
  private readonly anchorStructural: number;

  constructor(input: {
    gaps: readonly Gap[];
    durationFrames: number;
    policyBudgetFrames: number;
    /** Gap the compile starts from; 0 for an ordinary compile. */
    anchorGapIndex: number;
    /** False when resuming a snapshot: the startup cost is already paid. */
    includeStartup: boolean;
  }) {
    const scale = budgetEstimatorStructuralScale(input.policyBudgetFrames);
    const table: number[] = [];
    for (let gap = 0; gap <= input.gaps.length; gap++) {
      table[gap] = scale * structuralRemainingWork(
        input.gaps,
        input.durationFrames,
        gap,
        false,
        BUDGET_ESTIMATOR_TRAVERSAL_MODEL,
      );
    }
    this.policyBudgetFrames = Math.max(0, input.policyBudgetFrames);
    this.anchorGapIndex = clampGap(input.anchorGapIndex, input.gaps.length);
    this.includeStartup = input.includeStartup;
    this.structuralByGap = table;
    this.anchorStructural = scale * structuralRemainingWork(
      input.gaps,
      input.durationFrames,
      this.anchorGapIndex,
      input.includeStartup,
      BUDGET_ESTIMATOR_TRAVERSAL_MODEL,
    );
  }

  /**
   * The margin at a search position.
   *
   * `gapIndex` is the traversal's own position: the deepest gap it has reached
   * before first completion (the compile is racing to the end and its high
   * water is what is left to cover), the node's own gap afterwards (repair and
   * resumed passes restart from an anchor, so the compile-global high water has
   * nothing left to say about how far THIS pass is from the end).
   *
   * `costToEnd` is the incumbent's measured frames-from-gap-k-to-completion
   * profile — the same array repair sizes its ceilings from. Once it exists it
   * IS the evidence, so the estimator prefers it over the structural suffix
   * exactly as the recorder does.
   *
   * The estimator is called with the artifact as written — `pace: null`, and so
   * `progressFraction` is inert — which makes the denominator ONE term in each
   * phase: `structural * correctionWithoutPathFactor` before first completion,
   * `measured * correctionWithPathFactor` after it. The compile's own spend
   * therefore reaches the margin through the NUMERATOR only. It used to reach
   * the denominator too, as an episode-pace blend; see the tombstone above the
   * anchors for the measurement that removed it.
   *
   * Returns `Infinity` at a position with no work left, so a terminal node
   * reads as unpressed rather than as maximally behind.
   */
  marginAt(input: {
    spentFrames: number;
    gapIndex: number;
    costToEnd: readonly number[] | null;
  }): number {
    const { work } = this.remainingWorkAt(input.gapIndex, input.costToEnd);
    return this.marginForWork(input.spentFrames, work);
  }

  /**
   * Conservative start-of-suffix margin for a policy that deliberately rewinds
   * traversal. The ordinary deadline signal stays on the point estimate above;
   * this admission face applies the estimator artifact's start-event upper
   * interval to the concrete target gap, matching the uncertainty convention
   * used to size repair attempts.
   */
  conservativeMarginAt(input: {
    spentFrames: number;
    gapIndex: number;
    costToEnd: readonly number[] | null;
  }): number {
    const { work, pathAvailable } = this.remainingWorkAt(input.gapIndex, input.costToEnd);
    const upper = budgetEstimateInterval(work, {
      event: "start",
      pathAvailable,
    }, BUDGET_ESTIMATOR_MODEL).upper;
    return this.marginForWork(input.spentFrames, upper);
  }

  private remainingWorkAt(
    gapIndex: number,
    costToEnd: readonly number[] | null,
  ): { work: number; pathAvailable: boolean } {
    const gap = clampGap(gapIndex, this.structuralByGap.length - 1);
    const structural = this.includeStartup && gap === this.anchorGapIndex
      ? this.anchorStructural
      : this.structuralByGap[gap];
    const measured = costToEnd?.[gap];
    const pathAvailable = measured !== undefined && measured > 0;
    // The model is named explicitly for the same reason
    // `BUDGET_ESTIMATOR_TRAVERSAL_MODEL` is above: this argument also has a
    // default, and this module already spent one era computing a signal it did
    // not document because it took one. `pace: null` leaves `progressFraction`
    // inert — the estimator reads it only to weight a pace that is not there.
    return {
      work: estimateRemainingBudgetWork({
        structural,
        path: pathAvailable ? measured : null,
        pace: null,
        progressFraction: 0,
      }, BUDGET_ESTIMATOR_MODEL),
      pathAvailable,
    };
  }

  private marginForWork(spentFrames: number, work: number): number {
    if (!(work > 0)) return Infinity;
    return Math.max(0, this.policyBudgetFrames - spentFrames) / work;
  }
}

function clampGap(value: number, gapCount: number): number {
  const integer = Number.isFinite(value) ? Math.floor(value) : 0;
  return Math.max(0, Math.min(integer, gapCount));
}
