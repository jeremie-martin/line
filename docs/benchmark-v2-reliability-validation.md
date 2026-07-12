# Benchmark V2 Reliability Repair Validation

Date: 2026-07-12. Status: **implemented, recertified, migrated, and verified**.

This report records falsifiable evidence for the two adversarial repair passes
after the eval-chain cutover. It complements, but does not replace, the purpose,
policy, and operating documentation.

## State And Transaction Invariants

| Invariant | Implementation | Evidence |
|---|---|---|
| One declaration owns one fresh, non-overlapping seed epoch | State read, retry and budget checks, seed allocation, declaration, append, and projection update share one cross-process transaction. Lock ownership binds PID start plus a unique token; stale recovery uses an exclusive claim. | Multi-process tests admit one simultaneous declaration, settle 12 concurrent declare/abort transactions with disjoint intervals, and recover a killed lock holder. |
| The JSONL ledger is authoritative and replayable | Every event is structurally and contextually validated at append and replay. Non-finite values, malformed valid JSON, illegal transitions, invalid hashes/timestamps, bad budgets, duplicate attempts, and overlapping seeds are rejected. Projection replacement and ledger append are fsynced; stale projections are rebuilt. | `benchmark_v2_attempts.test.ts` injects malformed rows, an append-without-projection crash window, stale projections, concurrent writers, and illegal state transitions. |
| A transition cannot erase risk history | Accepted-candidate rebaseline starts a new era. A ledgered external transition instead appends `baseline-transition-complete`, changing only the baseline label and pending flag. | Tests pin the exact prior era ID, cap, spend, cumulative exposure, attempts, and seed ledger across transition rebaseline. Current cumulative exposure reconstructs to `0.0588`. |
| A fired futility look is binding after a crash | Resume settles a durable fired look under the ledger transaction before opening a workspace or executing another compile. Settlement is idempotent. | A crash-window test leaves only a fired look, verifies immediate `futility` append and stop, then verifies a second recovery adds no duplicate. |
| Baseline and migration publication cannot split silently | Baseline freeze plus ledger transition, and fixture plus baseline plus migration record, each use a durable pending journal and compare-and-swap checks under the attempt lock. The two journals are mutually exclusive inside the final transaction. Formal readers refuse while a journal exists; rerun completes or explicitly blocks recovery. | Baseline tests crash after freeze and after ledger append, recover idempotently, and refuse a changed pinned bundle. Migration tests cover its publication guards; independent review traced the recovery path, and three live migrations completed with no pending journal. |

## Identity And Governance Invariants

| Invariant | Implementation | Evidence |
|---|---|---|
| Resume means the same run | Checkpoint plan identity binds candidate fingerprint, compiler-source fingerprint, compiler environment, and WASM artifact fingerprint in addition to task policy. | Tests mutate each identity component and require resume refusal. The real runner replay restored no ambient tasks and matched all 252 rows. |
| Declaration cannot race a migration or rebaseline | Immediately before append, eval re-reads suite identity, baseline, era label, decision calibration, and certification inside the declaration transaction. | This lock placement was independently reviewed. State-machine tests cover exclusive migration/rebaseline publication and one in-flight declaration; there is not a synthetic scheduler test for the private re-read window. |
| A declaration remains immutable through execution | Ledger replay and every initial/resumed wave, look, final decision, qualification, and verdict boundary verify the declaration file against the ledgered SHA. Archive links compare to that ledgered SHA, never a fresh hash treated as authority. | Tests reject an undercharged or post-append-mutated declaration. Interface review traced all execution boundaries and the final archive linkage. |
| Conformance evidence cannot be casually rewritten | `--record-fixtures` is rejected. The governed fixture must contain exactly the six unique named cases; fixture replacement is staged only by an approved behavior-changing migration and published in its transaction. The fixture itself is part of inference migration identity. | Migration tests reject the bypass, empty/duplicate/incomplete sets, and direct fixture drift. Final migration `e7e36b3e` matched all six cases without replacing the fixture (`ddc94419...`). |
| Certification binds methodology and source evidence | Schema v4 artifacts bind the generator source fingerprint, shared eval-chain inference fingerprint, and raw plus compressed hashes of both independent and original references. The guard verifies both artifacts, all upstream inputs, identical predeclarations, schedule, depth, alpha levels, and every policy bar. | Deliberate fingerprint/reference/predeclaration mutations are rejected. Regeneration preserved the statistical payload hashes exactly. |
| Runner changes require empirical compatibility | The implementation fingerprint includes checkpoint behavior. A new runner cannot compare against the baseline until a reviewed compatibility record is present. | Baseline snapshot replay through implementation `8f31c634...` matched the retained `c703ab4f...` runner on all fields of all 252 probe rows. |
| Machine interfaces remain machine-readable | JSON mode reserves stdout for one JSON value; preparation, progress, resource, child, and conformance diagnostics use stderr. V7 calls `JSON.parse` directly. | Structured success and error tests pass. A real 48-job stage-0 invocation produced one parseable object; uncertified depth 32 returned structured invalid exit 1 before any declaration. |
| V1 and V2 commands cannot be confused silently | Active V1 examples use explicit `golden:v1`, `benchmark:v1`, or `decide:v1` aliases. Current `golden`, `benchmark`, and `goal` default to V2; legacy flags are rejected instead of being stripped into a different run. | Active documentation and source comments were searched after migration; historical command transcripts remain only in archive documents. |
| A promoted compiler is reproducible | Baseline and rebaseline refuse staged, unstaged, deleted, or untracked compiler-bound sources. | Temporary-repository tests cover every dirty mode. The live gate refused rebaseline and named exactly `package.json` and `package-lock.json`. |

