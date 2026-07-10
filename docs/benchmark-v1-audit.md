# Benchmark V1 Historical Audit

Status: historical audit only. Source inventory: `benchmark/v1-audit/source-inventory.json`.

This report records an earlier coverage review of all forty V1 sources. It does not
select, weight, or nominate any source for Benchmark V2. The characterization
fingerprint at the time of that review was `c769e61e11ade2f3`.

The V2 problem statement is `docs/benchmark-v2-context.md`. Any useful concept in
this audit must be independently re-authored and reviewed as a normal V2 candidate;
the V1 source itself remains outside V2.

## Disposition summary

- primary review: 0.
- rewrite candidate: 4.
- secondary candidate: 8.
- capability candidate: 3.
- collapse family: 8.
- defer: 17.

No legacy case is currently proposed for as-is headline review. Believer-derived drum variants share the same musical work as fuller development candidates; rewrite candidates are donor concepts and must not be compiled as representative V2 evidence in their current form.

## Proposed families

| Family | Provisional tier | Candidate / member count | Selection cap | Rationale |
|---|---|---:|---:|---|
| detected_drums_30s | secondary regression | 2 / 10 | 2 | All ten programs use the same detected 30s Believer onset skeleton, while fuller 56s Believer candidates now provide development evidence. Breath and crescendo remain useful opposing-axis and co-directed target diagnostics; the family must retain one total secondary allocation. |
| mixed_cadence_rewrite | primary development | 2 / 2 | 2 | These synthetic phrases contain useful mixed-gap and target-transition motifs, but they require independent musical timing before headline eligibility. |
| amplitude_cadence_rewrite | primary development | 2 / 2 | 2 | These are the strongest legacy donors for cadence-aware amplitude. Revisions should remove unneeded elevation and attach the timing and target program to reviewed music. |
| rapid_boundary_precursors | capability boundary | 3 / 3 | 3 | The cases distinguish a short 250ms opening, a longer 250ms opening, and a sustained 320ms run. They are stress precursors, not evidence that production music is dominated by rapid contacts. |
| legacy_regression_guards | secondary regression | 6 / 6 | 6 | These preserve distinct initialization, duration, amplitude, elevation, density, and irregular multi-axis failure modes without claiming representative headline weight. |

## Missing development coverage

### music derived short pickups

Reviewed musical pickups below 250ms plus isolated two- and three-contact short runs transitioning back to an ordinary pulse.

Evidence: The qualification inventory bottoms out at 294ms raw; legacy 250ms cases are synthetic and use longer sustained runs.

Next: Author from a new development-only song or percussion source, not by copying a qualification timeline.

### low air rideouts

Low-air, mostly-riding intervals at 2s, 3s, and approximately 5s, including entry and exit contacts, plus an eventual music-derived example.

Evidence: The explicit capability family now isolates all three durations. Its initial screen reaches the 2s and 3s exits but misses low-air intent and stalls before the 5s exit at every tested budget and seed.

Next: Use the capability family as a compiler mechanism gate and source an independent development song with a real rideout when available.

### independent music cadences

At least two development-only music-derived onset skeletons with subdivisions, omissions, and cadence transitions.

Evidence: All ten music-backed legacy candidates reuse one detected drum skeleton.

Next: Select independent music excerpts and freeze their timing before compiler evaluation.

### independent amplitude cadence

Music-backed amplitude intent across compact and spacious cadence in a second independent musical work, without requiring elevation scoring.

Evidence: believer_impact_56s provides this interaction for one work; the useful mixed legacy donors are synthetic and canyon_steps couples amplitude to low-priority elevation.

Next: Revise the donor concepts against a new development music source and keep elevation absent unless that track explicitly needs it.

## Legacy decisions

