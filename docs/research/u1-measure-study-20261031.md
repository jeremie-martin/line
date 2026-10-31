# U1 measure candidate: stopped at the retrospective check (2026-10-31)

Measurement only. Nothing the compiler, judge, evaluator or parity uses
changed. Evidence, commands, counts and every changed hit are in
[u1-measure-study-20261031.json](u1-measure-study-20261031.json).

## Result

- **Stopped before building the study.** The rule was to stop if the
  candidate did worse than `line.strike.v3` on labels the owner had already
  given. It does:
  - **45 of 63 decisive pairs, against 47 for v3.**
  - It changes the ranking in 4 of the 77 labelled pairs. In all 4 the owner's
    answer sides with v3: two decisive answers both chose v3's side, one was
    "same" and one was "neither".
- **No pairs were selected, no clips rendered, and no study ID exists.**
  Nothing needs copying into the main checkout.
- **What the owner already saw.** All four pairs come from round 1
  (`impact-pairs-2026-10`) and involve three distinct hits with the same shape:
  - a soft touchdown, with J 0.2–0.7 for 6 frames;
  - then a push of J 1.6–2.3 at 4 frames (100 ms) after the judged frame;
  - then the rider leaves the rail.

  v3 scores these 0.08–0.15. The candidate scores them 0.36–0.59, the same
  values as round 1's past-the-event motion-change reading (the `strength`
  column). The owner judged them no bigger than hits of 0.22–0.37.
- **Fix (a) alone changes no labelled pair.** The verdict rests entirely on
  fix (b), the push after a quiet touchdown.

## The candidate (`line.strike.v4-candidate`)

