# Producing strong, clean impacts: what is already known (2026-10-04)

A brief for the "producing impact" phase (REWORK.md, problem 2). It says what the project's history
teaches about making strong, clean hits where the music asks for them, translated to the product
ruler `line.strike.v2`. Under v2, strength is the largest whole-body motion change (travel plus spin)
over 2 frames within the event's first 6, divided by 7.55 px/frame.

Sources:
- the Codex transcript `2026-09-07-please-start-a-new-campaign-reason.md`, cited as `T:<line>`;
- memory notes, cited by name;
- `docs/research/*`;
- tag `archive/pre-rework-2026-10-03` and the `research/impact-*-2026100x` branches;
- the current code.

Most of the history was measured under older rulers (v·Δθ, landing, contact-impact v1). Each lever
below says whether its result should carry over to v2, and why.

## 0. Where the compiler stands under v2 (measured for this brief; descriptive, not causal)

**Data and method.**
- **Rides:** the v2 review library, `generated/measure/observations/strike2~*`: 4 development songs ×
  seeds 101/202/303 = 12 rides. July's 12 rides are the reference. Seeds are not independent songs.
- **Strength per matched beat:** `detectStrikes(strikeMotionFrames(o), STRIKE_V2_CONTRACT)` +
  `accountStrikes`.
- **Geometry of each hit:** joined from `tools/measure/hit_anatomy.ts --sets=strike2 --min=0.6`. Its
  own `strength` column is v1, so v2 was joined separately.

| requested | n | v2 achieved p50 / p90 / max | mean signed error | July p50 / max |
|---|---|---|---|---|
| < 0.3 | 111 | 0.10 / 0.20 / 0.35 | +0.06 | 0.13 / 0.35 |
| 0.3–0.6 | 297 | 0.44 / 0.56 / 0.66 | −0.04 | 0.30 / 0.54 |
| 0.6–0.8 | 309 | 0.57 / 0.68 / 0.82 | −0.12 | 0.33 / 0.60 |
| 0.8–1.0 | 228 | 0.67 / 0.85 / 0.96 | −0.24 | 0.37 / 0.57 |

Strong hits below are beats asking ≥ 0.6, n = 537.

**Spacing barely matters.** v2 p50 by gap before the beat:

| gap before the beat | v2 achieved p50 | requested p50 |
|---|---|---|
| < 14 frames | 0.60 | 0.94 |
| 14–20 frames | 0.59 | 0.76 |
| 20–30 frames | 0.60 | 0.76 |
| ≥ 30 frames | 0.67 | 0.76 |

The dense deficit comes from the higher ask on dense beats, not from lower delivery.

**Speed and incidence.**
- **Arrival speed:** about 11 px/frame (p50) for mid and strong asks alike. The compiler does not
  arrive faster for stronger asks.
- **Share of speed changed:** about 0.42 of approach speed changes within the 2-frame window, in every
  speed bin. So strength tracks speed:

  | approach speed (px/frame) | v2 achieved p50 |
  |---|---|
  | 9–11 | 0.57 |
  | 11–13 | 0.63 |
  | ≥ 13 (n = 16) | 0.74 |

- **Incidence** (centre-of-mass heading against the first touched line):
  - ≥ 30°: only 13% of hits, at v2 0.67 against 0.58 for 10–20°;
  - ≥ 45°: none.

  Normal speed into the line is 4.15 px/frame at p50 (July: 2.75).
- **Sled parallel to the surface** (pitch < 10°): v2 0.64, against about 0.57 otherwise (n = 200 vs 337).

**Every strong hit is a touchdown after flight** (536 of 537). This is forced by construction:
`late_release` requires the last 6 frames before each catch to be sled-free (`arc_evaluate.ts`,
`impactSearch.releaseFrames ?? 6`).

**Energy.** Strong hits lose 0.95 px/frame of speed over 6 frames (p50). The centre of mass
descends 71 px between beats (p50), which is what refills that loss (§1).

**Double contacts.**
- 21% of strong beats contain a second, opposite push inside the matched engagement (a v3 split).
- That is 33% when a guide is touched, against 12% when none is. My definition is broader than the
  17% quoted in the task.
- The floor push carries the matched strength (p50 0.58). The rail push comes about 3 frames later
  and is weaker (p50 0.25); it is the larger of the two in only 15 of 111.
- Under v3 the matched strength is unchanged (median drop 0.00).

