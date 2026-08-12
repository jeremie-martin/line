# Compile budget telemetry V7

## Contract

`compileHandoff(..., { budgetTelemetry })` emits the authoritative account of
compiler search work:

- `off`: `budgetTelemetry` is `null`;
- `summary`: compile, interval, episode, estimator, work, and lineage records;
- `trace`: the summary payload plus estimator observations and atomic node
  events.

The schema is `line.compile-budget-telemetry.v7`. Readers accept that exact
schema only. V1–V6 archives are historical evidence with different attempt,
identity, repair-selection, or target-attribution semantics; a reader must not
rename their fields or fall back to `compile_stats`.

Telemetry is observation-only. Changing `off`, `summary`, or `trace` must not
change RNG state, physics work, search order, selected geometry, reports, or
compiler stats.

## Budget domains

- `hard_budget_frames`: outer execution budget requested by the caller.
- `policy_budget_frames`: budget exposed to general compiler policy.
- `search_policy_budget_frames`: budget exposed to search-shape policy.
- `repair_budget_frames`: compile-global ceiling available to repair.
- `allocated_frames`: one episode's ceiling minus its start work.
- `total_spent_frames`: charged simulation work actually performed.
- `hard_overrun_frames`: atomic work beyond the hard budget. Work already
  admitted is allowed to finish; this is measured explicitly.
- `episode_overrun_frames`: atomic work beyond an episode's local ceiling.

Policy budget is not hard budget. An experiment that varies one while holding
the other fixed must retain both values.

The compile identity is exact:

```text
hard budget + hard overrun = total spent + hard remaining
```

## Lane, episode, and interval

A lane says which control-flow owner received the work:

- `initial`: normal first search;
- `snapshot`: search resumed from an externally supplied prefix snapshot;
- `repair`: post-first-completion improvement work;
- `resumed`: the original initial frontier after repair releases unused budget.

An episode is one bounded execution allocation. It owns one lane, parent,
anchor, seed when applicable, ceiling, estimator state, work funnel, register
state, and outcome. A repair episode also owns one complete `repair_decision`:
iteration and incumbent revision, remaining and usable budget, explicit
headroom, the named selection policy, every target×anchor option in the declared
option universe, affordable target and anchor sets, selected target and SSE,
actual parent depth/anchor, mutable-suffix SSE, cost estimates, and cost source.
The selected target has three distinct states: `incumbent_target_gap_before`,
`terminal_offer_target_gap`, and `incumbent_target_gap_after`. The last is the
post-register incumbent and must never be interpreted as the rejected offer.
Each non-null target observation has an explicit `status`: `measured` carries
axis state and SSE, while `missing` means that a terminal track lost the
selected gap's ending contact. `terminal_offer_target_gap: null` means no
terminal was reached; it never means a terminal with an unreported target.
Missing targets remain in terminal-offer rate denominators and count as not
improved. Numeric SSE aggregates use only measured observations and report the
missing population separately.
The payload replays the declared selection law exactly. There is no hidden
controller mode or failed-anchor state to infer from episode order.

The production selection policy is `worst_gap_deepest_affordable`: rank target
weakness among targets with an affordable anchor, then use that target's deepest
affordable parent up to maximum depth `6`. Headroom is `0`. Diagnostic arms use
`LR_REPAIR_MAX_PARENT_DEPTH`, `LR_REPAIR_HEADROOM_FRACTION`, and the categorical
`LR_REPAIR_SELECTION_POLICY=suffix-opportunity-per-cost` or
`LR_REPAIR_SELECTION_POLICY=max-suffix-opportunity`. The former chooses the
affordable anchor maximizing total incumbent SSE in its mutable suffix per
estimated point-cost frame; the latter maximizes that suffix SSE directly.
Both record the worst target in the selected suffix. Their
`parent_depth` is descriptive target-to-anchor distance and can exceed the
option-generation radius. One iteration chooses one anchor and executes it
once—there is no ancestor fallback chain or remembered tried-anchor state.

The additional diagnostic law
`LR_REPAIR_SELECTION_POLICY=max-local-window-opportunity` stays within the
declared target×anchor option radius. It chooses the affordable pair maximizing
summed incumbent SSE from its anchor through its target, then uses that anchor
for the ordinary suffix rebuild.

