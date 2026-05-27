# V0 optimizer feedback notes

This captures the shared implementation direction from the two optimizer
reviews. The applied items are deliberately scoped to low-risk changes that are
easy to justify from local state and authored intent.

## Applied now

- Scorer-aligned axis cost: candidate ranking now uses equal-axis L2 error.
  Purpose: remove hidden ranking bias while preserving smooth local candidate
  ordering. Signal: targeted and achieved axis values. Scale: no regional
  weights. Risk control: hard gates still filter candidates first.

- Dense candidate budget cleanup: target-region budget buckets were replaced
  by one deterministic dense-contact cap. Purpose: remove carved-out
  target-axis regions without increasing runtime. Signal: contact density.
  Scale: existing `CALIB.K` capped by a fixed dense minimum. Risk control:
  sparse specs still use full `CALIB.K`.

- Short-gap adaptive budget: dense gaps of 0.3s or shorter may continue past
  the dense minimum until they have two validated survivors, bounded by
  `CALIB.K`. Purpose: avoid hard-gate zeros when very short contact spacing
  makes the first survivor brittle. Signal: local gap duration and candidate
  survivor count. Scale: existing candidate budget, no wall-clock input. Seed 0
  improved from `GOAL_SCORE 241.28 valid 7/8` to `542.80 valid 8/8`, primarily
  by turning `opening_burst` from one missed contact into a valid row. Full
  suite improved from `GOAL_SCORE 220.03 valid 22/24` to `372.53 valid 24/24`;
  `opening_burst` improved from `7.66 valid 1/3` to `596.62 valid 3/3`.

- Regime-free air lookahead: candidate measurement looks through the next
  contact when air is targeted and the post-contact window is large enough to
  matter. Purpose: rank catches by the air/contact balance they actually create
  after impact. Signal: air axis presence and frame spacing. Scale: frame
  windows, not target-axis boxes. Risk control: hard-gate validation is
  unchanged.

- Full final-validation retries: dense speed-only specs no longer use fewer
  final sync retries. Purpose: avoid hard-gate zeros from assembled-track
  effects. Signal: final detected sync failures. Scale: existing
  `CALIB.FINAL_VALIDATION_RETRIES`. Risk control: deterministic bounded retry
  count.

- Honest final grain reporting: `grain` is computed from final fitted line
  geometry rather than stale candidate-side achieved values. Purpose: keep the
  geometry axis tied to the finished track after polish mutates line endpoints.
  Signal: final track lines. Scale: existing grain definition. Risk control: no
  scorer or report schema changes.

## Deferred nontrivial work

- State-conditioned arc sampling and impact anchoring: replace the uniform
  sampler and `CATCH_TEMPLATES` with a single prior centered on incoming rider
  angle, speed, contact style, and desired impact fraction. This should improve
  steep catches and low-contact skips without hard thresholds. Implementation
  area: `sampleArcParams`, with helper geometry for arc local points.

- Unified parameter-space refinement: replace the scattered polish functions
  with a local search over arc parameters such as anchor, length, angles,
  segments, curve bias, and ride-out length. This keeps arc geometry as the
  source of truth and avoids detector-internal offsets in polish passes.
  Implementation area: after candidate selection, calling `tryCandidate` for
  validated perturbations.

- Feasible air bands: clamp search-only air targets to what the detector can
  physically observe for the local contact window. This prevents impossible
  low-air or high-air dense rhythms from pulling ranking away from feasible
  hard-gate solutions. Implementation area: candidate ranking target
  preparation, using detector constants and contact frame sets.

- Grain-first sampling: choose segment count first and derive arc length from
  target line length when `grain` is targeted. A direct easy implementation was
  tested, but it worsened early dense catch feasibility, so this needs to be
  combined with impact anchoring or local refinement rather than landed alone.
  Implementation area: `sampleArcParams`.

- Section residual control: compute search targets from section-level residuals
  rather than treating each gap as an independent local fit. This should help
  oscillating and monotonic section specs where the final scorer aggregates
  whole sections. Implementation area: target sampling and gap ranking state.

- Generalized ride-out and trim variants: make continuation and tail-trim
  variants available to all relevant targets, not only air-only long gaps.
  Each variant must still pass the same survival, target-landing, and off-beat
  hard gates. Implementation area: `tryCandidate` variant generation.

- One-gap lookahead robustness: cheaply probe the next gap for the top current
  survivors to avoid locally good fits that leave the next contact impossible.
  Implementation area: candidate sorting, bounded to a small deterministic
  probe budget.

- Normal-direction retiming: keep Y bisection as the first pass, then add a
  small normal/tangent/angle retime grid for steep or fast impacts. This should
  improve survivor rate without changing physical constants. A simple
  speed-scaled Y search radius was tested as an easy variant, but it made
  candidate simulation too expensive, so this needs a bounded retime grid
  instead. Implementation area: retiming around `bisectAnchorY`.

- Validated final local repair loop: replace post-hoc special-case polish with
  a final loop driven by the worst honest section residual, accepting only
  mutations that pass final hard gates and improve measured score. Implementation
  area: after full-track validation and before report assembly.

- Final contact-style honesty: recompute `contact_style` from the finished
  track and final detection. A direct contact-line-id implementation exposed
  that the current candidate-side approximation and final-track measurement are
  not equivalent, so this should land with a calibrated contact-style
  definition and repair loop rather than as a report-only swap.

- Preroll grid cleanup: align prefix scoring with the same per-gap RNG schedule
  used by the main compiler and replace discrete velocity buckets with a
  stratified polar grid around first-section intent. Implementation area:
  `choosePrerollStart` and candidate start generation.
