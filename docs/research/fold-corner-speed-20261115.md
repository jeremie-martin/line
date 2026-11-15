# Upward folds and speed lost at corners

The owner strongly preferred the first upward-fold diagrams for their cleaner,
smoother appearance. This is explicit visual feedback on selected passages, not
a blind preference study. It supersedes the initial decision to reject that
candidate on small aggregate metric changes alone.

## Mechanism and declared test

Keep the upward proposals: every fourth generic paired-fold proposal offers two
upward turns. Estimate later face lengths using the tangential speed remaining
after a supporting corner, multiplying speed by the cosine of the turn. Apply
this only to fixed-face folds turning into their active surface. Headings and
receiver placement stay unchanged; native replay still decides actual contact.
No score, allowance, proposal-count or engine changes; no speed claim.

The refinement hypothesis was committed on `experiment/folds-corner-speed`
before evaluation. A fixed-control probe reduced mean timing error from 1.21 to
0.94 frames across 17 examples, but survival fell from 17 to 15. That probe is
not an acceptance test: the complete search must select viable controls again.

## Eight-seed paired result

Complete V7.1: 41 specs × eight seeds, 328 paired rides per comparison. All three
versions finish 328/328 rides and fulfill 432/432 explicit gaps. Headline averages
the eight primary strata equally; explicit requests are reported separately.

| Measure | Original | First upward candidate | Refined lengths |
|---|---:|---:|---:|
| Headline | 800.7774 | 800.1869 | 800.6130 |
| Explicit-request score | 766.0482 | 766.6594 | 764.2162 |
| Intact three-face folds | 1914 | 1913 | 1914 |
| Folds touching all three faces | 885 | 922 | 950 |
| Folds touching a guide | 1557 | 1539 | 1541 |
| Folds touching main and guide simultaneously | 1081 | 1087 | 1108 |
| Upward folds | 0 | 26 | 35 |
| Rail-free upward folds | 0 | 20 | 30 |

Every upward fold touches all three faces. Contact windows start three frames
before the authored section and end before the next. These are actual sled
contacts, not shape classification alone. Upward folds remain only 1.8% of the
family; broad reliance on guides is unresolved.

Refined minus original headline: **−0.16**, seed-block 95% interval **[−3.1,
+2.8]**, 19 primary specs up / 16 down. Refined minus first candidate: **+0.43**,
interval **[−2.98, +3.83]**. Neither establishes a score gain or equivalence.
First minus original is −0.59 [−3.37, +2.19]. The refinement's explicit score
falls 1.83 points against original. Category deltas are G +1.8, P1 +1.1,
P2 −3.5, P3 +7.4, P4 +0.1, P5 +2.7, P6 −7.4 and P7 −3.5.

## Other rulers and tradeoffs

These means use the same primary-stratum weights as the headline, excluding
explicit requests. Lower loss/error is better; geometry shares are descriptive.

| Measure | Original | First candidate | Refined |
|---|---:|---:|---:|
| Contact loss | .059227 | .059581 | .058843 |
| Strike loss | .037303 | .037682 | .037733 |
| Impact v2 loss | .005528 | .005603 | .005412 |
| Impact v3 loss | .005543 | .005624 | .005427 |
| Rail share | .428617 | .432039 | .426921 |
| Clean upper share at strong beats | .061254 | .055199 | .060076 |
| Body drag, seconds/minute | 3.11864 | 3.06949 | 3.03940 |
| Strong extras per 100 beats | .098088 | .102354 | .093410 |
| Inverted/backward share | .093225 | .091300 | .088760 |
| Air RMS | .046562 | .045768 | .047378 |
| Speed RMS | .044066 | .044772 | .044221 |
| Amplitude RMS | .092519 | .092199 | .095574 |

Strike, airtime and amplitude errors worsen. Clean upper share remains below
original. The comparison report's whole-panel per-ride guard weighting differs:
inverted/backward arrivals increase from 10.3% to 10.7% against original under
that weighting. Do not describe the primary-weighted reduction as universal.
Historical frozen grade is 6.31 / 9.52 / 22.98, but only 2 / 3 / 7 rides pass its
validity gate, so this is not a broad quality win. Charged physics is essentially
unchanged (3.51M frames per ride); parallel wall times are not a speed benchmark.

## Decision, provenance and review

Adopt on `geometry-improvements` for the owner's stated aesthetic preference and
more fully ridden, rail-free upward folds, with inconclusive score differences.
Some previously attractive passages become worse; retain those in the diagrams.
The six fixed passages were chosen before the refinement run. Three additional
new upward examples are explicitly selected illustrations, not an unbiased sample.

Original is `e06720f9`, saved arm `69ae6aee76dff9f0`; first candidate is exact
compiler content `821b0c0f3eeb…`, arm `926eae9bba29e74f` (initial dirty source
identity retained, not relabelled). Refined compiler content is
`6da0e7e7e982c291fe82e1255512adb704cace91784be7ff84f153cd141f5d1d`,
compiled at `df363c75`, arm `14b5b50b6be094cd`. Resolved inputs and evaluator
identities match across all 328 pairs. The original first four seeds are reused
under their exact identities, with four more added; no fresh holdout was opened.

Construction verification passes on all 328 first-candidate and all 328 refined
rides: 22,881 main supports each. Restoring trimmed ends changes no states or
contacts. Focused geometry tests and all 628 unit tests pass. Parity references
change because fold face lengths and resulting search decisions change. Full
`npm run check` on the adopted commit passes in 2.4 minutes: 628 tests, 32 Rust
tests, exact physics/engine checks, compile/judge parity and end-to-end smoke.
All nine player entries load and seek successfully in Chromium over 10.77.77.9.
The post-adoption `folds-adopted-eight` report confirms the identical compiler
content and remeasures both saved arms under the current measurement identity;
the headline result is unchanged.

Local artifacts: `generated/fold-refinement/index.html`, `paired.html`,
`collection.json`, `metrics.json`, `contact-summary.json`, and
`refined-vs-preferred.txt`. Full baseline comparison reports are under
`generated/eval/compare/upward-folds-eight` and `fold-corner-speed-eight`.
