# Impact visibility study: built, unanswered (2026-10-31)

Study `impact-visibility-2026-11`, 55 pairs, about 17–21 minutes. This is a
pre-registration. Nothing the compiler, judge, evaluator or parity uses changed.
The key (`labels/studies/impact-visibility-2026-11.key.json`) holds every
pair's measured values. Commands, seeds, hashes and counts are in
[impact-visibility-study-20261031.json](impact-visibility-study-20261031.json).

Answer at
`http://127.0.0.1:8767/motion-gallery/pairs.html?study=impact-visibility-2026-11`.

## What it asks

The same page, question and answers as the earlier rounds: *Which one is the
bigger impact? A / B / About the same / Neither looks like an impact.* Plain
landscape clips, a 1.8 s loop, the judged moment at 1.0 s with the light on from
−50 to +120 ms. The prompt adds one sentence: *some lights mark ordinary riding
with no hit at all; if neither lit moment looks like an impact, choose "Neither
looks like an impact".* The two blocks are shuffled together and the sides are
random.

- **Block A, visibility (34 pairs).** A lit moment against a lit **blank**,
  plain riding with nothing at the light. "Same" or "neither" means he does not
  see the moment as an impact.
- **Block R, strength resolution (21 pairs).** Two clean requested hits at a
  controlled v3 ratio. This is information for the owner. It is not a case for
  flattening requested strengths: varied impacts are wanted even where they
  are hard to tell apart.

## Sources

- **Rides.** 76 of the 96 held-out rides compiled for U1 and never examined
  (4 songs × seeds 9101–9124, `generated/u1-heldout` in the U1 worktree,
  compiled at 475ad6bf). They were read in place and not modified.
- **Checks.**
  - All 96 rides have the current specification and audio (sha256).
  - All 96 replayed v3 event lists equal the evaluations saved at compile time.
  - No held-out ride appears in any earlier study key or in the unwanted-impacts,
    U1 or step-back reports, so no excluded ride and no previously judged hit is
    used. Trouble is not a source.
- **Preserved tracks.** The 76 tracks are kept as
  `labels/studies/sources/heldout~<song>~<seed>.track.json.gz` (9 MB), so the
  study can be rebuilt and re-scored without that worktree.
- **No peeking.** Pairs were chosen from measured values by
  `tools/measure/visibility/select.ts`, seed 20261031. No clip was watched.

## Block A: is the lit moment an impact?

Each pair is one moment from a group below against one blank. The light sits
on the event's v3 onset (half-rise). For a push, it sits on the first frame of
its strongest 2-frame window.

| group | pairs | lit moment |
|---|---|---|
| D1 | 6 | unrequested (unmatched) v3 event, 0.05–0.10 |
| D2 | 6 | unrequested v3 event, 0.10–0.20 |
| D3 | 6 | unrequested v3 event, 0.20–0.35 |
| D4 | 6 | launch push: force maximum outside every event, ≥ 0.3, after a quiet touchdown (v3 ≤ 0.15) in the same contact, at least 4 frames after it; contact ends within 2 frames after the push |
| D5 | 6 | the same push, but the contact continues (3–10 frames here) |
| anchor | 4 | requested hit ≥ 0.5, clean (rule R below) |

**Isolation for D1–D3.**
- No beat within ±4 frames of the light.
- No other v3 event of 0.05 or more with onset 4 frames before to 8 after.
- No out-of-event 2-frame change in that window as large as the extra itself.

For D4 and D5, no other event has its onset in that window, and the touchdown's
onset is at least 3 frames before the light.

**Blank.**
- The rider is in contact for the whole lit span.
- No v3 event onset from 4 frames before to 8 after.
- No v3 event frames within 3 frames of the light.
- Every 2-frame change from 3 frames before to 6 after is below 0.05.
- No beat within ±4 frames.

Each blank is a different moment, from the same song where one is left,
otherwise from another song.

**Changes from the step-back's Study A, and why.**
- **Blank window narrowed.** The report asked for no event and no 0.05 change
  within ±8 frames. Only 4 of the 96 rides have such a moment: beats come every
  ~22 frames, and plain rail steering itself runs at a median 2-frame change of
  0.09. The 0.05 ceiling is kept, applied over the lit span plus one frame.
  That gives 138 frames, about 49 distinct moments.
- **Blanks come from the same song, not the same ride.** Luna has a single
  blank in all 24 rides, so its events are paired with a blank from another
  song.
