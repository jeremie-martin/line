# TODO

## Deferred WASM-engine optimizations

These are **deferred on purpose**. First make the normal Rust→WASM engine
rock-solid and base-optimized — i.e. structural sharing for forks done, the
Tier-3 track-hash gate (`npm run wasm:compile`) green, and the engine fast
enough for the compiler to use. Only then layer these on, each gated by the
track-hash gate (must produce a bit-identical compiled track) and the regression
oracle (`npm run wasm:all`) staying green.

### 1. Two-mode engine (fast pure-sim vs. compiler-with-history)

Only the compiler's beam search adds lines into an already-simulated trajectory,
so only it needs the collision `history` + exact invalidation. Pure forward
simulation (running a finished track, the trace oracle, rendering, dump
generation, playback) never does that and should keep the full ~53× speed.

Today `track_history` is hardcoded `true`, so history is built eagerly for every
engine — including the bulk of leaf candidates in the beam that are scored and
discarded without ever being forked. Make it a real toggle:

- pure-sim consumers create a **fast** engine (no history → no per-frame
  add_to_history cost);
- the compiler opts into **history** mode where mid-stream `addLine` needs exact
  invalidation.

Note: `add_line` already falls back to full invalidation when `track_history` is
false (so correctness is independent of the toggle); this is purely a perf lever.

### 2. Batch `addLines` (arc-level placement)

The compiler treats an arc (N segments) as one atomic placement and adds all of
its lines before reading anything. A batched `addLines([...])` does **one fork +
one invalidation** (truncate to the minimum first-collision frame over all the
arc's lines) instead of N forks/invalidations — cutting the per-arc overhead by
~the arc size.

Result is identical because adding lines one-by-one with no reads between equals
the batch (truncation only shrinks → sequential == min == batch). Implement on
both engines (lr-core wrapper as a sequential reduce; WASM as a true batch) and
switch the compiler's `for (line of fit.lines) eng = eng.addLine(line)` sites
(scripts/v0/core/candidate.ts, polish.ts, optimizer/handoff.ts, node.ts) to
`eng = eng.addLines(fit.lines)`. Gate on the track-hash check.
