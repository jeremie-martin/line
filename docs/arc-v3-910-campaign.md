# Arc V3 910 campaign

Target: at least **910** on frozen V3 at 750k actual compiler physics frames.
Starting compiler: `fe7616c8`, canonical **901.0923**, 176/176 valid runs over
88 specifications × seeds 16/17. Preservation: `archive/arc-v3-901`.

The first investigations examine transfer from deeper search and allocation
between refining individual arcs and comparing continuations. Existing teachers
reach 916–922 at larger research budgets, but the best teacher did not produce
the strongest standard-budget compiler. The production proposal forest still
comes from the earlier V2 campaign; V3 controls currently enter as nearby
examples. Joint regression on replay-verified V3 controls is a distinct transfer
hypothesis to test, not an assumed improvement.

The benchmark/scorer and coherent normal-arc requirement remain fixed.
Full raw results live under `generated/benchmark-v3/arc-910/`.

## Initial controlled studies

A zero-option 20-case control reproduces all 901 track hashes and frame counts.
The more detailed V3 916 ExtraTrees proposal model (32 trees, depth 14, leaf 4)
improves the pilot arithmetic mean by 5.64151, but reaches only **901.8144**
on the full 88-case seed-16 panel, all valid. This is a research result, not a
canonical promotion. Coarser/finer models and splitting the existing proposal
quota across old/new forests regress. A wider quota is tested separately.

Optional learned guidance blends the arrival-value estimate into local curve
refinement, preserving physical residuals and the reported objective. Weight
0.25 gives a mixed +0.4225 pilot mean; 0.5 regresses by 5.263985. Combining it
with the new proposal forest underperforms that forest alone in the pilot.
It remains disabled. The loss algebra is covered by independent tests.

The baseline spends 25,093,440 of 65,214,403 compiler frames on continuation
lookahead. Only 42 of 7,981 planning decisions choose depth two. Continuation
searches normally have 12 guidance samples, insufficient for a 23-sample joint
response round. Giving these probes a complete response round regresses in
all three first executions (pilot mean deltas -16.94981, -31.98501, -40.507).
Better local correction alone does not make a better path comparison; this
mechanism also remains disabled.

A residual-transfer study adjusts a nearby measured control by the predictor's
change between old and new physical inputs. Its strongest pilot execution is
still below the unadjusted new forest. Forest-proposal diversity and a predictor
trained on the stronger 922 teacher are separate active hypotheses.

All reported pilots contain 20 cases, retain invalid scores as zero, and have
no headline. [Compact paired evidence](../benchmark/v3/studies/arc-910-research.json)
retains favorable and adverse results. No production model or default is changed.