- **What the light can catch.** The isolation rules make sure no other event
  starts within the light. D3 extras, like most extras, often follow a strong
  hit 6–12 frames earlier (column "before" below). That hit is visible in the
  clip just before the light comes on.

### Block A pairs (event side; full values in the key)

| pair | group | event side | event (ride, frame) | value | blank (ride, frame) | strongest event in the 12 frames before |
|---|---|---|---|---|---|---|
| 10 | anchor | B | amour 9106 223 | 0.638 (ask 0.93) | amour 9104 1606 | — |
| 14 | anchor | B | amor 9109 178 | 0.645 (ask 0.80) | amor 9110 320 | — |
| 41 | anchor | A | tiki 9110 452 | 0.614 (ask 0.76) | tiki 9120 256 | — |
| 55 | anchor | A | luna 9105 1674 | 0.648 (ask 0.76) | amour 9121 1523 | — |
| 5 | D1 | A | luna 9104 308 | 0.077 | amour 9112 1577 | −7: 0.30 |
| 6 | D1 | A | tiki 9123 667 | 0.057 | tiki 9108 287 | −6: 0.66 |
| 17 | D1 | A | tiki 9108 1017 | 0.055 | tiki 9105 1786 | −8: 0.43 |
| 21 | D1 | B | amor 9111 1797 | 0.066 | amor 9116 160 | — |
| 25 | D1 | B | amour 9118 1741 | 0.077 | amour 9120 1283 | −5: 0.01 |
| 49 | D1 | A | amor 9115 1255 | 0.057 | tiki 9101 256 | −10: 0.46 |
| 9 | D2 | A | tiki 9101 530 | 0.103 | tiki 9117 255 | −7: 0.64 |
| 19 | D2 | A | amor 9124 1076 | 0.101 | amor 9104 317 | −7: 0.88 |
| 28 | D2 | B | amour 9113 1496 | 0.106 | amour 9118 1525 | −7: 0.45 |
| 37 | D2 | A | amor 9120 283 | 0.179 | amor 9101 159 | −6: 0.48 |
| 39 | D2 | B | tiki 9114 429 | 0.112 | tiki 9113 256 | −11: 0.81 |
| 54 | D2 | B | amour 9106 935 | 0.156 | amour 9108 1497 | −6: 0.67 |
| 4 | D3 | A | tiki 9106 396 | 0.230 | tiki 9109 288 | −12: 0.41 |
| 12 | D3 | A | amor 9120 1797 | 0.240 | amor 9106 322 | −7: 0.01 |
| 22 | D3 | A | luna 9113 985 | 0.204 | amor 9115 327 | −9: 0.71 |
| 31 | D3 | A | tiki 9111 400 | 0.203 | tiki 9115 287 | — |
| 32 | D3 | A | amour 9108 376 | 0.221 | amour 9117 1684 | −7: 0.74 |
| 51 | D3 | B | amour 9119 574 | 0.231 | amour 9113 1576 | −6: 0.72 |
| 18 | D4 | A | tiki 9108 1854 | push 0.42; touchdown 0.13, ask 0.03, +8 | tiki 9110 255 | −6: 0.13 |
| 26 | D4 | A | luna 9109 194 | push 0.32; touchdown 0.12, ask 0.06, +16 | tiki 9107 288 | — |
| 34 | D4 | B | amor 9120 106 | push 0.31; touchdown 0.14, ask 0.04, +7 | amor 9106 1032 | −5: 0.14 |
| 35 | D4 | A | luna 9114 85 | push 0.31; touchdown 0.07, ask 0.06, +9 | amour 9116 1711 | −8: 0.07 |
| 44 | D4 | A | tiki 9111 1784 | push 0.39; touchdown 0.10, ask 0.03, +7 | tiki 9121 255 | −7: 0.10 |
| 52 | D4 | A | amor 9123 1781 | push 0.73; touchdown 0.10, ask 0.10, +9 | amor 9112 315 | −8: 0.10 |
| 20 | D5 | A | tiki 9107 1714 | push 0.42; touchdown 0.13, ask 0.03, +6 | tiki 9103 287 | −5: 0.13 |
| 23 | D5 | B | tiki 9123 1783 | push 0.42; touchdown 0.12, ask 0.03, +7 | tiki 9105 323 | −5: 0.12 |
| 30 | D5 | A | luna 9124 137 | push 0.33; touchdown 0.08, ask 0.06, +10 | luna 9121 1071 | −8: 0.08 |
| 33 | D5 | A | amor 9109 1780 | push 0.48; touchdown 0.10, ask 0.10, +9 | amor 9118 1036 | −7: 0.10 |
| 42 | D5 | B | luna 9110 193 | push 0.53; touchdown 0.06, no ask, +8 | amour 9110 1712 | −3: 0.06 |
| 53 | D5 | A | amour 9118 67 | push 0.38; touchdown 0.10, ask 0.10, +18 | amour 9118 687 | — |

