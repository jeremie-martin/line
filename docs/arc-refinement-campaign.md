# Arc refinement campaign

Opened 2026-09-08. Reference: arc-guidance-planning, 744.5000 at 750k,
745.0343 at 1M and 3M. Reference branch: `archive/arc-guidance-planning-744`.
Work branch: `codex/arc-refinement`. The owner approved ambitious work on
completed-track refinement, selective planning, expressive coherent arcs and
useful earlier budget/difficulty/proposal mechanisms. Broader aesthetic
objective design remains for later discussion; full video review continues.

Benchmark V2, scorer, authored targets, validity, physics and actual-frame
accounting remain fixed. Only normal type-0 substantial physical curves.
Research is open; earlier design choices, caps and closures are historical.
Evidence and immutable study plans: `generated/benchmark-v2/arc-refinement/`.
Exploratory subset means are not benchmark headlines. Accepted behavior must
be evaluated on the full suite and bound to the exact compiler source.

## Initial hypotheses

The current compiler caps base proposals at 160 and guide proposals at 48,
with three current arrivals and one future interval. All 44 outputs match at
1M and 3M; maximum actual work is 804,515 frames. Higher budgets need useful
additional search, not merely a larger available allowance.

Earlier work already implemented completion repair, measured suffix costs,
structural difficulty, deadline control, local response models and readiness.
The old repair ROI report uses a retired scorer/telemetry schema and is not
quantitative evidence for the present compiler. Its qualitative warning is
valuable: repeated expensive suffix reconstruction can buy little improvement.
Likewise, earlier difficulty fits were policy-dependent and failed to
extrapolate across changes in search breadth. Reuse principles, and gather
new cost and value measurements for this curve family.

Start by separating three limitations: insufficient proposal/search effort,
insufficient geometry freedom, and expensive reconstruction of downstream
motion. Compare existing deeper/joint/model-guided options at 3M while building
completed-track refinement with a preserved complete incumbent. Measure useful
change per actual physics frame and where local changes lose downstream validity.

## First measurements

Eight-case exploratory panel at 3M: reference mean 666.7127; wider depth-two
planning 722.0681; joint geometry 692.8732; local Newton proposals 681.4350.
All arms complete 8/8. The deeper planning arm extends to the complete suite:
**781.0190 at 3M, 44/44 valid**, versus reference 745.0343 at 3M. Maximum
actual work is 2,565,867 frames. This is a one-seed higher-budget discovery
result, not a changed 750k canonical headline. Source remains the preserved
744 compiler with explicit research options (five arrivals, depth two,
48-proposal continuations).

Source 098246ff implements smooth turn timing, an additional later bend,
and varying guide separation, plus completed-track refinement. The first
refiner preserves a complete incumbent, proposes local revisions, then either
translates the fixed suffix or reconstructs it from the original curve controls.
Every complete offer is physically replayed and scored against the authored
report with unchanged observation coverage; all work is charged.

First refiner pilots expose weak returns. At 3M the translated-suffix mean
is 666.7237, and warm reconstruction 666.8209, both 8/8 valid. Most proposals
fail to preserve useful continuations; surviving candidates seldom improve
the global report. At 750k the tested refinement offers make no improvements.
The initial expressive geometry mean is 689.0611; paired with deeper planning
it is 711.0435, below plain deeper planning. These are execution-specific
results, not grounds to discard refinement or expressive geometry.

The next version tests direct parameter revisions judged through complete
continuations, cheap recovery when an original curve no longer works, and
selective planning based on measured construction work plus remaining budget.
It also tests strict planning horizons: a failed deeper branch must not gain
an artificially cheap comparison by silently returning only a shorter prefix.

## Geometry, response models and measured scaling

The simple Newton solver's eight-case 750k mean improved to 687.0371, but the
full suite scored only 729.0882 (44/44), below 744.5. That configuration is
rejected. This confirms why the diagnostic subset cannot decide promotion.

Selective planning based on observed construction cost and remaining frame
allowance reaches 745.0629 at 750k, 44/44. Strict depth-two comparison at 3M
reaches 791.4600, 44/44, versus the earlier non-strict 781.0190. The original
fallback could compare a failed deeper branch using a shorter, cheaper horizon.
Strict horizons reject that incomplete lookahead while preserving the original
physical construction fallback when no continuation is found.

Source 936bb8ff adds local joint response fitting across curve and guide
controls. It fits derivatives from exact simulations and validates every
joint proposal. Combined expressive geometry and joint responses score
745.7898 at 750k (44/44). Combined with strict deeper planning they reach
**798.3729 at 3M, 44/44**, maximum 2,675,323 actual frames. Compared with the
3M reference 745.0343, this is +53.3386; it does not replace the 750k headline.
The matched strict-planning contrast without expressive response geometry is
791.4600, so geometry and response fitting add 6.9129 in that tested setting.

Completed-track refinement was further revised to reuse the physically diverse
alternatives retained during initial construction and adapt following arcs from
warm controls. Its eight-case 3M mean is 673.0431, versus reference 666.7127;
the corresponding direct-revision follow-up is 666.9786. Both preserve 8/8
validity. This is useful evidence for retaining continuation alternatives,
though deeper initial planning remains the stronger use of this budget.

## Future-value and runtime experiments

The deeper expressive run records 20,298 candidate arrivals and measured
future outcomes from 21 parent specifications. Physical features contain
relative body state and authored upcoming targets, with no case, seed, absolute
position or budget identity. Five folds hold each parent and all its variants
out together. On teacher shortlists, the learned ranking's mean regret is
0.06509 versus 0.12287 for current-only ranking. These are offline cost units,
not headline points or live compiler improvement. The inference export matches
all 32 retained Python predictions exactly. Live out-of-parent validation is
required before judging the model useful.

A compiler-only runtime experiment reuses raw prefix reads only when adding
new geometry leaves the engine's cached physical prefix intact. Otherwise it
uses the original extraction. Detector, physics, cold replay and frame charging
remain unchanged. Focused combined planning/refinement tests preserve exact
tracks, reports and physics costs; full-suite equivalence is evaluated separately.


The prefix cache's full 44-case comparison preserves every track, report and
actual physics cost exactly (`prefix-cache-equivalence.json`). No controlled
wall-time speedup is claimed from concurrently run panels.

The first live parent-disjoint pilot covers 16 cases. Admission-only ranking
adds 19.2459 arithmetic mean points over its matched expressive reference;
blending 25% predicted future cost into the measured comparison adds 21.9119
(13 improvements, three regressions), and 50% adds 20.4293. All arms are 16/16
valid. The 25% version proceeds to all 44 cases with the same parent-disjoint
folds, and a single full-fit frozen model is evaluated separately. The model's
training inputs are development examples; qualification has not been used.