An execution interval accounts for wall-to-wall charged compiler work such as
startup, initial search, frontier repair, resumed search, or
finalization. Intervals form a contiguous partition of total charged work in a
closed payload. They answer where frames went; episodes answer which search or
repair allocation caused outcomes.

## Work populations

The work funnel deliberately keeps different populations separate.

### Proposal and candidate work

- `ranked_option_calls`: exact `rankedOptions` proposal/ranking calls, including
  primary frontier, rescue, and tail-completion calls. It is not a claim that
  the normal candidate prefix was freshly sampled:
  a call may reuse that memoized prefix while still ranking, rolling out, and
  running extra streams. Reports label it **ranked-option pool calls**.
- `requested_normal_proposals`: sum of resolved normal-stream `nCand` requests.
  This is the requested breadth population. It is not configured lane width,
  actual sampling, viable candidates, children, or nodes.
- `actual_candidate_samples`: all candidate samples actually attempted across
  sample modes. It can differ from requested normal proposals because other
  streams and internal sampling mechanics also produce samples.
- `candidate_samples_by_stream`: exact attribution of actual evaluated candidate
  geometries to `normal`, `brake`, `startup_catch`, and any future explicitly
  named stream. Optional sibling geometries count in both the total and the stream
  that evaluated them.
- `viable_candidates`: actual samples that passed candidate viability.

The following identity is enforced:

```text
actual candidate samples = sum(candidate samples by stream)
```

No V7 field counts normal-prefix cache hits or misses. Consequently,
`ranked_option_calls` must not be used to infer fresh sampler builds. Actual samples per
ranked-option call can change because of prefix reuse, internal rollout calls,
extra streams, retry behavior, and optional sibling evaluations. A future
cache-efficiency study must add an authoritative cache-boundary counter rather
than infer one from these populations.

### Frontier work

- `nodes_processed`: partial-track nodes removed from a frontier and handled.
- `nodes_expanded`: processed nodes whose children were generated.
- `children_enqueued`: child alternatives returned to a frontier.

Candidate breadth does not determine node count arithmetically. Breadth affects
pool work and ranking; child limits, viability, frontier order, failures,
tail-completion behavior, and local ceilings determine how many nodes the
remaining budget can process. V7 records both sides so this relationship is an
empirical result rather than an assumption.

### Register and terminal work

- `register_offers`: outputs offered to `BestSoFarRegister`.
- `partial_node_evaluations`: nonterminal offers.
- `terminal_node_evaluations`: complete-track offers.
- `first_time_terminal_node_evaluations`: terminal offers for a `SearchNode`
  object not previously evaluated in the compile.
- `revisited_terminal_node_evaluations`: terminal offers for the same in-memory
  `SearchNode` object again.
- `distinct_terminal_tracks`: exact serialized track geometry first observed
  in the stated scope.
- `repeated_terminal_track_evaluations`: terminal offers whose exact geometry
  was already observed in the stated scope.
- `register_improvements`: offers adopted by the compiler's strict internal
  comparator.
- `terminal_register_improvements`: adopted terminal offers.

Node identity and geometry identity are not interchangeable. Two different
nodes may build identical geometry; one node may be evaluated more than once.
The two enforced decompositions are:

```text
terminal evaluations = first-time terminal nodes + revisited terminal nodes
terminal evaluations = distinct terminal tracks + repeated terminal tracks
register offers = partial evaluations + terminal evaluations
```

Geometry identity is exact within the scope that owns the work record. The
compile record detects repeats across the entire compile. An episode record
detects repeats only inside that episode; summing episode-level distinct counts
does not detect the same geometry appearing in two different episodes. V7 does
not separately attribute compile-global geometry repeats by lane, so reports
must not call a sum of repair episodes “cross-repair duplicate tracks.”

### Evaluation origin

`by_evaluation_origin` attributes register offers, terminal evaluations, and improvements to:

- `frontier`;
- `tail_completion`;
- `polish`.

Origin is orthogonal to lane. For example, both initial and repair frontier
episodes can contain tail-completion evaluations. This prevents a phase called
"main" from silently mixing initial, repair, and resumed work.

## Completion and repair outcomes

