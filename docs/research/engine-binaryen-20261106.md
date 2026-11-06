# Pinned Binaryen convergence trial, November 6

Reference `036c4517`. No production change is adopted; the last qualified default
result remains 7,172.5 ns per charged physics frame.

Pinned Binaryen 133 `-O3 --converge` reduced the current WASM from 94,646 to
83,199 bytes (12.1%). All 65 saved physics cases and complete compiler checkpoints
for cells 61/62 matched. The independent judge remained unchanged.

| Fixed experiment | Paired median change | Exact median interval | Verdict |
| --- | ---: | ---: | --- |
| Default screen, 12 pairs | −0.795% | [−1.167%, −0.448%] | FASTER |
| Larger guard, 12 pairs | −0.321% | [−1.105%, +0.036%] | EQUIVALENT within 2% |
| Cold guard, 12 pairs | +0.104% | [−0.192%, +0.793%] | EQUIVALENT within 5% |
| Fresh default confirmation, 24 pairs | −0.856% | [−1.220%, +0.086%] | INCONCLUSIVE |

CPU 2, five warmups and three measured compiles per process (cold: zero and one).
All measured and warmup compiles preserve exact tracks and charged frame counts.
All declared resource bounds passed. Exact interval coverage is 96.14% for twelve
pairs and 97.73% for twenty-four, at 95% requested confidence.

Confirmation did not establish a speedup, and the median gain missed the
prospectively declared 1% design minimum for adding a build dependency. The
candidate is removed. The remaining isolated replay, full validation and
reproducible rebuild adoption gates were therefore not run. Neither the smaller
binary nor the promising screen overrides the confirmation or design gate.

[Plan, source patch, tool provenance and validation](engine-binaryen-20261106.json),
[screen](engine-binaryen-20261106-screen.json),
[larger guard](engine-binaryen-20261106-larger.json),
[cold guard](engine-binaryen-20261106-cold.json), and
[fresh confirmation](engine-binaryen-20261106-confirm.json) preserve the evidence.
