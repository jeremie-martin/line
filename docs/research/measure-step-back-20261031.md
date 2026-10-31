# The impact measure, a step back (2026-10-31)

Analysis only. No tool, measure, compiler, label or study changed. Evidence
(commands, input hashes, every judged hit, the scratch scripts) is in
[measure-step-back-20261031.json](measure-step-back-20261031.json).

**This spends the owner's existing answers as test data.** Any measure change
suggested here must be confirmed on fresh answers before it is adopted.

## Summary

- **What is validated.** v3 orders hits much better than v1 where the two
  disagree (20 of 23). It also passes coarse checks (9 of 10). It does not
  beat the other plausible candidates (18 of 30), and it does no better than
  chance when two hits differ by less than about 1.5× (17 of 28). Its scale,
  its extras and its timing have no validation.
- **The misses.** v3 gets 16 of 63 decisive pairs wrong. The only pattern
  with any weight is this: in 7 of the 16, the hit v3 prefers is followed
  within 200 ms by another sizeable event. It is post hoc and small, and two
  of the 7 come from how the moment was scored. It is a hypothesis, not a
  finding.
- **What matters and is unknown.**
  - Whether unrequested bumps of 0.05–0.35 are visible at all: the studies
    never showed him any.
  - What he sees as "the hit" of a quiet beat.
  - How much of the strength error, 70% of the loss, he can see.
- **Proposal.** One new short study: is the lit moment an impact? The light
  sits on an extra or a later push, paired against plain riding. Then answer
  the already-built night study. Together that is about 18–25 minutes.
- **Measure changes.** None now.

## 1. What the compiler needs from the measure

The account (`scripts/lib/contact_impact.ts`, `accountContactImpacts`)
first matches events to beats, at most 4 frames apart, maximising the
number of beats fulfilled. It then charges four costs:

- strength error², for each matched beat;
- timing error², for each matched beat;
- strength², for each unmatched event;
- 1, for each missing beat.

On the 32 authored panel rides (U1 remeasure), the loss splits into
**strength 70%, timing 18%, extras 12%**.

