# Library compiler comparison

The tested candidate includes compiler changes through foundations `44f51f06`.
The later rebase onto `81427b52` changes comparison locking and documentation,
not compiler behaviour. Commit IDs below identify the original measured checkouts.
Raw paired records and artifact verification are retained locally under
`line-library-comparison/generated/compiler-library-comparison/`.

Matched 66 runs: 22 authored recordings × seeds 101/202/303, fixed saved requests, budgets, jolt −15 ms and strike-v3 contract. Old `c436160a` → new `a8ef777b`. No videos regenerated.

Completion: 66/66 → 66/66; qualification 66/66 → 66/66; missing requested contacts 0 → 0.

## Scores and diagnostics

Production score is higher-is-better; RMS errors and timing/extra-impact loss are lower-is-better. Extra-event counts, motion corrections and line counts are descriptive rather than artistic targets.

| Metric (equal weight per recording) | Old | New | New − old |
|---|---:|---:|---:|
| score | 651.34 | 679.22 | +27.878 |
| weightedAxisRms | 0.10797 | 0.097647 | -0.010322 |
| airRms | 0.088142 | 0.08223 | -0.0059112 |
| speedRms | 0.058868 | 0.055223 | -0.003645 |
| impactRms | 0.15203 | 0.13466 | -0.017361 |
| strengthRms | 0.13538 | 0.12231 | -0.013064 |
| timingMeanAbsMs | 4.8399 | 3.0562 | -1.7837 |
| extraMse | 0.0017684 | 0.0012644 | -0.00050401 |
| extraEvents | 27.818 | 26.197 | -1.6212 |
| extraStrengthMax | 0.18888 | 0.16366 | -0.025215 |
| impactLoss | 0.023797 | 0.018908 | -0.0048882 |
| physicalFrames | 3.5172e+06 | 3.5175e+06 | +298.15 |
| compileSeconds | 87.815 | 61.987 | -25.828 |
| historicalScore | 0 | 0 | +0 |
| historicalWeightedAxisRms | 0.061796 | 0.057889 | -0.0039063 |
| historicalMissingOrDrifted | 18.924 | 16.5 | -2.4242 |
| historicalOffBeat | 15.197 | 14.288 | -0.90909 |
| legacyMetricsScore | 0.15344 | 0.46673 | +0.3133 |
| absoluteCorrectionPerMinute | 314.87 | 320.67 | +5.7932 |
| directionCorrectionPerMinute | 737.61 | 762.84 | +25.23 |
| positiveCorrectionPerMinute | 80.487 | 82.684 | +2.1965 |
| lines | 5270.7 | 5657.1 | +386.44 |

Score improves in 22/22 recordings, worsens in 0/22. Recording-level descriptive paired bootstrap interval: +23.56 to +31.97 points. Seeds are nested within recordings; they are not 66 independent songs.

These recordings represent 14 underlying compositions, with slowed variants correlated. Giving each composition equal weight instead gives 657.50 → 683.42, Δ +25.92, descriptive interval [+20.61, +30.71].

Excluding Luna Bala and Amor Na Praia (known dev/evaluation song families): 19 recordings, score 658.13 → 686.88, Δ +28.75.

## Per recording

