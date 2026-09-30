# First repertoire milestone — 2026-09-30

Work under the [agreed roadmap](creative-repertoire-roadmap.md). The first panel
compares ordinary arcs, ripple phrases, a third construction on the same phrases,
and a complete ride combining the third construction first and ripples later.
Earlier history is locked; the continuation is physically searched. Music targets,
normal-line physics, the scorer and production rendering remain unchanged.

## Declared development and confirmation

Development uses Luna Bala and Amor na Praia at seed 331. Their existing phrase
windows are retained. Tiki Tiki was reserved before development: first beats at
6.9–9.5 s and the later run at 27.83–30.5 s, with the complete 48-second ride
compiled. These windows select supports by their start times; actual boundaries
and returns are recorded, not assumed to match the nominal windows exactly.

The compiler was frozen at `984cfb3c`. Development compares terraces and
serpentine at strength 1 and 1.5, each with a one-million-frame ceiling. A first
200,000-frame study changes both reference and edit budgets and therefore does
not isolate editing cost. A second 500,000-frame edit study holds the reference
at one million, making the incoming physical states directly comparable.

The provisional third construction is the serpentine at strength 1.5. Native
inspection showed the terrace changes can remain subtle; a stronger broad sweep
is a useful next visual hypothesis alongside the two-wave ripple. This choice
accepts measured musical costs, not an assertion of aesthetic superiority. The
complete mixed ride uses the stronger serpentine in the first phrase and ripples
in the second. The stronger construction is not applied everywhere by default.

Confirmation uses seed 341 on all three songs, with the same frozen compiler,
one-million-frame ceilings and fixed construction strengths. Tiki's reuse result
must not be used to retune this confirmation. The production inputs have zero
jitter, so fresh seed labels alone do not establish independent searches.

## What the controls mean

| Choice | Meaning and limitation |
| --- | --- |
| Ordinary arc | The searched entry, initial turn and exit schedule, with optional expressive bend. |
| Ripple | Two sinusoidal heading variations during the post-entry part of the support. |
| Serpentine | One broader positive/negative heading variation, tapered at its ends. |
| Terraces | Two eased heading pulses. The name does not guarantee flat horizontal ledges. |
| Profile strength | An explicit multiplier on that heading variation, before the common curvature limit. Zero reproduces ordinary geometry for the same controls; one preserves the existing profile. The tested research range is 0–2. |
| Guide permission | Search may build an opposing guide. Unused guide portions are trimmed after replay. Permission, visible geometry and actual contact are distinct. |
| Search | Fits entry, turn, exit, duration, easing and guide parameters to the musical targets. It cannot change the requested profile or strength. It can affect their visible expression through support length and curvature. |

Strength is a construction input, not a guarantee of screen-space displacement.
The same multiplier can look different at different speeds and support lengths.
The gallery shows actual searched tracks; no decorative replacement is applied.

## Findings so far

At 200,000 frames the tested compositions are valid but lose substantial musical
accuracy. The inherited allocation also disables guide refinement on these long
requests, so this comparison changes the available search mechanisms as well as
the allowance. At 500,000 edit frames, Luna terraces retain much of their accuracy,
but Amor loses more. Lower compilation cost is not free and neither result is a
geometry ceiling. The main visual confirmation therefore retains the larger
allowance while preserving these efficiency results for further work.

All 352 default V4 outputs at seeds 16/17 match the previous run exactly, including
tracks, observations, diagnostics and physics work. The headline remains 952.4726.
This checks default behavior, not aesthetic success of the new comparisons.

The global future-value ablation retains the learned control proposals but
removes the learned estimate used to rank future motion. Four matched tests
all worsen RMS: Luna's two-profile comparison 0.02168 → 0.02790 and mixed ride
0.01503 → 0.01980; Amor 0.02526 → 0.03831 and 0.02966 → 0.04398 respectively.
All remain valid at essentially the same work. The unsuccessful switch was
removed; its exact patch, probe and results are preserved in the evidence. This
does not rule out a better estimator or a more targeted change.

## Confirmation results

All **12/12 rides** pass timing and survival, with **50,239 normal segments**.
Earlier rider history matches over 1,848 compared frames. All eight Luna/Amor
tracks repeat the corresponding development tracks at the fresh seed; Tiki adds
four distinct tracks on the reserved song. These are 12 distinct confirmation
rides, not evidence of seed robustness beyond the tested zero-jitter requests.

