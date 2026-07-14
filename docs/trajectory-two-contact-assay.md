# Causal Contact-Phase Assay

`scripts/v0/study_two_contact_envelope.ts` is a bounded construction assay,
not a compiler evaluator or continuation solver. It is intended to answer one
question before a source family exists: can a fixed, state-normalized phase
primitive close the current owned contact without reading future targets?

## Contract

- The phase constructor receives only the frozen physical prefix, a
  pre-contact planning state, the current contact's impact ask, and a
  predeclared compact or diagnostic-oracle control.
- The frozen prefix is compiler-selected using full-spec traversal. The phase
  construction is target-blind *conditional on that prefix*; this is not
  evidence that an end-to-end compiler proposal is future-blind.
- Its geometry has a fixed six-frame response horizon. It does not read an
  outgoing interval, any outgoing axis, `nextImpact`, a later contact, seed,
  case ID, score, or prior row outcome.
- Exact replay verifies full physical-prefix identity and zero proposed-line
  collision through the frame before the earliest permitted current event
  (`target - 2` under the sealed +/-1 convention). An owned current event must
  touch the approach or capture-surface role; a phase-tail collision alone
  cannot pass.
- The construction itself is six frames. Verification extends one additional
  frame because an on-time detector event may be one frame late and still
  requires the full six-frame response window. Detector replay runs through
  the later of that local closure horizon and the outgoing reporting horizon,
  so a short next interval cannot truncate local evidence.
- Turn chirality and the engine's one-way collision side are separate inputs.
  The 24-row compact stencil crosses three lookbacks, two chiralities, two
  tail shapes, and both collision sides. `toward_motion` derives the active
  normal from incoming CoM motion and places the named sled reference on its
  collidable side; `away_from_motion` is a paired diagnostic arm with identical
  geometry and the opposite flags. Only the former can support a constructive
  conclusion. The 288-row oracle additionally spans the independent 0..8
  frame phase ladder, with four samples in each 72-way stratum.
- A fixed horizontal-rail positive control must pass the same exact trace,
  collision, ownership, persistence, response, and off-beat path before a
  phase result is eligible. It is not a compiler candidate.
- The next contact's *time* is a reporting boundary only. The artifact reports
  full interval occupancy, trailing airborne frames, phase-line collisions,
  terminal state, and off-beat telemetry. It does not generate or rank an
  endpoint candidate, score outgoing axes, or claim a two-contact bridge.
- Evidence is immutable and source-sealed through the static import closure,
  compiler identity, protocol fingerprint, and before/after identity checks.
  Each available row also retains its complete physical-prefix fixture, exact
  realized Float64 geometry, local event diagnostics, rejection reasons, and
  the separate local/outgoing horizons.

The command uses a fixed 500k prefix budget and requires `LR_ENGINE=wasm`:

```sh
LR_ENGINE=wasm npx tsx scripts/v0/study_two_contact_envelope.ts \
  --case=dense --out=/tmp/contact-phase-dense.json
```

## Scope

The dense, dense-240ms, shifted-pickup, ordinary, and impact-led rows test
short-cadence current-contact geometry. The 3/4/5/6/7-second low-air family is
excluded intentionally: a six-frame phase cannot represent a duration-aware
carrier. That question remains with the separately sealed post-impact and
long-carrier studies.

## Superseded Read

Schema `line.study-two-contact-envelope.v1` is not evidence. It fabricated an
optimizer node, let a continuation pool read later contact information, and
reported a runway observation from a different track than the endpoint pool.
Its initial zero-result is therefore inconclusive, not a negative result for
state-normalized phase construction.

Schema `line.study-causal-contact-phase-response.v2` is also non-evidence. It
coupled collision orientation to chirality, placing every tested capture on the
wrong one-way side, and had no positive control. Use schema v3 only; its
`status.eligibleEvidence` must be true before interpreting even a bounded
negative result.
