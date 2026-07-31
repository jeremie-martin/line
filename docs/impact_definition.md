# Impact — current definition

This is the current, concise definition of author-facing `Contact.impact`.
`docs/impact_contract.md` expands the authoring, feasibility, scoring, and
generation contract; historical metric campaigns live under `docs/archive/`.

## Production quantity

Impact is the landing's accumulated contacted-frame redirection impulse:

`cArc = Σ v̄ · |Δθ|`

For each step, `Δθ` is the wrapped change in the rider's center-of-mass velocity
heading and `v̄` is the arithmetic mean of the two endpoint speeds. Units are
px/frame.

The production implementation is
`contactRedirArcPxAtLanding` in `scripts/v0/core/substrate.ts`. Its exact frame
contract is:

- Incoming velocity is read at `landingFrame - 1`, falling back to
  `landingFrame`. If neither exists, the result is unavailable.
- Steps ending at frames `landingFrame` through
  `landingFrame + IMPACT_WINDOW` are considered, inclusive, and truncated at
  the detection's last measurement. With `IMPACT_WINDOW = 6`, this is the
  touchdown step plus the six following frame intervals; the post-touchdown
  horizon is about 150 ms at 40 fps.
- A step contributes only when its ending frame is contacted
  (`airborneAt(frame) === false`). Airborne path bending is flight, not impact.
- `prev` still advances across a valid airborne sample. Therefore flight
  bending is not charged later to a re-contact.
- A missing in-window velocity contributes nothing and leaves `prev` at the
  last valid sample; the next valid step bridges from that sample.
- Each contributing step uses
  `0.5 × (|v_prev| + |v|) × |wrap(heading(v) - heading(v_prev))|`.
- Detection frame offsets are handled by the shared measurement accessors;
  callers pass absolute event frames.

These details are scored semantics, not incidental loop structure. Tests pin
the landing anchor, inclusive right boundary, midpoint speed, airborne
advancement, missing samples, truncation, and offset behavior.

## Felt ruler

`normImpact` maps the raw impulse to the authored/scored felt scale:

`clamp01((raw - IMPACT_RULER.SOFT) / (IMPACT_RULER.VERY_STRONG - IMPACT_RULER.SOFT))`

Shipped defaults:

| anchor | raw impulse | author-facing meaning |
|---|---:|---|
| `SOFT` | 0 | perfectly smooth; no path bending |
| `VERY_STRONG` | 7.55 | very strong; harder hits saturate at 1 |

The [0,1] ruler is a felt/compatibility scale, not the complete physical range.
Reliable physics extends above 7.55 px/frame. `impactCeiling(actualSpeed)`
reports the catchable diagnostic ceiling; it does not redefine or clamp the
authored target.

`IMPACT_METRIC` carries the versioned production identity used by preview
payloads. A change to the raw formula, window, or anchors is a ruler change and
must bump its version and the evaluator fingerprint.

## Why this quantity

- Accumulation makes bend-then-unbend and bounce contacts add instead of
  cancelling to zero.
- Contact gating excludes gravity's ballistic path bending structurally.
- Midpoint speed prevents a near-instant velocity reversal from manufacturing
  a large impulse solely through a π-sized heading flip.
- CoM velocity avoids surface-faceting, sled-rotation, and limb-whip artifacts.
- Speed weighting preserves the distinction between a slow turn and a slam at
  the same angle.
- Parallel slowdown on a straight path has no heading change and therefore no
  impact.

The promotion was deliberate. Across the discriminating felt-label sets,
accumulated `cArc` was at least as rank-consistent as the retired net form and
resolved the observed cancellation cases. Calibration on the labeled,
production, and Benchmark V2 inventories produced a flat compatibility valley
for `VERY_STRONG` around 7.3–7.9; 7.55 is the combined-corpus choice. The
reliable-turn study supports `IMPACT.MAX_RELIABLE_TURN_RAD = 1.0`.

## Legacy policy

Production has one impact measurement and no legacy fallback:

- Scoring, reports, inspection, landing probes, overlays, and post-effects use
  `contactRedirArcPxAtLanding` → `normImpact`.
- The production overlay schema is `line-overlay/v2`; contacts expose
  `impactMeasured` and `impactRawPxPerFrame`, plus target/error fields.
- The renderer and effects do not read retired `impact`, `impactRedir`,
  `impactWindow`, or candidate fields.

Retired formulas may remain only in `scripts/v0/impact_support.ts` for explicit
analysis. Their exports begin with `legacy`, and the old net formula uses its
own frozen 0/7.29 ruler. `build_impact_study.ts` shows only the current metric
by default; `--include-legacy` opts into the historical comparison. A legacy
raw value must never be normalized with `IMPACT_RULER`.

Authored-target and fixture compatibility are separate from metric fallback:

- The 2026-07-31 metric promotion does not migrate current-convention
  `Contact.impact` targets. Their normalized values remain unchanged; the new
  raw formula and calibrated raw anchors preserve the felt contract.
- `withImpactLegacy` is a separate, explicit opt-in for source values that
  predate the current felt convention. It applies one anchor-independent
  affine conversion while constructing the spec. It does not rewrite source
  values and is never called by the scorer, optimizer, report, or preview.
  The retired physical-pixel migration switch is gone.
- Frozen post-impact study fixtures retain historical serialized property
  names such as `redirArcSoftPxPerFrame`; current code accesses those fixtures
  through formula-neutral helpers.

None of these compatibility details changes what production measures.

## Evidence and tools

The decision evidence is preserved by the analysis harnesses and
`labels/impact/` ground truth:

- `study_impact_impulse.ts`: felt-rank comparison and divergence adjudication.
- `study_catchability_atlas.ts`: reliable turn and physical envelope.
- `study_impact_perceptual_curve.ts`: linear-vs-isotonic ruler shape.
- `study_impact_scale_audit.ts` and
  `study_impact_benchmark_validation.ts`: compatibility and inventory checks.
- `tests/v0_impact.test.ts`: production loop and ruler semantics.
- `tests/overlay_impact.test.ts`: current-only presentation/effects contract.

Run `npm test -- --run tests/v0_impact.test.ts tests/overlay_impact.test.ts` for
the focused semantic checks.
