# Production sweep, November 16, 2026

Compiler: `2279c1f8` (foundation-12 behavior). Default production specs, seeds 101–808 in steps of 101, standard budget, 23 concurrent workers. All 248 rides completed and qualified. Timings below are elapsed compile times under load, not isolated speed benchmarks.

This is an initial diagnostic review, not an aesthetic verdict. Speed-deficit time means gaps whose achieved normalized speed is more than 0.15 below the request; this screening threshold is not an optimization target. Repetition is the longest consecutive run of the same realized geometry family, not proof that its shapes look identical. Strong extras use the existing 0.25 strength band. Bursts use motion_check’s existing 100 ms band.

## Priorities to inspect

1. Believer and short L’amour: the largest cumulative speed deficits and strong-hit shortfalls. Watch whether these are visible stalls or merely demanding specs.
2. Long L’amour: repeated arcs (up to 28.25 s) and occasional unrecorded pushes; inspect the long float section before changing family placement.
3. Tiki and ultra-slowed Los Voltaje: roughly one unrecorded push per ride despite otherwise acceptable scores. Locate these events; the impact account can miss late turns.
4. Lua: low score without comparable speed failures. It remains held out from compiler tuning; include it only as production coverage, not as a basis for a change.
5. Trouble: all eight default-spec seeds complete. This does not prove every historical short-pair variant is fixed.

Petrunko is deliberately not promoted to a compiler problem just because its mean score is 673: the owner marked its chosen handcrafted reading 11 (`labels/studies/handcraft-2026-11-15.json`). That existing judgment weighs more than its place in a score-sorted list.

Only five rides exceed the 100 ms burst band, each for one sampled window; maximum excess is 0.0562. Burst reduction is not the leading opportunity in this sweep.

## Per-song coverage

Every row has 8/8 complete and qualified rides.

