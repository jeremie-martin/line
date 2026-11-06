# Profile after partial-prefix reuse, November 6

Reference `0b5402df`. Repeat the [compiler-scoped profile](engine-scoped-profile-20261106.md)
with the same boundaries: separate CPU/allocation processes, five warmups,
three CPU profiles at 250 µs and two transient-inclusive allocation profiles at
16 KiB, on CPU 2. All fifteen compiles preserve the exact default track and work.
No formal timing experiment overlaps collection.

The three CPU profiles total 3,330.7 ms. Ordinary native stepping accounts for
966.3 ms (29.0%), direction-filter rebuilding 162.8 ms (4.9%), registration
126.9 ms (3.8%), and garbage collection 194.5 ms (5.8%). Function names are
consistent with the unchanged native binary and earlier symbol diagnostics.
These are sampled attribution, not incremental speed measurements.

The two allocation profiles estimate 1.573 GB total. Raw-frame decoding is
158.7 MB, geometry-path construction 151.8 MB, impact observation 95.8 MB,
strike detection 92.6 MB, and strike-frame construction 89.3 MB. These measure
allocation traffic, not live memory or peak RSS. The earlier profile estimated
281.2 MB at raw-frame decoding, consistent with the accepted reduction in reads;
the sample estimates are not a statistical memory-saving claim.

The archived body-wide direction-filter audit already predicts more work, so
that mechanism is not repeated. Deeper generated-code profiling is the next
step for understanding the remaining solver cost. Linux perf remains unavailable
under the host's perf_event_paranoid=4 setting; V8 profiling needs no host change.

[Scopes, samples, exact iterations and scripts](engine-post-prefix-profile-20261106.json)
include hashes and paths for raw profiles under `generated/`.
