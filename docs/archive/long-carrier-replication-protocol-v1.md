# Retired Long-Carrier Replication V1

Status: superseded before any formal declaration, fixture, assay, or ledger was
published.

The original exact-callback capture rule treated a target as unavailable when
tail completion constructed that physical boundary internally without emitting
an `onNode` callback. This was an observation defect, not a compiler or assay
result. V1 must not be used for evidence or execution.

The active design is documented in
[`docs/long-carrier-replication-protocol.md`](../long-carrier-replication-protocol.md).
It uses a target-independent donor selection rule, reconstructs the donor
ancestry through the declared prefix with the normal root-plus-extend
transition, and requires an all-row feasibility sweep before a cohort can be
declared.
