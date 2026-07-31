# Impact mission

The foundation is now a single end-to-end production contract:

`Contact.impact` → `impactToRawPx` → compiler geometry →
`contactRedirArcPxAtLanding` → `normImpact` → score/report/preview.

The current quantity is the accumulated contacted-frame redirection impulse
`Σ v̄·|Δθ|`; the felt ruler is `IMPACT_RULER` (shipped defaults 0 / 7.55).
The exact semantics and evidence live in:

- `impact_definition.md` — concise formula, frame contract, ruler, and legacy
  policy.
- `impact_contract.md` — full authoring, feasibility, scoring, generation, and
  test contract.

## Ongoing mission

Future impact work should improve delivery of the existing authored intent,
especially the under-delivered middle ask bands, without changing the ruler by
accident or sacrificing other axes.

Every change must preserve these boundaries:

1. Production has one metric. Scoring, reports, inspection, previews, and
   effects all consume the current contact-redirection impulse.
2. Resolved, current-convention authored targets are absolute and unmodified.
   The metric promotion does not migrate them. The explicit
   `withImpactLegacy` helper converts only opted-in older source values while
   constructing a spec. Feasibility and actual-speed ceiling are diagnostics,
   not score forgiveness.
3. Retired formulas are analysis-only, explicitly named `legacy...`, and use
   their own frozen normalization. No production fallback may read them.
4. Serialized historical fixtures may retain old field names, but current code
   accesses them through formula-neutral adapters.
5. A change to the formula, window, or ruler is deliberate: update
   `IMPACT_METRIC.version`, evaluator fingerprint, tests, and both current docs.
6. Compiler changes are judged with the established benchmark governance and
   the non-impact headline; historical run totals are not copied into this doc.

Focused semantic checks:

`npm test -- --run tests/v0_impact.test.ts tests/overlay_impact.test.ts`

The completed June net-ruler campaign is archived at
`archive/impact-mission-2026-06-15.md`.