- `first_terminal_total_spent_frames`: compile-global charged work when the
  first terminal track was offered.
- `first_improving_terminal_total_spent_frames`: compile-global charged work
  when a terminal first improved the register.
- `first_terminal_offset_frames`: episode-local work to its first terminal.
- `terminal_observation_censored`: the episode ended without observing a
  terminal; it is not a measured completion-cost sample.
- `terminal_reached`: literal Boolean that at least one terminal node was
  evaluated. The exact count remains `work.terminal_node_evaluations`.
- `accepted_alternative`: repair-only Boolean that a terminal alternative was
  adopted by the internal compiler register. It does not mean Benchmark V2
  score improvement.
- `first_register_improvement_offset_frames` and
  `final_register_improvement_offset_frames`: exact episode-local timing of
  register adoption.
- `first_terminal_register_improvement_offset_frames`: episode-local timing of
  the first complete track adopted by the register. This closes the attribution
  of `first_improving_terminal_total_spent_frames`; it is not interchangeable
  with the first improvement, which may be a partial track.

Production repair evaluates at most one complete alternative in an episode,
then makes a new independent decision from the current incumbent and remaining
budget. `repair_divergence` directly compares incumbent and alternative arc
geometry: compared gaps, first divergent gap, divergent gaps overall and in the
regenerated suffix, and exact terminal-geometry identity. A fresh seed is never
used as a proxy for diversity.

## Register and score domains

`register_key_at_start` and `register_key_at_end` expose the optimizer's actual
comparison domain:

1. contract pass/fail;
2. `axis_quality` for passing leaves;
3. `internal_full_score` for failing leaves;
4. `drift_quality` as the documented passing-leaf tiebreak.

`internal_full_score_delta` is therefore an optimizer-internal diagnostic. It
is not Benchmark V2 score and must never be labeled as headline score change.

The final optimization/scoring target remains the authored specification and
Benchmark V2 evaluation. Diagnostic feasibility estimates must not cap,
rewrite, or replace authored impact or any other authored target.

## Final-output lineage

`final_output_episode_id` and `final_output_lane` identify the last episode
whose register improvement produced the final selected output. The referenced
episode must exist, its lane must match, and it must contain an improvement.

## Estimator observations

Every episode has `start` and `end` observations; trace payloads add high-water,
spend-decile, and first-terminal observations.

Each observation keeps hard and episode remaining work separate and records:

- structural remaining-work prior;
- incumbent path work when positively measured;
- observed episode pace projection;
- selected point estimate and empirical interval;
- applicability (`calibrated`, `extrapolated_policy_budget`, or
  `unvalidated_attempt_kind`);
- structural progress and hard/episode completion margins.

A zero path cost is treated as absent, not as evidence that completion costs
nothing. An episode without a terminal is censored and must not be converted to
a point estimator error.

Adjacent budget points in a deterministic sweep are policy variants of the
same specification/seed, not independent samples. Report direct observations
and descriptive associations separately from hypotheses or causal claims.

## Required validation

The recorder and analyzer enforce:

- contiguous ordered episode IDs and valid parents;
- at most one active episode;
- non-negative integer work counters;
- closed candidate-mode, evaluation-origin, offer, node-identity, and
  geometry-identity decompositions;
- episode allocation and spend identities;
- compile work equal to episode work, except compile-global distinct geometry
  is deduplicated across episode boundaries;
- contiguous execution intervals covering total spend;
- first-terminal attribution equal to the earliest episode-local observation;
- valid final-output lineage;
- trace node events attributed to the exact episode and lane, with atomic frame
  components closing to node spend.

Benchmark pairing additionally requires unique, complete
`(source, budget, seed)` cells in both arms. A map insertion must never silently
overwrite duplicate cells.

## Tools

- `scripts/v0/describe_budget_telemetry.ts`: strict single-compile narrative,
  work funnels, evaluation origins, intervals, and estimator walk.
- `scripts/v0/analyze_budget_telemetry.ts`: strict multi-payload validation and
  descriptive aggregate analysis.
- `scripts/benchmark/analyze_scale_mechanics.ts`: paired multi-budget mechanics
  comparison using V7 only.

For naming and architecture rationale, see
[`compiler-telemetry-foundation.md`](compiler-telemetry-foundation.md).