| use | what it needs | validated? |
|---|---|---|
| **Matching and fulfilment** (a ride is complete only if every beat has an event within ±4 frames) | detection: the event matched to a beat is what he sees as that beat's hit | **No.** Any touchdown counts, however gentle. In two grade-study clips with quiet asks (c010, ask 0.10; c023, ask 0.03), v3 matched a 0.06/0.09 touch on time. A 0.57/0.37 landing followed 200–275 ms later. He reported one hit, "late" and "very late". |
| **Strength error** (s − ask)² | an absolute scale: an ask of 0.5 should look like a medium hit. At least, differences the loss charges should be visible. | **Ordering only, for clear differences.** Scale: none. Nothing was ever judged harder than "medium" (impact-2026-10). The compiler's strength rms is about 0.13 (√0.0162). On mid-range hits that is a ratio of about 1.3, where his pair answers barely follow v3. |
| **Timing** (half-rise onset vs beat) | when he sees the hit begin | **Weak.** Two approved passages (P2, P14). In 11 grade clips, "on the beat" onsets run +25 to +75 ms and "late" ones +50 to +75 ms: they overlap. |
| **Extras** (unmatched strength²) | detection (is it a separate visible hit?) and a scale comparable to strength error | **None.** Pair selection excluded any hit with a neighbour of half its size within ±10 frames. Only 5 of 154 judged hits are below 0.2, while panel extras have median 0.05 and p90 0.15. His notes say a following upper hit is unwanted (round 3 #12; grade clips c021, c022). |

In the search, an extra s costs s² and the current beat's strength error e
costs 2e² (unwanted-impacts report). An extra of 0.15 therefore weighs the
same as a 0.106 strength error. Whether that balance is right depends on
two unknowns: whether a 0.15 extra is visible, and whether a 0.1 strength
error is.

## 2. What his answers say

### Agreement on decisive pairs

v3 is scored with the U1 rule: the strongest v3 event with onset within ±6
frames of the judged frame. This reproduces 47/63. The other rows come from
`tools/measure/analyze_pairs.ts` on the preserved tables.

| measure | round 1 (19) | round 2 (20) | round 3 (24) | all (63) |
|---|---|---|---|---|
| **v3** | 16 | 16 | 15 | **47** |
| v2 strength (Oct 4 table) | 15 | 16 | 15 | 46 |
| whole event, with spin | 14 | 16 | 16 | 46 |
| arrival + spin (`c_arrive_spin`) | 15 | 16 | 14 | 45 |
| travel only (no spin) | 15 | 13 | 14 | 42 |
| arrival (`c_arrive`) | 15 | 14 | 12 | 41 |
| v1 redirection | 10 | 5 | 16 | 31 |

Slam study ("which slams more"): v3 is right on 3 of 6 decisive pairs.

**By kind of pair** (v3):

| pairs chosen where… | decisive | v3 right |
|---|---|---|
| v1 and v2 disagree | 23 | 20 |
| both measures agree strongly (checks) | 10 | 9 |
| another good candidate disagrees with v2 (whole event, travel, arrival + spin, arrival vs arrival + spin) | 30 | **18** (95% CI 0.42–0.75) |

**By v3's own gap:**

| larger/smaller | decisive | v3 right | "same" |
|---|---|---|---|
| < 1.5 | 28 | **17** (CI 0.42–0.76) | 8 |
| ≥ 1.5 | 35 | 30 (CI 0.71–0.94) | 5 (+1 neither) |

Every study chose its pairs where measures disagree, or as easy checks. So
47/63 is not an estimate of agreement on ordinary compiled hits. No random
sample has been answered: the night study holds one, built and unanswered.

The judged hits span 0.26–0.65 (p10–p90). The question was always "which is
bigger" about a lit, isolated hit.

### The 16 pairs v3 gets wrong

These are physical readings from replaying the preserved source tracks. I did
not watch the clips. Tags: **C** means v3's pick has another v3 event at least
half its size within 8 frames. **I/B** means v3's pick lands inverted or
body-first.

| pair | he chose (v3) | v3's pick (v3) | what differs | tag |
|---|---|---|---|---|
| R1 #3 | 0.42, 41° turn | 0.56, 13° turn | both inverted | — |
| R1 #13 | 0.33, upright | 0.52, inverted, shoulder first | | I/B |
| R1 #23 | 0.48, upright | 0.65, inverted | | I |
| R2 #14 | 0.28, July, clean | 0.52 from an event 1 frame after the light, in a cluster of 4 events within 6 frames | note: "B is cleaner" | C, rule |
| R2 #19 | 0.32, July | 0.55, followed at +3 frames by 0.40 | | C |
| R2 #25 | 0.36, upright | 0.52 at +2 frames; the lit event is 0.36; body first, roof push | | C, rule |
| R2 #27 | 0.55, 21° turn | 0.63: mostly spin, 0° turn, shoulder first | ratio 1.14 | B |
| R3 #8 | 0.36, 27° turn | 0.48, followed at +3 by 0.47 | | C |
| R3 #9 | 0.21 | 0.38, July | | none |
| R3 #10 | 0.35, July | 0.72 | the known failed check | none |
| R3 #11 | 0.42, July, spin reversal | 0.55, inverted | | I |
| R3 #12 | 0.52 (followed by an upper hit he disliked) | 0.63, force builds over 5 frames, body | ratio 1.21 | B |
| R3 #16 | 0.38, upright, 20° turn | 0.52: 1° turn, spin-up, inverted, busy clip | note: "A cleaner and better defined" | C, I |
| R3 #21 | 0.29, no turn | 0.40, quiet ask, spin reversal | | none |
| R3 #22 | 0.36, 35° turn | 0.45, followed at +4 by 0.34 | | C, B |
| R3 #25 | 0.419 | 0.422, followed at +4 by 0.39 | a tie | C |

"same"/"neither" answers where v3 sees a big gap:

- Only two pairs: round 1 #10 (neither, 0.09 vs 0.27) and #12 (same, 0.08
  vs 0.22). Both involve the quiet-beat hits that U1 re-scored.
