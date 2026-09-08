# Learned value at continuation boundaries

September 2026 research following the compiler-foundations cleanup.
Preserved branch: `research/arc-continuation-boundary`.
**Not promoted. Production retains the accepted 767.6851 planner.**

The hypothesis was to apply the learned arrival-value model at the end of an
exactly simulated continuation, where unresolved future work begins. The existing
planner instead blends the model into root selection and uses a hand-built prior
at the continuation boundary. Geometry, physics, accounting and V2 are unchanged.

The first eight-case panels tried boundary weights 0.25 and 0.5. They improved
the 750k exploratory mean but regressed at 3M. A second execution retained learned
ranking of unprobed root candidates, removed the overlapping root-value blend,
and used the model at the simulated boundary. This improved both pilot budgets.
Production integration scaled the boundary weight continuously with the guide
search allowance, using the existing allocation from ride length and budget.

## Results

| Evaluation | Incumbent | Candidate | Valid candidate runs |
|---|---:|---:|---:|
| Canonical 750k, full 44 cases × seeds 16–23 | 767.6851 | 771.3015 | 352/352 |
| Full 250k development, one seed | 610.9446 | 610.9446 | 44/44 |
| Full 500k development, one seed | 718.8741 | 720.8943 | 44/44 |
| Full 1M development, one seed | 793.3941 | 802.7438 | 44/44 |
| Full 3M development, one seed | 812.0916 | 813.7500 | 44/44 |
| Jitter 0.02, 44 cases × seeds 101–104, mean cell score | 754.0957 | 758.2551 | 176/176 |
| Qualification 250k, five cases × eight seeds | 601.2726 | 517.4043 | 39/40 |
| Qualification 500k, five cases × eight seeds | 690.5581 | 701.5806 | 40/40 |
| Qualification 750k, five cases × eight seeds | 751.5702 | 759.0753 | 40/40 |

The unchanged canonical gate accepted at its first N=8 look. Those zero-jitter
seeds reproduce 44 distinct tracks, not 352 independent shapes. The separate
jitter study has 176 distinct tracks. Catalog-sensitivity delta bounds are
[1.7381, 5.5258]. At 750k, 22 cases improve and 22 regress; the largest regression
is −45.7697 on `believer_impact_56s_amplitude_plus_5`. All 4,100 curve groups are
normal physical arcs, with at most two connected chains and 1,042 single groups.

Qualification was run only after the candidate was frozen. At 250k,
`amour_de_ma_vie_short_44s`, seed 0, loses one required contact/impact measurement
after spending 249,985 frames. The incumbent completes all 120 qualification
runs; this candidate completes 119. Its aggregate qualification monitor also
falls from 691.0046 to 681.9938. This is sufficient reason to retain the incumbent
despite the positive canonical and higher-budget results. No further tuning was
performed against this qualification panel.

## Preservation and next investigation

The experimental implementation and its test stay on the research branch. The
active cleanup branch restores the incumbent planner, avoiding an extra disabled
mechanism in production. The production-options factory and improved study tools
remain available for future work.

The idea has useful evidence, particularly at 1M, but its transition into scarce
search allowance is not reliable enough. Future development should characterize
that transition on fresh development-only workloads before another independent
validation. Reusing an old budget threshold or special-casing the failing song
would not establish a general solution.

[Compact evidence](../benchmark/v2/studies/arc-continuation-boundary-validation.json)
contains all 14 panels, controls, hashes, qualification results and tradeoffs.
Large tracks, checkpoints, logs and frozen snapshots remain in the local
`archives/compiler-foundations-2026-09-08/` archive. Existing full production
videos remain in `archives/arc-refinement-2026-09-08/`; this experiment did not
replace that video gallery.
