# A usable first repertoire workspace

[Open the creative workspace](http://localhost:8767/motion-gallery/workspace.html).
This delivery advances all five strands of the [roadmap](creative-repertoire-roadmap.md)
together. It is a substantial first workflow for composing and reviewing tracks;
it does not declare the creative problem solved.

The owner values strong visual contrast in scattered and folded passages, found
an earlier pronounced ripple meaningful, and found later ripples subtler. Preserve
those observations without treating every new example as approved. The new
arrangements below await that artistic judgment.

## What can now be done

Choose a song and arrange any ordered, non-overlapping sequence of passages.
Select ordinary arcs, single rails, scattered contacts, folds, ripples, serpentine,
terraces or facets. Adjust the relevant strength, onset, waves, faces or fold angle;
permit or forbid guides for connected passages. Save/open the small JSON document,
compile it with a bounded allowance, inspect the exact native rider alongside the
ordinary production baseline, and generate the full vertical production video.

The music specification is unchanged. Windows select supports whose starts fall
inside them; the workspace shows the realized support intervals. Between selected
passages, construction returns to ordinary arcs. “Allow” lets physical search
use guides; it does not force a guide or establish its necessity. Scattered
construction preserves measured source contacts and then searches the return.
It is not an independently authored motion controller.

The editor keeps a local draft and separates it visibly from the recorded ride.
Saved runs retain requests, identities, work, failures and replay artifacts.
Compilation and rendering have separate bounded worker lanes, so a long movie
cannot block the next composition. Exact source compilations and production media
are reused only with verified identities. Concurrent source-cache publication is
atomic. Interrupted and cancelled jobs cannot appear as completed work.

## Complete musical examples

All five arrangements complete with normal type-0 lines, unchanged authored
targets and independently verified native replay. All have full 1080×1920, 60 fps
production videos, audio, overlays and post-processing, plus matching baseline
comparisons. The first four are development arrangements; the Tiki windows were
reserved before development. Tiki remains known music, not an unseen-song test.

| Arrangement | Music | Deliberate passages | Baseline RMS | Arrangement RMS | Composition frames |
|---|---|---:|---:|---:|---:|
| Islands and folds | Luna | 4 | .012319 | .020447 | 1,839,018 |
| Long wave phrases | Luna | 4 | .012319 | .049664 | 1,513,795 |
| Air and edges | Amor | 5 | .013236 | .028846 | 1,935,454 |
| Ripples and interruptions | Amor | 4 | .013236 | .024578 | 1,912,735 |
| Reserved ripples and folds | Tiki | 2 | .019895 | .023251 | 893,939 |

Each arrangement had a 2-million-frame composition ceiling. Those counts include
all composition stages, preparation, failed candidates and cold compiler replay.
Source creation has its own 1-million-frame ceiling and is charged once when not
reused; independent evaluation/rendering is separate. Composition wall times were
25–50 seconds on this machine, with concurrent work, not controlled speed trials.
All use seed 401 with zero authored jitter; changing the seed alone would not
establish independent robustness.

“Islands and folds” repeats scattered passages and folded replies. “Air and edges”
starts with explicitly guide-free supports and combines folds, scattered motion
and ripples later. “Long wave phrases” sustains several shapes for longer, including
terraces and an early serpentine; its larger target error is disclosed rather than
hidden by validity. These are editorial examples, not inferred music-to-shape rules.

## What the construction studies established

Twenty-four matched-ceiling search calls compared six song/construction cases.
Inherited search completed 3/6. Adding up to 80 generic proposals only after an
empty initialization completed 6/6, including both failed strong-ripple entries
and the failed Tiki fold. These are known-case diagnosis and retries, not fresh
confirmation. Recovery is now used by the composition workflow, including its
lookahead; it does not alter production defaults or weaken requested geometry.

Two other ideas did not justify permanent options. Removing inactive fold
coordinates changed search allocation and worsened Luna fold RMS from about
.0212 to .0369. Every cheap source-control preview failed the requested validity
or quality limit. Their measurements and exact implementation remain in commit
`c2e05858`; those two options were removed from the delivered compiler. This does
not establish a ceiling for either idea.

A further 16 alternatives varied onset, strength and guide permission for serpentine
and terraces on the same Luna/Amor passages. All completed. Representative results:

| Shape / song | Inherited onset, strength 1 | Early, strength 1 | Early, strength .6 | Early .6, guides forbidden |
|---|---:|---:|---:|---:|
| Serpentine / Luna | .01631 | .02750 | .01949 | .06702 |
| Serpentine / Amor | .01852 | .03027 | .01293 | .11381 |
| Terraces / Luna | .01440 | .02353 | .01810 | .07690 |
| Terraces / Amor | .01746 | .01453 | .01445 | .12255 |

These are whole-track target RMS values, not aesthetic rankings. Earlier onset
can put real contact into previously bypassed portions; it does not guarantee
continuous traversal. For example, Amor’s softer early serpentine records main
contacts in both halves in temporal order on all ten changed supports, while some
middle quarters remain untouched. In the longer Luna arrangement, one serpentine
support contacts all four schedule quarters with guide interaction, while another
only contacts its early half. Raw ordered contact timelines are retained.

Guide-free alternatives have substantial accuracy costs in this panel. Stronger
shape is not uniformly better, nor is guide removal. The workspace exposes these
choices and measurements without inventing an automatic visual-quality score.
A separate extreme unguided fold stress test fails and remains inspectable, with
no completed-video controls. It is a failure-path test, not evidence against folds.

## Implementation and validation

Concrete recipe definitions are shared by the old gallery and new composition
workflow. The old music study and new worker share authored-input adaptation,
physical evaluation, contact/geometry verification and artifact writing. The
composer reuses the existing connected and contact-fragment mechanisms, supports
repeated scattered passages, locks earlier realized geometry/state and meters every
stage under one ceiling. No new specification language, motif hierarchy, musical
classifier or opaque style score was introduced.

The delivered compiler reproduces all five saved arrangements’ track bytes,
reports, fragment sections and physical work exactly after removal of the two
unsuccessful experimental options. The older musical study still reproduces its
Luna baseline/fold tracks, collisions, scores and work exactly after helper extraction.

The full V4 default check remains **952.4726**, **352/352 valid**, **176 distinct
tracks**, seeds 16/17, and **46,454,822 physical frames**. Track hashes, score
components, observations, contacts, geometry and compiler statistics match the
previous run exactly. Benchmarks, detector, engine and scorer are unchanged.

Focused tests cover composition, preserved fragments, work accounting, geometry
and immutable caching: 39 pass. Native browser checks cover all main/control/stress
artifacts with zero saved-body-point error; full-app pose comparisons cover Luna
and Tiki baselines/arrangements. Workspace checks exercise actual audio playback,
scrubbing, rapid selection, draft persistence, JSON round trips, real compilation,
exact-request reuse, cancellation, invalid requests, failed-ride display and phone
layout. Actual simultaneous render/compiler workers were observed, graceful server
shutdown terminated its owned worker and preserved an interrupted status, and the
render queue produced a complete video from an API-created run. TypeScript retains the
same 251 pre-existing diagnostics, with no new diagnostics in this delivery.

Sampled production frames were visually inspected for native artwork, distinct
linework and complete post-processing. That is not a substitute for the owner’s
judgment of the complete videos. A prior browser-test timeout exposed the shared
render/compile queue; it was fixed with independent lanes and retested. Earlier
native-viewer checks exposed assumptions about two-window studies and one common
allowance; the viewer now handles composition records explicitly.

## Where the roadmap now stands

The foundation has moved from isolated demonstrations to a usable loop: choose,
compose, compile, inspect, compare and render. Existing shapes have meaningful
controls and stronger characterization; shared recovery broadens the useful set;
complete arrangements demonstrate repetition, longer passages, guide choices and
returns. This is an integrated early milestone across all five roadmap strands.

Remaining creative work includes stronger connected constructions, better quality
at deliberate unguided passages, less expensive continuation search, and musical
arrangements with more expressive sustained motion. The richer editor makes those
questions concrete. It does not infer a universal distribution of shapes, declare
serpentine solved, or replace visual judgment with contact counts. Preserve the
owner-approved contrasts while iterating on complete arrangements.

Raw study root: `generated/repertoire-workspace-20260930/`. Large media/raw files
remain local. [Compact evidence](evidence/repertoire-workspace-20260930.json) records
hashes, controls, results, contact summaries, rejected experiments and reproduction
sources. Normal lines only; no authored music or benchmark changes.
