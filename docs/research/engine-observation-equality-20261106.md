# Equal replayed observations, November 6

Reference `0b5402df`, last qualified default **6,979.3 ns/charged physics frame**.
The new target is <6,500 ns. This candidate is rejected; production is unchanged.

A shadow audit finds all 256 default and 869 larger-workload partially invalidated
prefixes observationally identical after required replay. Only 266/895 frame
comparisons could avoid 107/358 detector rebases and four larger terminal-prefix
fallbacks. The complete checkpoints match. The candidate uses Node's whole-value
`isDeepStrictEqual` at the existing evaluation boundary, restoring immutable prefix
identity only until the first differing observation. It adds no field, cache or
numeric tolerance.

Typecheck and 21 focused tests pass, including an injected changed contact record
with unchanged coordinates that must still rebase detection. Both complete
compiler checkpoints match. Full-trajectory/full-detection shadows match all
34,379 workload replays plus 9,304 transfer-layout replays (7,142 observed
receivers); complete transfer results also match.

The fixed 12-pair screen (CPU 2, five warmups, three compiles per fresh process,
zero margin, 95% requested confidence) is INCONCLUSIVE: −0.370%, exact interval
[−1.031%, +0.567%], coverage 96.14%. Every warmup/timed/resource compile retains
exact track and charged work; resource bounds pass. No guards, confirmation or
full validation gate follow. Restore source and tests, preserving the small
accepted partial-prefix implementation.

[Plan, patch, diagnostics and validation](engine-observation-equality-20261106.json)
and [fixed screen](engine-observation-equality-20261106-screen.json) retain the evidence.