**The owner's sense of a ceiling is real.**
- No clip has felt harder than "medium" to him (strike-definition-20261004.md).
- v2-like events ≥ 0.8 are very rare: 0 of 1,175 (July), 2 of 1,579 (pre-strike), 6 of 1,376
  (strike-v1 library). Source: `labels/studies/sources/impact-candidates-20261004.jsonl.gz`,
  column `mcOwn`.

## 1. Physical limits in v2 units (g = 0.175 px/frame², 40 fps; 1.0 = 7.55 px/frame within 50 ms)

### A single landing reads about 0.75–0.85 of its normal speed

Probes from `tools/measure/impact_candidates.ts --probes` (motion-change kernel against the ideal):

| probe | kernel | ideal |
|---|---|---|
| flat drop h20 / h60 / h140 | 0.26 / 0.47 / 0.79 | 0.35 / 0.61 / 0.93 |
| head-on wall, v 4 | 0.39 | 0.53 |
| 30° corner, v 8 | 0.36 | 0.55 |
| smooth bend r60 / r150, v 8 | 0.33 / 0.17 | — |

So a strength of 1.0 needs about 9–10 px/frame of normal speed. The 2-frame window under-reads
because only the sled and feet (6 of 10 points) touch the line; the rest follows through sticks.

### Survival is the real ceiling, and it depends on pose

- **What crashes the rider:** a sled–body `BindStick` breaking past endurance 0.057, or the body–sled
  joint flipping (`vendor/lr-core/line-rider-engine/constraints/index.js`, `rider-data/index.json`).
- **Probe outcomes** (impact-candidates-20261004.md):

  | probe | normal speed (px/frame) | outcome |
  |---|---|---|
  | flat drop h140 | 7.0 | survives |
  | flat drop h300 | about 10.2 | crashes |
  | head-on wall, v 8 | — | crashes |
  | 60° ramp, v 8, nose-first | about 6.9 | crashes |
  | upright head into a ceiling | — | crashes |

- **Largest seen:** v2 0.96 (strike2 library).
- **The old compiler at ask 1:** aiming incidence directly, only 41 of 240 contacts still landed
  (impact-arrival-not-scoop).
- **UNVERIFIED:** the survivable region for v2 ≥ 0.8 in speed × incidence × sled pitch is unmapped.

### Energy

An inelastic kill of normal speed Δv costs Δv²/2. Refilling it takes a drop of h ≈ Δv²/(2g) ≈
163·s² px per hit:
- about 60 px at strength 0.6;
- about 130 px at strength 0.9, and more once the 2-frame under-read is counted.

This matches §0: 0.95 px/frame of lost speed is about 61 px of drop, and the observed descent is 71 px.

A sustained run of strong hits therefore needs net descent:
- Elevation has been unscored since D1, but speed is scored as a gap mean, and the camera may care.
- The old finding "the scoop brakes the next contact" (benchmark-v2-impact-error-budget) is this
  energy bill. Under v2 the braking *is* the hit; the next hit pays for it.

### Gravity cannot build much speed inside one dense gap

- The gain is g·N·sinθ: +1.8 px/frame over 12 frames at 60°, worth about +0.07 v2 at today's 0.42
  share.
- So "speed before the hit" must come from descents spanning several beats, or from killing a larger
  share of the speed (incidence and sharpness).

### Airtime

- The pop is about g·N²/8 (track-variety-boring-problem).
- Gravity steepens the heading by g·N over the forced 6-frame flight: about 1 px/frame.
- So on dense beats, incidence must come from tilting the catch surface. Connected geometry allows
  that; ballistics alone do not (the old unguided bound was about g·(N_prev + N_next)/2).
- At dense spacing the binding constraint is the forced flight and the support it leaves
  (`support ≤ span − 6`, `openInterval`).

### The frame-5 floor is gone

- It belonged to the retired landing contract (contact-frame-floor). Under impact contracts the
  landing and off-beat rejections are skipped (`!options.impactContract` guards, `arc_evaluate.ts`).
- What remains: the release reserve, and a 2-frame preparation (the catch is planned 2 frames before
  the beat, `arc_compile_context.ts`).
- A renewal strike inside continuous contact needs ≥ 4 frames since the previous peak, and a valley
  ≤ ½ of the new peak.

## 2. Levers tried before (ledger)