| Song | Score min / mean / max | Compile seconds mean | Speed-deficit seconds mean | Longest same-family seconds mean | Strong extras mean | Unrecorded pushes mean |
|---|---:|---:|---:|---:|---:|---:|
| amor_na_praia_46s | 745.8 / 760.5 / 773.2 | 36.9 | 0.78 | 4.2 | 0.00 | 0.38 |
| amor_na_praia_selection | 736.6 / 744.1 / 756.4 | 44.6 | 0.69 | 5.4 | 0.00 | 0.00 |
| amour_de_ma_vie_108s | 706.4 / 731.0 / 759.7 | 61.3 | 0.68 | 18.7 | 0.12 | 0.75 |
| amour_de_ma_vie_44s | 573.6 / 597.6 / 616.8 | 33.2 | 6.08 | 5.9 | 0.12 | 0.00 |
| believer_78s | 636.5 / 653.3 / 665.3 | 70.6 | 8.02 | 4.1 | 0.62 | 0.00 |
| bones_selection | 746.2 / 760.3 / 770.2 | 41.3 | 1.18 | 4.9 | 0.00 | 0.00 |
| circus_minimus_77s | 723.5 / 743.5 / 758.4 | 64.7 | 1.65 | 3.2 | 0.00 | 0.00 |
| derniere_danse_coral_selection | 733.9 / 765.3 / 783.1 | 40.6 | 0.36 | 6.2 | 0.00 | 0.00 |
| funk_do_bounce_super_slowed_selection | 740.1 / 759.6 / 785.8 | 41.8 | 0.38 | 4.0 | 0.25 | 0.00 |
| funk_estranho_super_slowed_selection | 712.9 / 736.9 / 754.2 | 42.4 | 0.49 | 5.0 | 0.00 | 0.12 |
| let_the_world_burn_selection | 749.8 / 771.9 / 792.3 | 41.2 | 0.98 | 6.0 | 0.12 | 0.12 |
| los_voltaje_selection | 679.9 / 709.2 / 728.4 | 46.1 | 1.32 | 5.4 | 0.00 | 0.00 |
| los_voltaje_slowed_selection | 706.1 / 726.1 / 745.9 | 44.4 | 0.64 | 6.3 | 0.00 | 0.00 |
| los_voltaje_ultra_slowed_selection | 723.3 / 742.6 / 773.3 | 40.8 | 0.53 | 6.0 | 0.00 | 1.00 |
| lua_na_praca_selection | 526.6 / 558.0 / 588.9 | 42.9 | 0.77 | 8.3 | 0.12 | 0.00 |
| luna_bala_44s | 827.7 / 844.0 / 856.4 | 26.8 | 0.14 | 5.2 | 0.00 | 0.38 |
| luna_bala_original_selection | 666.6 / 681.3 / 694.3 | 47.9 | 1.59 | 5.5 | 0.50 | 0.00 |
| luna_bala_slowed_selection | 681.3 / 711.5 / 725.3 | 46.3 | 0.17 | 5.3 | 0.12 | 0.12 |
| montagem_coma_selection | 712.1 / 722.9 / 734.1 | 44.7 | 1.12 | 3.9 | 0.00 | 0.00 |
| montagem_tomada_extended_selection | 735.8 / 745.8 / 754.2 | 43.7 | 0.87 | 4.5 | 0.00 | 0.00 |
| montagem_tomada_slowed_selection | 727.9 / 742.2 / 761.2 | 44.6 | 0.27 | 4.9 | 0.00 | 0.00 |
| montagem_tomada_super_slowed_selection | 743.1 / 757.0 / 780.5 | 43.0 | 0.15 | 5.6 | 0.25 | 0.00 |
| no_batidao_selection | 689.1 / 709.5 / 733.3 | 46.8 | 1.45 | 4.4 | 0.00 | 0.00 |
| no_batidao_slowed_selection | 721.0 / 732.1 / 739.8 | 44.0 | 0.62 | 4.0 | 0.00 | 0.00 |
| passo_bem_solto_selection | 698.3 / 713.7 / 729.0 | 45.3 | 1.34 | 3.5 | 0.00 | 0.00 |
| passo_bem_solto_slowed_selection | 713.9 / 732.2 / 756.6 | 46.3 | 0.61 | 3.2 | 0.38 | 0.00 |
| passo_bem_solto_super_slowed_selection | 724.8 / 737.9 / 756.3 | 45.0 | 0.65 | 4.5 | 0.00 | 0.00 |
| petrunko_selection | 633.0 / 673.4 / 697.3 | 42.1 | 1.41 | 5.7 | 0.00 | 0.12 |
| tiki_tiki_48s | 779.1 / 787.4 / 794.0 | 30.2 | 0.00 | 7.6 | 0.00 | 1.12 |
| trouble_50s | 772.2 / 786.7 / 804.8 | 30.9 | 0.50 | 6.3 | 0.12 | 0.38 |
| valhalla_40s | 813.3 / 829.8 / 838.3 | 25.4 | 0.00 | 8.1 | 0.00 | 0.00 |

## Follow-up checks

The speed deficits are not stalls: excluding the first two seconds, Believer, short L’amour and Tiki each spend zero frames below 2 px/frame (sled PEG displacement). Median speeds are 10.41, 11.10 and 10.23 px/frame respectively. Believer’s deficits above the screening threshold all occur in gaps of 0.5 s or less; no longer gap crosses it. This points toward dense catch chains, not a rider left stuck on a shape.

All eight ultra-slowed Los Voltaje push flags occur at 3.125 s, 100 ms after the requested beat at 3.025 s. The account records that catch at strength 0.290 against ask 0.37, ending at frame 124; the two-frame push diagnostic peaks at frame 125 at 0.95–1.01. These are different measures and windows, not eight independent off-beat incidents. Frame-sheet inspection shows a steep catch into a curved support; it does not establish an unwanted extra hit. Tiki’s flags occur at 43.675–47.15 s, also 100–125 ms after requested beats. Do not optimize these counts as if they were validated off-beat judgments.

## Quiet asks, tight pairs, and guide contacts

