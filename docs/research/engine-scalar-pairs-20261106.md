# Reject independent scalar constraint scheduling

Three adjacent stick pairs have disjoint endpoints. This candidate calculates
both scalar lengths and factors before applying either correction, exposing
independent square-root/division work while retaining every equation and result.
Unlike the earlier SIMD trial it uses no vector operations or runtime feature.
Shared helpers keep one equation, and an assertion rejects overlapping pairs.
The packaged binary shrinks 20 bytes.

The declared default screen requires a supported 0.75% benefit to justify the
extra scheduling abstraction. Twelve paired rounds measure **+0.093%**, with
interval **[−0.471%, +1.003%]**, INCONCLUSIVE. The candidate does not qualify;
there are no larger/cold guards, confirmation, retries or adoption. All source,
candidate tests and packaged artifacts are restored exactly.

Correctness passes: 33 Rust tests, including 60,000 adversarial pair comparisons
against the original scalar equations; 65 saved and live physics cases, 68,827
states and 432,018 ordered collisions plus raw/body/contact observations; and
complete default/larger compiler checkpoints. Full structural checks were not
run after the speed screen failed.

[Fixed screen](engine-scalar-pairs-20261106-screen.json) and
[plan, patch, tests and logs](engine-scalar-pairs-20261106.json) retain the trial.
