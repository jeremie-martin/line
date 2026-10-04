# Scorecard blind spots (2026-10-05)

**Question.** Which rider behaviours would the owner plausibly notice that no `tools/eval` row
measures? Did the night's compiler changes (the v3 objective, L1, L9) move any of them?

**Tool.** `node --import tsx tools/measure/blind_spots.ts --runs=s3-base,s3-l1,s3-l9 [--rows=F] [--list]`.
It is research only and feeds nothing. `--list` prints example timestamps for viewing. Two runs are
byte-identical (per-ride rows sha256 `c224fefb…`).

## Data

- **Eras.** July (12 rides over 3 songs; no L'amour), the previous landing library
  (`current`, candidate-8), the strike v1 library (`strike`), and the v2 library (`strike2`).
- **Night runs.** Eval runs `s3-base` (v3 objective, before L1), `s3-l1` and `s3-l9`, 24 cells each.
- **strike2 is the pre-night compiler.** It is the v2 library, and it is byte-identical to eval run
  `s2-base` on seeds 101/202/303: 12 of 12 track hashes match.
- **s3-base had no saved tracks.** I recompiled it at bb8eab27 in a scratch worktree (at nice 19,
  with the old worker patched only to save the track). All 24 tracks match the stored cell hashes.
  They now sit beside the cells in `generated/eval/s3-base/cells/`.
- **Comparisons.**
  - The set table uses the same 12 authored cases (seeds 101/202/303) in every column.
  - Paired steps use per-case differences with a 95% song-bootstrap interval (n = 4 songs, as in
    `tools/eval`).
  - The v3 step (s3-base − strike2) has only 12 cases, because s2-base tracks exist only for those
    seeds.

## Definitions

Screen y points down.

- **Rider rotation φ:** the angle of the sled's TAIL→NOSE axis, 0 in the rest pose (checked: 0.0 at
  frame 0 in every ride).
- **Inverted:** |φ| > 90°.
- **Backward:** the sled axis points against the travel of the centre of mass (CoM), the 10-point
  mean.
- **Contact:** observe.ts's contact flag.
- **Strong arrival:** a `line.strike.v3` match with request ≥ 0.6. Its pose is read at the event's
  first contact frame.
- **Body contact:** BUTT, SHOULDER or a hand touching any line (the feet sit on the sled, so they do
  not count). A **drag** is a run of at least 6 frames (150 ms) of body contact.
- **Roof contact:** body contact on a line that pushes the point downward.
- **Pass-through:** a rider point ends a frame on the far side of a solid line it crossed and did not
  collide with that frame. "≥ 3 px" means it ends at least 3 px past the line. Consecutive frames
  merge into one episode.
- **Kick:** a one-frame CoM speed gain beyond gravity of more than max(0.75, 10% of speed), the
  motion check's 1-frame band applied to the CoM. It is off-beat when it falls more than 4 frames
  from every beat.

## Results

Per-ride means over the same 12 cases (July: its own 12 rides).

| row | July | current | strike | strike2 | s3-base | s3-l1 | s3-l9 |
|---|---|---|---|---|---|---|---|
| **strong arrivals inverted or backward %** | 13.4 | 19.6 | 22.4 | 21.5 | 24.3 | 30.2 | **30.8** |
| — inverted (\|φ\| > 90°) % | 9.7 | 17.6 | 18.0 | 18.0 | 21.9 | 25.3 | 27.9 |
| — backward % | 8.6 | 10.8 | 10.2 | 14.8 | 14.3 | 19.0 | 17.6 |
| inverted, % of ride | 7.6 | 12.6 | 15.5 | 15.8 | 15.7 | 18.4 | 17.0 |
| flight spin, rev/min | 14.0 | 15.2 | 17.6 | 18.9 | 18.5 | 20.6 | 19.5 |
| body contact, s/min | 1.17 | 8.41 | 7.20 | 7.94 | 7.93 | 7.61 | 7.83 |
| **body drag (runs ≥ 6 f), s/min** | 0.04 | 1.72 | 1.56 | 1.58 | 1.61 | 1.59 | **1.88** |
| — on a roof, s/min (all body contact) | 0.09 | 4.63 | 3.63 | 4.44 | 4.32 | 4.20 | 4.31 |
| **pass-through ≥ 3 px, episodes/ride** | 0.00 | 7.17 | 5.75 | 6.08 | 7.33 | 7.67 | **8.08** |
| pass-through (any), episodes/ride | 2.3 | 40.2 | 38.7 | 39.5 | 41.6 | 43.1 | 43.5 |
| strong: body first % | 3.5 | 23.9 | 25.9 | 36.4 | 39.7 | 33.8 | 39.0 |
| strong: front tip % / flat % | 50 / 21 | 34 / 30 | 33 / 25 | 31 / 21 | 28 / 18 | 31 / 21 | 30 / 20 |
| CoM kicks off-beat (total over 12 rides) | 0 | 12 | 0 | 0 | 0 | 0 | 0 |
| quiet passages: turn, °/frame | 1.89 | 2.37 | 3.46 | 2.82 | 2.95 | 2.81 | 2.80 |
| wobbles/min (≥ 15° swings reversing within 8 f) | 9.8 | 19.3 | 14.2 | 18.4 | 14.3 | 12.0 | 13.6 |

