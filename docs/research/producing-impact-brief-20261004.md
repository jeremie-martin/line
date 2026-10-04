# Producing strong, clean impacts: what is already known (2026-10-04)

A brief for REWORK.md's problem 2, "producing impact". It collects what the project's history teaches
about making strong, clean hits where the music asks for them, translated to `line.strike.v2` / `v3`.
Strength is the largest whole-body motion change (travel and spin) over 2 frames within an event's
first 6, divided by 7.55 px/frame.

Sources:
- the Codex transcript `2026-09-07-please-start-a-new-campaign-reason.md`, cited as `T:<line>`;
- memory notes, cited by name;
- `docs/research/*`;
- the tag `archive/pre-rework-2026-10-03` and the branches `research/impact-*-2026100x`;
- the current code.

Most of this history was measured under older rulers (v·Δθ, landing, contact-impact v1). Each lever
below says whether its result should carry over, and why.

## 0. Where the compiler stands (measured for this brief; descriptive, not causal)

**Data and method.**
- **Library:** the v2 review library, `generated/measure/observations/strike2~*`, which was optimized
  under v2 before v3 existed. It is 4 development songs × seeds 101/202/303, so 12 rides; July's 12
  rides are the reference.
- **Strength:** v2 per matched beat, via `detectStrikes(strikeMotionFrames(o), STRIKE_V2_CONTRACT)` and
  `accountStrikes`.
- **Hit geometry:** joined from `tools/measure/hit_anatomy.ts --sets=strike2 --min=0.6`. That tool's own
  `strength` column is v1.

| requested | n | v2 p50 / p90 / max | mean signed error | July p50 / max |
|---|---|---|---|---|
| < 0.3 | 111 | 0.10 / 0.20 / 0.35 | +0.06 | 0.13 / 0.35 |
| 0.3–0.6 | 297 | 0.44 / 0.56 / 0.66 | −0.04 | 0.30 / 0.54 |
| 0.6–0.8 | 309 | 0.57 / 0.68 / 0.82 | −0.12 | 0.33 / 0.60 |
| 0.8–1.0 | 228 | 0.67 / 0.85 / 0.96 | −0.24 | 0.37 / 0.57 |

**Strong hits** (asks ≥ 0.6, n = 537):

- **Spacing barely matters.** The dense deficit comes from the higher ask, not from lower delivery.

  | gap before the beat | v2 p50 | ask p50 |
  |---|---|---|
  | < 14 frames | 0.60 | 0.94 |
  | 14–20 frames | 0.59 | 0.76 |
  | 20–30 frames | 0.60 | 0.76 |
  | ≥ 30 frames | 0.67 | 0.76 |

- **Speed is not used for strength.**
  - Arrival speed is about 11 px/frame (p50), the same for mid and strong asks.
  - About 0.42 of the approach speed changes within the 2-frame window, in every speed bin. Strength
    therefore follows speed: 0.57 at 9–11 px/frame, 0.63 at 11–13, 0.74 at ≥ 13 (n = 16).
- **Incidence is shallow.** Incidence is measured as the centre-of-mass heading against the first line
  touched.
  - It is ≥ 30° on only 13% of hits; those reach 0.67, against 0.58 at 10–20°.
  - It is never ≥ 45°.
  - Normal speed into the line has p50 4.15 px/frame (July: 2.75).
- **A flat sled helps.** With the sled parallel to the surface (pitch < 10°) the hit reaches 0.64,
  against about 0.57 otherwise (n = 200 vs 337).
- **Every strong hit is a touchdown after flight** (536 of 537). Construction forces this: `late_release`
  requires the last 6 frames before each catch to be sled-free (`arc_evaluate.ts`,
  `impactSearch.releaseFrames ?? 6`).
- **Energy.** Strong hits lose 0.95 px/frame over 6 frames (p50). The centre of mass descends 71 px
  between beats (p50), which is what refills that loss (§1).
- **Double contacts (floor, then rail).** 21% of strong beats show one. My definition is two or more v3
  events inside the matched v2 engagement; it is broader than the 17% quoted in the task.
  - The rate is 33% when a guide is touched, against 12% when none is.
  - **The floor push carries the matched strength** (p50 0.58). The rail push comes about 3 frames
    later and is smaller (p50 0.25); it is the larger of the two in only 15 of 111.
  - **Re-scoring these tracks under v3 leaves matched strength unchanged** (median drop 0.00).

