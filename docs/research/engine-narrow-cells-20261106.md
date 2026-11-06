# Abandon narrower cell-coordinate conversion

Reference `1908fc83`, with production identical to `0b5402df`. Try a safe
saturating i32 conversion for interior values and retain the original i64
floor/cast path at both saturation endpoints. This preserves NaN, infinity,
signed zero, fractions and the full integer domain without unsafe conversion.

31 Rust tests, 65 saved/live physics cases and complete default/larger compiler
checkpoints pass. A private WASM harness also passes **2,002,697** direct
comparisons against the original helper across random binary64 patterns,
ordinary fractional coordinates, integer boundaries and exceptional values.
Generated solver code uses the narrower path, but retains its saturation guard
and adds endpoint routing. The optimized solver grows from 7,268 to 7,504 bytes.

Stop after **eight of twelve pairs**, with a descriptive median **+0.389%**,
two faster and six slower pairs. Even nearly 100% improvements in all four
remaining pairs would leave the fixed experiment's upper bound at +0.847%,
which cannot meet the declared 0.5% speed requirement. This is an abandoned
trial, not a completed confidence interval or regression verdict.

No larger/cold guard, fresh confirmation or full structural check follows.
Remove the helper change, tests and packaged artifacts. Accepted production is
unchanged. The [partial screen](engine-narrow-cells-20261106-partial-screen.json)
and [plan, patch, exact checks and abandonment calculation](engine-narrow-cells-20261106.json)
retain the evidence; diagnostic compiles are not performance measurements.