| lever (era, ruler) | result | carries over to v2? |
|---|---|---|
| **Steep arrival** (old search compiler, v·Δθ): launch pitched down by the arrival deficit; open to all attempts, delete the 0.30 ask floor, span 0.5..1 | **+8.42, +19, +21.** Impact and speed biases improved together, the best impact family ever. Over-dose loses: 30° cap and 100% span −10.6 (impact-arrival-not-scoop; headline-700 M3). | **Very likely:** v2 ≈ speed into the surface, and incidence is the first-order term. The current compiler has no counterpart for guided catches (L1). |
| Contact-surface scoop `impactCurvePressure` (old) | A true optimum (+69.5); re-fit +4.1. It brakes the rider and flattens the next launch (next impact −0.043 → −0.069). | **Bend: no** (smooth bends barely count under v2). **The lesson: yes** — braking at hit k costs hit k+1 (§1). |
| Wider post-contact angle (old) | Cannot create impact; −21.9 | Yes |
| Aim incidence directly (old) | Incidence +1.7°, but contact speed 10.2 → 8.1, so v·Δθ stayed flat. At ask 1, 41 of 240 land. | **Partly.** The "conserved product" was a v·Δθ artifact (braking now *adds*). The survival collapse is physics. Re-test with L0. |
| Finer polyline after contact (old) | +2.01, the only arm moving every axis together | **Probably reversed:** v2 wants the change concentrated in 2 frames, and finer subdivision smears it. |
| Higher impact weight, `LR_IMPACT_LOCAL_W`, open launch clamp (old); weight-1 (Oct 1, arc) | Inert, or impact up at the cost of speed and air. Steep candidates were generated but not committed. | **Yes, as method:** generation without selection is inert; selection without generation fails (headline-700, M2 −31). |
| Planning loop / impact re-aim; after-the-fact repair of saved tracks (T:108–640) | Parity at best. Local impulse gains died at recapture (next-interval air error 4–73× the impact saved; only 2 of 78 paths could even reach the gain). | **Yes.** Impact must be built inside search together with the next catch. |
| V4 dive-scoop pair: aimed arrival + scoop catch (arc-state-control) | +5.4. Scoops win local cost but lose at forward evaluation; rollout visibility falsified 3×. | **The coupling law carries over:** a ±2° arrival change loses the next on-beat catch at 79% of gaps. Aim the arrival with the catch, never after it. |
| Acceleration lines; point "constellations" (Codex, T:994, T:1061) | Large gains | **Forbidden** by the owner: normal lines only, coherent arcs. |
| Friction speed gain from guides (motion-quality-investigation-20261001.md) | A contact from the opposing side adds tangential speed (5 → 6.6 per collision). Converging rails cause the speed-ups the owner rejected (passages 10, 15). Penalized via `engagementGainWeight .64`. | **Yes:** speed before a hit must come from gravity. |
| Tighter curvature limit; larger catch offsets; independently bent guide; joint pair refinement at 750k (Codex V4 era, landing ruler, T:2448–2550) | Curvature binds on 51 of 770 arcs but holds 14 of the 27 largest misses; rejected (one invalid). Offsets mixed. Bent guide 924.2 < 926.9. Pair refinement regressed (150–190k frames). | Unknown. `radius: 24` is unchanged. A different coupled-pair refinement later shipped from the Oct 2 campaign (`coupledIntervalSamples: 64`, `arc_neighbor_revision.ts`). |
| Oct 1–2 impact precision (arc, landing ruler; `docs/impact-precision-campaign-20261001.md` on the tag; branches `research/impact-{precision,capture,entry,repair}-*`) | Same-state catch assays show big local headroom (Amour s15 0.18 → 0.88 at ask 1.0, impulse 3.63 vs 0.80 px/frame from the lower support; s17 0.46 → 0.79). Every integration failed: capture −28.6; guided capture lost rides; portfolio −46 to −77; population +11 but Afterglow −152. Cause: catch search inside every speculative forecast ate the allowance. | **Headroom: likely yes.** **Rule: yes** — spend new catch search only at committed intervals. |
| Rework, Oct 4 (d4357789; compiler-budget-20261004.md) | Preparation 2 accepted (peaks −11 ms). Rejected: prep 0 (H1), extra-strike weight 2 (H2), refine-all (R1), lookahead off (L1). v2 adopted with the unchanged search: v2 loss 0.078 → 0.037. | Current baseline |

## 3. Promising levers under v2, ranked

### L0 — Map the survivable-hit envelope first (instrument; no compiler change; seconds)

- **Do:** extend `probes()` in `tools/measure/impact_candidates.ts`.
  - Grid: normal speed 4–12 × incidence 15–75° × sled pitch mismatch 0–40° × floor or roof (± spin).
  - Read v2 and `riderMounted` / `sledIntact` at +20 frames.
