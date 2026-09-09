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