Paired steps of the night: mean difference [95% song bootstrap]. **Bold** marks an interval that
excludes 0.

| row | v3: s3-base − strike2 (12) | L1: s3-l1 − s3-base (24) | L9: s3-l9 − s3-l1 (24) | all: s3-l9 − strike2 (12) |
|---|---|---|---|---|
| strong arrivals inverted or backward % | +2.8 [−1.4, 5.5] | **+7.5 [5.9, 9.1]** | +0.4 [−3.1, 5.4] | **+9.3 [3.1, 16.8]** |
| strong inverted % | +4.0 [−0.1, 7.3] | **+4.8 [2.7, 7.1]** | +2.0 [−1.8, 6.0] | **+10.0 [4.6, 15.1]** |
| strong backward % | −0.5 [−3.9, 2.4] | **+5.4 [4.5, 6.3]** | −1.5 [−4.0, 1.6] | +2.8 [−4.4, 9.1] |
| inverted, % of ride | −0.1 [−1.5, 0.9] | **+2.2 [1.0, 3.5]** | −1.0 [−2.6, 0.8] | +1.2 [−2.3, 3.8] |
| flight spin, rev/min | −0.4 [−1.6, 0.8] | **+1.4 [0.5, 2.0]** | **−0.75 [−1.46, −0.04]** | +0.6 [−0.8, 1.9] |
| body drag, s/min | +0.02 [−0.67, 0.71] | **+0.24 [0.02, 0.41]** | +0.09 [−0.19, 0.33] | +0.29 [−0.28, 0.87] |
| pass-through ≥ 3 px | +1.3 [−0.5, 2.8] | **+2.4 [1.0, 3.9]** | −0.9 [−1.9, 0.1] | **+2.0 [0.4, 3.1]** |
| wobbles/min | **−4.1 [−5.8, −1.9]** | +0.1 [−2.2, 2.5] | −0.9 [−2.2, 0.7] | **−4.7 [−7.5, −1.7]** |

## Findings, ranked by likely importance to the owner

### 1. Head-down or backward arrivals at strong beats: a regression caused by L1

**Owner evidence.** His one explicit negative example (`docs/research/evidence/interaction-panel-feedback-20261002.json`,
clip `amor-strong`, paraphrased) reads: "the head-down/backward-looking arrival does not feel like an impactful strike …
not a general rejection of inverted riding". He also appreciates "the simple upright ground contact
without a control rail" (`tiki-contrast`).

**What moved.**
- July had 13% of strong arrivals inverted or backward. The pre-night compiler had 21–24%; s3-l9 has
  31%.
- L1 alone adds +7.5 pp. The sign holds in all 8 song × panel cells: +3.8 to +9.6 pp, authored
  +8.0, perturbed +6.6.
- **Power.** 1,066 strong matches per 24-cell run. L1 reclassifies 378 beats (232 upright → bad,
  146 bad → upright), which nets +86 bad arrivals (235 → 321).
- The extra inverted arrivals are mostly the rider rotated nose-down past vertical: in the 90–120°
  band, 42 → 68 against strike2.

**What the scorecard sees.**
- L1's strength gain comes from upright arrivals: unchanged upright beats +0.031, beats turned
  upright +0.051.
- Beats that became inverted or backward lost strength (−0.023).
- v3 already rates bad arrivals weaker: bias −0.198, against −0.147 upright.
- So the scorecard does not reward this side effect, but no row shows it. If the owner perceives these
  arrivals as weaker than v3 does, which his note suggests (**UNVERIFIED**: one paraphrased clip), L1's
  real gain is smaller than reported.

**Example to view.** `s3-l9 amor_na_praia_46s~101`, 9.10 s (request 1.0, v3 0.79, inverted). It is
the same beat as the owner's earlier negative passage (P12 Amor 9.10 s).

### 2. Body contact and body drag: a large era gap, slightly worse tonight

- The butt, shoulder or hands touch lines about 8 s/min (July 1.2), half of it on roofs (control-rail
  guides; July 0.09).
- Sustained drags run 1.6–1.9 s/min (July 0.04).
- **Owner evidence, which is mixed.**
  - In favour: he "strongly likes" a jump into a separate upper receiver, "with variety, not
    everywhere" (`ripple-receiver`).
  - Against: "the upper receiver dampens the felt impactfulness" (`open-transfer`), he was uncertain
    about a control rail in a "somewhat messy" opening (`luna-opening`), and he valued the upright,
    rail-free contact.
  - He also asked not to "remove all control rails".
- Body-only contact is invisible to the frozen air axis, which reads sled contact. That is 2.4 s/min
  counted as "air".
- L1 adds drag time: +0.24 s/min [0.02, 0.41]. **Power:** 71–89 drag runs per compiled column.