"+n" is the push's frame after the touchdown's first contact. Songs: amor = Amor
na Praia, amour = Amour de ma vie, luna = Luna Bala, tiki = Tiki Tiki.

## Block R: when does a strength difference become visible?

**Clean requested hit.**
- A v3 event matched to a beat, below the 1.0 cap.
- Upright at first contact (|pitch| ≤ 90°) and sled first: no body point on
  the first contact frame. The night study's head-down pairs were 6 of 6, so
  posture is held out of this block.
- No other v3 event of 0.1 or more within ±8 frames (200 ms).
- No out-of-event 2-frame change of 0.1 or more within ±8 frames.

**Cells.**
- Smaller hit at 0.20–0.30 (base 0.25) or 0.43–0.53 (base 0.5).
- Larger hit at the target ratio, within a factor of 1.05.
- 3× at base 0.5 would need hits above the cap, so that cell does not exist.
- 3 pairs per cell, 7 cells. Every R hit comes from a different ride.

| pair | base × ratio | larger side | larger (ride, frame) | v3 | smaller (ride, frame) | v3 | ratio |
|---|---|---|---|---|---|---|---|
| 11 | 0.25 × 1.25 | B | luna 9115 802 | 0.326 | luna 9117 1629 | 0.254 | 1.28 |
| 40 | 0.25 × 1.25 | B | luna 9106 911 | 0.320 | luna 9108 322 | 0.266 | 1.20 |
| 43 | 0.25 × 1.25 | A | luna 9121 1609 | 0.319 | luna 9122 279 | 0.247 | 1.29 |
| 16 | 0.25 × 1.5 | B | tiki 9105 1009 | 0.453 | luna 9112 1107 | 0.299 | 1.51 |
| 36 | 0.25 × 1.5 | A | luna 9102 1412 | 0.374 | luna 9110 497 | 0.239 | 1.57 |
| 48 | 0.25 × 1.5 | B | amor 9117 1245 | 0.451 | luna 9124 1608 | 0.293 | 1.54 |
| 15 | 0.25 × 2 | B | amor 9102 960 | 0.514 | luna 9123 1063 | 0.250 | 2.06 |
| 27 | 0.25 × 2 | B | tiki 9123 1200 | 0.546 | luna 9101 1456 | 0.270 | 2.02 |
| 50 | 0.25 × 2 | A | amour 9116 448 | 0.529 | tiki 9122 1812 | 0.273 | 1.94 |
| 3 | 0.25 × 3 | B | amour 9105 1408 | 0.842 | luna 9103 1281 | 0.275 | 3.06 |
| 7 | 0.25 × 3 | B | amour 9101 1196 | 0.754 | luna 9120 301 | 0.263 | 2.86 |
| 13 | 0.25 × 3 | A | amour 9122 209 | 0.844 | luna 9113 1587 | 0.293 | 2.88 |
| 29 | 0.5 × 1.25 | A | amour 9109 1168 | 0.608 | amor 9105 629 | 0.508 | 1.20 |
| 38 | 0.5 × 1.25 | A | luna 9104 671 | 0.572 | tiki 9118 384 | 0.479 | 1.19 |
| 47 | 0.5 × 1.25 | A | amor 9110 761 | 0.553 | amour 9120 1383 | 0.434 | 1.27 |
| 8 | 0.5 × 1.5 | A | luna 9119 1390 | 0.700 | tiki 9120 1235 | 0.485 | 1.44 |
| 24 | 0.5 × 1.5 | B | tiki 9104 523 | 0.740 | tiki 9111 1079 | 0.498 | 1.49 |
| 45 | 0.5 × 1.5 | B | amour 9117 955 | 0.812 | amor 9113 739 | 0.527 | 1.54 |
| 1 | 0.5 × 2 | A | amor 9120 365 | 0.995 | tiki 9102 784 | 0.522 | 1.91 |
| 2 | 0.5 × 2 | B | luna 9116 1216 | 0.903 | amour 9108 1276 | 0.436 | 2.07 |
| 46 | 0.5 × 2 | B | amor 9119 364 | 0.970 | amour 9111 1435 | 0.500 | 1.94 |

