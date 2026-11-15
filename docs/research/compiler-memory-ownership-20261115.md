# Compiler memory ownership audit

Continue from the checked throughput foundation, `89be84e6`. Prefer removing
unneeded ownership and respecting resource limits to pools, packed representations,
runtime flags or low-level tuning. Geometry, search decisions, physics work and
scores must remain unchanged.

## What the audit found

The main engine has explicit scoped disposal on success and failure. Lineage uses
weak engine keys; memo contexts have a 32-context limit. The recovery frontier
keeps only selected candidate facts rather than entire candidate pools and bounds
its history. Candidate replay already reuses its prefix array. Model loading was
not the source of the observed hundreds of MiB: live JS heap after input preparation
was about 12 MiB in the plain Node diagnostic.

There is substantial temporary allocation during search (14.46 GB sampled traffic
for standard Luna in the preceding study), but allocation traffic is not live
memory. In a diagnostic compile with forced collection at selected sequence
boundaries, live JS heap was 12 MiB before search, 68–73 MiB at sampled middle
boundaries, 110.4 MiB near the end, and 13.3 MiB after completion while retaining
the result. The last search sample contained 32 memo contexts, 11,419 entries,
6,164 viable candidates and 462,870 candidate line references. This single run
does not show a persistent leak.

Two small changes follow from concrete ownership/resource boundaries.

## Release search memo before final verification

The compilation context remains reachable during finalization, including its
memoized rejected/alternative candidates. Finalization needs the committed track,
rows and measurements, but never reads the search memo. Clear that map after
search ends and before entering finalization, including the handled budget-exhaustion
path. Do not mutate candidate facts: retained selections and study-owned references
remain valid. No new shared cache or representation is introduced.

A diagnostic wrapper sampled live heap at entry to the existing finalizer, in
separate fresh processes running the same standard Luna compile:

| | Before | After |
|---|---:|---:|
| Memo contexts | 32 | 0 |
| Live JS heap after collection, MiB | 121.03 | 28.85 |
| Heap after initial preparation, MiB | 22.05 | 22.05 |
| Whole-process peak RSS, MiB | 446.28 | 456.99 |

The 92.18 MiB live-retention reduction is at this boundary. **It is not a
whole-compile peak-memory or speed improvement.** These diagnostic runs force GC,
use a test wrapper and include its overhead; neither peak RSS nor their timing
qualifies as a production performance comparison. There is no forced collection
in production. Both tracks and charged work match the committed reference exactly.
The earlier plain-Node run and these test-wrapper runs have different fixed overhead.

## Respect process memory constraints when sizing workers

The old default capped workers from host RAM alone. A process limited to 4 GB on
a 64 GB host could therefore choose many more workers than its limit can support.
Use the lesser of host RAM and `process.constrainedMemory()`, treating zero as an
unknown constraint. The existing 2 GB/worker estimate, CPU cap, minimum one worker,
maximum 23, and explicit `--jobs` override stay intact. This is not a reservation
or coordination mechanism between separately launched commands.

On this unrestricted i7-12800H the constraint is an unlimited sentinel, so the
default stays twenty. Tests cover finite, unknown and unlimited constraints and
confirm explicit overrides. The host currently has ample RAM; this fixes a
portability defect, not a measured out-of-memory incident here.

## Verification and limits

Focused tests verify that the memo is populated during search, empty when
verification begins, and that selected candidate facts remain unchanged. Existing
memo-reuse, cleanup and interruption tests pass. Runtime constraint tests pass.
Six full compiles alternating Luna and Tiki in one process reproduce their
expected tracks and charged work. After dropping each result and collecting,
live JS heap stays between 12.37 and 12.71 MiB. That provides no evidence of
large per-compile live-heap accumulation in this sample; it is not a proof against
all leaks, and RSS need not fall when the runtime retains reserved pages.
Full `npm run check` passes in 2.4 minutes: 628 tests, 32 Rust tests, exact
physics/engine checks, all 25 compile parity cases, 10 judge parity tracks and
end-to-end smoke. Parity references are unchanged.

Raw diagnostics live under `generated/memory-audit/`. The temporary boundary test
and its instrumentation were removed. No output labels, scoring definitions,
parity expectations, speculative tuning or diagnostic GC calls are changed.
