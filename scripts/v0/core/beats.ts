/**
 * Beat authoring helpers — co-author the WHEN (timing) and the HOW-HARD (impact)
 * of landings in one place, in the spec file, without duplicating timing.
 *
 * A `Contact` is the beat (`{ t, impact? }`). Two complementary authoring modes:
 *
 *   1. `beats([...])` — a literal beat list with FINE per-beat control: every beat
 *      carries its own impact inline. Use when each landing is hand-tuned.
 *
 *   2. `withImpact(contacts, rule)` — decorate an existing beat list (e.g. onsets
 *      loaded from a `beats/*.json` file, or an inline grid) with impact BY RULE,
 *      a scalar or a function of `(t, index, count)`. The timing stays single-
 *      sourced from `contacts`; only the impact is added. Composes with the
 *      JSON-load + map pattern and with inline loops.
 *
 * Both clamp impact into [0, 1] (the absolute authored range; see `Contact.impact`).
 * These are pure functions in the style of `core/curves.ts` — no compiler state,
 * no effect on determinism or the evaluator fingerprint.
 */

import type { Contact } from "../types.ts";
import { normImpact, CALIB, impactEnvNum } from "../types.ts";
import { clamp } from "./substrate.ts";

/** A per-beat impact: a constant, or a function of (time s, index, beat count).
 *  The function may return `undefined` (e.g. a `core/curves.ts` `Curve` used as a
 *  rule) to leave that beat untargeted. */
export type ImpactRule = number | ((t: number, index: number, count: number) => number | undefined);

/**
 * Build a beat list from literal `{ t, impact? }` entries (fine per-beat control).
 * Impact, when present, is clamped to [0, 1]; a beat without impact is left
 * untargeted (scored/measured exactly like a plain `{ t }` beat). The list is
 * returned in the given order — sort by `t` yourself if the source isn't ordered
 * (the compiler sorts contact frames internally regardless).
 */
export function beats(list: Array<{ t: number; impact?: number }>): Contact[] {
  return list.map((b) =>
    b.impact === undefined ? { t: b.t } : { t: b.t, impact: clamp(b.impact, 0, 1) }
  );
}

/**
 * Attach impact to an existing beat list by rule, preserving each beat's timing
 * (and any other fields). `rule` is either a constant impact for every beat, or a
 * function `(t, index, count) => impact`. Returned impact is clamped to [0, 1]; a
 * rule that returns a non-finite value leaves that beat untargeted.
 *
 * Example — ramp impact up through a chorus without re-listing onset times:
 *   withImpact(raw.onsets.map((o) => ({ t: o.t })),
 *              (t) => (t < 38 ? 0.15 : t < 58 ? 0.6 : 0.3))
 */
export function withImpact(contacts: Contact[], rule: ImpactRule): Contact[] {
  const count = contacts.length;
  return contacts.map((c, i) => {
    const raw = typeof rule === "function" ? rule(c.t, i, count) : rule;
    if (raw === undefined || !Number.isFinite(raw)) {
      const { impact: _drop, ...rest } = c;
      return { ...rest };
    }
    return { ...c, impact: clamp(raw, 0, 1) };
  });
}

/**
 * Migrate an OLD-convention authored impact (the pre-redirArc scale, felt-"soft"≈0.2 under
 * `redir/REDIR_CAP`) onto the new redirArc felt scale [0,1]. Two schemes (`LR_IMPACT_MIGRATE`):
 *
 *  - **"affine"** (the recommended re-bake): `a_new = clamp01((a_old − SOFT_OLD)/SPAN_OLD)`, i.e. just
 *    align the conventions — old-soft 0.2 → new-0 (soft), old-hard 0.85 → 0.81. This is a pure,
 *    monotone, rank-preserving convention shift that is **independent of the felt anchors**, so the
 *    achievable-range calibration (SOFT/VSTRONG) can be tuned freely without re-crushing the specs. It
 *    does NOT saturate (old-median 0.45 → 0.31, medium).
 *  - **"legacy"** (default, the `·REDIR_CAP` bridge): `a_new = normImpact(a_old · REDIR_CAP)`. Requests
 *    the same physical px the old value asked for — but it re-normalizes through px with the LIVE
 *    anchors, so under the (lower) achievable anchors it OVER-SATURATES (everything ≥~0.45 → 1.0). Kept
 *    only for A/B against affine; to be deleted once the affine re-bake is frozen on disk.
 */
// Affine convention shift is now the DEFAULT (anchor-independent (a−0.2)/0.8). `LR_IMPACT_MIGRATE=legacy`
// restores the old `normImpact(a·REDIR_CAP)` bridge for A/B only. The on-disk spec values are the
// ORIGINAL old-convention numbers; this transforms them once at load — there is no frozen-literal bake,
// so re-running never double-applies.
const MIGRATE_AFFINE = ((globalThis as { process?: { env?: Record<string, string | undefined> } })
  .process?.env?.LR_IMPACT_MIGRATE) !== "legacy";
const MIGRATE_SOFT_OLD = impactEnvNum("LR_IMPACT_MIGRATE_SOFT", 0.2);
const MIGRATE_SPAN_OLD = impactEnvNum("LR_IMPACT_MIGRATE_SPAN", 0.8);
export const migrateImpact = (aOld: number): number =>
  MIGRATE_AFFINE
    ? clamp((aOld - MIGRATE_SOFT_OLD) / MIGRATE_SPAN_OLD, 0, 1)
    : normImpact(aOld * CALIB.REDIR_CAP);

/**
 * `withImpact` for the pre-redirArc spec corpus: the rule outputs OLD-convention values which are
 * migrated to the new felt scale at authoring time (`migrateImpact`). Existing golden specs use
 * this so their on-disk numbers stay readable while the resolved targets are new-convention; new
 * specs use `withImpact` directly (no migration). Keeps the bake on-disk, not a runtime remap.
 */
export function withImpactLegacy(contacts: Contact[], rule: ImpactRule): Contact[] {
  const migrated: ImpactRule = typeof rule === "function"
    ? (t, i, count) => {
        const r = rule(t, i, count);
        return r === undefined || !Number.isFinite(r) ? r : migrateImpact(r);
      }
    : migrateImpact(rule);
  return withImpact(contacts, migrated);
}
