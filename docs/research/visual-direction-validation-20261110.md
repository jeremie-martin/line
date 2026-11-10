# Visual direction validation, 10 November 2026

Purpose: check the renderer cleanup against the owner's decisions and review workflow,
not just its implementation tests. Baseline: `dd2c8e01` (round 39), with the current
uncommitted hit and visual-model refactors. No new theme design is adopted here.

## Intent and implementation

Read the recent commit history, the direction and craft notes, timing design, ledger,
round 21–26 answers and the 10 November owner-feedback digest, including rounds 32–39.
These decisions constrain the cleanup:

| Decision | Implementation and validation |
|---|---|
| Keep the ride readable; R26 shake only above strength 0.6, no rider zoom | `hits.js` preserves the approved response; `split.js` keeps the clean rider overlay and smaller title treatment. Original/current hit-frame comparisons are identical. |
| R23 effects start at measured peak, along the line struck at onset | Hit preparation separates time and normal. Ride time remains song time plus the recorded offset; spectrum and authored drop cues use song time. |
| Keep today's absolute intensity; alternative recipes were studies | `intensity.js` retains the calibration and smoothing. It is not normalized separately per song. All eight lab songs' sampled intensity, hit times and spans agree before/after. |
| R37 soft-start vibrance, paper half; normal passages retain the theme | Same response curve and colour transform. Plain-paper themes retain their override. All 40,446 palette/grade/intensity combinations compared in the refactor are identical. |
| R21/R22 composition and dark-theme inking | Existing sun/rider placement, band position, track modes, framing and bookends remain. Models are explicit inputs to the one canvas composition. |
| R39 deliberate theme families; drop refinement deferred | No automatic top-32 promotion, palette retuning or new drop treatment. The 62 active judging versions and proposed 28-family shortlist are different stages, not conflicting catalogs. |
| Review one change at the same moment, with accurate labels | Lab option/moment/ride switching and persistence checked in Chromium. The intensity caption now uses the resolved on-screen look, including overrides and free mix, and calls the amount “colour response.” |

## The same design through each workflow

`look.js` resolves production defaults and named themes. Candidate rounds register
their own colours in page memory and resolve complete options. Both feed
`createPicture`; the lab's films and production writer use the same picture through
`writeVideo`. Native replay supplies the ride, rather than a second visual implementation.

Judging is deliberately different from live preview: `freeze.mjs` captures the full
look, palette and partner, assigns a content identity and keeps the rendered stills.
The dashboard displays those stills; it does not reinterpret old choices through
today's defaults. `buildsOn` carries earlier judgments; retired themes remain in
the fit but are not offered; round-38 twins carry their specified prior. The dashboard
and report share `rate/model.js`. No ranking formula, pair-selection rule, prior,
owner answer, registry or frozen set was changed by this work.

Checked every one of round 38's 197 theme identities against its full specification.
Recomputed its existing inherited record read-only. More decisively, rendered all
62 active themes at both frozen moments (18 and 44.65 seconds), using their frozen
colours and options at 1080 × 1920, JPEG 0.92: **124/124 files are byte-identical to
both the pre-refactor renderer and the actual archived judging stills**. No archived
file was replaced. This is evidence about the current comparison material, not a
claim that every possible frame of every historical experiment is identical.

## Deliberate corrections and their scope

- **Fork heat:** a dot-radius variable shadowed ride time, sampling heat permanently
  at seven seconds. Fork and bars now share the current heat-based accent selector.
  This can change accent colour and dot size over much of a song on fork/heat looks,
  including production's Blue and Rose and several older candidates. None of the
  62 active round-38 versions uses this combination. Inspected same-moment before/after
  Blue and Rose stills: the corrected frame adds a second accent dot at 44.65 seconds;
  layout and palette remain the same. The correction matches the declared driver;
  its aesthetic desirability over a whole song is not established by that fact.
- **Colour queries:** `schemeAt(t, look)` previously used the last drawn intensity.
  It now uses the requested time, before drawing or after an unrelated seek. The
  draw path already set the right intensity; this corrects query consistency.
- **Evidence preservation:** `--rerender` previously overwrote frozen stills while
  retaining their judgments; its comment required the original renderer without
  enforcing that requirement. Rendering now stages a batch and compares every
  existing image before adding missing files. Any differing image or incomplete
  batch stops publication. Identical files are never rewritten. This also protects
  an existing moment when only another moment is missing. Changed encoding is a
  difference too; resolution upgrades must not silently replace judged evidence.

The preservation check cannot prove the provenance of a completely missing image;
the original scenes, renderer and archived files still need to be retained. It
prevents overwriting existing evidence, rather than promising reconstruction of
lost evidence from today's code.

## Checks and limits

- Lab: 76/76 browser checks, including seven new caption checks; phone and desktop,
  same-moment switching, asynchronous navigation, reload, notes, free mix and blind mode.
- Judging: phone portrait/landscape and desktop; vote/note persistence, repeated undo,
  retry deduplication, changed-set rejection, inherited-data isolation, retired-theme
  exclusion and results. A formerly tautological undo assertion now checks the restored
  theme. Tests use a throwaway set with no inherited owner log.
- Real freeze command on a throwaway set: identical regeneration preserves existing
  bytes and fills missing files; a differing image rejects the batch before filling
  another missing file. Three filesystem regression tests enforce that contract.
- Actual one-pass encoded excerpt: Circus Minimus / Rothko, 38.5–41 seconds at
  540 × 960; 150 frames and 0.00 ms measured audio-start error. This verifies the
  writer path, not a fresh aesthetic judgment of a whole film.
- The refactor's prior checks: 116 lab fingerprints, 504 targeted hit frames and
  2,592 composition frames (differences only for fork/heat); compile and judge parity.
  Final unit/browser test run, typecheck and reachability recorded in `REWORK.md`.

Verdict: the architecture and current judging material remain aligned with the
approved visual direction. No evidence here authorizes applying the pending shared
theme refinements, promoting candidates, changing the intensity metric or finishing
drop design. Those remain explicit design decisions, evaluated in the lab and whole
films rather than inferred from passing tests or ranking scores.
