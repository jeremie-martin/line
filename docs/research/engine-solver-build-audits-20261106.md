# Solver and build-policy probes, November 6

Reference `b6ab90bf`; no production change is adopted. The last qualified default
result remains 7,172.5 ns per charged physics frame. These trials preserve their
prospective gates and do not establish a new performance result.

| Candidate | Evidence | Decision |
| --- | --- | --- |
| Pair three adjacent disjoint stick constraints | SIMD128 computes independent distance/correction factors with unchanged scalar updates. 32 Rust tests, 65 saved physics cases, complete checkpoints for cells 61/62, and 2,167,042 independent actual-WASM/scalar numeric comparisons pass. | Stop after four losing pairs: +4.86%, +5.68%, +6.57%, +6.69%. Remove the helper, SIMD requirement, tests and documentation. |
| Standard LLVM `opt-level = 2` | WASM shrinks 94,646 → 89,250 bytes. All 65 saved physics cases and both complete checkpoints match. | Stop after six losing pairs: +0.47%, +0.92%, +1.40%, +2.02%, +1.98%, +0.79%. Restore `opt-level = 3`. |
| Reuse main-curve displacement schedules within an interval | Exact input-identity shadow, no work skipped. Complete checkpoints match. Only 6,518/229,798 default integration steps repeat (2.84%); larger repeats 147,080/1,211,270 (12.14%). | Both fail the declared 30% opportunity gate. No schedule cache or new geometry abstraction. |

Both speed trials planned 12 balanced randomized fresh-process screen pairs and
24 fresh confirmation pairs, on CPU 2 with five warmups and three measured
compiles per process. The losing screens were explicitly abandoned. Their
partial records are descriptive observations, with no completed confidence
interval, verdict or performance qualification. No heavy work ran alongside them.
All completed timed and warmup compiles retain exact track hashes and charged
frame counts. Neither candidate reached the full adoption gate or confirmation.

The SIMD comparison checks exact non-NaN binary64 bits, including signed zero;
NaNs must remain NaNs, without a payload-identity promise. Its numerical probe
binary was never timed. The public state/cache layout and solver order were
unchanged; disjoint endpoints made the paired arithmetic independent. Correctness
was sufficient to test the idea, but the runtime loss ruled it out.

[Plans, patches, scripts, validation and counts](engine-solver-build-audits-20261106.json),
[partial paired-constraint screen](engine-stick-pairs-20261106-screen.json), and
[partial LLVM-level screen](engine-opt2-20261106-screen.json) preserve the work.
Large checkpoints remain in `generated/engine-solver-build-audits-20261106/`,
with hashes in the record.
