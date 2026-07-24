# Next-Arc Readiness Model Goal

Status: **contract, frozen corpus, component models, and production inference
are implemented; compiler validation is pending**.

Build the best cheap estimate of whether the predicted incoming boundary at an
authored contact is set up for a successful next arc. This is separate from
direct ballistic prediction and from compiler promotion.

The normative contact, gap, frame, input, and output semantics are defined in
[`docs/BALLISTIC_READINESS_CONTRACT.md`](docs/BALLISTIC_READINESS_CONTRACT.md).

## Objective

For one unbuilt arc `A_i` at contact `C_i`, predict:

```text
readiness =
  catchability
  × speedFit
  × airFit
  × impactFeasibility
  × elevationFit
```

where:

- catchability is the probability one proposal from the named policy is viable
  at `C_i`;
- impact feasibility concerns impact delivered by that proposal at `C_i`;
- speed, air, and elevation fit concern the proposal's outgoing scorer gap
  `[C_i, C_(i+1)]`;
- unauthored factors are `1`.

The input is the predecessor's predicted collision-free incoming boundary at
`C_i` plus known authored gap context and policy identity. No realized proposal
geometry or future simulation is a legal production input.

The direct ballistic projection used to reach `C_i` is not a speed, air, or
elevation readiness prediction. It completes the preceding scorer gap.

## Lean workflow

Normal model iteration reuses the frozen corpus and performs no compilation or
simulation:

```bash
npm run benchmark:readiness:dataset
npm run benchmark:readiness:train
```

After a reviewed model decision, regenerate the checked runtime artifact and
its cross-language fixture with:

```bash
npm run benchmark:readiness:export
```

Collection is an explicit one-time operation when the schema, production
proposal policy, V2 case membership, or representative context distribution
materially changes:

```bash
npm run benchmark:readiness:collect
```

The trainer compares a small, fixed set of standard models with grouped
cross-validation, chooses from development data only, checks the locked third
seed, and exports one dependency-free runtime artifact. There is no permanent
model registry or experiment-state machine.

## Frozen corpus

Use real current-V2 production-sampler contexts. Each retained decision
boundary stores:

- the production-predicted incoming boundary;
- the exact subsequently observed boundary as diagnostic truth only;
- incoming and outgoing scorer-gap targets and frame counts;
- generator-policy identity;
- every retained proposal attempt, including failures;
- viable-attempt impact at the entry contact;
- viable-attempt prefix/exit sufficient statistics;
- benchmark-only full outgoing-gap speed, air, and elevation truth.

Collection is deterministic, bounded, sharded, resumable, and parallel across
case/seed tasks. Ordinary evaluation performs no compiler or engine work.

Use grouped development and validation partitions. Attempts from one decision
boundary never cross partitions. Reports macro-average case/seed groups.

The frozen V2 corpus is schema `line.readiness-corpus.v3`: 44 canonical cases,
three canonical seeds, 132,493 retained decision contexts, and 421,932 retained
proposal attempts. The first two seeds are development data; the third is
locked validation.

## Component scores

Lower is better.

| Component | Primary score |
|---|---|
| catchability | Brier score over all attempts |
| impact feasibility | Brier score over viable impact-authored attempts |
| speed fit | squared error against realized outgoing-gap target fit |
| air fit | squared error against realized outgoing-gap target fit |
| elevation fit | squared error against realized outgoing-gap target fit |
| composite readiness | squared error against mean realized joint attempt utility per context |

Reports also show calibration, MAE, raw physical error, bias, target/regime
buckets, coverage, and pool ranking/regret where available.

The speed/air/elevation model may directly predict expected target fit or may
predict structured arc-prefix and launch outcomes and reuse the canonical
ballistic kernel. In either case it is judged against the complete outgoing
scorer-gap truth.

## Decision rule

An alternative replaces `current` when:

1. its development primary score is at least 1% lower;
2. validation also improves;
3. coverage is complete and important regimes show no contradictory failure;
4. every input is causal and available identically in production;
5. the implementation is simpler than, or materially more accurate than, the
   model it replaces.

Otherwise record the result, remove the alternative, and continue. There is no
model registry, era, staged screen, or permanent experiment matrix.

After all components and the product are validated, audit every compiler
consumer against the contract. Only then use `goal.md` for the independent
compiler comparison and promotion decision.

## Current component decision

The selected artifact uses compact histogram-gradient-boosted regressors. On
the locked validation seed, primary loss improved over the former production
estimators by:

| Component | Improvement |
|---|---:|
| catchability | 13.3% |
| impact feasibility | 9.4% |
| speed fit | 95.7% |
| air fit | 94.3% |

All 14 origin families improved for every component. Elevation remains exactly
neutral because current V2 has no authored elevation population. Python export
parity is below `2e-15`; the checked TypeScript fixtures match exactly.

The complete product also improves on locked validation: macro context MSE
falls from `0.07182` to `0.01563` (78.2%), MAE from `0.1903` to `0.0798`, and
correlation rises from `0.578` to `0.792`. All 14 origin families improve; the
family-cluster bootstrap interval for absolute MSE improvement is
`[0.0410, 0.0642]`.

The runtime owns no Python or scikit-learn dependency. Python owns training and
exports the stable `line.readiness-model.v1` tree arrays; TypeScript owns the
canonical causal feature vector, validates the artifact once, and performs
inference.

## Required implementation order

1. [x] Replace ambiguous gap terminology with contact-indexed input/output types.
2. [x] Separate projected outgoing-gap quality from next-arc readiness.
3. [x] Build the frozen next-arc corpus and validate frame/target ownership.
4. [x] Revalidate catchability and impact on the new schema.
5. [x] Build speed and air readiness from the next arc's outgoing outcomes.
6. [x] Leave elevation neutral until a relevant authored population exists.
7. [x] Validate the five-factor product on the locked corpus.
8. [x] Rebuild proposal utility without duplicate quantities.
9. [ ] Complete production telemetry and hot-path performance validation.
10. [ ] Run the independent compiler benchmark through `goal.md`.

## Invalidated prior result

The 2026-07-24 v2 readiness study reported essentially zero speed error because
it compared the predecessor's ballistic projection of one scorer gap with the
exact measurement of that same scorer gap. That result remains useful evidence
for ballistic gap composition, but it is not evidence for next-arc speed
readiness. The associated speed/air composite claims are withdrawn.