`tools/measure/u1/strike_candidate.ts` mirrors v3's `detectStrikes` line for
line. Observation, smoothing, the opposite-push split, strength (largest
2-frame whole-body change over the event's own ≤ 6 frames ÷ 7.55), timing and
matching are v3's. Only two changes:

- **(a) The renewal keeps its peak.** A renewal starts no earlier than its
  smoothed peak − 4 (window − strengthWindow). Its window therefore contains
  the peak and the frame after it.
- **(b) A push beyond a touchdown's own frames can start an event.**
  - Normally a valley must follow the current reference frame.
  - When no lower force follows it, the reference itself may serve as the
    valley, if the new peak is at least 6 frames (one window) after it.
  - Floor 0.8 and valley 0.5 are unchanged.
  - In practice this acts only after an event start: a touchdown or an
    opposite-push start.

U5 (fusing 1-frame gaps) does not follow from U1 and is not included.

**Design iteration, on the report's own panel, before the retrospective.**
Draft 1 had (b) without the 6-frame condition. It split 213 ordinary landings
(force rising over 4–5 frames) into a 1-frame touchdown plus a strike: 223
new events instead of 92. Moment strengths were identical, so only event
identity was affected. That is not the defect, so the condition was added.

**Moment rule**, the same for both measures: the strength of a judged moment
is the strongest event whose onset lies within ±6 frames of the judged frame.
The rule was fixed in code before the retrospective ran.

Tests (`tests/strike_v4_candidate.test.ts`) cover:
- a constructed case and a recorded case for each defect (amour 303 at
  1.625 s for a; tiki 101 at 42.7 s for b; fixture from the HEAD panel);
- an ordinary landing that is not split;
- a check that the candidate without its fixes equals v3 exactly, on 200
  random contact runs with opposite pushes.

## Retrospective check

`tools/measure/u1/retro_u1.ts` re-scores every judged hit from the source
tracks in `labels/studies/sources`. A measure is right on a decisive pair
(A or B) when it ranks the chosen hit higher.

| studies | pairs | decisive | v3 right | candidate right | pairs re-ranked |
|---|---|---|---|---|---|
| impact pairs, rounds 1–3 ("bigger impact") | 77 | 63 | 47 (p 0.0001) | **45** (p 0.0004) | 4 (all round 1) |
| slam-2026-10 ("more like a slam") | 10 | 6 | 3 | 3 | 0 |
| fix (a) only, impact pairs | 77 | 63 | 47 | 47 | 0 |

The four re-ranked pairs in `impact-pairs-2026-10`:

| pair | hit the candidate raises | v3 → candidate | other hit (v3) | owner |
|---|---|---|---|---|
| 1 | strike luna 202, f53 | 0.09 → 0.59 | 0.37 | the other hit |
| 4 | strike luna 303, f279 | 0.15 → 0.44 | 0.32 | the other hit |
| 10 | strike luna 303, f53 (same opening as luna 202) | 0.09 → 0.59 | 0.27 | neither |
| 12 | strike amor 303, f101 | 0.08 → 0.36 | 0.22 | same |

**Strength of this evidence.**
- 2–0 on decisive pairs is weak by itself (p = 0.25), and the "same" answer
  also contradicts the candidate's clear prediction.
- The clips put the light on the touchdown, with the push 100 ms later. A study
  with the light on the push itself would ask a slightly different question.
- That question stays open. Proceeding needs the owner's decision, because the
  pre-set rule says stop.
- A post-hoc rule that scores only the event nearest the light would tie v3
  here. It was not adopted, because it was chosen after seeing the labels.

## Remeasured runs

The report's panel runs (`v-s2x100-dev/-confirm`) lived in a deleted
worktree. I recompiled the same 48 cases at HEAD with `tools/eval` (strike3,
standard budget), to `generated/eval/u1-head-{dev,confirm}` in my worktree.
They reproduce the report's panel:
- v3 counts are equal (authored 3,433 events and 913 unmatched; perturbed
  1,593 and 333);
- every saved v3 loss recomputes exactly;
- the four review rides are byte-identical.

| | authored (32) | perturbed (16) |
|---|---|---|
| events v3 → candidate | 3,433 → 3,489 (+1.75 per ride, 0–5) | 1,593 → 1,623 (+1.9, 0–4) |
| unmatched v3 → candidate | 913 → 969 | 333 → 363 |
| hits whose strength changes by ≥ 0.1 | 58 (1.8 per ride), all up | 31 (1.9 per ride), all up |
| class: defect a / defect b (b alone / b needing a) / other | 4 / 54 (15 / 39) / 0 | 2 / 29 (4 / 25) / 0 |
| size of change: median (max) | +0.30 (+0.80) | +0.33 (+0.87) |
| hits involving a matched beat (quiet catches) | 35 | 21 |
| mean v3 loss → candidate loss | 0.0231 → 0.0272 | 0.0208 → 0.0258 |
| extra cost (extraMse) | 0.0028 → 0.0066 | 0.0019 → 0.0064 |

- **The counts match the report's diagnosis.** There are 6 defect-a cases (the
  report counted 6) and 92 new events (the report counted 86 rising cases plus
  6 window cases).
- **No unexplained change remains.** One "other" turned out to be a defect-b
  case with a slow rise (amour 202, 1.5 s: a 0.07 touchdown, then a 2.27 slam
  13 frames later); the attribution window was widened for it.
- **82 touchdowns are shortened** by a new renewal: median −0.02, 15 by 0.05
  or more, at most −0.11.

## Not done or not verified

- **Steps 4–6:** pair selection, pre-registration, study build and serving
  checks were not done, by the stop rule.
- **Held-out rides.** 96 rides were compiled for a held-out pool with
  `npm run produce`: 4 songs × seeds 9101–9124, in `generated/u1-heldout` in
  the worktree. They were never measured or looked at, so they are still held
  out if the owner wants a study.
- **Defect (a) alone could still be studied,** but it is rare: 6 in 48 rides.
- **Placement and identity.** The candidate lives in `tools/measure/u1/`
  because `evaluatorIdentity` hashes the top level of `tools/measure`, so a new
  file there would have changed the identity of every saved run. The identity
  is unchanged (`28c94fa1…`).
