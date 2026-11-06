# Reject bounded interior cell certificates

Reference `1908fc83`, with production identical to `0b5402df`. Replace the
existing scaled-coordinate cache bounds with conservative world-coordinate
interiors inside the existing bounded cell domain. A padding derived from
binary64 precision certifies hits without dividing either coordinate; boundary
and out-of-domain inputs retain the original division/floor/hash path. No new
cache or state fields are introduced. This differs from earlier general-domain
world-bound candidates by avoiding their per-bound representability checks.

An instrumented shadow executes every original operation and asserts each
proposed certificate. Default/larger workloads preserve complete checkpoints;
5,790,858 / 29,324,916 queries qualify (85.7% / 86.1%), losing only 2 / 27 original
hits. The candidate passes 32 Rust tests, including over 1.3 million boundary
probes, all 65 saved and live physics cases, and both complete compiler
checkpoints. The packaged WASM grows from 94,646 to 94,899 bytes.

The fixed twelve-pair default screen is **+0.597% [−0.122%, +0.806%]**,
INCONCLUSIVE at the declared 0.5% margin. It does not qualify. No larger/cold
guard, fresh confirmation or full structural check follows. All candidate
source, tests and artifacts are removed; accepted production remains unchanged.

A subsequent generated-code inspection confirms the hit path skips both
divisions. Misses now serialize the x conversion/check before the y division,
and rebuilding world bounds adds work. These observations do not establish why
the compiler-level timing failed; they prevent attributing it to a missing
compiler transformation. Optimized solver code remains 7,268 machine-code bytes.

[Screen](engine-bounded-cells-20261106-screen.json) and
[plans, patch, audit, drivers, validation and artifact hashes](engine-bounded-cells-20261106.json)
preserve the evidence. Fewer executed divisions were insufficient for adoption.