**The owner's ceiling is real.** No clip has felt harder than "medium" to him (strike-definition).
v2-like events at ≥ 0.8 (`labels/studies/sources/impact-candidates-20261004.jsonl.gz`, column
`mcOwn`):

| set | events at ≥ 0.8 |
|---|---|
| July | 0 of 1,175 |
| pre-strike | 2 of 1,579 |
| strike-v1 library | 6 of 1,376 |

## 1. Physical limits (g = 0.175 px/frame², 40 fps; strength 1.0 = 7.55 px/frame within 50 ms)

- **A single landing reads about 0.75–0.85 of its normal speed.** Probes from
  `tools/measure/impact_candidates.ts --probes`, kernel against ideal:

  | probe | kernel | ideal |
  |---|---|---|
  | flat drops h20 / h60 / h140 | 0.26 / 0.47 / 0.79 | 0.35 / 0.61 / 0.93 |
  | head-on wall at v 4 | 0.39 | 0.53 |
  | 30° corner at v 8 | 0.36 | 0.55 |
  | smooth bend at v 8, r60 / r150 | 0.33 / 0.17 | — |

  So 1.0 needs about 9–10 px/frame of normal speed. Only the sled and feet (6 of 10 points) touch the
  line; the other points follow through sticks, so 2 frames under-read the hit.
- **Survival is the real ceiling, and it depends on pose.** A crash is a sled–body `BindStick` exceeding
  endurance 0.057, or the body–sled joint flipping (`vendor/lr-core/line-rider-engine/constraints/index.js`,
  `rider-data/index.json`).

  | probe | normal speed (px/frame) | outcome |
  |---|---|---|
  | flat drop h140 | 7.0 | survives |
  | flat drop h300 | about 10.2 | crashes |
  | head-on wall at v 8 | — | crashes |
  | 60° ramp at v 8, nose first | about 6.9 | crashes |
  | upright head into a ceiling | — | ejects |

  - The largest hit seen is v2 0.96.
  - In the old compiler, aiming incidence at ask 1 landed only 41 of 240 contacts.
  - **UNVERIFIED:** the survivable region for ≥ 0.8.
- **Energy.** Killing normal speed Δv inelastically costs Δv²/2. Refilling it takes a descent of
  h ≈ Δv²/(2g) ≈ 163·s² px per hit:
  - about 60 px at s = 0.6, and about 130 px at s = 0.9 (more after the under-read);
  - this matches §0: a loss of 0.95 px/frame is about 61 px, and the observed descent is 71 px;
  - so a run of strong hits needs net descent;
  - elevation is unscored since D1, but speed is scored as a gap mean and the camera may object;
  - the old finding that "the scoop brakes the next contact" (benchmark-v2-impact-error-budget) is this
    same bill. Under v2 the braking *is* the hit, and the next hit pays for it.
- **Gravity adds little speed inside one dense gap.** The gain is g·N·sinθ: 12 frames at 60° give
  +1.8 px/frame, worth about +0.07 at today's 0.42 share. "Speed before the hit" must come from
  descents spanning several beats, or from killing more of the speed (incidence, sharpness).
- **Airtime.**
  - Pop height is about g·N²/8 (track-variety-boring-problem).
  - The forced 6-frame flight steepens the heading by only g·N ≈ 1 px/frame.
  - So on dense beats, incidence must come from tilting the catch surface. Connected geometry can
    do that; ballistics cannot (the old unguided bound was about g·(N_prev + N_next)/2).
  - The binding constraint at dense spacing is the forced flight and the support it leaves
    (`support ≤ span − 6`, `openInterval`).
- **The frame-5 floor is gone** (contact-frame-floor). Under impact contracts the landing and off-beat
  rejections are skipped (`!options.impactContract`, `arc_evaluate.ts`). What remains:
  - the release reserve;
  - a 2-frame preparation (the catch is planned 2 frames before the beat, `arc_compile_context.ts`);
  - a renewal strike inside contact needs ≥ 4 frames since the previous peak and a valley ≤ ½ of the
    new peak.

## 2. Levers tried before