| Song | Construction | Whole-ride RMS ↓ | Simulated frames | Compile seconds |
| --- | --- | ---: | ---: | ---: |
| Luna | Ordinary arcs | 0.01232 | 5,417 | 3.24 |
| Luna | Ripple phrases | 0.01865 | 924,556 | 24.14 |
| Luna | Serpentine phrases, strength 1.5 | 0.02168 | 926,439 | 22.99 |
| Luna | Serpentine then ripple | 0.01503 | 923,770 | 23.99 |
| Amor | Ordinary arcs | 0.01324 | 934,417 | 24.68 |
| Amor | Ripple phrases | 0.01441 | 938,222 | 25.41 |
| Amor | Serpentine phrases, strength 1.5 | 0.02526 | 941,102 | 25.44 |
| Amor | Serpentine then ripple | 0.02966 | 943,559 | 26.55 |
| Tiki | Ordinary arcs | 0.01989 | 5,915 | 0.36 |
| Tiki | Ripple phrases | 0.03391 | 947,639 | 27.58 |
| Tiki | Serpentine phrases, strength 1.5 | 0.03219 | 942,247 | 27.59 |
| Tiki | Serpentine then ripple | 0.03080 | 947,702 | 28.09 |

Compile times include shared-host contention, and Luna's first baseline includes
model loading. They exclude independent verification and video production. The
modified Luna and Tiki rides are much more expensive than their easy baselines.
The study has not delivered an editing speedup.

Local costs are material. In Amor's mixed ride, the main-drop window's mean
speed error rises from 0.0118 to **0.0840**, with a largest error of **0.2198**.
In Tiki's first-beat window, mean amplitude error rises from 0.0445 to **0.1363**,
with a largest error of **0.2958**. Luna's mixed climax has smaller losses: mean
speed error 0.0115 → 0.0231, impact 0.0043 → 0.0086. Validity and a reasonable
whole-track average must not hide these specific musical compromises.

## What touches the rider

For each profiled support, the inspection reconstructs the main rail at its
actual incoming state and saved controls, then compares it with the same controls
at zero profile strength. **74 of 78 supports** have actual rider contacts with
the displaced main-rail segments. The other four have guide contacts; two of
those have no main-rail contact at all. The contact report distinguishes these
cases. It does not claim every shaped segment is used or every guide is needed.
The zero-strength geometry is a diagnostic reference, not a validated alternative
ride: changing a surface can alter the whole continuation.

Native replay matches all 12 saved rides with zero body-position error. The full
Line Rider app agrees on **3,448 sampled poses**, including scarf and rider state.
All 12 native-gallery comparisons pass, including corruption rejection, playback,
contact navigation and mobile layout.

Production rendering and music-page checks are being completed. The previous
positive ripple feedback applies to the earlier reviewed example; new preference
and production adoption remain open. This milestone supplies concrete choices
and evidence, while accuracy, efficient editing and artistic composition remain
substantial work under the roadmap.

## Evidence and reproduction

The [compact evidence](evidence/creative-repertoire-20260930.json) includes all
38 development compilations (30 distinct tracks), four matched future-value
ablations, the 12 confirmation rides, local errors, actual contact inspection,
default V4 parity and validation records. The ablation includes its exact
temporary patch and probe; it is not a retained compiler option.

The full tracks, replays and media remain local under
`generated/repertoire-20260930/`. Code and compact evidence are committed and
pushed. Use a clean compiler checkout at `984cfb3c`, with this repository's
`node_modules` and verified WASM artifact available, for the declared confirmation:

```sh
LR_ENGINE=wasm node --import tsx scripts/produce/musical_direction.ts \
  --compiler-root=/tmp/line-repertoire-20260930 \
  --out=generated/repertoire-reproduction \
  --repertoire=serpentine --strength=1.5 --seeds=341 \
  --songs=luna_bala_44s,amor_na_praia_46s,tiki_tiki_48s

node --import tsx scripts/produce/summarize_musical_direction.ts \
  --study=generated/repertoire-reproduction \
  --out=generated/repertoire-reproduction/evidence.json

LR_ENGINE=wasm node --import tsx scripts/produce/inspect_repertoire.ts \
  --study=generated/repertoire-reproduction \
  --out=generated/repertoire-reproduction/contacts.json
```

Development uses `--seeds=331`, excludes Tiki, and compares `--repertoire=terraces`
with `--repertoire=serpentine`, with omitted strength (one) or `--strength=1.5`.
`--methods=baseline,candidate,mixed` avoids rebuilding the identical ripple
comparison in each study. `--composition-budget=500000` holds the reference
allowance at one million while reducing edit work; `--budget=200000` changes both.

Render preserved cell IDs with `scripts/produce/render_musical_direction.ts`
using `--study=... --ids=...`. The script imports the saved physical tracks into
the full production pipeline, checks input identities, and produces full vertical
videos and 32-second excerpts. `reuse_musical_direction_videos.ts` reuses media
only after checking identical physical, authored and rendering inputs.

Browser validation uses the existing dashboard and mirror servers:

```sh
node scripts/gallery/check_renderer.mjs \
  generated/repertoire-reproduction/manifest.json \
  --mirror-origin=http://127.0.0.1:8765 --mirror-cases=all \
  --out=generated/repertoire-reproduction/native-checks.json

node scripts/gallery/check_musical_direction_ui.mjs \
  --study=generated/repertoire-reproduction \
  --out=generated/repertoire-reproduction/music-checks.json
```
