# Collision work audit, November 6

Three possible exact shortcuts were counted in a private instrumented copy of
accepted `0b5402df`. Every original predicate and physics operation still ran;
predicted repeated misses were asserted. Complete compiler checkpoints for
cells 61 and 62 are deep-strict-equal to the accepted reference.

| Opportunity | Default | Larger | Prospective gate |
| --- | ---: | ---: | --- |
| Repeated identical all-miss point position: queries | 0.0212% | 0.0054% | At least 20% queries or visits |
| Repeated identical all-miss point position: line visits | 0.0118% | 0.0035% | At least 20% queries or visits |
| Duplicate failed line visits before position changes | 15.27% | 13.89% | At least 50% visits before lookup overhead |
| Multiplications with segment-position test first | +28.90% | +27.80% | At least 20% fewer |

Every gate failed. No cache, reordered predicate, production code or timing
experiment follows. Exact-position reuse differs from the earlier spatial miss
rectangle, but is too rare to justify another fast path. Duplicate line visits
retain their original collision order.

[Plans, counters, assertions and instrumentation](engine-collision-work-20261106.json)
include hashed full checkpoints. Instrumented measurements make no speed claim.
