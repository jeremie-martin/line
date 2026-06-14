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
import { normImpact, CALIB } from "../types.ts";
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
 * `redir/REDIR_CAP`) onto the new redirArc felt scale, by requesting the SAME physical redirArc
 * the old value asked for: `a_new = normImpact(a_old · REDIR_CAP)`. This is the convention rescale,
 * applied ONCE at authoring (no runtime remap). New specs author natively on the new scale.
 */
export const migrateImpact = (aOld: number): number => normImpact(aOld * CALIB.REDIR_CAP);

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
