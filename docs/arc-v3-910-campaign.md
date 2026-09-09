# Arc V3 910 campaign

**Completed at 910.5248**, up 9.4325 from 901.0923. All 176 canonical runs
pass and exactly reproduce the research tracks, scores and physics-frame counts.
[Final validation](../benchmark/v3/studies/arc-910-validation.json)

Target: at least **910** on frozen V3 at 750k actual compiler physics frames.
Starting compiler: `fe7616c8`, canonical **901.0923**, 176/176 valid runs over
88 specifications × seeds 16/17. Preservation: `archive/arc-v3-901`.

The first investigations examine transfer from deeper search and allocation
between refining individual arcs and comparing continuations. Existing teachers
reach 916–922 at larger research budgets, but the best teacher did not produce
the strongest standard-budget compiler. The production proposal forest still
comes from the earlier V2 campaign; V3 controls currently enter as nearby
examples. Joint regression on replay-verified V3 controls is a distinct transfer
hypothesis to test, not an assumed improvement.

The benchmark/scorer and coherent normal-arc requirement remain fixed.
Full raw results live under `generated/benchmark-v3/arc-910/`.

## Initial controlled studies

A zero-option 20-case control reproduces all 901 track hashes and frame counts.
The more detailed V3 916 ExtraTrees proposal model (32 trees, depth 14, leaf 4)
improves the pilot arithmetic mean by 5.64151, but reaches only **901.8144**
on the full 88-case seed-16 panel, all valid. This is a research result, not a
canonical promotion. Coarser/finer models and splitting the existing proposal
quota across old/new forests regress. A wider quota is tested separately.

Optional learned guidance blends the arrival-value estimate into local curve
refinement, preserving physical residuals and the reported objective. Weight
0.25 gives a mixed +0.4225 pilot mean; 0.5 regresses by 5.263985. Combining it
with the new proposal forest underperforms that forest alone in the pilot.
It remains disabled. The loss algebra is covered by independent tests.

The baseline spends 25,093,440 of 65,214,403 compiler frames on continuation
lookahead. Only 42 of 7,981 planning decisions choose depth two. Continuation
searches normally have 12 guidance samples, insufficient for a 23-sample joint
response round. Giving these probes a complete response round regresses in
all three first executions (pilot mean deltas -16.94981, -31.98501, -40.507).
Better local correction alone does not make a better path comparison; this
mechanism also remains disabled.

A residual-transfer study adjusts a nearby measured control by the predictor's
change between old and new physical inputs. Its strongest pilot execution is
still below the unadjusted new forest. Forest-proposal diversity and a predictor
trained on the stronger 922 teacher are separate active hypotheses.

All reported pilots contain 20 cases, retain invalid scores as zero, and have
no headline. [Compact paired evidence](../benchmark/v3/studies/arc-910-research.json)
retains favorable and adverse results. No production model or default is changed.

## Querying the teacher on the student's states

The next experiment addresses distribution mismatch directly. At each prefix of
the canonical 901 track, the teacher runs a larger local/continuation search,
records its counterfactual choice and predictor inputs, then commits the original
student control. Thus the next query is made at the student's actual next state.
The harness requires the completed replay track hash to equal the original 901
track hash. Its replayed score is not a score for a new expert rollout.

A separate collector reconstructs every query input from physics, matches it
exactly to the recorded features, rebuilds each proposed arc, and independently
checks its prefix, catch, survival, lack of offbeat landings and timely release.
The two-case smoke study passes: 179 non-startup examples, plus both startup
queries, are checked. The full 88-specification teacher is collecting at a 3M
research allowance. Any eventual student must still meet the fixed 750k budget.

## Candidate above the target

The complete 88-case seed-16 comparison of the new 916 proposal forest with
0.25 learned guidance reaches **910.5248**, all 88 valid. It improves 70 cases
and regresses 18 relative to 901.0923. Total compiler work is 65,157,750 actual
physics frames; the maximum is 749,929. The same forest without learned guidance
reaches 901.8144. The pilot did not predict the size of the full-suite gain.

This candidate uses the replay-verified 916 training data already established in
the preceding campaign. The newer student-prefix teacher experiment did not
produce this result. Its full data collection is being preserved and checked,
without beginning further model training once the 910 candidate is available.

The production candidate replaces the old proposal forest with the 32-tree,
depth-14, leaf-4 model trained on 7,981 validated 916 controls. The same 7,981
nearby examples and 916 continuation predictor remain. Learned guidance blends
25% predicted future loss with 75% of the existing arrival prior during local
refinement; physical span residuals stay intact. Root ranking remains at 0.45.
No geometry, benchmark, scorer, physics or frame-budget change is involved.

Canonical public-entry-point confirmation and separate target-jitter checks are
required before marking this campaign achieved. The targeted TypeScript check
still reports 251 inherited diagnostics, with none in changed compiler or
research TypeScript files.

The gain is uneven. In the full research comparison, the representative stratum
rises 15.3959 and development music rises 5.2883, while capability declines
5.8573 and legacy regression declines 7.3047. The largest case drops are
`arches_at_new_tempos` (-151.7222), `interleaved_recovery` (-129.7423), and
`rest_and_return` (-98.6096). All remain physically valid. These regressions are
retained explicitly; the predeclared overall headline governs this campaign.

## Final canonical confirmation

The public compiler at `f0ca9434` confirms **910.5248**, all
**176/176** runs valid over the complete 88-specification × seed-16/17 panel.
These reproduce 88 distinct deterministic tracks. Every track, score and actual
frame count matches the complete research candidate. Total compiler work is
130,315,500 frames; the maximum per run is 749,929.
All 132 identified compiler files match the validated checkout exactly.

All geometry is normal, with zero isolated single-segment components. The
shortest endpoint-connected component is 15.596375 units.
The established coherent arc primitive is unchanged; no new audiovisual review
is claimed. The frozen suite fingerprint matches both the original published
baseline and the preceding 901 compiler.

Separate 2% target jitter with seeds 211/212 passes **88/88 distinct tracks**
on the reused 44-case V2 development catalog. Its maximum work is
749,984 frames and its total is 64,903,950. This diagnostic
is separate from the V3 headline and does not establish independent-family
generalization. [Stress evidence](../benchmark/v3/studies/arc-910-jitter.json)

Thirty-four focused tests across 12 files pass. Type checking retains 251
inherited diagnostics and none in changed files. The student-prefix teacher
experiment finishes with all 88 replay tracks exactly matching the 901 source
tracks; all 8,069 alternative arcs are independently revalidated, producing
7,981 non-startup training examples. These remain unused research data.

The goal is complete. Code and compact evidence are pushed and preserved on
`archive/arc-v3-910`; full tracks, unselected models, teacher data and large
archives remain local.