- Frame by frame, those hits are a gentle nose touchdown followed 4–5
  frames later by a strong upward push in the last two frames before the
  rider leaves the rail: **a launch, not an arrival**. The third such hit
  (round 1 #4) lost too.
- The light is on from −50 ms to +120 ms (`pairs.js`). These pushes start
  at +100–125 ms, so the light went off as the push began.
- All other "same" answers sit at v3 ratios 1.07–1.68.

### Is there a pattern?

Each candidate pattern was checked on all 63 decisive pairs, not only on the
misses.

- **Clutter (a sizeable event right after the hit).**
  - v3 is right 4 of 11 times when its pick is cluttered, against 43 of 52
    otherwise. This holds for windows of 4–12 frames and size fractions of
    0.3–0.7.
  - Two of those misses (R2 #14, #25) exist only because the ±6-frame rule
    credited a neighbouring event. Scoring the event nearest the light gives
    v3 49/63, and clutter 4/9 against 45/54 (one-sided Fisher p ≈ 0.02).
  - The definition was chosen after seeing the misses, and about 30 variants
    and 8 features were scanned. So this is **a hypothesis, consistent with
    his notes** ("cleaner", "better defined", "the upper hit right after is
    not good"), **not a result**.
- **Inverted or body-first pick:** v3 is right 9 of 14 when its pick has
  this, against 38 of 49 otherwise. This could be noise.
- **Bigger direction change:** the chosen hit has the larger turn in 36 of
  63. Not a pattern.
- **Quiet launches:** 3 hits in 4 pairs, all read as weak. That is
  anecdote-sized.
- **Round 3 holds 9 of the 16 misses.** Every measure scores 12–16 of 24
  there, because its pairs were chosen where good measures disagree. Part of
  the remainder is what this design cannot resolve.
- **Unexplained:** 3 misses (R3 #9, #10, #21).

## 3. What is unknown and matters

In order of what it would change:

1. **Are extras of 0.05–0.35 visible?**
   - They make up all of the extras term and the subject of TODO item 3
     (U2–U4).
   - There is no evidence either way.
2. **What is "the hit" of a quiet beat?** Three cases: a gentle touchdown,
   then a launch push, or a later landing.
   - The evidence points two ways, each on 2–3 cases. Launches read weak.
     In the two grade clips, the later landing was seen as the hit, late.
   - This decides U1, and where the light belongs.
3. **How fine his strength resolution is on ordinary compiled hits.** Strength
   error is 70% of the loss, and pair agreement is near chance below about
   1.5×. If that holds on a random sample, pushing strength error below
   about 0.1 buys nothing he can see.
4. **Scale.** Pairs give order, never absolute size. He has called nothing
   harder than "medium". That matters for the top of the ask range, but it
   needs a different, longer study. Not now.
5. **Timing.** It is unvalidated, but the evidence is too thin to design a
   good study yet. Item 2 will also say where he places a quiet beat's hit.

## 4. Proposal

Same page (`motion-gallery/pairs.html`), plain landscape clips, 1.8 s loops,
the light at the judged moment. Same question: *Which one is the bigger
impact? A / B / About the same / Neither looks like an impact.* **No new
question type is needed.** For detection, one side is a "blank": plain riding
with nothing at the light. Then "neither" or "same" means the event is not
seen as an impact. The instructions should say that some lights mark ordinary
riding.

### Study A (new): is the lit moment an impact? (34 pairs, optional +14)

- **Source.** The 96 held-out rides compiled for U1 and never measured or
  viewed (`generated/u1-heldout` on the U1 worktree: 4 songs × seeds
  9101–9124). Exclude Trouble.
- **Detection block, 30 pairs.** Each pairs a lit event with a lit blank from
  the same ride: contact, no v3 event and no 2-frame change of 0.05 or more
  within ±8 frames, no beat within ±4 frames. The light sits on the event's
  half-rise. Six pairs per stratum:
  - D1, counted extras of 0.05–0.10;
  - D2, counted extras of 0.10–0.20;
  - D3, counted extras of 0.20–0.35, mostly body on the guide after a strong
    hit (69% of extra cost);
  - D4, an uncounted push of at least 0.3 after a quiet touchdown, where the
    contact ends within 2 frames (a launch);
  - D5, the same, but the contact continues (a landing or turn within the
    contact).
- **Four anchors.** A matched hit of at least 0.5 against a blank.
- **Clutter block, 14 pairs (optional).** Two requested strong hits with v3
  ratio at most 1.15. One is followed within 4–12 frames by an event of at
  least 0.2; the other has no event of 0.1 or more within ±12 frames. The
  light is on the main hit.
- Sides randomised, blocks interleaved.
- **Time.** About 19 s per pair, his pace in rounds 1 and 3. That is about 11
  minutes, or 15 with the clutter block.

**Decision rules, fixed before any answer:**

- **Detection, per stratum of 6.** An event counts as seen only when he picks
  its side.
  - **Visible:** picked in at least 5 of 6. A true detection rate of 0.9
    gives this 89% of the time.
  - **Not visible:** picked in at most 1 of 6. A true rate of 0.1 gives this
    89% of the time.
  - Otherwise unresolved.
- **Validity.** All 4 anchors must be picked, and blanks picked in at most 2
  of 34 pairs. Otherwise the block is void: discuss before reading it.
- **Clutter.** The clean hit must be picked in at least 11 of 14 decisive
  pairs (one-sided sign test p < 0.05 if fewer are decisive).
  - Power is about 0.70 if the true rate is 0.8, and 0.36 if it is 0.7.
  - A pass confirms the pattern; a fail does not rule out a mild effect.

**What each outcome changes:**

- **D1–D2 not visible.** Unmatched events below 0.2 are not hits to him.
  - U2–U4 should target only the 0.2+ tail, about 1 per authored ride.
  - Candidate measure change: an extras floor.
- **D2 visible.** A 0.15 bump is seen, while a 1.3× strength gap mostly is
  not. Extras are then under-priced against strength error.
  - Raise the extra weight (U4) or fix the forcing rules (U2/U3).
  - These are compiler changes, tested under WORKING.md.
- **D4 not visible, D5 visible.** The U1 defect is real only for pushes
  within a contact.
  - Simplest change to test: U1(b) without pushes that end the contact.
- **D4 and D5 visible.** Re-open U1 as built. The retrospective's light on
  the touchdown explains its result.
- **Both not visible.** Close U1(b) and keep v3's identity.
- **Clutter passes.** An extra right after a hit also shrinks the hit. That
  strengthens U2/U3 (geometry) over measure work.
- **Clutter fails.** Nothing changes.

**Tooling.** `pair_study.ts` accepts only matched beats from eval runs. A
small builder for arbitrary frames of production rides is needed. Put it in
a subdirectory of `tools/measure` on a branch: `evaluatorIdentity` hashes
only top-level files there, so saved runs keep their identity.

### Study B (existing): answer `night-pairs-2026-10-05-contact` (22 pairs)

- It is built, rendered (44 clips present) and unanswered: about 7 minutes.
- 16 pairs are random strong beats, the same beat compiled two ways. 6 are
  head-down vs upright contrasts.
- It is the **first non-adversarial sample**: does v3's ordering hold where
  the compiler operates?
- **Rule.** On the 16 random pairs:
  - v3 right on at least 75% of decisive pairs: ordering holds.
  - At most 60%: it does not, and strength precision should not be pushed
    further.
  - Between: inconclusive.
- The head-down block is descriptive only (n = 6).
- Before scoring, re-measure its hits from `sources/night-eval-20261005.tar.gz`
  rather than trusting the key's values.

### Measure change worth testing

**None yet.**

- No physical feature explains the misses beyond the clutter hint.
- v3 is level with every plausible candidate.
- The one gain found (+2 pairs from scoring the event nearest the light) is
  about how a study reads a moment, not about the measure.
- After study A, the two simplest candidates are an extras floor and U1(b)
  restricted to pushes within a contact. Each would be a new contract
  identity, remeasured, and confirmed on fresh pairs.

A small observation, not quantified: strength is read from the half-rise
frame. A slow-rising hit can therefore lose its strongest 2-frame window
(c023: 0.45 → 0.37). One case only.

## Not verified

- **The clips.** I did not watch them. Every physical description comes from
  replaying the preserved tracks.
- **The night study's values** in its key were not re-measured.
- **The held-out rides** were not measured, on purpose, so the share of
  launch vs within-contact pushes there is unknown. The U1 panel numbers
  could not be read from this worktree.
- **The grade study.** 13 of its 28 answered clips come from "experimental"
  rides whose tracks were not preserved. Only the other 15 were re-measured.
- **Small samples throughout.** The pattern section is exploratory on spent
  labels.

## Scripts

All scratch scripts are embedded in the JSON (`scratchScripts`). **None is
worth keeping as a tool.** The pair re-scorer duplicates the U1 retro, and
the rest are one-off tables.
