# Arc 850 campaign

The owner requests **strictly greater than 850** on the fixed canonical 750k
Benchmark V2 headline. Starting point: `arc-control-policy`, **828.1228**, all
352/352 canonical runs valid, preserved at `1bf6954a`. Work branch `codex/arc-850`.
The substantial connected normal arc constraint remains. The benchmark, score,
targets, detector, physics and accounting are unchanged. Research compute is
unrestricted; the delivered compiler must earn its headline within 750k.

## Initial investigations

1. Reconcile the optimizer's interval loss against the final scorer's actual
   observations. Construction measures through the frame before the next contact;
   the final span includes the contact boundary. Quantify the discrepancy and
   investigate joint boundary-aware selection without changing measurement rules.
2. Improve the learned joint proposal distribution. The existing teacher predates
   the current policy and covers a different arrival distribution. Measure stronger
   policy-assisted teachers and test subsequent learned proposals, with complete
   parent exclusion and independent physical replay.
3. Examine search allocation and local refinement after good learned proposals.
   Broad exploration, response steps, continuation probes and completed-track
   repair may now have different marginal returns. Compare complete-suite results
   before accepting pilot gains.

Large immutable panels live under `generated/benchmark-v2/arc-850/`. Each panel
binds source, options, inputs, judge and suite hashes. Keep all failed trials.
The previous 825 archive remains unchanged. Code and compact evidence are pushed;
large research and video bundles remain local.

## Measured progress

The baseline audit binds the actual 828 canonical tracks to rich records. The
local-to-final RMS discrepancy is 0.0238 for air, 0.00318 for speed, and 0.02194
for amplitude (pooled observations, not a new headline). Most scheduled contact
times equal authored frames. Some large dense-case air errors are bounded by the
unchanged detector's six-frame minimum flight; removing that requirement would
change the task and is not an option.

Two boundary treatments were tested. Predicting a grounded final frame improves
the pilot but reaches only 829.7879 on the full suite. A measured correction to
the preceding gap works better: when placing the next curve, measure the now
complete preceding span and replace its earlier truncated estimate in planning
cost. The final scorer and measurements are unchanged. This reaches **832.9731**,
44/44 valid.

Within-track memory of selected controls reaches **833.1900**, 44/44. It retrieves
nearby relative physical states and upcoming targets, adapting heading and support
duration before ordinary physical evaluation. Combining it with the boundary
correction reaches **837.4177**. Four memory proposals work better here than twelve;
more candidates do not automatically improve a fixed physical allowance.

A new policy-assisted 6M research teacher reaches 828.1114 (44/44), with at most
3,636,388 frames actually used. More search by itself does not establish a better
headline. Its verified trajectories nevertheless supply useful new arrivals.
Aggregating the original teacher, the accepted compiler and the new teacher gives
12,168 replay-verified examples. A deeper joint forest reaches **836.3153** alone;
with boundary correction and within-track memory it reaches **844.6985**, 44/44.

The compiler also tests reuse of measured local response matrices. These propose
adjusted controls for a nearby state and changed targets; their predictions never
replace physical evaluation. Four response proposals raise the full result to
**848.0063**, 44/44. Eight reach 847.4472. More joint-response work, weaker value
priors, altered neighbor metrics, broader control diversity and response damping
have not yet established another gain. All adverse trials remain in the records.

Another policy iteration, trained on 16,224 verified rows including the 844
compiler's trajectories, reaches **847.1539** with the original memory settings.
Combining it with response reuse reaches only 846.5776. Improvements must be
measured together rather than added arithmetically.

The next investigation combines learned proposals with nearby complete control
examples. Runtime data contains relative state, future targets and normalized
controls, excluding source, frame, index, seed and absolute coordinates. Like the
online memory, it proposes ordinary coherent curves for physical evaluation.
It is additional development-trained knowledge; qualification, jitter and
conditional family-exclusion checks must be described honestly, not presented as
a fresh independent end-to-end holdout.

## Evidence storage correction

Large policies were repeated in every research result and again in stdout. This
exhausted storage while four pilot panels were writing their last four cases.
The 16 interrupted writes are logged as infrastructure failures and retried; no
valid checksum-bound result is silently replaced. They are not compiler failures.

The preceding campaign's redundant extracted files were removed only after each
file matched its fully verified local archive. Completed stdout files were removed
only where their JSON was proven identical to the retained primary record with
reports/rows omitted and track geometry reduced to its line count. New study
records store each loaded model once per panel, with an artifact hash and atomic
publication. A paired replay matches geometry, reports, scores, counts, planning
and memory observations exactly; a 13.8 MB record becomes 1.31 MB. These changes
affect research storage, not compiler behavior or the fixed benchmark.

## Selected integration

