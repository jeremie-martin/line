# Reject the fused detector traversal

Reference `1908fc83`, with production identical to `0b5402df`. Accumulating
contact/air summaries during detection removes a second ordered traversal and
its cursor. It keeps one set of equations and reduces production by eight lines.
The summary still includes the terminating frame and respects prefix lookahead.

The frozen-original differential passes 37,800 comparisons across random
trajectories, custom persistence/stall settings, shorter/longer and alternate
continuations, exceptions, empty windows and exceptional numeric inputs.
Focused tests and typechecking pass; a new termination-summary test covers all
four termination reasons, repeated continuations and already terminated prefixes.
Both complete compiler checkpoints match the reference exactly.

The fixed twelve-pair default screen is **−0.317% [−1.116%, +0.270%]**,
INCONCLUSIVE at the declared zero margin. It does not qualify. No larger/cold
guard, fresh confirmation or full structural check follows. Candidate source
and tests are removed; production remains unchanged.

[Screen](engine-fused-detection-20261106-screen.json) and
[plan, patch, differential driver and validation logs](engine-fused-detection-20261106.json)
preserve the experiment. No timing claim is inferred from fewer traversals.
