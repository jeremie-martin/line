# Reject the constant-unit norm simplification

For finite nonzero scale, the larger normalized magnitude in the two-dimensional
norm is exactly one. Replacing its division and squaring with that constant
preserves the binary64 result: addition of the two finite squares commutes.
The smaller magnitude is selected with Math.min; exceptional inputs retain the
original handling. Only two executable lines change.

The existing numerical suite passes, including arbitrary binary64 and nearby
magnitudes in both orders, signed zeros, infinities, NaNs, subnormals and exponent
boundaries. Complete default/larger compiler checkpoints are deep-strict-equal
to the accepted reference. The native binary is unchanged.

The fixed twelve-pair default screen is **+0.517%**, interval
**[−0.107%, +0.780%]**, INCONCLUSIVE at the declared zero speed margin.
Algebraically fewer operations do not establish a runtime improvement. The
candidate is removed; no guards, confirmation, full structural check, retry or
adoption follows. This does not establish a statistically supported slowdown
either. Production remains unchanged.

[Screen](engine-unit-norm-20261106-screen.json) and
[plan, patch, numerical tests and checkpoint hashes](engine-unit-norm-20261106.json)
retain the evidence.