The forest plus nearby controls from the 844 trajectories reaches **852.1248**
on all 44 development specifications within 750k, all valid. Using the full
16,224-row example collection instead reaches 850.8774. The selected model combines
12,168 forest-training rows and 4,056 measured examples, with a 2:1 proposal split.
Public integration reproduces every selected track, report, score and simulated
frame count exactly. The 1M panel reaches 851.7820, 44/44 valid.

An unconditional boundary correction regressed 150k to 481.5733, 40/44 valid.
Three complete-suite ablations isolate the cause: disabling boundary correction
restores 509.7855 and 41/44 validity, while restoring the old proposal model alone
changes nothing. Joint guidance and learned proposals are absent at this allowance.
The delivered allocation enables complete-boundary correction with joint guidance,
preserving the low-allowance search and retaining the full 750k proposal settings.
This is a work-per-ride-frame allocation, without case or benchmark-budget keys.

The 47 focused tests pass. TypeScript still reports the same 251 inherited
diagnostics as the accepted compiler, with no added diagnostic after normalizing
line positions. Canonical confirmation and independent physical stress remain
required before this exploratory score is accepted.

## Canonical acceptance

The normal sequential command declared a maximum of 48 seeds and accepted at its
first complete N=8 look: **852.1248**, a **24.0020** gain over 828.1228. All 352
runs pass over the entire 44-case V2 development suite, seeds 16–23. Zero jitter
makes these 44 distinct tracks repeated eight times. The compiler, scorer,
suite, targets, detector, engine and frame-accounting identities are checked in
the final validation evidence. Only the compiler identity changes.

The promoted baseline is `arc-control-memory`; measured compiler commit
`5c397b51`. All four strata improve: representative +23.2974, capability +17.1992,
legacy regression +26.4465 and development music +49.3848. Forty-three cases
improve; `river_reentry_tempo_fast_5` regresses 0.8779. Across the 44 canonical
geometries, actual physical work falls from 32,674,591 to 32,495,197 frames.
No wall-clock speedup is claimed: the larger model and neighbor search add CPU
and memory work outside the benchmark's physical-frame unit.

Independent jittered compilation produces 176 distinct valid tracks across
four seeds and all 44 cases, within 750k. Its unweighted mean is **839.0565**,
up from 814.4260. Five conditional family-excluded final policies score
**846.4560**, 44/44 valid. Families are excluded from both the forest and example
datasets, but upstream teacher policies and the unchanged runtime future-value
prior were already development-trained; this is not a fresh independent
end-to-end holdout. The reused qualification sidecar
passes 120/120, with monitor **785.4969** versus 764.1572. Its budget scores are
672.5495 at 250k, 791.5388 at 500k and 850.7253 at 750k.

The low-budget output exactly matches the prior compiler's 509.7855 and 41/44
validity at 150k. The 1M result is 851.7820, improving on 831.0704 but below the
new 750k result. Reliable aggregate scaling beyond the canonical allowance
remains an opportunity. The existing standing-time creative floor is also
separate from the successful physical contract and remains unmet.

The canonical geometry audit joins every track hash to its rich record: all
normal type 0, 4,100 interval groups comprising 625 single and 3,475 paired
curves. The shortest connected curve is 10.4588 units. The primitive generator
is unchanged. Seventy-two checksum-verified panels, including adverse trials,
are indexed in `benchmark/v2/studies/arc-850-research.json`.

## Local preservation and rendering recovery

All raw panels, datasets, models and prototype source changes are preserved in
`archives/arc-850-852/raw-panels.tar.zst`: 5,414 files, 12,988,303,186 uncompressed
bytes, 839,031,896 compressed bytes. Every inner file was hash-verified. After
the compact summary completed, 4,114 redundant extracted files (11,347,795,886
bytes) were removed only after matching the verified archive. The retained
reclamation record lists every path; `tar --zstd -xf` restores them at repo root.

Two initial simultaneous Remotion overlays failed with browser page crashes;
Luna explicitly logged `ERR_INSUFFICIENT_RESOURCES`. Both failures and logs are
retained. `LR_REMOTION_CONCURRENCY` now allows a positive integer worker limit
without changing the locked rendering recipe. Those videos are retried
sequentially with four compositor workers. Their already-verified compiler
outputs are reused. Tiki Tiki's original render completed normally.


All three full 1080×1920, 60fps production review videos are complete and decode
without errors. Six sample frames were inspected. Production scores are
915.0055 (Amor na Praia), 902.9911 (Luna Bala), and 822.5694 (Tiki Tiki), using
the unchanged 1M production settings. Their 0% standing time remains below the
original creative floor. See [the video review](arc-850-video-review.md) and
[the complete validation](../benchmark/v2/studies/arc-850-validation.json).
The final source and completion evidence are archived locally, with a pushed
[archive index](../benchmark/v2/studies/arc-850-local-archive.json). The compact
[prototype patches](../benchmark/v2/studies/arc-850-prototypes/README.md) preserve
the alternative implementations without publishing the large raw archive.