- **This decides:**
  - whether 1.0 is physically reachable, which bears on REWORK's open item, the absolute scale;
  - which arrival pose L1–L4 should aim for.

### L1 — Steep, impact-aware arrival for guided catches (the old biggest win, translated)

- **Today:**
  - `addArrivalPriors` (`arc_evaluate.ts`) applies its heading prior only to *passive* catches
    (unguided or transfer; `resolveIntervalOptions` in `arc_interval_state.ts`).
  - It aims arrival speed at the authored mean.
- **Hypothesis:** a prior built from the next ask moves strong hits from about 22° toward 30–45° of
  incidence and raises v2 at fixed speed.
  - Needed normal speed ≈ s·7.55/0.8.
  - Allow arriving above the gap-mean speed: v2 reads the speed just before contact.
- **Expected effects:**
  - impact up;
  - air may drop on dense gaps;
  - speed neutral to up if paired with L5;
  - the next on-beat catch is at risk (coupling law). Lean on the existing pair refinement and lookahead.
- **Experiment:** one paired `npm run eval` arm in `strike2` mode, prior on for asks ≥ 0.6, at partial dose.

### L2 — Guided dive before the hit (the owner's control-rail idea; the generation half of L1)

- **Physics:**
  - A guide lets the support turn downward faster than free fall (see the `flow` clamp comment in
    `motionArc`, `arc_geometry.ts`).
  - So the release can be steep (`exit` up to 85°, plus `bend` and `guideEnd`) within a short gap.
  - It buys incidence mostly; speed adds only about +1.8 px/frame per dense gap.
- **Constraints:**
  - Keep the guide parallel: a converging `guideFlare` produces friction speed-ups.
  - The catch must meet the sled about parallel, or it crashes like the 60° ramp at v 8 (see L4).
- **Experiment:** a same-state pair assay on library strong beats.
  - Force exit ∈ {45, 60, 75}° with a guide to the end of support, then re-search only the next catch
    (`entry`).
  - Compare v2, survival, next-gap speed and air against the incumbent.

### L3 — Put the catch turn inside 2 frames

- **Today:**
  - The nominal turn is `impactToRawPx(ask)/pace`, about 39° at ask 1 (`openInterval`).
  - It runs over the inherited 5-frame `first` (`motionArc`; `turnFraction` defaults to
    min(5, support/2) frames).
  - So v2 credits only about 2/5 of it.
- **Hypothesis:** for strong asks, seeding `turnFraction` so the turn completes in ≤ 2 frames, or
  putting an angular face (`faces`) at the anchor, raises the share of speed killed above 0.42.
- **Expected effects:** crash risk up; more speed lost (pay for it with L5).
- **Experiment:** a same-state sweep over about 40 strong beats, then a paired eval arm.

### L4 — Arrive with the sled parallel to the surface

- **Evidence:**
  - Descriptive: pitch < 10° gives 0.64 against 0.57.
  - Physics: crashes come from the sled–body differential, so a flat sled lets more normal speed survive.
- **Signal:** pose and angular rate at release are already computed as value features
  (`arc_evaluate.ts`, `pose`/`angularRate`). Exit pitch moved the old compiler's landing pose by about
  40° (arc-state-control).
- **Experiment:** add a pose-matching term inside the L2 assay before touching `addArrivalPriors`.

### L5 — Energy budgeting across strong passages

- **Today:** nothing plans descent for strong asks. `repertoire_context.ts` / `intentional_repertoire.ts`
  read impact only as `quiet`.
- **Hypothesis:** many strong misses are energy-bound (§1).
- **Experiment (zero compiles):** per passage, compare the available descent with Σ Δv²/(2g).
  Count the energy-bound misses before building anything.

### L6 — Shorter release reserve, or strikes inside continuous contact, on dense beats

- **Today:** `releaseFrames` (≤ 6, default 6) was added in 984f253f ("Probe … release assumptions"). I
  found no recorded result, so treat it as **untested**.
- **Hypothesis:** 2–4 frames on dense strong intervals leave room for the dive and the catch. A corner
  between connected arcs could make a no-flight strike through the renewal rule.
- **Risks:** completion; air drops.
- **Experiment:** one eval arm with `releaseFrames: 3`.

### L7 — Impact-aware construction choice

- **Today:** the plan ignores strong asks.
- **Old data (landing ruler, descriptive):** impact RMS by construction.

  | construction | RMS |
  |---|---|
  | paired guided | 0.034 |
  | unguided arcs | 0.105 |
  | separated terraces | 0.173 |

