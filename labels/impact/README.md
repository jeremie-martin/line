# Felt-impact labels — durable ground truth

The user's felt-intensity annotations from the June 2026 impact-metric campaign,
plus the EXACT tracks they were labeled against. These are the irreplaceable
ground truth every impact-metric decision rests on (see
`docs/impact_definition.md` and `docs/archive/impact_problem_statement.md`).
The live copies under `generated/impact-study/` are gitignored; this directory
is the tracked backup. If the two ever diverge, `generated/` is newer (the
dashboard autosaves there) — re-sync by copying `generated/impact-study/<n>.labels.json`
here.

Each pair: `<name>.labels.json` (dashboard annotations, keyed by landing frame:
ordinal intensity, tags, free-text note) + `<name>.track.json` (the compiled
track the labeled video was rendered from — re-simulating it reproduces the
labeled trajectory bit-identically for a fixed engine).

| Set | Labeled | Status |
|---|---|---|
| `impact_lab_v2` | 2026-06-14 | discriminating (bespoke divergence-max track) |
| `climb_terrace` | 2026-06-14 | discriminating |
| `rolling_drop` | 2026-06-14 | discriminating (caught the DECEL·on overfit) |
| `staircase` | 2026-06-14 | discriminating (flat slams; broke the redirArc/turn tie) |
| `shelter_impact_2m` | 2026-06-14 (n=19) | reference only — two labels flipped vs the Jun-9 session |
| `believer_impact_2m` | 2026-06-14 | non-discriminating (labels bunched medium↔strong) |

The 2026-06-14 verdict (`redirArc = v·Δθ`, anchors soft/very-strong) was
adjudicated on the four discriminating sets — mean Spearman: redirArc 0.808 >
redir 0.788 > turn 0.773; force/onset family collapsed on rolling_drop.

Validate a metric against these with:
`npx tsx scripts/v0/study_impact_labels.ts --labels=<name>`
