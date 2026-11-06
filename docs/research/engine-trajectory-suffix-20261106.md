# Fixed-length candidate trajectory trial, November 6

Reference `036c4517`, production identical to `8bfb6f9e`. No change is adopted.
The [scoped allocation profile](engine-scoped-profile-20261106.md) identified
about 19 MB per compile in repeated trajectory-prefix array copies. The candidate
allocated one complete trajectory array on the first successful reusable replay
of an interval, then overwrote only its fixed-length suffix. The immutable prefix
remained separate for terminal scoring; candidates retained owned facts.

Unlike the November 4 combined trial, this tested container reuse alone and never
truncated or grew the array. Typecheck and twenty focused tests passed, including
frozen prefix, non-writable array length, successive controls, retained candidate
facts and terminal scoring. Complete checkpoints for cells 61/62 matched.
A separate shadow compared all 34,379 successful candidate trajectories to full
native reads, including 1,125 invalidated-prefix replays. Both complete shadow
checkpoints also matched. No source change affected physics or its work meter.

The fixed 12-pair screen on CPU 2, five warmups and three measured compiles per
process, measured −0.462% with exact interval [−0.739%, +0.031%]: INCONCLUSIVE
at a zero practical margin and 95% requested confidence (96.14% exact coverage).
Every timed/warmup/resource compile preserved track hashes and charged work;
resource guards passed. The supported-speedup gate failed, so no larger/cold
guards, fresh confirmation or full validation gate ran. Source and tests were
restored. The last qualified default remains 7,172.5 ns/frame.

[Plan, patch, validation, audit counts and reproduction scripts](engine-trajectory-suffix-20261106.json)
and [fixed screen](engine-trajectory-suffix-20261106-screen.json) retain the evidence.
