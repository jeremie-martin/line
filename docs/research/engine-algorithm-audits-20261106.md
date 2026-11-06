# Algorithmic opportunity checks, November 6

Reference `c8f86498`; production code remains identical to `8bfb6f9e`.
None of these candidates is adopted. The last qualified default result remains
7,172.5 ns per charged frame; the 7,000 ns target remains open.

| Mechanism | Evidence | Decision |
| --- | --- | --- |
| Seed the nearest-neighbor heap from recent examples | Complete 12-pair default screen: +0.176%, interval [−0.855%, +0.456%], INCONCLUSIVE. All 21 focused tests and complete default/larger checkpoints match. | Remove the traversal change; no confirmation or full adoption suite. |
| Share an exact authored-future suffix lower bound | Excludes 500,998/790,403 default calls and 1,582,591/2,353,774 larger calls. However, 720,792/790,403 and 2,155,588/2,353,774 suffix calculations are unique. | Fails the declared ≤25% distinct-suffix gate. Actual default construction uses the V3 model, whose sharing differs from the older V6 artifact. No cache implementation. |
| Scan a one-axis model index outward from the query | Every captured nearest page matches (195/600 pages). Three warmup blocks, 12 alternating local pairs: indexed retrieval is 19.3%/15.9% slower. Only about 6% of distance calls disappear. | Fails the declared 20% local improvement prerequisite; no compiler trial. Unlike the earlier single-axis per-row probe, this tested sorted traversal and early termination. |
| Bound every direction predicate in a cached collision neighborhood | All predicted predicates and both complete checkpoints match. Bounds cover 18.18%/18.17% of direction tests; building them would visit another 15.10%/14.20% as many lines. | Fails the declared 50% exclusion gate. No production bound or cache metadata. |

The heap screen uses the established v3 protocol: CPU 2, pinned Node 22.22.2,
12 balanced randomized fresh-process pairs, five warmups and three measured
compiles per process, zero practical speed margin. Requested confidence is 95%;
the exact interval has 96.14% coverage. Both arms preserve every measured track
and charged frame count. Complete checkpoints compare all compiler outputs,
not just track hashes. No heavy work ran alongside timing.

The other rows are feasibility diagnostics, not compiler speed claims. The axis
microbenchmark uses saved actual queries from the November 5 study; subsequent
changes preserve compiler behavior. Full candidate validation is reserved for a
candidate that proceeds toward adoption.

A startup check also rules out a smaller nursery increase: default Node and
explicit 16 MiB semi-space limits both report a 4,144 MiB heap limit; explicit
32 MiB reports 4,192 MiB. The earlier 24 MiB request rounds up to 32 MiB. No new
runtime experiment or configuration was added.

[Plans, code, counts and exact-check evidence](engine-algorithm-audits-20261106.json)
and the [complete heap screen](engine-recent-seed-20261106-screen.json) preserve
these decisions. Large checkpoints are retained under
`generated/engine-algorithm-audits-20261106/`, with hashes in the evidence.
