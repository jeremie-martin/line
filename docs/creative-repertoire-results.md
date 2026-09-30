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

Production videos, final confirmation evidence and owner review status will be
recorded here when complete. The previous positive ripple feedback applies to
the earlier reviewed example; it is not approval of this new panel.
