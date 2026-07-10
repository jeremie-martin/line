# Benchmark V2 Prototype Source Review

Status: historical source review. The reviewed cohort is quarantined under
`specs/v2/prototypes/` and is not eligible for the selected suite.

Characterization fingerprint: `6c5014eccb342476`.

This review reads every manually authored contact score and target program and
cross-checks them against the static characterization. It uses no compiler result
and no qualification compiler outcome. The machine-readable record is
`benchmark/v2/prototypes/manual-source-review.json`.

## Result

Eight candidates advance to click-track review. Two enter a direct family
comparison. Advancing means that the written score has a coherent, distinct
purpose worth hearing; it does not imply final membership or weight.

| Candidate | Quantized cadence evidence | Distinct target interaction | Disposition |
|---|---|---|---|
| steady_reentry | 560ms body, one short burst gap, two >=1.5s openings | speed and impact establish two entries while air stays smooth | advance to click review |
| vocal_to_pulse | irregular support, 540ms body, 420-660ms replacement breakdown | quiet impact and speed lift mark support-to-percussion transition | advance to click review |
| halfstep_hook | 44% primary gaps, 56% half-pulse gaps | amplitude suppressed on dense passages and opened on primary pulse | advance to click review |
| syncopated_current | eleven <350ms gaps, maximum two consecutive gaps | high-speed pickup recovery with distinct pickup and return impacts | advance to click review |
| breathing_grid | 600ms bed, fourteen 1.2s gaps, five 1.8s gaps | amplitude/gap correlation 0.61 | family comparison required |
| sparse_arc | 720ms pulse, twelve ~1.44s gaps, two ~2.16s gaps | moderate air with amplitude openings distinguishes arcs from runouts | advance to click review |
| microtimed_drive | five common frame gaps from 475-575ms, entropy 2.29 bits | smooth axes isolate played sync while impact carries accents | advance to click review |
| tempo_crossfade | 720/640/560/480/620ms pulses, entropy 2.96 bits | gap/speed correlation -0.90 under a separate air contour | advance to click review |
| low_air_runout | 97% 550ms body plus 2.2/3.3s openings | gap/air correlation -0.78 with high sustained speed | advance to click review |
| amplitude_breaths | 85% 500ms bed plus selected 1.0-2.0s openings | amplitude/gap correlation 0.78 | family comparison required |

## Family constraint

`breathing_grid` and `amplitude_breaths` are different contact timelines, but both
encode the same dense/sparse amplitude thesis. They compete for at most one primary
family slot. Keeping both in the candidate pool is useful for auditory comparison;
counting both as independent headline coverage would be misleading.

This constraint does not apply to `sparse_arc`. Its longer base pulse, moderate-air
arcs, and smaller gap/amplitude coupling exercise a different visual intent.

## Specific cautions

- `halfstep_hook` is deliberately block-regular and must sound like a repeated hook,
  not a mechanical alternation.
- `microtimed_drive` remains distinct after frame quantization, but its authored
  offsets must sound played rather than randomly jittered.
- `tempo_crossfade` strongly couples speed to cadence. It may ultimately be a
  diagnostic family even if the click score is coherent.
- `low_air_runout` is representative only if its long openings form convincing
  phrases. Strategic importance alone cannot grant it headline weight.
- `vocal_to_pulse` uses an inferred voice-like opening rather than an independent
  recorded performance, so auditory coherence is the relevant next gate.

## Next gate

Render or reuse the ten deterministic click tracks and review each complete score,
not isolated timestamps. For every candidate, record:

1. whether local pulse and phrase boundaries are audible;
2. whether exceptions sound intentional;
3. whether impact accents clarify or fight the rhythm;
4. whether repeated material earns its duration;
5. whether the candidate should advance, be revised, or be removed.

The two dense/sparse amplitude candidates must also be compared directly. No
development suite manifest should be frozen until this auditory review is recorded.