Tiki’s 112 quiet targets across seeds average ask 0.025 and delivered 0.046; 29.5% exceed twice the ask. These are near the documented touchdown floor, so the ratio alone exaggerates their practical severity. Long L’amour is the stronger quiet-miss case: its 24 quiet targets average 0.112 → 0.219, 45.8% above twice the ask. This is the previously studied long-float/quiet-catch conflict. Other quiet passages are closer: Bones 0.140 → 0.145, Circus 0.150 → 0.159, Petrunko 0.136 → 0.142, Trouble 0.110 → 0.125.

For the second target of gaps at most nine frames, all matches exist: Trouble 32 targets, ask 0.551 → 0.474, zero mean onset error; Circus 568, 0.597 → 0.484, mean absolute onset error 0.12 frames; Believer 1,136, 0.612 → 0.469, 0.17 frames. Tight pairs are completing and timed well, while losing strength. This does not prove every historical variant is reliable, but the default productions no longer show the historical failure pattern.

Across all 27,576 matched beats: 19,394 floor, 5,742 clean upper, 1,750 floor+rail, 664 rail, 26 other (contact classification in the first three contact frames). Thus 8.8% touch a rail at the catch. On strong beats that is 991/16,312 (6.1%); on quiet beats 45/792 (5.7%). These are contact roles, not labels of bad hits; banning guide touches would discard a working construction without evidence that the resulting motion is preferable.

## Mechanism checks and decisions

- Believer: all 238 speed-deficit gaps across eight seeds are 0.5 s or shorter; none of the 64 longer gaps crosses the screening threshold. Short L’amour has 83 flagged gaps of at most 0.5 s and 30 longer ones, including its startup. This is consistent with the previously measured dense-chain energy/strength tradeoff, rather than a newly discovered stall bug. It does not prove the search is optimal or establish a physical bound. Strong-hit shortfalls concentrate around Believer 20–24 s, 36–40 s and 48–52 s; short L’amour 0–4 s and 8–16 s. These windows are named on the watch page.
- Strong-hit speed is not a new free lever. The November 7 energy analysis already identifies catch dissipation and arrival energy; doubling the arrival-speed price was already tried. The November 15 arrival-law trials already trade steepness against strength and body drag. Repeating those weight sweeps or adding search budget would not be a justified response to this production review.
- The longest arc run in long L’amour seed 101 consists of planned arcs (69–97.25 s), with no shaped requests replaced by upper catches. Its long float requests and a momentum model of the current supports were studied on November 15; that model is not a universal bound. Do not blame the catch permission or impose a family quota to remove this run.
- The historical explicit-score discrepancy is resolved from saved experiment cells: 24 explicit rides at four seeds give −2.8899; 96 at sixteen give −1.9048. These are different coverage, not conflicting figures. The adopted implementation’s four-seed result was +2.6 with permission stripped inside explicit windows. The new final-code audit must be read separately.
- A caller-supplied construction plan can deliberately carry `catchFromAbove`; validation neither adds nor silently removes it. Without that permission the shape must pass the ordinary realization check; benchmark explicit windows strip the permission. The misleading type comment is corrected and a regression test covers both supplied-plan cases.
- Plain upper receivers are drawn consistently, then checked against the request. Skipping every upper candidate for an unpermitted shaped request would be a new search restriction, not a proven structural cleanup: realization judges the actual curve and contacts. No such shortcut is adopted.
- Reduced realized shaped share after upper catches is a real cost to report beside fewer rails and more clean upper hits. Neither distinct-family count nor the headline erases that tradeoff. The owner previously accepted the look; the final-code audit tests the remaining quantitative reservations.

No new behavioral change is justified by the screening counts alone. In particular, do not optimize unrecorded-push flags that may be part of requested catches, or buy stronger hits through more rails. The watch collection is intended to turn the next step into a specific visual problem rather than another weight search.

## Final-code catches-from-above audit

V8, 16 seeds, 784 paired rides against `foundation-9`: 784/784 complete on both sides. Headline +0.6, 95% seed-block interval [−4.5, +5.6]; 30 specs up, 13 down. The long spec loses 11 points. Explicit requests (96 rides) change −0.9. Direct inspection of saved plans and realization verifies all 864 explicit sections, including 576 shaped sections: no permission or shape substitution inside the windows and no unfulfilled section. There are 183 permitted substitutions outside them.

