# Compiler Goals and Acceptance Criteria

The v0 compiler maps a human-authored `Spec` to a Line Rider `TrackJson`.
The rebuild changes only the search/optimization process. The lr-core engine,
detector, `Spec` and `DriftReport` shapes, hard contact contract, axis list,
axis measurements, golden specs, and output track shape remain fixed.

## Properties

1. **Monotonicity in compute.** For a fixed `(spec, seed)`, increasing the
   deterministic work budget must never lower contract-gated axis quality.
   Contract-gated quality is `0` for hard-contract failures and
   `axis_quality` for valid tracks.
2. **Wall-clock predictability.** Work units must correspond to approximately
   constant wall-clock cost across specs and seeds. The target coefficient of
   variation for `wall_ms / work_units` is `< 0.25` on a stable machine.
3. **Cheat-resistance.** The work unit must be tied to an externally
   observable engine operation. A future optimizer cannot do more physical
   search per unit without paying proportional wall-clock cost.
4. **Determinism.** The same `(spec, seed, budget)` must produce
   hash-identical `TrackJson` output across repeated runs.

## Acceptance

- CI/representative monotonicity: at least three representative specs, three
  seeds, and three budgets must be non-decreasing in contract-gated quality
  within a tolerance below 1%.
- Acceptance sweep: full golden suite x seeds `[0,1,2,3,4]` x budgets
  `[0.25,0.5,1.0,1.5] * budgetFor(spec)` must have zero monotonicity
  violations.
- Work-unit predictability: representative and full sweeps report
  `wall_ms / work_units`; acceptance requires CV `< 0.25` on the stable
  measurement machine.
- Cheat-resistance: the design audit must confirm that `work_units_used`
  increments at the lr-core trajectory extraction boundary and that all
  physical candidate validation is metered there.
- Determinism: representative budgeted compiles must hash-identically repeat.
- Baseline parity: default-budget LDS must stay within 5% of
  `baselines/greedy_v1.json` and match or exceed legacy contract-pass count
  for every golden spec before legacy removal.

## Non-goals

The rebuild does not add new axes, spec features, contact semantics, detector
behavior, physics behavior, or golden specs. It does not target a specific
absolute score; matching the frozen baseline within tolerance is the migration
bar.