## Statistical Evidence

Both artifacts were recomputed from retained compile references, not
restamped. Menu passed **9/9** bars and the independent seeds 36..47 holdout
passed **7/7** bars. Both charge the cross-artifact worst relevant null bound,
`0.0196`, for either offered mode.

- schema: `line.benchmark-v2.independent-validation.v4`;
- shared eval-chain inference: `4694360852f907e3ba0d2bb239f8bec65d5dac66710e82d9eb76772dfd9286c7`;
- certification generator: `9ed276d95fb82aab49603763f6a454f3959d20ee2de90d920dcf75134d7f50cd`;
- menu artifact SHA-256: `782b5afd6bbb9d9d0e035fc0a229d71289f45f43ef4dc4885584b974660dcdfe`;
- holdout artifact SHA-256: `41c35a8b34d4c6d24a3af5072dda73c40559934516e88ea24c7e102f1f1a4694`;
- menu statistical payload SHA-256, unchanged: `e8b2a292f014358faf011a5c551a9f5f2ad70c25843ac5033f252d6e0fc469da`;
- holdout statistical payload SHA-256, unchanged: `53cb7c79226054492cb5cd71093bd5444000e856a2c867db899c1868b08db068`.

## Execution Compatibility

The accepted baseline snapshot was replayed through the final repaired runner
on the 252-task probe plan. Every row matched on task, raw report, score, track
hash, and authored contacts:

- retained implementation: `c703ab4fb50fbace785f8f5d69d6732a8acc1f348a659af2eaf5adea5991894c`;
- repaired implementation: `8f31c63424e3a776044f2d5d39e4ee2488e7f8c33a0232ec906be831e99ddf0a`;
- evidence: `benchmark/v2/evidence/runner-compat-c703ab4f-8f31c634.json`;
- evidence SHA-256: `a30060cfaed379db96103f848b2c718b32e0de097ca12690a28a0400078daf78`;
- result: **252/252 bit-identical**, headline `446.0945`.

A separate live `LR_ENGINE=wasm ... eval --json --jobs=48` completed all 252
tasks with no restore, emitted one parseable stdout object, and reported base
and candidate headline `446.0945`, delta `0`, identical fraction `1`, and
validity `221/252` on both sides.

## Governance Publication

Migration `2026-07-12T07-03-21Z-e7e36b3e` was published at inference scope
with behavior change explicitly attested. Its conformance run passed **82/82**
tests and all six governed fixtures matched. The active contract is:

- suite: `517e044103a5fef381ba5970a9906a688fe859e9fb6d28f04d58c60ee751a54a`;
- decision inference: `a4221accc55324d18b1a4d21731d1d65102399cc400278d8d2a366ed45037d21`;
- decision protocol: `9ac85b1ff0c472e7692b706c25ef53c58c9cc2a775ff3508303dfb26fd22a359`;
- decision calibration: `51ca5ed7a5d8ec74d5c846d4ebd91a9f9a4d5829d1592a8ced0d2a35d028184d`.

After publication, the full repository suite passed **56 files / 488 tests**.
Deterministic preparation passed for 42 development plus five qualification
cases. The baseline, migration ledger, artifacts, and era projection agree:
cap `0.05`, current spend `0`, cumulative exposure `0.0588`, no in-flight
attempt, no pending transition, and no publication journal.

An independent final audit reported no remaining functional findings. Its
focused reliability selection passed **92/92** tests and independently checked
the active protocol, journal state, declaration/checkpoint identities,
certification provenance, V1 aliases, and the 252/252 compatibility evidence.

## Residual Scope

- Migration recovery is covered by guard tests, code-path review, and live
  publication, but not by a direct process-kill crash-injection test.
- Declaration revalidation is covered at each boundary and mutation tests, but
  not by a synthetic scheduler test that forces a migration into the private
  pre-append timing window.
- The journals make process interruption recoverable. They are not fsynced, so
  this report does not claim durability across host power loss or storage-cache
  failure.

## Remaining Operator-Owned Condition

The accepted compiler is reproducible from its tracked, checksummed snapshot.
The working tree still contains pre-existing user changes in `package.json`
and `package-lock.json`; they were neither reverted nor silently committed.
The V1 alias correction in `scripts/v0/optimizer/README.md` is also inside the
deliberately broad compiler-source boundary. The source gate correctly
prevents any new baseline or rebaseline until these compiler-bound changes are
committed or otherwise resolved.