The small base-0.25 hits are 11 of 12 from Luna, the quietest song. All three
3× pairs set Amour against Luna.

## Pre-registered rules (fixed before any answer exists)

**Counting.**
- Block A: a moment counts as **seen** only when he picks its side. "Same",
  "neither" and picking the blank all count as not seen. Picking the blank is
  also counted toward the void rule.
- Block R: a difference counts as **seen** only when he picks the larger v3
  side. "Same" and "neither" count as not seen. Picking the smaller side is a
  **reversal**: not seen, and counted separately. "Neither" in block R is
  reported separately: it means a requested hit of 0.25–1.0 did not read as an
  impact.
- The last answer per pair counts. A **skipped** pair is excluded. A verdict
  stands only if it holds whatever the skipped pairs would have been.

**Void conditions.**
- **Anchors.** All 4 anchors must be seen. Otherwise the whole study is void,
  and we discuss it before reading either block.
- **Blanks.** He may pick a blank in at most 2 of the 34 block A pairs. If he
  picks more, block A is void; block R is still read, with the count reported
  beside it. If he truly picked blanks 3% of the time, this rule would void the
  block 8% of the time.

**Block A, per group of 6** (the step-back report's rule):
- **visible:** seen in at least 5 of 6 (probability 0.89 if his true rate is
  0.9);
- **not visible:** seen in at most 1 of 6 (probability 0.89 if his true rate
  is 0.1);
- otherwise **unresolved**.

Descriptive only: D1–D3 split by whether an event of 0.3 or more starts in the
12 frames before the light. A "visible" D1–D3 verdict that rests on those pairs
alone may be borrowing the earlier hit.

**Block R, per ratio** (both bases pooled; 6 pairs at 1.25×, 1.5× and 2×, 3 at
3×):
- **visible:** larger picked in at least 5 of 6 (3 of 3 at 3×);
- **not visible:** larger picked in at most 2 of 6 (at most 1 of 3 at 3×);
- otherwise **unresolved**.

If his true rate of picking the larger is 0.8, a 6-pair level reads visible 66%
of the time and not visible 2% of the time. At 0.5, the figures are 11% and 34%.

- **Visibility threshold:** the smallest ratio that reads visible, provided no
  larger ratio reads not visible. Otherwise it is reported as inconsistent.
- **Reversals:** two or more at 2× or 3× means v3 misorders clean hits at that
  gap.
- **Descriptive only:** the two bases separately (3 pairs per cell), and a
  logistic fit of "larger picked" against log ratio over all 21 pairs.

## What each outcome would mean

**Block A** (as in the step-back report):

| outcome | meaning |
|---|---|
| D1–D2 not visible | Unmatched events below 0.2 are not hits to him. U2–U4 should target only the 0.2+ tail. Candidate measure change: an extras floor. |
| D2 visible | A 0.15 bump is seen while a 1.3× strength gap mostly is not. Extras are under-priced against strength error (U4, or the forcing rules U2/U3). These are compiler changes, tested under WORKING.md. |
| D4 not visible, D5 visible | The U1 defect matters only for pushes within a contact. Simplest change to test: U1(b) without pushes that end the contact. |
| D4 and D5 visible | Re-open U1 as built. The retrospective put the light on the touchdown, which explains its result. |
| D4 and D5 not visible | Close U1(b) and keep v3's identity. |
| anchors fail, or blanks picked more than 2 times | The task is not working as intended. Discuss before reading anything. |

**Block R** (information for the owner, not an objective):

| outcome | meaning |
|---|---|
| visible from 1.25× | He resolves differences of about 1.25× in isolation, which is finer than the night study suggested. v3 strength error of 0.1–0.13 is then partly visible. |
| visible from 1.5× (1.25× not visible) | Differences under ~1.5× are not seen in isolation, differences of 1.5× are. The night study's "same" at 1.5–1.9× then came from its own pairs (same beat compiled two ways, clutter and posture not controlled), not from a limit of his eye. |
| visible from 2× (1.25× and 1.5× not visible) | Consistent with the night study: below ~2× he does not see v3 differences between clean hits in isolation. Most of the strength error the loss charges, about 70% of it, is then below what he sees in isolation. This says nothing about context (a hit beside its neighbours), and it is not a reason to flatten requested strengths. |
| 3× not visible, or reversals at 2–3× | v3's scale does not match what he sees on clean hits. That would contradict the earlier 30 of 35 at ratios of 1.5 or more, and needs a look at the specific pairs before anything else. |
| base 0.25 resolves at a smaller ratio than base 0.5 (descriptive) | A hint that equal ratios are not equally visible (compression at the top of the scale). Too small to act on alone. |

## Built and verified

- **Build.** `tools/measure/visibility/build.ts` renders the 76 rides and cuts
  the clips: plain landscape, spec camera, 1280×720 renders cut to 960×540.
  This is the same `renderRides` and `cutClip` as `pair_study.ts`.
  `pair_study.ts` was not changed: it reads only the July, library and eval
  sources.
- **Verification** (scratch script in the JSON):
  - **Manifest.** It lists the key's 55 pairs in order, with question `bigger`
    and options left/right/same/neither, hitAt 1.0 and length 1.8.
  - **Labels API**, run on a throwaway copy, never on `labels/` here:
    - 220 valid answers (every pair × every option) accepted;
    - a wrong answer, an unknown clip and a missing answer each rejected (400);
    - afterwards it reports all 55 pairs answered.
  - **Clips.** All 110 exist: 1.80 s, 960×540, h264 at 60 fps, with audio.
  - **Page.** It loads in headless Chromium from this worktree's `npm run
    serve` on port 8791. It shows "Pair 1 of 55", the prompt and four answers,
    and the videos play. There were no console errors or warnings, no failed
    requests and no writes. All 110 clips decode in the page at 1.8 s.
  - **Judged moment at 1.0 s.**
    - Clip cut: on 20 sampled sides (anchors and R), the clip frame at 1.0 s is
      the ride render's frame at frame/40 s (mean pixel difference about
      0.05). For odd physics frames it is the 60 fps frame 1/120 s earlier, the
      nearest the video grid allows (10 odd frames checked).
    - Render time against physics: a 1,860-frame track renders 2,793 frames at
      60 fps, which is linear at 1.5 video frames per physics frame.
    - Start offset: one anchor (pair 14, contact at frame 178) was viewed frame
      by frame after the key was frozen. The sled meets the rail at clip time
      1.00–1.03 s, within one physics frame.
- **Gates.**
  - `npm test`: 293 passed.
  - `npm run typecheck`: 0 errors, as before.
  - `npm run reach`: 0 unreachable; the 3 new files are entries under `tools/**`.
  - Parity: not run. No product file changed: the new code is only in
    `tools/measure/visibility/`, and `evaluatorIdentity` hashes top-level
    `tools/measure` files only.

## Not verified

- **His pace.** Rounds 1 and 3 took about 19 s per pair and the night study
  about 23 s, so 55 pairs is 17–21 minutes. Blank pairs may be quicker.
- **What the clips show.** I did not watch them, by design (except the one
  timing check above, after the key was frozen). A lit "blank" was
  checked numerically: contact, no event, no change of 0.05 near the light. It
  may still show something he reads as a hit, such as a seam or a line ending
  that the physics does not register.
- **Cues on the page.**
  - The beat timeline (grey ticks) is shown as in earlier rounds. Anchors and
    R hits sit on a tick. Blanks and D1–D3 have none within 100 ms. D4/D5 have
    a small tick 150–450 ms before the light.
  - The page's fixed instruction line still says the light marks "the hit you
    are judging". The prompt above it says some lights mark ordinary riding.
    `pairs.js` was not changed.
- **The rule thresholds** (blank window, isolation windows, clean rule) were set
  from measured pool sizes, before any answer, but not tested on clips.

## Files

- `tools/measure/visibility/observe_heldout.ts`: replays the held-out rides and
  writes v3 events, pushes outside events and per-frame contact and change.
- `tools/measure/visibility/select.ts`: the rules and seeded selection; writes
  the key and preserves the source tracks.
- `tools/measure/visibility/build.ts`: renders, cuts and writes the manifest.
- `labels/studies/impact-visibility-2026-11.key.json` and
  `.manifest.json`: the key and a copy of the published manifest.
- `labels/studies/sources/heldout~*.track.json.gz` (76) and
  `labels/studies/sources/index.json`.

These files are in a subfolder because `evaluatorIdentity` hashes only
top-level `tools/measure` files, so saved runs keep their identity.

## Amendment before any answer (2026-10-31, main session)

The beat timeline drew each requested beat with its strength as tick height,
and only requested moments have a tick. That would cue Block R (the larger hit
usually has the taller tick) and the Block A anchors (a tick at the light,
where blanks and extras have none). The manifest's per-clip `beats` lists are
now empty, so the timeline shows only the judged moment and the playhead.
Pairs, clips, sides and every pre-registered rule are unchanged.