| lever (era, ruler) | result | carries over? |
|---|---|---|
| **Steep arrival** (old search compiler, v·Δθ; impact-arrival-not-scoop): launch pitched down by the arrival deficit; open to every attempt; drop the 0.30 ask floor; span 0.5..1 | **+8.42, +19, +21.** Impact and speed biases improved together: the best impact family ever. Over-dose loses (100% span −10.6, headline-700 M3). | **Very likely.** v2 ≈ speed into the surface, and incidence is first-order. Guided catches have no counterpart today (L1). |
| Contact-surface scoop `impactCurvePressure` (old) | A true optimum (+69.5); re-fit +4.1. It brakes and flattens the next launch (next impact −0.043 → −0.069). | **The bend does not** (smooth bends barely count now). **The lesson does:** braking at hit k costs hit k+1. |
| Wider post-contact angle (old) | Creates no impact; −21.9 | Yes |
| Aim incidence directly (old) | +1.7° of incidence, but contact speed 10.2 → 8.1, so v·Δθ stayed flat. At ask 1, only 41 of 240 land. | **Partly.** The "conserved product" was a v·Δθ artifact: braking now adds. The survival collapse is physics. Re-test with L0. |
| Finer polyline after contact (old) | +2.01, the only arm that moved every axis together | **Probably reversed.** v2 wants the change concentrated in 2 frames. |
| Higher impact weight, `LR_IMPACT_LOCAL_W`, opened launch clamp (old); weight-1 (Oct 1, arc compiler) | Inert, or impact up at the expense of speed and air. Steep candidates were generated but never committed. | **Yes, as method:** generation without selection is inert, and selection without generation fails (headline-700, M2 −31). |
| Re-aim / planning loop; after-the-fact repair of saved tracks (T:108–640) | Parity at best. Local gains died at recapture: next-interval air error was 4–73× the impact saved; only 2 of 78 paths could reach the gain. | **Yes.** Build impact inside search, together with the next catch. |
| V4 dive-scoop pair (arc-state-control) | +5.4. Scoops win local cost but lose at forward evaluation; rollout visibility falsified 3×. | **The coupling law does:** a ±2° arrival change loses the next on-beat catch at 79% of gaps. Aim the arrival together with the catch. |
| Acceleration lines; point "constellations" (T:994, T:1061) | Large gains | **Forbidden by the owner:** normal lines and coherent arcs only. |
| Friction gain from guides (motion-quality-investigation) | An opposing-side contact adds tangential speed (5 → 6.6). Converging rails produce the speed-ups the owner rejected. `engagementGainWeight .64` penalizes it. | **Yes:** speed before a hit must come from gravity. |
| Tighter curvature limit; larger catch offsets; bent guide; joint pair refinement at 750k (Codex V4 era, landing ruler, T:2448–2550) | Curvature binds on 51 of 770 arcs, which hold 14 of the 27 largest misses; rejected, with one invalid. Offsets mixed. Bent guide 924.2 < 926.9. Pair refinement regressed. | Unknown. `radius: 24` is unchanged. A different coupled refinement later shipped (`coupledIntervalSamples: 64`). |
| Oct 1–2 impact precision (arc compiler, landing ruler; `docs/impact-precision-campaign-20261001.md` on the tag) | **Same-state catch assays found big local headroom:** Amour s15 went 0.18 → 0.88 at ask 1.0 (impulse 3.63 vs 0.80, from the lower support), s17 went 0.46 → 0.79. **Every integration failed:** capture −28.6, portfolio −46 to −77, population Afterglow −152. Cause: catch search inside every forecast ate the allowance. | **The headroom: likely. The rule: yes.** Spend catch search only at committed intervals. |
| Rework, Oct 4 (d4357789; compiler-budget-20261004.md) | **Accepted:** prep 2 (peaks −11 ms). **Rejected:** prep 0, extra weight 2, refine-all, lookahead off. Re-ruling to v2 with the unchanged search gave v2 loss 0.078 → 0.037. | Baseline |
| H-v3, night of Oct 4 (REWORK.md log; adopted in bb8eab27) | **Optimizing under v3:** doubles fall by about 75%. On the authored panel, v2 strength rms +0.008 and speed rms +0.007. Adopted as an explicit exception; recovering both is H-1. | See §4 |

## 3. Promising levers under v2/v3, ranked

