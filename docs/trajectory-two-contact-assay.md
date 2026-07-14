# Causal Contact-Phase Assay

`scripts/v0/study_two_contact_envelope.ts` is a bounded construction assay,
not a compiler evaluator or continuation solver. It is intended to answer one
question before a source family exists: can a fixed, state-normalized phase
primitive close the current owned contact without reading future targets?

## Contract

- The phase constructor receives only the frozen physical prefix, a
  pre-contact planning state, the current contact's impact ask, and a
  predeclared compact or diagnostic-oracle control.
- Its geometry has a fixed six-frame response horizon. It does not read an
  outgoing interval, any outgoing axis, `nextImpact`, a later contact, seed,
  case ID, score, or prior row outcome.
- Exact replay verifies full physical-prefix identity and zero proposed-line
  collision before the current gap. An owned current event must touch the
  approach or capture-surface role; a phase-tail collision alone cannot pass.
- The next contact's *time* is a reporting boundary only. The artifact reports
  full interval occupancy, trailing airborne frames, phase-line collisions,
  terminal state, and off-beat telemetry. It does not generate or rank an
  endpoint candidate, score outgoing axes, or claim a two-contact bridge.
- Evidence is immutable and source-sealed through the static import closure,
  compiler identity, protocol fingerprint, and before/after identity checks.

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
