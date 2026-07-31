# Next-Arc Readiness Model Goal

Status: **the accumulated-contact-impulse corpus and scorer-bound component
refresh are complete; independent N=48 compiler validation is pending**.

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

A scorer-target identity change is a bootstrap, not ordinary iteration. Keep
the exact former runtime artifact at an explicit path and use it for both
context selection and incumbent comparison:

```bash
npm run benchmark:readiness:collect -- --replace-corpus --incumbent-model=PATH
npm run benchmark:readiness:dataset -- --incumbent-model=PATH
uv run scripts/v0/train_readiness.py --incumbent-model=PATH
```

The corpus records that artifact's checksum and old target protocol. The
collection worker may run it only behind the paired collection guards; ordinary
production remains strict. Never edit the old artifact's protocol string.

The trainer compares a small, fixed set of standard models with grouped
cross-validation. Development OOF evidence chooses both each model form and
whether that component replaces its incumbent. The locked third seed then
decides the already-fixed hybrid once, against the product production actually
multiplies. There is no permanent model registry or experiment-state machine.

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

The frozen V2 corpus is schema `line.readiness-corpus.v7`: 44 canonical cases,
three canonical seeds, 124,516 retained decision contexts, and 564,207 retained
proposal attempts of 580,067 observed. Of the retained contexts, 121,741 have a
production-predicted boundary. The first two seeds are development data; the
third is locked validation.

Schema v7 binds the labels to target protocol
`next-arc-readiness-targets-v3-contacted-frame-impulse`. Its contexts were
selected by the exact previous production artifact (`7c85fb50e739…`, target
protocol v2), explicitly as a bootstrap selector only. Production rejects that
old protocol; the collection worker permits it behind two collection-only
guards so fresh labels can be learned without relabeling the old model.

## Component scores

Lower is better.

| Component | Primary score |
|---|---|
| catchability | Brier score over all attempts |
| impact feasibility | squared error against mean scorer-compatible impact fit over viable impact-authored attempts |
| speed fit | squared error against realized outgoing-gap target fit |
| air fit | squared error against realized outgoing-gap target fit |
| elevation fit | squared error against realized outgoing-gap target fit |
| shipped composite readiness | squared error against mean realized `catchability × impact × speed × elevation` attempt utility per context |

Reports also show calibration, MAE, raw physical error, bias, target/regime
buckets, coverage, and pool ranking/regret where available.

The speed/air/elevation model may directly predict expected target fit or may
predict structured arc-prefix and launch outcomes and reuse the canonical
ballistic kernel. In either case it is judged against the complete outgoing
scorer-gap truth.

`airFit` remains trained and evaluated independently, but the shipped product
does not infer or multiply it. The full five-factor joint utility remains
research truth; it cannot decide a production artifact while air is disabled.

## Decision rule

Development OOF first fixes a hybrid: a component enters only when its primary
score is at least 1% lower and the family-cluster bootstrap lower bound is
positive. The locked seed is not consulted for that selection. The fixed hybrid
replaces `current` when:

1. its shipped-product validation MSE is at least 1% lower with a positive
   family-cluster bootstrap lower bound;
2. a scorer-identity change includes a freshly selected impact component;
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

The 2026-07-31 scorer-bound refresh uses the exact former production model only
as its context selector and reference. Development OOF retains catchability and
speed, selects a new 200-tree impact regressor, selects a new air diagnostic,
and leaves elevation neutral. On the locked seed:

| Component | Decision | Improvement |
|---|---|---:|
| catchability | retain incumbent | candidate +0.7% (inconclusive) |
| impact feasibility | **replace** | **39.5%** |
| speed fit | retain incumbent | candidate +29.4%, not development-stable |
| air fit | replace diagnostic | 45.5% |

Impact and air improve all 14 origin families on the locked seed. Elevation
remains exactly neutral because current V2 has no authored elevation population.
Python export parity is below `2.2e-15`; the checked TypeScript fixture matches.

The fixed shipped product improves on locked validation: macro context MSE
falls from `0.022332` to `0.017180` (23.1%), MAE from `0.11584` to `0.09656`,
and correlation rises from `0.7857` to `0.8152`. All 14 origin families improve;
the family-cluster bootstrap interval for absolute MSE improvement is
`[0.00369, 0.00586]`.

The runtime owns no Python or scikit-learn dependency. Python owns training and
exports the stable `line.readiness-model.v3` tree arrays; TypeScript owns the
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
