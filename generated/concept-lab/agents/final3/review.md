# Round 3 pre-render review

Evidence: every preset rendered on all 6 songs at 6 moments, bookends rendered on 4 songs and inspected on 3, phone walkthrough at 390×844, and camera traces from `cam.js`. I saw stills, strips and numbers, not motion or sound, so perception calls below are inferred. The stage is 313 px wide on the phone, so 1 % of H ≈ 5.4 css px.

## Blockers (fix before rendering or sending)

1. **"Out in long calm" repeats a rejected move.** It pushes in during flight: Lua flight 27.2–29.65 s goes z 4.66→5.59 (+20 %), Los 10.5–11.7 s +11 %. He said zoom in the air feels weird, and tides dropped round 2's flight rule. The range is also −26 % (Lua z 4.59, wider than Today), though `cam.js` says tides stay within about ±12 %. The note says "except in 3+ seconds without a hit", but the zoom has already reached z 5.6 at the last hit before the gap (Lua 21.93 s). It fires on only 2 of 6 songs, so the Shade line ("eases out in long quiet") is false on the Petrunko film. Fix: make it the one-sided low tail of the σ = 3 s impact rate, cap it at −12 %, and hold zoom in flight. Otherwise cut it from Q2 and Shade.
2. **Q1 asks the wrong question, and A and B are close.** All four options sit in the same place: mean x 58–62 % W, mean y 40–44 % H on the four chips. What differs is motion (y-speed rms on Los: 260 / 148 / 87 / 0 px/s). Official vs Tamed differ by only 7–10 css px in y and 2 in x, and I expect that pair to blur on a phone. Retitle it "How still should the rider be?" and tell him to watch the rider, not the track.
3. **Tamed is the riskiest camera, yet it is the default and is missing from the chart.** It ramps at about 100 px/s, the same rate as Operator's sawtooth (90). It has far fewer ramps (1–6/min vs 16–23), but Lua 21.9–24.3 s has a straight 2.45 s, 210 px climb. It also keeps 66–101 slips/min (Today 77–125, Calm 0). Add Tamed to the morning chart. See "Most valuable change".
4. **Morning text is wrong in three places.**
   - Films: "Five full looks… plus one on three other songs". The real count is six looks plus Today on 3 songs, and two looks on 3 others.
   - Night: "hand-placed" sits one line below "Sections no longer drive anything", but all 12 cue numbers in `NIGHTS` match section boundaries in `phases`. Say so: sections as an authoring aid, which he accepted.
   - "A song without one wouldn't get Night": all 6 have one, and Petrunko has no loudness rise at its cue (0.383→0.386).
5. **"Standing" doesn't stand.** The page says red "rests… until a stronger hit earns it", but it jumps 41–62 times/min (median hold 0.9–1.3 s; Coma 40–46 s has 5 jumps). This goes into Scarf, Press and Shade. Requiring a hit to beat the champion by ×1.3 with τ = 8 s gives 18–25/min. Change it before rendering.

## Should-fix

- **Q5 isn't one decision.** It says colours aren't the question, then mixes rainbow, pastel, red and Ridge, plus heights and reflection, across 7 options. Tuning fork and Iris (both in his pool) are absent, and no plain Blocks option. Use one neutral palette for every form, and a separate height row for bars only.
- **Q6 mixes paper, driver and Night.** On the default chip (Petrunko 18–26 s) impact and loudness tones nearly match (0.47–1.0 vs 0.49–0.8). Open on Los 19.5 s instead (0.67–1.0 vs 0–0.87). Tone also saturates: Los impact is above 0.9 for 56 % of the song. Its end colour `#dfe5ee` is deeper than the `#e3e8f0` he called subtle, and he dislikes tinted paper.
- **Ridge fades just before it completes.** The shapes are correct on all 6 songs, but the front is about 95 % across when the band fades at the ending. Keep the finished silhouette through the ending; it is the natural payoff. 79–132 pre-cut slits turn it into a barcode that reads as another spectrum, and it is grey moiré where hits are dense. Cut slits only for stronger hits. The red slit (1.2 css px, ≤ 0.24 s) is invisible on a phone. The red dot works.
- **Shade.** Flash is safe on a worst-case full-frame estimate: at most 2 per second below luminance 0.8, 3 per second at ΔL ≥ 0.1. But 39–79 visible wedges/min is not "rest clean". Gate out w < 0.25. Scale it by (1 − over): wedges cut across the whole-course view at 0.6 s (Petrunko, Coma).
- **Night.** All cues land and the rider and band are legible, though Iris is thin on dark. The exit isn't snapped: it is 25–50 ms off the nearest hit and lands on weak hits on Batidão, Burn and Coma (I 0.18–0.28). The white flash lifts black to about `#555` on strong hits and spoils the night. Reduce it to about 40 % on dark.
- **Tides pump mildly.** Busy tides swing 27 % at 1–5 reversals/min, peak 9–14 %/s, and spend 28–50 % of their travel in flight (biggest push-in 7 %). Coma is worst at 5/min. Add a slew limit of about 4 %/s.
- **"One slow push"** moves at 0.4–0.7 %/s, so it can't be seen as motion in a loop. Only the seam shows (Lua 15–35 s snaps 13 %). The note should point to the Lua start and end chips.
- **Free lab:** size Today silently forces the official camera, and official ignores tide.

## Nice-to-have

- Moment chips show no active state.
- Pick buttons start at y ≈ 980, below the 844 px fold, and show letters only.
- Heat reaches six on at most 2 % of frames, and under 1 % on Petrunko, Los and Burn.
- The morning page is 3,630 css px, about 4.3 screens.

## Checked and fine

- All chips land and keep the selected option; loops wrap at both endings; no page errors or overflow. All 4 Q6 chips cross the cue. Calm-out fires in the Lua 15–35 and Los 5–25 loops.
- Rider y never exceeds 48.5 % H (band tops ≥ 56 %), x stays at or below 63 %, and it is never off-frame or hidden.
- Bookends: rider visible throughout on ring, token and plain, on the 3 cameras inspected (Tamed, Official, Calm); the ring fades in gradually; no path line.
- All five red logics fire.
- Calm's "no slips" holds on 6 songs.
- Verified morning claims: 60–62 %, 10,000 px/min, 360–430 u/s, corr 0.69, 1.27×, 15 %, 0.25 s, 99 %, 40 % zone, and both detectors missing Petrunko's cue (17.0 s and 33.3 s). The chart data recomputes within 0.05.

## Taste: what to cut

Cut calm-out unless it is rebuilt, Press (nearly Scarf), and Registers (least meaning). Reduce Q5 to 5 options. Shorten the morning page to the three cards and the chart; he has little time and catalogues intimidate him.

**Most valuable change:** render the looks on Calm, not Tamed. Keep Tamed only in Q1. Calm is the only moving camera with zero slips, its ramps are few and slow (1–2/min, about 55 px/s), and it stays visibly apart from Official. He singled out rider-motion artefacts, so this protects every film. A wrong default would waste the whole render.
