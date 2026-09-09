# V3 conservative successor pilot

V3 is a separately versioned benchmark. V2 and its 852.1248 baseline stay intact.
This pilot follows the owner's request to make meaningful adjacent improvements
without requiring a new visual review or inventing an aesthetic metric.

## Frozen design, before compiler evaluation

- 88 specifications on two declared seeds (16,17), at 750k physical simulation
  frames: 176 compiles, versus V2's 352. Both seeds cover every specification.
- 44 V2 bridge cases preserve their contact frames, impact targets, sampled
  speed/amplitude curves, durations and phase metadata.
- 39 new authored programs cover the existing 13 non-music groups: three forms
  per family, with phrase-level changes in cadence, recovery, target combinations
  and controlled endings. Supported gaps reach 7.5s, slightly beyond V2's 7s.
  These programs share grammars; they are not 39 independent musical works.
- Five already exposed production works broaden the music stratum from one
  work to six. They are development material here, not newly untouched holdouts.
  V2's qualification registry is unchanged.
- Preserve the 70/15/10/5 strata and existing non-music group weights. Within
  music, weight the six works equally; the two Believer interpretations remain
  separate parents within that work. There are 65 aggregation parents overall.
- Preserve the current engine, landing/bounce rules, timing tolerance, impact
  definition and felt scale, speed/amplitude rulers, 30/30/30/10 axis weights,
  exponential tolerance 0.25, invalid-run zeros and shifted geometric hierarchy.

## Three explicit changes to the measured task

1. Airtime is authored as an integer count of airborne frames per inclusive
   interval. Retain the closest requested fraction permitted by the landing
   floor and two grounded boundary samples. Record the original fraction,
   replacement and reason in every frozen case. The scorer compares against
   that frozen target; it never clips a request to a compiler's achieved result
   or an estimated physics ceiling. This removes known necessary-condition
   contradictions and unattainable sub-frame precision, not all possible
   conflicts between axes or adjacent intervals.
2. Score every authored span, including the ending after the last contact.
   There is no invented final beat or final impact requirement.
3. Weight span-axis squared errors by elapsed frames; retain equal event weight
   for impact. A five-second supported rideout now contributes as five seconds
   of span behavior. Contact density still matters through event validity and
   per-contact impact. Keep episode diagnostics; introduce no extra phase gates.

The airtime counts are adapted to the existing function-based compiler API with
shared boundary target samples and a constant interior value whose inclusive mean
is exactly the authored fraction. Half-scale boundaries keep the samples inside
the API's 0.99 air limit; zero-count intervals lower their adjacent boundaries.
These are target samples, not a prescribed physical flight/contact sequence.
All physical proposals remain compiler choices.

## Independence, style, and decisions

Two seeds are a declared finite evaluation panel, not a guarantee for all future
stochastic compilers. Report distinct tracks, per-seed variation, failures and
complete-suite paired differences. Use additional predeclared complete seed
panels when studying materially stochastic behavior. No seed-only generalization
probability or uncalibrated automatic sequential promotion is introduced.

Normal type-0 lines are checked automatically. Substantial coherent physical
arcs remain the product eligibility requirement. Current frozen reference
compilers use the approved arc primitive. Geometry diagnostics are retained;
the benchmark does not claim to automatically certify beauty or detect every
way to disguise point controls. There is no curve-count, standing-time, variety
or universal-smoothness quota. Owner audiovisual approval is not claimed.

The specifications, policy, static audit and scorer are committed before the
first compiler run. Initial results—including failures—will be retained. A low
headline is not evidence that the pilot is good. The study must verify that the
declared changes have their intended effects and describe the tradeoffs.

Authoring is separate from execution: `scripts/benchmark/v3_author.ts` emits the
frozen, hash-checked catalog. `scripts/benchmark/v3_audit.ts` checks all inputs
without compiler outcomes. Do not regenerate the catalog to improve a candidate's
score; any intentional input change requires a new identity and fresh comparison.

The initial execution exposed an adapter defect: zero-valued boundary samples
could require an interior target of 1.0, which the compiler API rejects. Those
runs were aborted without a headline and retained under `initial-852/828`.
The correction changes target encoding only: all 88 frozen cases, interval means,
policy weights and contact frames retain their pre-evaluation identities. The
audit now invokes the actual compiler input validator for every specification.