| Recording | Old score | New score | Δ | Seed wins / losses | Strength RMS old → new |
|---|---:|---:|---:|---:|---:|
| Amor Na Praia | 683.94 | 721.39 | +37.44 | 3 / 0 | 0.1264 → 0.1043 |
| Bones | 737.83 | 759.57 | +21.74 | 3 / 0 | 0.0993 → 0.0894 |
| Dernière danse × Montagem Coral | 731.84 | 758.18 | +26.34 | 3 / 0 | 0.1006 → 0.0907 |
| FUNK DO BOUNCE (Super Slowed) | 697.99 | 731.86 | +33.88 | 3 / 0 | 0.1202 → 0.1059 |
| FUNK ESTRANHO (Super Slowed) | 622.93 | 645.56 | +22.63 | 3 / 0 | 0.1156 → 0.1089 |
| Chris Grey — LET THE WORLD BURN | 697.33 | 718.93 | +21.60 | 3 / 0 | 0.1176 → 0.1061 |
| LOS VOLTAJE | 622.89 | 641.72 | +18.84 | 2 / 1 | 0.1499 → 0.1447 |
| LOS VOLTAJE (Slowed) | 619.71 | 652.15 | +32.44 | 3 / 0 | 0.1564 → 0.1310 |
| LOS VOLTAJE (Ultra Slowed) | 685.03 | 716.72 | +31.69 | 3 / 0 | 0.1235 → 0.1102 |
| LUA NA PRAÇA | 567.21 | 570.06 | +2.85 | 1 / 2 | 0.1375 → 0.1290 |
| LUNA BALA | 518.72 | 526.67 | +7.95 | 3 / 0 | 0.2212 → 0.2162 |
| LUNA BALA (Slowed) | 622.26 | 643.95 | +21.69 | 3 / 0 | 0.1367 → 0.1288 |
| ANDROMEDA — MONTAGEM COMA | 622.60 | 640.15 | +17.55 | 3 / 0 | 0.1470 → 0.1400 |
| MXZI — MONTAGEM TOMADA (Extended) | 687.53 | 730.02 | +42.49 | 3 / 0 | 0.1259 → 0.1070 |
| MONTAGEM TOMADA (Slowed) | 661.29 | 699.81 | +38.52 | 3 / 0 | 0.1372 → 0.1211 |
| MONTAGEM TOMADA (Super Slowed) | 685.77 | 726.77 | +41.00 | 3 / 0 | 0.1177 → 0.1026 |
| NO BATIDÃO | 624.84 | 654.82 | +29.98 | 3 / 0 | 0.1532 → 0.1390 |
| NO BATIDÃO (Slowed) | 657.52 | 693.52 | +36.00 | 3 / 0 | 0.1347 → 0.1229 |
| PASSO BEM SOLTO | 623.59 | 655.10 | +31.51 | 3 / 0 | 0.1524 → 0.1338 |
| PASSO BEM SOLTO (Slowed) | 634.45 | 674.09 | +39.64 | 3 / 0 | 0.1446 → 0.1231 |
| PASSO BEM SOLTO (Super Slowed) | 648.99 | 676.84 | +27.85 | 3 / 0 | 0.1384 → 0.1315 |
| Petrunko | 675.20 | 704.90 | +29.69 | 3 / 0 | 0.1223 → 0.1047 |

## Tradeoffs and individual regressions

Production score improves in 63/66 paired seeds. The exceptions are:

- LOS VOLTAJE seed 202: 633.27 → 631.50 (-1.77).
- LUA NA PRAÇA seed 101: 579.18 → 570.27 (-8.91).
- LUA NA PRAÇA seed 303: 568.89 → 563.37 (-5.52).

Mean strength RMS and mean absolute timing error improve in every recording. Air RMS worsens in Bones, LOS VOLTAJE (Slowed), and LUA NA PRAÇA; speed RMS worsens in LOS VOLTAJE, LOS VOLTAJE (Slowed), LUA NA PRAÇA, LUNA BALA (Slowed), NO BATIDÃO, and Petrunko. Extra-impact MSE worsens in FUNK ESTRANHO, original LUNA BALA, and PASSO BEM SOLTO. Full magnitudes are in comparison.json.

LUA NA PRAÇA is the weakest overall gain (+2.85 points): its air RMS rises from 0.174 to 0.182, despite better impact strength and timing. The improvements are not uniform across requested axes or seeds.

Line count rises by 7.3%; observed absolute and directional motion corrections rise by 1.8% and 3.4% respectively. These are descriptive changes, not proof of a visible defect. Charged physics work is essentially unchanged (+0.008%). No visual/listening comparison was performed here.

## What this does and does not establish

- Every old plan, manifest, track and report passed its stored SHA-256 check. All 66 saved judge/harness source identities and native engine bytes match the new checkout; every fresh resolved case/request/budget is checked against its original. This compares compiler changes under the same measurements, without relabelling old results.
- No exact library spec occurs in the declared V7/dev/heldout panels. However, Luna Bala and Amor Na Praia are existing evaluation songs under different authored specs/excerpts. This is additional authored-spec coverage, not a sealed held-out study of 22 unseen songs.
- The new construction artifact contains 17077 examples from 198 listed sources; no library spec ID is among them. Listed music sources are Believer/Shelter, alongside synthetic cases. This checks the current artifact provenance, not every historical influence on the compiler.
- Historical landing and current strike rulers are both retained above. Historical zero grades reflect historical contract failures, not failure to finish the ride. The legacy metrics score is also preserved as a diagnostic; it is not the current production score.
- Physical frames compare charged compiler work. Wall-clock timings were collected at different times under different machine loads, so they are descriptive and do not establish a controlled speedup.
- Bootstrap intervals describe variation over this chosen set; it was artistically selected, contains related variants, and was not a random sample of all music. Scores measure the written requests, not perceived musical or visual quality.
- No authoring or compiler tuning was performed from these results. All per-seed measurements, components and motion observations are retained in comparison.json.
