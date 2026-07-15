# Observed Transition Packet Assay

**Status: completed study-only prerequisite.** The packet is not a compiler
source, selector, benchmark result, or a template that later geometry may
copy. It establishes whether the final path actually emitted by the normal
compiler contains a finite capture boundary from which a separate experiment
can start.

## Contract

`scripts/v0/study_observed_transition_packet.ts` runs one ordinary
WASM/500k compile at a predeclared authored transition. It retains only the
last improving register snapshot and rejects the observation unless that
snapshot reconstructs the emitted track exactly, including final key, duration,
and improvement count. There is no fallback to a deep visit, local candidate,
or historical fixture.

For a final clean path, the tool takes prefixes of the selected current fit in
source-line order. A finite capture boundary is the shortest prefix that both
owns the selected on-time contact and reproduces the complete non-visual engine
state of the final emitted track through `H + 1`, where `H` is the owned event
plus the impact-response window plus one frame. It records the measured state
and named-reference step at `H` and `H + 1`.

The direct outgoing input is restricted to its interval and literal non-event
axes. Undefined axes remain absent. A future release experiment must not read a
next impact, later target, case identity, seed, score, rank, or previous
packet result.

`--verify-output-neutrality` reruns the exact compile without the observation
callback. Track, report, and deterministic compiler-stat fingerprints must all
match; otherwise the packet is invalid.

```bash
LR_ENGINE=wasm node --import tsx scripts/v0/study_observed_transition_packet.ts \
  --case=frontier5 --verify-output-neutrality
```

## Frozen Roster Result

The `mixed-v1` roster was declared from authored topology before observation:
ordinary, dense, dense-240, normal and shifted pickup, and the 3–7 second
low-air ladder. On the current normal compiler at WASM/500k:

| Row | Result | Final selected capture |
|---|---|---:|
| ordinary | observed | 3 of 5 current-fit lines |
| pickup | observed | 4 of 6 |
| shifted pickup | observed | 3 of 6 |
| 3s low-air | observed | 4 of 17 |
| 4s low-air | observed | 3 of 17 |
| 5s low-air | observed | 3 of 17 |
| 6s low-air | observed | 2 of 17 |
| 7s low-air | observed | 2 of 17 |
| dense | unavailable | final path ends at g68 before declared g69 |
| dense-240 | unavailable | final path ends at g76 before declared g86 |

Independent output-neutrality controls passed for ordinary and 5s low-air.
Every row bound to its final emitted path. The dense outcomes are coverage
evidence, not errors and not a reason to substitute a different search visit.

## Consequence

The next bounded experiment may test a small, connected release family only on
the observed non-dense boundary. It must start at the retained capture endpoint,
use the sealed response state plus direct outgoing air/speed, and exact-replay
through the direct next contact. Dense requires a later joint
capture-and-continuation formulation; it must not receive a short-horizon
post-capture fallback.