### 3. Lines passing through the rider (pass-through ≥ 3 px)

- July has none (0 in 12 rides). Compiled rides have 6–8 episodes per ride; the p50 depth is 3.9 px
  and the maximum about 12 px.
- L1 adds +2.4 per ride [1.0, 3.9]; the whole night adds +2.0 [0.4, 3.1].
- **Each one lasts about a frame. Whether a viewer notices is UNVERIFIED.** It needs the owner's eye
  before it is treated as a defect.
- **Examples to view (s3-l9):**
  - `amor_na_praia_46s~202`, 19.68 s: sled tail, nose, a hand and both feet;
  - `amor_na_praia_46s~101`, 6.50 s: the curled sled tip.

### 4. Spin and time upside down: rider character, not a defect

- Compiled riders spend 16–18% of the ride inverted (July 7.6%) and spin 19–21 rev/min in flight
  (July 14). L1 raised both and L9 gave part of it back.
- The owner welcomes rotation ("the issue is not that we are rotating") and inverted riding, and asked
  to preserve "dramatic motion". This should be a descriptive row, not a guard.
- There is one full loop (a flight turning at least 360°) in 120 rides: `s3-l9 luna~101` at 42.55 s.

### 5. Hit anatomy

- Strong hits are body-first in 34–40% of compiled rides, against 3.5% in July. Front-tip hits are
  fewer than in July (30% vs 50%), and the median sled-to-surface pitch is lower (31° vs 42°).
- The night moved none of these beyond noise.
- The owner said a tip bump "can work … not the highest possible impact". In the slam study he picked
  body-first as slamming more (4 : 2). Not a priority.
- With first contact read over the first 2 frames, "mostly sled-tip strikes" (PROGRESS, 23:45) does
  not hold: tip 41%, body 39%, flat 20% on s3-l9. hit_anatomy.ts reads 6 frames, so the two
  definitions differ.

## Negative results (looked for, not found)

Over 120 rides, all complete:

- **Stalls:** none. The lowest CoM speed after the first second is 5.4 px/frame.
- **Grinding:** the longest contact run is 0.93 s; no run lasts more than 2 s.
- **Crashes after the authored end:** none within 3 s (each complete ride was replayed 120 frames past
  the end).
- **Literal repetition:** at most 0.6% of consecutive equal-length gaps repeat the CoM path within
  2 px RMS (July 5%). A looser notion of variety ("same shape family") was not measured.
- **Off-beat speed kicks of the whole rider:** 0 in every column since the strike v1 library
  (`current` had 12 in 12 rides). On all 24 cells the night runs have 12 / 2 / 4 CoM kicks, all on a
  beat.
  - The motion check's 1-frame burden uses the engine's body-average velocity (6 body points,
    `engine.ts getRider`). It reads 44 → 14 → 28 frames (s3-base → L1 → L9).
  - That is body-relative motion, not a whole-rider speed-up, so the "1-frame ratio fails" lines in
    REWORK overstate the speed-up concern.
- **Quiet passages:** no kicks. Small extra impacts (0.1–0.25) run about 0.2 per quiet beat
  (July 0.36). Compiled riders rotate about 50% more there than July (2.8 vs 1.9 °/frame); the night
  did not move this.
- **Wobble:** v3 reduced it (−4.1/min).
- **Not checked:** camera framing. Render camera behaviour is outside this tool, so it is
  **UNVERIFIED** whether the rider ever leaves the frame.

## Recommended guard rows

These are guards (must not rise beyond noise against the baseline), not targets. The owner asked not
to minimise motion diagnostics globally.

1. **`strong arrivals inverted/backward %`** (recommended now).
   - Definition: per cell, among `line.strike.v3` matches with request ≥ 0.6, the share whose first
     contact frame has |φ| > 90°, or (NOSE − TAIL) · V_com[frame − 1] < 0.
   - Today: 30.8% (s3-l9). Pre-night: 21.5%. July: 13.4%.
   - Pair it with a blind pair study (head-down vs upright at equal v3 strength) to price it.
2. **`body drag s/min`** (recommended now).
   - Definition: frames where BUTT, SHOULDER, RHAND or LHAND collide with any line, counted only in
     runs of at least 6 consecutive frames, ÷ 40 ÷ ride minutes.
   - Today: 1.88. July: 0.04.
3. **`off-beat CoM kicks`** (a cheap tripwire for the owner's most repeated complaint, speed-ups).
   - Definition: one-frame CoM speed gain beyond gravity greater than max(0.75, 0.1·speed), more than
     4 frames from every beat; a count per ride.
   - Today 0. It should replace the body-average 1-frame burden as the speed-up check.
4. **`pass-through ≥ 3 px / ride`**: only if the owner confirms the examples above are visible.

## Caveats

- n = 4 songs, and July covers 3 of them.
- The thresholds (90°, 6 frames, 3 px, 15°/8 frames) are physical choices, not fitted to the owner.
- None of these rows is validated against the owner's labels. They describe what changed, not how
  much it matters.
