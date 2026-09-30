# Developing a useful repertoire — 2026-09-30

Work under the active [roadmap](creative-repertoire-roadmap.md). Musical inputs,
physics, detector and benchmark remain frozen; all construction uses normal lines.

## Selection and declared experiments

The existing gallery and implementation suggest two complementary directions:

| Direction | Potential | Current limitation | First experiment |
| --- | --- | --- | --- |
| Ripple rails | A connected, repeating physical curve; an earlier musical example received positive owner feedback. | The heading variation begins only after the entry turn and always contains two waves. Strength alone does not control where or how visibly the rider experiences it. | Separate wave count and placement from the entry-turn schedule. Compare the inherited construction with one or two earlier waves at matched incoming states and musical targets. |
| Scattered contacts | Deliberately disconnected linework, used for selected phrases within ordinary arcs. | The improved implementation reconstructs a complete arc plan, has delicate numeric width choices, and is not available for local composition. | Reuse its observed collision footprints for selected supports of a preserved complete ride. Compare several fragment widths and replay every candidate, including its full continuation. |

Ordinary arcs are the reference. Full paired rails mostly retain unused geometry
without changing the ride; outlined ribbons/teeth/petals emphasize the decorative
changes the owner set aside. Facets and terraces remain promising, but earlier
musical examples were subtle. Waves and serpentine remain available research
candidates; the latter's documented bypass does not establish a geometry limit.
These observations motivate this round's selection, not a permanent ranking.

Development uses the existing Luna and Amor intervention windows, with seed 351
and unchanged zero-jitter production inputs. Repeating seed labels is not
independent evidence. Vary actual geometry controls and incoming passages instead.
Record every trial, including invalid reconstructions and adverse local errors.

Reserve **Tiki supports beginning in 12.1–14.8 s and 36.0–38.6 s** before these
new interventions are compiled. This is a new intervention on a previously used
song, not an unseen song or a wholly unseen specification. Freeze the selected
construction settings before testing those windows. Any subsequent tuning must
be reported as development and cannot retroactively count as confirmation.

For ripples, inspect ordered contacts, release and rider motion through the
actual changed geometry. For scattered passages, measure source-motion fidelity,
survival/timing, fragment width and contact use; do not imply that disconnected
linework creates a new motion if it reproduces the source. Judge visual usefulness
in faithful playback and full musical videos. Neither path gains an aesthetic
score or a mandatory contact quota.

After bounded development, preserve a small range of useful alternatives and
compose the two directions with ordinary arcs. Show entry and return, disclose
local musical losses and all computational work, and retain the original panel.
Owner preference remains open. The results below distinguish physical validity,
visible linework, measured adherence and remaining artistic judgment.

## Development decisions before the reserved intervention

The first 16 fixed-continuation fragment trials (eight widths on each song)
all fail the complete timing/survival contract. Tiny reconstruction perturbations
can remain negligible through the edited phrase and then grow through a long
unchanged continuation. The meaningful retry locks the realized fragment prefix
and searches the return from its actual physical state. Seven of eight tested
width/song combinations then pass; width 0.3 still fails on Amor. This does not
establish a general safe width or imply that widening fragments is harmless.

The ripple study compares the inherited late two-wave profile, earlier placement,
one versus two waves, and strength 0.6 versus 1. Strong early waves can fail the
first changed catch; a moderate early one-wave construction is valid on both
songs. Native inspection shows a broad inflection, while two earlier waves can
produce separated contacts and earlier launch. These are different usable
directions to inspect, not evidence that continuous sliding is always preferable.

For the next musical panel, freeze **one ripple wave, strength 0.6, starting at
support fraction zero**, and **fragment width 0.003**. The latter is a numeric
realization width in world units; the native two-unit line stroke makes these
fragments appear as dots. It is not a dot-size aesthetic control. The panel has
ordinary arcs, ripple phrases, a scattered first phrase, and scattered first /
ripple later. Keep the earlier ripple examples and the control comparisons
available. This choice preserves distinct linework and a restrained broad curve;
it does not claim maximum visual intensity or owner approval.

The implementation reuses the collision observer and fragment constructor. Arc
continuation accepts explicitly declared, locked fragment sections; it validates
their actual incoming state and leaves their geometry untouched. Guide inspection
uses recorded source roles for mixed tracks. Ripple placement and cycle count
are explicit geometry inputs applied during all candidate simulations. No musical
specification syntax or production default changes.

## Delivered comparison

