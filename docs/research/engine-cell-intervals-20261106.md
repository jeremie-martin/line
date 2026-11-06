# Abandon redundant cell-validity removal

Reference `1908fc83`, with production identical to `0b5402df`. Remove
`PointCell.valid`: successful finite interval comparisons already imply
nonempty bounds. Default and saturated bounds are empty; NaN coordinates never
hit. A finite coordinate can safely hit cell-zero bounds populated by a prior
NaN input. Keep division, floor/cast, hash and interval arithmetic unchanged.

31 Rust tests, all 65 saved/live physics cases and both complete compiler
checkpoints pass. A private WASM harness passes **3,033,246** comparisons of
cached keys and both integer coordinates against fresh calculations after
exceptional transitions, representability boundaries, repeated points and
random binary64 inputs. The packaged WASM shrinks by 410 bytes to 94,236 bytes.

Stop after **four of twelve pairs**, all slower, with descriptive median
**+1.181%**. Even nearly 100% improvements in the remaining eight pairs would
leave the fixed experiment's upper bound at +1.107%, which cannot meet the
declared zero-margin speed requirement. This is an abandoned trial, not a
completed confidence interval or regression verdict. Fewer fields and fewer
source operations do not guarantee a runtime win; no causal explanation is
established by this screen.

No larger/cold guard, fresh confirmation or full structural check follows.
Remove the source/test change and packaged artifacts. Accepted production is
unchanged. The [partial screen](engine-cell-intervals-20261106-partial-screen.json)
and [plan, patch, exact checks and abandonment calculation](engine-cell-intervals-20261106.json)
retain the evidence.