**L0 — Map the survivable-hit envelope.** An instrument, not a compiler change; it takes seconds.
- **Grid:** extend `probes()` in `tools/measure/impact_candidates.ts` over normal speed 4–12 × incidence
  15–75° × sled-pitch mismatch 0–40° × floor or roof, ± spin.
- **Read:** v2/v3 strength, and `riderMounted`/`sledIntact` at +20 frames.
- **Decides:** whether 1.0 is reachable at all (REWORK's absolute-scale item), and which pose L1–L4 aim for.

**L1 — Steep, ask-driven arrival for guided catches.** The biggest old win, translated.
- **Today:** `addArrivalPriors` (`arc_evaluate.ts`) applies its heading prior only to passive catches
  (unguided or transfer; `resolveIntervalOptions`), and aims arrival speed at the authored mean.
- **Hypothesis:** a prior built from the next ask moves incidence from about 22° to 30–45° and raises
  strength at fixed speed. It needs normal speed ≈ s·7.55/0.8, and should allow arriving above the gap
  mean (strength reads speed just before the hit).
- **Expected effects:**
  - impact up;
  - air down on dense gaps;
  - speed neutral to up, if combined with L5;
  - the next catch at risk (the coupling law), so rely on pair refinement and lookahead.
- **Experiment:** one paired `npm run eval` arm, prior on for asks ≥ 0.6, at partial dose.

**L2 — Guided dive before the hit.** The owner's control-rail idea, and the generation half of L1.
- **Mechanism:** a guide lets the support turn down faster than free fall (see the `flow` clamp comment
  in `motionArc`, `arc_geometry.ts`). The release can then leave steep (`exit` up to 85°, plus `bend`
  and `guideEnd`) within a short gap. It buys incidence; speed adds at most about +1.8 px/frame per
  dense gap.
- **Constraints:**
  - Keep the guide parallel: a converging `guideFlare` produces friction speed-ups.
  - The catch must meet the sled roughly parallel, or it crashes like the 60° ramp at v 8 (L4).
- **Experiment:** a same-state pair assay on library strong beats. Force exit ∈ {45, 60, 75}°, then
  re-search only the next `entry`. Compare strength, survival, next-gap speed and air.

**L3 — Put the catch turn inside 2 frames.**
- **Today:** the nominal turn is `impactToRawPx(ask)/pace`, about 39° at ask 1 (`openInterval`). It runs
  over the inherited 5-frame `first` (`motionArc`; the `turnFraction` default), so v2 credits about 2/5
  of it.
- **Hypothesis:** for strong asks, seed `turnFraction` so the turn finishes in ≤ 2 frames, or put an
  angular face (`faces`) at the anchor. That raises the share of speed killed above 0.42.
- **Expected effects:** crash risk rises and more speed is lost (pay for it with L5).
- **Experiment:** a same-state sweep over about 40 strong beats, then an eval arm.

**L4 — Arrive with the sled parallel to the surface.**
- **Evidence:** 0.64 vs 0.57, descriptive. Crashes come from the sled–body differential, so a flat sled
  should let more normal speed survive.
- **Signal:** pose and angular rate at release already exist as value features (`arc_evaluate.ts`,
  `pose`/`angularRate`). Exit pitch had about 40° of authority over pose in the old compiler
  (arc-state-control).
- **Experiment:** test pose matching inside the L2 assay first.

**L5 — Budget energy across strong passages.**
- **Today:** nothing plans descent for strong asks. `repertoire_context.ts` / `intentional_repertoire.ts`
  read impact only as `quiet`.
- **Experiment (zero compiles):** per passage, compare the available descent with Σ Δv²/(2g). Count the
  energy-bound misses before building anything.

**L6 — Shorter release reserve, or strikes inside continuous contact, on dense beats.**
- **Status:** `releaseFrames` (≤ 6, default 6) came in with 984f253f ("Probe … release assumptions").
  No recorded result, so treat it as **untested**.
- **Hypothesis:** 2–4 frames free room for the dive and the catch. A corner between connected arcs could
  strike with no flight at all, via the renewal rule.
- **Risks:** completion, and air.
- **Experiment:** one eval arm with `releaseFrames: 3`.

**L7 — Impact-aware construction choice.**
- **Today:** the plan ignores strong asks.
- **Old impact RMS by construction** (landing ruler, descriptive): paired guided 0.034, unguided arcs
  0.105, separated terraces 0.173.
- **Strong hits now:** 0.59 when they touch a guide, 0.61 when they do not.
- **Next:** audit by construction first, at zero compiles. Change weights only: the owner values variety.

**L8 — Spin.** v2 counts ΔL, and the owner preferred spin 12 : 4. But spin moves `c_arrive_spin` more than
0.1 above `c_arrive` on only 75 of 3,236 events. Probe it inside L0. Low priority.

## 4. The floor-then-rail double contact

**Where guides come from.**
- `motionArc` builds the guide (roof) as an offset of the main rail at `clearance`: 6–30 px, default
  channel 12 (`connected_arcs.ts`).
- It runs from vertex 2 (a few px past the contact anchor) to `guideEnd`, so it covers the catch itself.
- `guideStart`/`guideEnd` are searched by coordinate steps only (`arc_motion_control.ts`).
- `trimUnusedArcGuides` (`arc_guidance.ts`) trims only never-touched ends, after the fact.

**Why strong hits touch it.**
- Headroom is tiny: sled bottom (TAIL, NOSE, feet at y = 5) to shoulder (y = −5.5) is 10.5 px
  (`rider-data/index.json`), so at clearance 12 an upright rider has about 1.5 px to spare.
- 80% of strong hits rebound, and shoulders or hands meet the roof about 3 frames later. Hence 33% of
  guided strong hits double, against 12% of unguided ones.

**Rulers.**
- **v2** fuses the two pushes and partly cancels them.
- **v3** (committed d9323e96: "opposite pushes are separate impacts", more than 120° apart) makes the rail
  push an unmatched extra. `impactSearchResiduals` penalizes it as (raw/7.55)². That is the owner's
  rule: "a floor hit followed by an upper hit is two impacts".

**Reconciling with REWORK's H-v3 note.** That note blames the v2 strength regression on rail bounces
that "were helping the compiler reach strength and speed targets". On the v2 library the rail push is
rarely the strength carrier: 15 of 111, and v3 re-scoring costs a median 0.00. So H-1 should look at
two other explanations first (**UNVERIFIED**):
- fewer viable catches once roof contact is penalized;
- speed effects.

**Levers, cheapest first.**
1. Delete the roof segments touched within 6 frames after onset on split strong beats, then replay; the
   prefix is identical. Codex guide removals left the earlier collision unchanged (T:5493).
2. For strong-ask catches, start the roof after the rebound window, or widen the clearance near the
   catch. `guideFlare` is linear over the whole guide.
3. Leave guides that never touch the hit alone.

Do not over-correct. The owner welcomes deliberate upper hits and transfers (beat-salience-investigation,
Tiki 101 at 14.2 and 14.95 s), and he welcomes smooth guidance.

## 5. Traps and comparability hazards

- **Rulers.**
  - Report every arm under v1, v2 and v3, plus the frozen sentinel.
  - In `tools/eval`, `strength rms (R1)`, `strong strength rms` and `quiet strength rms` use the per-beat
    `r1`, which is v1. Per-beat v2/v3 are not stored, so add a strong-band signed error (asks ≥ 0.6).
- **Composition.** Compare impact only on cells complete in both arms.
- **Correlation is not a price.** Across-seed correlation is selection variation. The tables in §0 are
  descriptive.
- **Local is not complete.** Same-state gains (0.18 → 0.88) did not survive complete compilation.
  - Always finish with complete, paired, song-level runs on perturbed inputs.
  - With n = 4 songs, intervals are wide; generality needs held-out music.
- **Budget cliffs.**
  - Guidance, complete-boundary correction and the value model switch off below allowance 80.
  - 0.75M runs hit the stop. Judge at 1,700 frames per ride frame, and check low budgets separately.
  - Never search inside every forecast: lookahead already takes about 70% of frames.
- **Reachability.** Check a knob can fire before believing a null (`steepArrivalMatureZeroBand` reported a
  perfect +0.00).
- **Speed gain.** Watch the 1-frame burst ratio (1.06, failing) and `engagementGainResiduals`. A strong
  hit made of friction speed gain is a regression.
- **Physics accounting.** Every probe is metered and charged (CLAUDE.md).
