# Production sweep, November 16, 2026

Compiler: `2279c1f8` (foundation-12 behavior). Default production specs, seeds 101–808 in steps of 101, standard budget, 23 concurrent workers. All 248 rides completed and qualified. Timings below are elapsed compile times under load, not isolated speed benchmarks.

This is an initial diagnostic review, not an aesthetic verdict. Speed-deficit time means gaps whose achieved normalized speed is more than 0.15 below the request; this screening threshold is not an optimization target. Repetition is the longest consecutive run of the same realized geometry family, not proof that its shapes look identical. Strong extras use the existing 0.25 strength band. Bursts use motion_check’s existing 100 ms band.

## Priorities to inspect

1. Believer and short L’amour: the largest cumulative speed deficits and strong-hit shortfalls. Watch whether these are visible stalls or merely demanding specs.
2. Long L’amour: repeated arcs (up to 28.25 s) and occasional unrecorded pushes; inspect the long float section before changing family placement.
3. Tiki and ultra-slowed Los Voltaje: roughly one unrecorded push per ride despite otherwise acceptable scores. Locate these events; the impact account can miss late turns.
4. Lua: low score without comparable speed failures. It remains held out from compiler tuning; include it only as production coverage, not as a basis for a change.
5. Trouble: all eight default-spec seeds complete. This does not prove every historical short-pair variant is fixed.

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

## Artifacts and remaining work

Local evidence: `generated/compiler-sweep-20261116/`: checksummed production library, motion diagnostics, full per-ride measurements, render logs. The saved compiler, inputs, audio and track identities remain in the library manifests.

Watch collection (once renders finish): `/motion-gallery/video-compare.html?collection=/generated/watch/compiler-sweep-20261116.json`. Eight plain-look whole rides: diagnostic outlier and median-burden seed for four songs. These selections are not yet claimed to be visually worst or most typical.

Still required: inspect the videos, localize unrecorded pushes, investigate the leading mechanism, run and review paired behavioral experiments, finish the adopted-catches audit, and close or explicitly defer the housekeeping items.