Ride character: rails 39 → 34% of gaps; open arcs 49 → 52%; shapes 33 → 30%; clean upper hits 13.9 → 15.3% of strong beats. Body drag 4.50 → 4.63 s/min (+3%); strong extra impacts +2%; inverted/backward strong arrivals 14.0 → 12.8%; unrecorded pushes 0.22 → 0.20 per ride. The apparent compute-time difference is under concurrent load and is not a speedup claim.

Every impact ruler, equal-stratum mean excluding E (candidate minus reference; lower loss is better):

| Ruler | Loss difference |
|---|---:|
| contact-impact | +0.001203 |
| strike (v1) | +0.001439 |
| impact v2 | −0.000136 |
| impact v3 | −0.000171 |

The older two rulers worsen while v2/v3 improve slightly. The full report also retains every axis, guard, stratum and seed sign: `generated/eval/compare/adopted-catches-audit-v8/report.txt`. This is not a free score improvement. Retaining the owner-adopted look is supported by fewer rails and more clean upper catches, with the loss of shaped content and extra body drag explicitly acknowledged. V7.1 is also complete: 164/164 paired rides finish on both sides, headline +7.0 [1.2, 12.7], all four seed blocks positive, 26 specs up and nine down. Explicit requests +2.0; all 216 explicit sections preserve their requested construction with no substitution. Rails 34 → 30%, shapes 32 → 30%, clean upper strong catches 11.9 → 13.1%. Body drag 4.87 → 4.95 s/min; strong extras 0.02 → 0.04 per 100 beats; unrecorded pushes 0.29 → 0.21 per ride. Equal-stratum losses excluding E: contact-impact +0.000372, strike v1 +0.001949, v2 −0.000276, v3 −0.000278. Full detail: `generated/eval/compare/adopted-catches-audit-v71/report.txt`.

These audits measure the already-adopted behavior, not gains from this review’s cleanup. The cleanup removes unused proposal formats and is qualified separately by byte-identical compile/judge parity and the frozen shipped-model hash.

## Reproducing the sweep

`npm run library -- --seeds=8 --jobs=23 --publish=false --out=generated/production-sweep-NAME` declares all production songs and eight seeds through the normal checksummed, resumable library runner. Choose a fresh output directory when compiler or harness identity changes. The completed November 16 library used a local copy with the same eight-seed list before this option existed.

## Artifacts and remaining work

Local evidence: `generated/compiler-sweep-20261116/`: checksummed production library, motion diagnostics, full per-ride measurements, render logs. The saved compiler, inputs, audio and track identities remain in the library manifests.

Watch collection: `/motion-gallery/video-compare.html?collection=/generated/watch/compiler-sweep-20261116.json`. Eight plain-look, steady-zoom whole rides: diagnostic outlier and median-burden seed for four songs. These selections are not yet claimed to be visually worst or most typical.

Decision: retain the owner-adopted compiler behavior and ship the validated structural cleanup. The sweep exposes no new completion or stall failure to repair. Dense-chain strength shortfalls and long-float quiet misses remain open; the evidence does not prove they are optimal or physically unavoidable. A next behavioral experiment should address a visually confirmed passage with a new construction idea, rather than repeat the documented weight, rail, or budget trials. Sampled frame sequences were inspected; the collection leaves the final musical/aesthetic ranking to the owner.

Housekeeping: five abandoned instrumented-study scripts removed; obsolete forest predictions, residual policies, the 67-feature proposal path and their 11 MB fixture removed. The shipped 210 KB source is untouched. Proximity retrieval is retained because the construction trainer still emits it. `completeBoundary` varies with allowance; the other two option seams are retained for lower-level tests/research rather than silently changing those configurations. The normal library command now supports a declared seed count. Checks: 660 tests, typecheck, reach, 25 compile parity cells and 10 judge parity tracks pass.