- **Under v2 (§0 data):** hits touching a guide reach 0.59, against 0.61 for hits touching none.
- **Next:** audit v2 by construction first, at zero compiles. Change weights only — the owner values variety.

### L8 — Spin

- **Why it could matter:** v2 counts ΔL, and the owner chose with-spin 12 : 4.
- **Why it rarely does:** `c_arrive_spin` exceeds `c_arrive` by > 0.1 on only 75 of 3,236 events.
- **Next:** probe it inside L0. Low priority.

## 4. The floor-then-rail double contact

**Where guides come from.**
- `motionArc` builds the guide (roof) as an offset of the main rail at `clearance`: 6–30 px, default
  channel 12 (`connected_arcs.ts`).
- It runs from vertex 2 (a few px after the contact anchor) to `guideEnd`, so it covers the catch itself.
- `guideStart` and `guideEnd` are searched by coordinate steps only (`arc_motion_control.ts`).
- `trimUnusedArcGuides` (`arc_guidance.ts`) trims only never-touched ends, after the fact.

**Why strong hits touch it.**
- The sled bottom (TAIL / NOSE / feet, y = 5) to the shoulder (y = −5.5) is 10.5 px
  (`rider-data/index.json`). At clearance 12 an upright rider has about 1.5 px of headroom.
- 80% of strong hits rebound, so shoulders and hands reach the roof about 3 frames later.
- Hence 33% doubles with a guide against 12% without.

**What the rulers see.**
- **v2** fuses both pushes into one engagement, and their 2-frame sums partly cancel. The objective has
  no reason to avoid the second push.
- **v3** (`STRIKE_V3_CONTRACT`, "opposite pushes are separate impacts") makes the rail push an unmatched
  extra. `impactSearchResiduals` then penalizes it as (raw/7.55)². That encodes the owner's own words:
  "a floor hit followed by an upper hit is two impacts".
  - At the time of writing, v3 exists in the working tree only, uncommitted. Another session is editing
    `strike_impact.ts`; `tools/eval/eval.ts` already reports `impact3`.
  - The matched strength would not drop (§0).

**Levers, cheapest first.**
1. Delete the roof segments touched within 6 frames after onset on split strong beats, and replay (the
   prefix is identical). Check that the hit stays clean and that nothing else breaks. Codex guide
   removals left the earlier collision unchanged (T:5493).
2. Search with v3 as the account, reporting v2 alongside.
3. In geometry, start the roof after the rebound window, or widen the clearance near strong catches.
   `guideFlare` is linear over the whole guide.

Don't over-correct. The owner welcomes deliberate upper hits and transfers (Tiki 101 at 14.2 and
14.95 s, beat-salience-investigation), and smooth guidance. The target is only an *unintended* second
push inside a hit.

## 5. Traps and comparability hazards

- **Rulers.**
  - Report every arm under v1, v2 and v3, plus the frozen sentinel.
  - `tools/eval` columns `strength rms (R1)`, `strong strength rms` and `quiet strength rms` use
    per-beat `r1`, which is v1 — **not v2**.
  - Per-beat v2 is not stored. Add a strong-band v2 signed error (asks ≥ 0.6) before the campaign.
- **Composition.** Compare impact only on cells that complete in both arms. Newly completed hard runs
  bring bad contacts with them.
- **Correlation is not a mechanism price.** Across-seed correlation measures selection variation. The
  §0 tables are descriptive only.
- **Local is not complete.** Same-state gains (0.18 → 0.88) did not survive complete compilation.
  - End every test with complete, paired, song-level runs, including perturbed inputs.
  - With n = 4 songs, intervals are wide.
  - Generality needs held-out music.
- **Budget cliffs.**
  - Guidance, complete-boundary correction and the value model switch off below allowance 80
    (`connected_arcs.ts`).
  - Runs at 0.75M hit the stop (81% complete). Judge at the standard 1,700 frames per ride frame, and
    check low budgets separately.
  - Never put new search inside every forecast: lookahead already takes about 70% of frames.
- **Reachability.** Check that a knob can fire before believing a null result: the
  `steepArrivalMatureZeroBand` dead 0.6 band reported a perfect +0.00.
- **Speed gain.** Watch the 1-frame burst ratio (1.06, failing; REWORK.md log) and
  `engagementGainResiduals`. A "strong hit" made of friction speed gain is a regression, even if v2 rises.
- **Physics accounting.** Every probe is metered and charged (CLAUDE.md).