The [music review](http://localhost:8767/motion-gallery/music.html) compares four
complete rides on each of Luna, Amor and Tiki: ordinary arcs, two ripple phrases,
a scattered first phrase, and scattered first / ripple later. Phrase buttons
include entry and return. Each comparison links to the exact track in native
playback. The [control trials](http://localhost:8767/motion-gallery/?data=/generated/repertoire-development-20260930/controls/manifest.json)
keep 26 development examples visible, including eight invalid attempts. Earlier
ripple, facet and serpentine panels remain linked.

The finished-video frame inspection shows the intended contrast between solid
curves and disconnected dots. The new one-wave ripple is a restrained broad
inflection; it does not supersede the owner's encouraging earlier two-wave
example. These are reviewable alternatives, not a claim that either is the
preferred artistic direction.

| Control | Meaning and tested behavior |
| --- | --- |
| Ripple strength | Scales the heading profile before physical simulation. Tested 0.6, 0.8 and 1. Increasing it does not guarantee a valid entry or a visibly stronger successful ride. |
| Ripple start | Begins the profile at a fraction of estimated support duration. Explicit 0 and 0.25 were tested against the inherited start after the entry turn. This removes an accidental coupling with entry-turn duration. |
| Ripple waves | One versus two heading cycles. These are geometric construction cycles, not a promise that the rider traverses every bend. Three is accepted by the API but was not characterized here. |
| Scattered phrase | Replaces selected supports with observed normal-line contact fragments and searches the remaining ride from their realized exit. The unedited prefix stays locked. |
| Fragment width | A numerical reconstruction parameter. Eight widths were tested with a fixed suffix, four with a searched return. Width 0.003 was frozen for the panel; it is not a visual dot-size control. |

Guides remain explicit physical geometry whose parameters are searched; unused
parts can be trimmed. Ripple onset does not prescribe guide occurrence. For
fragments, main/guide roles come from their exact source segments. No random
style selection, quotas, hidden fallback to arcs or musical classification was
introduced.

## Evidence and meaningful retries

There are **44 development probe calls**, then eight development-panel calls and
twelve frozen confirmation calls. Some repeat identical tracks or deliberately
repeat a failed control. They are not 64 independent observations. Raw probes,
including failures, remain local; hashes, controls, outcomes and probe source are
preserved in the [compact evidence](evidence/repertoire-development-20260930.json).

| Experiment | Valid / calls | What it establishes |
| --- | ---: | --- |
| Replace fragments, retain the entire old suffix | 0 / 16 | Full-ride replay rejects the naive local replacement on both development songs. |
| Replace the first phrase, search its return | 7 / 8 | Replanning from the actual exit addresses this concrete failure; width 0.3 still fails on Amor. |
| Ripple placement / wave-count / strength | 7 / 8 | Earlier, moderate one-wave profiles work on both songs; earlier full-strength one-wave fails on Amor. |
| Strong one-wave versus moderate two-wave, both from the start | 2 / 4 | Both moderate two-wave rides work; both full-strength one-wave entries fail. |
| Start stronger ripples from an already successful gentle ripple | 1 / 4 | Strength 0.8 works on Amor; strong entries and Luna 0.8 still fail. |
| Matched ordinary-source controls for that last experiment | 1 / 4 | Amor 0.8 already works from the ordinary source; changing the source improves that one result, not entry viability generally. |

The stronger-ripple failures are concrete initialization failures: for example,
Luna's first changed support at frame 258 rejects all 43 initial proposals as
binding. Supplying the successful gentle-ripple controls does not repair this.
On Amor at strength 0.8, it improves RMS from 0.019269 to 0.015516, at 941,447
versus 942,562 frames for the respective continuation searches. Constructing the
gentle reference also costs work, so this is neither an equal-total-work speedup
nor a general search improvement. These later diagnostic experiments did not
retune the frozen panel. The adapted probes initially recorded the ordinary
source's hash despite using the gentle source. That metadata was corrected;
original artifact hashes and the correction are retained, with no physics or
outcome changes.

Independent fragment inspection checks their parent collision planes, orientation,
normal line type, actual contacts and motion through the return boundary:

| Song | Return frame | Maximum body-point difference from source through return |
| --- | ---: | ---: |
| Luna | 343 | 1.12e-8 world units |
| Amor | 143 | 9.93e-10 world units |
| Tiki | 591 | 1.12e-5 world units |

The fragment endpoints remain within 2.04e-13 world units of their recorded
parent planes. All six scattered/mixed final tracks have an invalid old fixed
suffix and a valid searched continuation. The earlier unedited body history is
exact. This construction realizes an existing useful motion with different
linework; the later searched motion can differ substantially.

Ordered ripple contacts show varied behavior, not universal continuous riding.
Luna's first ripple contacts the main curve early, then the guide, then returns
to the main curve through profile phase 0.91. Amor's first three ripple supports
reach phases 0.968–0.990 without guide contacts. Luna ripple support 43 reaches
only phase 0.389 with main contacts, alongside seven guide-contact frames. These
are locations in the construction schedule, not distance traveled or a visual
quality score. The full timelines remain in the evidence; touching one changed
segment does not establish traversal.

## Frozen musical results and cost

Compiler **e9ed9635**, clean source fingerprint
`4108680a2ad824b51d29c23a0c44ed3eaca6c81675ffe13290f19d5929132afc`,
was frozen before the reserved Tiki interventions. All **12/12 complete rides**
pass unchanged timing and survival checks, using **51,613 normal lines** in total.
No acceleration lines are present. Seed 361 repeats the zero-jitter development
tracks on Luna/Amor; its label provides no additional statistical independence.
The reserved Tiki windows test reuse on new passages of a known song.

Lower RMS means closer adherence to the existing normalized musical targets.
These are production-song measurements, not V4 headline scores.

| Song | Ordinary | Ripple phrases | Scattered first | Scattered + ripple |
| --- | ---: | ---: | ---: | ---: |
| Luna | 0.012319 | 0.020042 | 0.013619 | 0.013884 |
| Amor | 0.013236 | 0.014073 | 0.011641 | 0.013709 |
| Tiki | 0.019895 | 0.023165 | 0.021533 | 0.022774 |

Local costs matter. In the mixed Luna climax, mean absolute impact error rises
from 0.00433 to 0.01407. Amor's percussion speed error rises from 0.01175 to
0.02227. In Tiki's later mixed phrase, amplitude error rises from 0.01730 to
0.03483 and impact error from 0.00490 to 0.01974; the largest individual errors
there reach 0.08109 and 0.08849 respectively. Other local targets improve.
The evidence preserves every displayed local axis, rather than using the
whole-ride average to hide these tradeoffs.

Each alternative spends **913,077–944,251 physics frames** out of its one-million
allowance, including preparation and cold replays. Baseline work is shared and
reported separately: Luna 5,417, Amor 934,417, Tiki 5,915 frames. Rebuilding a
styled continuation is therefore still expensive relative to the easy production
cases. Confirmation alternatives took 28–39 seconds each on the shared host
during concurrent rendering/evaluation; this is not a controlled timing study.
No efficiency improvement is claimed.

## Verification and reproduction

- Full unchanged V4: **952.4726**, 352/352 valid outputs across all 176
  specifications and seeds 16/17. Tracks, scores, observations, diagnostics,
  compiler statistics and physical work match the preceding run exactly:
  46,454,822 simulated frames, zero compared-field differences.
- 32 focused tests pass across contact composition, original scattered
  reconstruction, arc composition, geometry controls and gallery contacts.
  The final selection refinement also passes all three contact-composition tests.
  TypeScript retains the same 251 pre-existing diagnostics, with none added.
- Twelve confirmation native replays and 26 control replays have zero body-point
  error. All twelve confirmation tracks also match the real application at
  3,448 checked poses, including scarf and rider state. The gallery rejects
  corrupt artifacts, replay drift and acceleration lines.
- The production renderer checks input/pipeline identity, file hashes, streams
  and complete video decoding. Identical Luna/Amor development tracks reuse their
  verified videos through the existing strict reuse tool. Raw media stay local.
- All twelve full **1080×1920, 60 fps** videos with audio and their excerpts are
  ready. All nine new musical comparisons and nine previous-panel comparisons
  pass browser checks for synchronized seeking, one audio source, phrase jumps,
  pause during replacement, retry, native-track links and mobile layout.

Reproduce the frozen panel from a checkout at the frozen compiler commit:

```sh
LR_ENGINE=wasm node --import tsx scripts/produce/musical_direction.ts \
  --compiler-root=/tmp/line-repertoire-development-20260930 \
  --out=generated/repertoire-development-reproduction \
  --repertoire=contacts --strength=.6 --profile-start=0 --ripple-cycles=1 \
  --fragment-widths=.003 --seeds=361 \
  --songs=luna_bala_44s,amor_na_praia_46s,tiki_tiki_48s --reuse-passages=contacts
```

Use `summarize_musical_direction.ts`, `inspect_repertoire.ts` and
`inspect_fragment_phrases.ts` with `--study=<directory> --out=<file>` for the
respective evidence. Render with
`render_musical_direction.ts --study=<directory> --ids=<comma-separated-cell-ids>`;
the existing pipeline supplies music, camera, vertical layout and post-processing.
`package_repertoire_controls.ts` packages preserved probes without recompiling or
selecting a winner. Exact source, identities, commands and validation hashes
are recorded in the compact evidence. The large raw archive is local.

## What remains open

This is a usable local-composition milestone, not a finished repertoire or a
claim of artistic approval. The strongest new capability is preserving chosen
linework and searching a physical return from its actual state. Ripple placement
and wave count are now deliberate inputs rather than consequences of entry-turn
duration. The earlier approved ripple remains available alongside these choices.

The next engineering questions are specific: why shaped entries exhaust a narrow
initial proposal set before useful refinement, and how to spend less work on
already-good styled continuations while retaining visible choices. Those deserve
matched-work experiments with retained failures, not simply more budget or an
automatic return to ordinary arcs. Future rounds can develop terraces, facets,
waves or serpentine where they offer worthwhile contrast; no geometry ceiling
has been established. Musical phrase selection and artistic preference still
need owner review before adding broad specification controls.
