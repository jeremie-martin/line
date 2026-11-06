# Read cached contacts without constructing full update streams

Accepted on `perf/compiler-after-foundations`, against `23ee2074` (production
identical to `0b5402df`). Fresh default confirmation improves paired compile
time by **4.419%**, with an exact interval **3.983–4.552% faster**. Separate arm
medians are 7,022.45 → **6,723.99 ns per charged physics frame**. This includes
search, observations and independent replays; it is not isolated solver cost.
The 6,500 ns target remains open.

The broader profile pointed beyond solver arithmetic. Contact-only consumers
were creating complete Step/Constraint/Collision update streams and then
filtering almost all of them out. The independent judge adapter now reads contact
presence and first-occurrence unique IDs directly from its existing event
transport, with explicit cached-frame validation. Guide trimming becomes a pure
geometry/contact operation; pruning and construction preservation share one
all-point contact snapshot. Production realization consumes the direct IDs too.

The consumers depend on contact presence, empty/nonempty frames and
first-occurrence ordering; collision multiplicity does not change their result.
Lists are owned, and neither consumer mutates the shared snapshot. General
ordered-update APIs remain available for consumers and oracle checks that need
them. Neither WASM binary nor either Rust physics implementation changes. There
is no new native export, runtime option, persistent cache or alternate solver.

## Fixed measurements

CPU 2, Node 22.22.2, Rust 1.95.0, i7-12800H, 16 GB. Protocol v3 uses balanced
randomized fresh-process pairs, five warmups and three measured compiles per
process. Twelve screen/guard pairs and 24 fresh confirmation pairs request 95%
confidence; exact discrete coverage is 96.14% and 97.73%. Cold testing uses zero
warmups and one compile. No heavy work overlaps timing. The practical speed
margin was declared at 0.5%, with larger/cold upper regression bounds of 2%/5%.

| Experiment | Median paired change | Exact interval | Decision |
| --- | ---: | ---: | --- |
| [Default screen](engine-contact-readers-20261106-screen.json) | −4.347% | [−4.718%, −3.274%] | FASTER |
| [Larger guard](engine-contact-readers-20261106-larger.json) | −0.647% | [−0.922%, +0.094%] | Guard passes; EQUIVALENT within 2% |
| [Cold guard](engine-contact-readers-20261106-cold.json) | −1.943% | [−2.404%, −1.564%] | Guard passes; EQUIVALENT within 5% |
| [Fresh default confirmation](engine-contact-readers-20261106-confirm.json) | −4.419% | [−4.552%, −3.983%] | FASTER; qualified |

The median of paired changes need not equal the ratio of separate arm medians.
All **800 warmup, measured and resource compiles** preserve tracks and charged
work exactly. Separate resource probes keep WASM capacity unchanged in every
stage. Peak RSS ratios are 1.0017, 1.0074, 0.9873 and 0.9867 respectively, within
the predeclared 1.15 bound. These individual probes do not establish retained
memory or allocation savings. No isolated stepping claim is made: simulation
and registration are unchanged.

## Correctness and design

The full `npm run check` passes: zero type errors/unreachable files, **451 JS
and 31 Rust tests**, 65 saved/live physics cases, 63 compiler cases and 33 judge
tracks. Both complete default/larger checkpoints, including reports, counters,
signed zero and JSON field order, match the reference.

The live gate now verifies both adapters' cached contacts against the original
full judge event stream. A separate unmodified `lr-core` comparison passes all
65 corpus cases: **68,827 frames and 432,018 collisions**. Unit tests cover
invalid and unsimulated reads, sibling invalidation, first-occurrence ordering,
frame zero and unchanged metering. Another **2,000** randomized reductions match
the frozen original guide trimmer, including duplicates and fragment exclusions.

The final audit recomputes all timing verdicts, checks every recorded track/work
pair and resource bound, and verifies frozen source identities and both unchanged
WASM hashes. The [evidence archive](engine-contact-readers-20261106.json) contains
the prospective plan, patch, study drivers, validation logs and verification.
Large checkpoints and diagnostic profiles remain under
`generated/engine-contact-readers-20261106/`, with hashes in the archive.

## Fresh diagnostic profile

After all validation and timing, repeat the established scoped profile on CPU 2:
separate CPU/allocation processes, five warmups, three CPU profiles at 250 µs
and two transient-inclusive allocation profiles at 16 KiB. All fifteen compiles
preserve exact tracks and charged work. Inspector operations, input preparation
and serialization are excluded from the reported compilation scope.

The CPU profiles total 3,152.9 ms. Ordinary native stepping accounts for 927.0 ms
(29.4%), direction-filter rebuilding 171.4 ms (5.4%), registration 161.8 ms
(5.1%), garbage collection 178.0 ms (5.6%), and nearest-control retrieval
110.4 ms (3.5%). Guide pruning and trimming now sample at 11.1 and 3.4 ms,
compared with 41.1 and 25.4 ms in the previous exact-source profile. This is
consistent with eliminating update-stream construction; the paired experiment,
not this attribution comparison, establishes the speedup.

The two allocation profiles estimate 1.494 GB of traffic. Raw-frame decoding
(153.7 MB), geometry construction (152.0 MB), strike detection/construction
(90.6/90.4 MB) and impact observation (82.8 MB) remain substantial sources.
These are sampled allocations, not retained memory or RSS. The profile and its
scripts are archived for the next investigation; no further optimization is
inferred or adopted from these counts.