| Source | Disposition | Music-backed | Cadence evidence | Rationale | Required action |
|---|---|---:|---|---|---|
| drums_signature | collapse family | yes | 55 contacts; 460ms / 480ms / 1077ms min/median/max | Same detected contact skeleton as the other nine drum programs; its active target profile is covered by the family review. | Do not allocate independent cadence weight. |
| drums_pendulum | collapse family | yes | 55 contacts; 460ms / 480ms / 1077ms min/median/max | Same detected contact skeleton; extreme air isolation is less representative than the two provisional family candidates. | Keep available for targeted air diagnostics only. |
| drums_crescendo | secondary candidate | yes | 55 contacts; 460ms / 480ms / 1077ms min/median/max | Music-derived cadence with broad co-directed air, speed, and impact motion, but it is a short variant of the same Believer work as fuller development candidates. | Measure target-interaction diagnostic value without assigning independent music or headline weight. |
| dense_sprint | capability candidate | no | 41 contacts; 250ms / 500ms / 500ms min/median/max | Four consecutive 250ms opening gaps followed by ordinary 500ms cadence isolate hot-start handling. | Treat as a rapid-boundary precursor, not representative rhythm. |
| syncopated_switchback | rewrite candidate | no | 24 contacts; 350ms / 600ms / 1050ms min/median/max | A useful repeating 350/600/1050ms phrase with strong target reversals, but the timing is synthetic. | Re-author the motif from independent reviewed music. |
| opening_burst | capability candidate | no | 32 contacts; 250ms / 500ms / 500ms min/median/max | Ten consecutive 250ms gaps expose sustained rapid-contact and initialization fragility. | Keep outside the representative headline and compare against shorter music-derived pickups. |
| grain_staircase | defer | no | 39 contacts; 500ms / 500ms / 500ms min/median/max | Uniform 500ms cadence and inert grain make it redundant for V2 product coverage. | Use only for historical debugging when needed. |
| rhythm_ladder | rewrite candidate | no | 37 contacts; 300ms / 520ms / 670ms min/median/max | Mixed 300/350/520/560/670ms phrase and crossed targets are useful donor structure, but timing is synthetic. | Re-author from independent reviewed music and remove inert grain. |
| cold_start | secondary candidate | no | 15 contacts; 750ms / 750ms / 750ms min/median/max | A compact initialization guard distinct from the longer production distribution. | Measure whether it catches failures not covered by rapid-boundary cases. |
| mini_burst | defer | no | 7 contacts; 650ms / 650ms / 650ms min/median/max | Six uniform 650ms gaps provide little coverage beyond longer candidates. | Drop unless empirical failure independence is demonstrated. |
| tiny_dance | defer | no | 4 contacts; 600ms / 700ms / 700ms min/median/max | Only four contacts and no unique product cadence cell. | Retain as a smoke test, not a benchmark member. |
| solo_run | capability candidate | no | 77 contacts; 320ms / 320ms / 320ms min/median/max | Seventy-six consecutive 320ms gaps test sustained density and scaling, unlike reviewed production patterns. | Report as stress capacity and do not give it representative cadence weight. |
| verse_chorus | secondary candidate | no | 31 contacts; 780ms / 780ms / 780ms min/median/max | Longer timeline and repeated target-section changes are useful regression coverage despite uniform 780ms timing. | Measure incremental failure and runtime value. |
| drums_swell | collapse family | yes | 55 contacts; 460ms / 480ms / 1077ms min/median/max | Same detected contact skeleton; smooth co-directed motion overlaps crescendo family coverage. | Compare target-program stability only if crescendo proves noisy. |
| drums_crosscut | collapse family | yes | 55 contacts; 460ms / 480ms / 1077ms min/median/max | Same detected contact skeleton; alternating impact is a target variant, not independent rhythm evidence. | Do not allocate independent cadence weight. |
| drums_tide | collapse family | yes | 55 contacts; 460ms / 480ms / 1077ms min/median/max | Same detected contact skeleton; periodic target motion is a correlated family variant. | Do not allocate independent cadence weight. |
| drums_dropout | collapse family | yes | 55 contacts; 460ms / 480ms / 1077ms min/median/max | Same detected contact skeleton; target dropout is a correlated family variant. | Keep as a targeted fallback if family review needs a discontinuity case. |
| drums_breath | secondary candidate | yes | 55 contacts; 460ms / 480ms / 1077ms min/median/max | Opposing air, speed, and impact motion complements co-directed behavior, but it is a short variant of the same Believer work as fuller development candidates. | Measure target-interaction diagnostic value without assigning independent music or headline weight. |
| drums_pulse | collapse family | yes | 55 contacts; 460ms / 480ms / 1077ms min/median/max | Same detected contact skeleton and mostly single-axis active variation. | Do not allocate independent cadence weight. |
| drums_zigzag | collapse family | yes | 55 contacts; 460ms / 480ms / 1077ms min/median/max | Same detected contact skeleton; periodic target crossing overlaps drums_breath's interaction role. | Do not allocate independent cadence weight. |
| climb_terrace | defer | no | 15 contacts; 1000ms / 1000ms / 1000ms min/median/max | Uniform 1s elevation-only variation has low current product priority. | Run only for explicit elevation work. |
| swoop_dive | secondary candidate | no | 13 contacts; 1000ms / 1000ms / 1000ms min/median/max | Largest elevation range among the pure-elevation cases and useful historical axis coverage. | Keep outside representative headline weighting. |
| rolling_hills | defer | no | 18 contacts; 900ms / 900ms / 900ms min/median/max | Uniform 900ms elevation coverage is subsumed by the stronger swoop_dive guard. | Drop unless it shows independent failures. |
| summit_push | defer | no | 12 contacts; 1100ms / 1100ms / 1100ms min/median/max | Uniform 1.1s cadence and modest elevation range add little beyond selected secondary guards. | Drop unless it shows independent failures. |
| mixed_grade | defer | no | 17 contacts; 500ms / 1200ms / 1200ms min/median/max | Mixed cadence is useful, but its primary distinction is low-priority elevation and synthetic timing. | Borrow no timing without independent musical provenance. |
| big_air_ramp | secondary candidate | no | 13 contacts; 1300ms / 1300ms / 1300ms min/median/max | Broad air/amplitude/impact range at spacious 1.3s cadence is a useful amplitude regression guard. | Measure incremental value against revised amplitude cases. |
| pop_train | defer | no | 14 contacts; 1100ms / 1100ms / 1100ms min/median/max | Uniform 1.1s amplitude cadence is covered by stronger amplitude candidates. | Drop unless it shows independent failures. |
| soar_settle | rewrite candidate | no | 16 contacts; 700ms / 700ms / 1300ms min/median/max | Strong cadence-aware amplitude transition from 1.3s to 700ms with broad target range, but synthetic timing. | Attach the motif to independent reviewed music. |
| leap_cadence | defer | no | 12 contacts; 1200ms / 1200ms / 1200ms min/median/max | Uniform 1.2s amplitude cadence is redundant with broader amplitude guards. | Drop unless it shows independent failures. |
| float_bounds | defer | no | 14 contacts; 1200ms / 1200ms / 1200ms min/median/max | Uniform 1.2s cadence and narrower amplitude range do not justify another canonical case. | Use only for targeted bound debugging. |
| canyon_steps | rewrite candidate | no | 20 contacts; 550ms / 650ms / 1500ms min/median/max | Mixed 550ms, 1.15s, and 650ms sections couple cadence, amplitude, and impact in a useful donor pattern. | Remove incidental elevation and re-author timing from reviewed music. |
| ridge_pulse | defer | no | 24 contacts; 600ms / 600ms / 600ms min/median/max | Uniform 600ms combined-vertical cadence lacks unique product relevance. | Run only for explicit combined-axis work. |
| valley_bounce | defer | no | 15 contacts; 1100ms / 1100ms / 1100ms min/median/max | Uniform 1.1s cadence duplicates amplitude/elevation stress already represented by stronger guards. | Drop unless it shows independent failures. |
| switchback_pop | secondary candidate | no | 19 contacts; 500ms / 800ms / 1200ms min/median/max | Highest cadence entropy in the combined-vertical family and alternating impact expose irregular multi-axis regressions. | Keep secondary; elevation prevents representative promotion without revision. |
| terrace_sprint | defer | no | 23 contacts; 500ms / 600ms / 1750ms min/median/max | Its 1.75s vertical transition is superseded by the explicit 2s, 3s, and 5s low-air capability construction. | Run only for explicit combined-vertical regression work. |
| glide_stairs | defer | no | 18 contacts; 950ms / 950ms / 950ms min/median/max | Uniform 950ms combined-vertical cadence adds no distinct product rhythm cell. | Run only for explicit elevation work. |
| dense_echo_climb | secondary candidate | no | 27 contacts; 500ms / 500ms / 500ms min/median/max | Uniform dense 500ms combined-axis case is a useful regression contrast to sparse amplitude cases. | Keep outside representative headline weighting. |
| rolling_drop | defer | no | 16 contacts; 1150ms / 1150ms / 1150ms min/median/max | Uniform 1.15s combined-vertical behavior overlaps stronger amplitude and elevation guards. | Drop unless it shows independent failures. |
| skyline_push | defer | no | 18 contacts; 700ms / 700ms / 1700ms min/median/max | Its 1.7s transition is subsumed by terrace_sprint as the long-interval precursor. | Do not duplicate the capability-boundary allocation. |
| syncopated_lift | defer | no | 20 contacts; 500ms / 850ms / 950ms min/median/max | Synthetic irregular timing is less representative than rewrite donors and remains elevation-coupled. | Drop unless it shows independent failures. |

## Empirical gate

After musical review and rewrites, freeze a development-only candidate manifest. Then measure simulated-frame cost, validity, seed variance, and component-level failure independence on that candidate set. Those results determine which secondary guards earn execution time and how many members each family needs; duration and contact count remain diagnostics rather than automatic weights.

Qualification references remain excluded from these compiler experiments.
