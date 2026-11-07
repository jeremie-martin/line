# Round 3 ideas: one red, the lower band, hits

Written 2026-11-05. Every number was measured on all six songs in `data/` (batidao, burn, coma, los, lua, petrunko).

**What was tested.** I mocked up the Ridge, the Ledger, the Frieze (with a skeleton standing in for the sprite) and the Shade as stills over real lab frames. **Nothing here has been seen in motion or on a phone.** Timing claims come from arithmetic, not from viewing. The stills are in `/tmp/claude-1000/-home-holo-prog-line-side-task/bec926ae-5566-475f-a8cf-cad1f83f13be/scratchpad/r3/`: `bands.png`, `ridges.png`, `hits.png`.

**The bets I'd stake my taste on:**
1. **Ridge with slits** (§2.1)
2. **The Shade on the far side of the struck line, with the shared envelope** (§3.1 and §3.2)
3. **Standing red** (§1.4)

---

## 0. What the data changed

| Measurement | Result | Consequence |
|---|---|---|
| Paper share of a clean frame | **99.3–99.5 %** | A white flash on white paper changes almost nothing except the ink, and the split can only move ink. On this look, the only truly full-frame move is taking paper *down*. |
| Strength spread | `e` p50 ≈ 0.5, p90 ≈ 0.75; 39–60 % of hits have e > 0.5 (36–74 per minute) | Today's kick `6+20e` gives about 16.6 px at p50 and 21 px at p90, only ×1.27. This is why strong hits don't stand out: **most of the range is spent on the base, not the excess**. |
| Peak-frame aliasing | Hits sit on the 40 fps grid, so 40–57 % fall mid-frame at 60 fps and lose 8.3 ms of decay | Split peak ×0.87, flash peak ×0.85. For the flash at e = 0.5 that equals losing Δe ≈ 0.17. Half the hits are randomly weakened by about two thirds of the p50→p90 strength difference (Δe ≈ 0.25). |
| Hit crowding | Strong hits with another hit < 0.25 s before: 0–3 %; gap p10 0.25–0.35 s, p50 ≈ 0.5 s | The full 0.25 s recovery budget is free, and accents almost never overlap. Today's accents use little of it. |
| Rider speed | vx ≈ 370 u/s, never backwards; about 2300 px/s at z = 6.2, so 0.47 s to cross the frame | Anything pinned to world x leaves the frame almost at once. |
| Course shape | A straight ramp at 20–29°, with 880–1200 u of deviation over about 21 000 u | Raw altitude is a boring diagonal. Rotated flat, each song has a distinct silhouette. |
| Raw top-3 loudest | 45–91 % in the low third; 12–21 swaps/s; never empty | What he adored is a small, constant quantity of red that flickers mostly on the left. |
| Hit "fingerprint" (spectral flux at the hit) | Drums at band ≈ 7–16, voice at ≈ 23–33 of 56 | Band position nearly encodes the source. Red on flux shows *what* struck. |
| `s` vs `ask` | r ≈ 0.8, residual sd 0.08; hits that beat their ask have average strength | Realized and specified barely differ, and the difference is invisible (see §1.5). |
| Struck side | Rider below the line for 9–31 % of hits (nearest-line estimate); line angle −13° to +62° (p5–p95) | A geometry-based accent varies by itself. |

**Why the tuning fork works.** Red is not added to the picture: a few existing elements *become* red, and the amount stays nearly constant. Each logic below keeps that property and changes only *who* is red.

---

## 1. One red

Shared: `RED = '#d3262e'`. Red only ever fills shapes ≥ 4 px wide. `wh = v / p95(band)` is the spectrum whitened per band over the song, computed once in `prepare()`. `flux(t) = wh(t + 1/30) − wh(t − 2/30)`.

### 1.1 Struck (impact, realized)
- **Rule.** At each hit, take the `k = 1 + round(4e)` bands with the largest flux. They stay red for `0.10 + 0.14e` s, and the band is pure graphite otherwise. Contiguous selection is not enforced.
- **Why it looks good.** Red occurs only when the ride touches something. Strength reads as a count (1–5 stems) with no tier, and position shows the source: kicks left, voice centre. Red is on 23–37 % of the time, so rest is truly clean.
- **Fails if** kicks light the same three stems all song (drum position sd ≈ 3 bands on batidao and burn; 16 on petrunko), or 0.1 s of red on small dots goes unseen. If the second happens, use bars.

### 1.2 Three registers (always on, musical)
- **Rule.** Split the 56 bands into three thirds. Each third keeps exactly one red: its loudest whitened band. A new band takes over only if it beats the current one by 15 % and the current one has held for ≥ 100 ms.
- **Why it looks good.** It is the same "always three" he loved, but spread across the band instead of 45–91 % on the left: a three-note chord that moves. Swaps fall from 12–21/s to 5–9/s.
- **Fails if** the high third is mostly noise on sparse songs, so one red wanders without musical meaning. Or if it loses the tight clustered look that may be part of the charm (coma's raw top 3 is contiguous 79 % of the time).

### 1.3 Heat (red follows rolling impact)
- **Rule.** `heat(t) = Σ e·exp(−(t−tc)/0.8)`. Target count `n = 6·heat/1.47`, clamped to 0–6. Red goes to the `floor(n)` loudest stems, and the next one in line grows its dot radius with `frac(n)`, so nothing pops. Using 0.8 s: it is above the song's median hit gap (≈ 0.5 s), so count does not ripple on every hit, and short enough to follow a phrase. Note `heat` is causal, so red never leads the music.
- **Why it looks good.** It is purely data-driven intensity without sections, and the same signal could serve the background. Measured `n` p10/50/90 is about 0.5 / 3 / 5. Stems are graphite for 11–21 % of the time, and red grows with the ride.
- **Fails if** it stays near 3–5 through a uniform song, in which case it is just the old picture. Check batidao and lua. **Specified variant:** swap `e` for `strength(ask)`. Red then follows the song's written intent and isn't affected by physics shortfalls. With r ≈ 0.8 expect a similar result; try it once and don't spend longer on it.

### 1.4 Standing red (red holds until something earns it) — my pick
- **Rule.** Keep a champion strength `c(t) = c₀·exp(−(t−t₀)/4 s)`. When a hit has `e > c(t)`, it becomes the champion: `c₀ = e`, `t₀ = tc`. Its top 3 flux bands become the red stems. Red then **stays on those stems** until the next champion, while the stems go on moving with the music. The change is instant.
- **Why it looks good.** Red is still, so *a jump is the event*. It moves about 1/s (42–63 moves/min) instead of 12–21 swaps/s. Champions are stronger than average hits (mean e 0.57–0.64 vs 0.42–0.53). Bigger hits stay champion longer, so a strong hit is marked by **how long nothing dislodges it**. That is continuous, with no threshold. It should also be the most elegant of the four: three fixed red notes, on a moving graphite field.
- **Fails if** a red stem sitting at low height reads as stale or wrong, since a kick's red lands on low bands and those drop quickly. Fix: dot radius follows the stem, so it remains a mass. Also fails if 1 move/s still seems busy; then use τ = 8 s.

### 1.5 Considered and dropped
- **Promise (red when `s` beats `ask`).** The top 15 % of `s − ask` have average strength, so red would appear on hits that look ordinary. The viewer can't see the spec. It would read as random.
- **Freshest three (loudness vs each band's 4 s baseline).** Worse than raw on every measure: still 53–67 % on the left and flickers more.
- **Red under the contact point, registered to the world.** The rider is nearly fixed on screen, so it is either static (at the hit) or gone in under 0.5 s (registered to world x).
- **Next three hits arriving at the rider.** Needs a compressed time scale, which is the Score he didn't keep.

### 1.6 Other forms

| Form | Red element | Note |
|---|---|---|
| Tuning fork | Dot, radius + 2 px | As today |
| Today's bars / Three colours | The whole bar, solid, and its reflection at low alpha | Bars must be graphite first: red on three colours is a fourth colour |
| Blocks | Only the top lit cell of the column | Red dashes hopping on a graphite stack. Likely the best match with Standing red |
| Iris | **Not** a red contour: a filled sliver between the live contour and the 0.06 s echo, ±1 band around the selected band | A thin red stroke smears at 4:2:0 and reads as line. The sliver is a mass, and it vanishes when the curve isn't rising, so pair with Struck or Heat, not Standing |

---

## 2. Lower band beyond visualisation

All three are masses, are still between events, and use the frame's area from about 0.71 H to the base at 0.825 H. **A still band is a feature here:** today's band moves at all times, and these give "rest clean" to the bottom of the frame as well.

### 2.1 Ridge with slits — my pick (see `ridges.png`)
- **What.** The course's own silhouette, rotated flat, filled, with every hit cut out of it. Each song gets a different mountain barcode.
- **Geometry.** Fit `y = a·x + b` on the rider centres. `det = y − (a·x + b)`, normalised to 0–1. For u = 0..1080 px, with `u = 1080·(x−x₀)/(x₁−x₀)`: top edge `ytop = base − 40 − 170·(1 − det)`, base = 0.825 H. This is the true profile with about 3.4× vertical exaggeration.
- **Inking.** Left of the rider's u is `#15181d`, right of it pale `#d6dbe2`. There is one hard vertical edge. The front moves about 18 px/s and maps nearly linearly to time (≤ 37 px error). A red 18 px dot sits on the crest at the front.
- **Hits.** Each hit cuts a full-height paper slit at its own u, `1.5 + 3.5e` px wide (keep ≥ 2 px after scaling). Slits are pre-cut in the pale part too, so the entire song is visible in advance, as with pencil→ink. On contact, the slit flashes solid red for `0.10 + 0.14e` s, then returns to paper.
- **Why it isn't cheap.** Nothing about it could belong to another ride. It is the same pencil→ink idea he loved, in the same grammar, and it completes itself in the final second as a poster of the ride. Lead's call, but it could also receive the whole course from the opening, and the fully inked ridge could be the Short's last frame. Slit density shows where the song is busy; solid stretches are the rests.
- **Fails if** it reads as a progress bar (the most likely verdict; the Shorts bar is at the bottom edge) or the black mass pulls the eye from the rider by the last 15 s. Then try `#3b414a`, or 120 px height. Very dense passages hatch finely (batidao around 30 s) and must be checked after YouTube compression.
- **Size.** About 25 lines: precompute a `Path2D`, clip twice, and draw the slits.

### 2.2 Frieze: Marey's chronophotograph of the ride
- **What.** A row of 8 frozen rider silhouettes, each the exact pose at a recent hit, solid and without detail. This ride spins a lot (rotations of several turns on coma, petrunko and los), so the poses really differ.
- **Geometry.** 8 fixed slots across the band. Size follows strength: `height = 90·(0.75 + 0.5e)` px. Candidates are hits with e ≥ 0.45 (about 1/s). Slots work like a typewriter: **nothing slides**; the next slot is overwritten and the cursor wraps. Tone runs from `#15181d` (newest) to `#d6dbe2` (oldest) by age rank. Only the newest keeps its red scarf.
- **Data.** `riderAt` at `h.tc`, sprite rendered into an offscreen canvas and flooded with `source-in`, rotation preserved. Prepared once at load.
- **Why it isn't cheap.** It is a record of what the rider actually did, in the rider's own artwork, which he values. It reads at phone size because it is a silhouette. A viewer gets a small reason to look down, and the band changes only on a hit.
- **Fails if** a second row of riders competes with the real one, particularly in a mostly white frame, or if 1 update/s feels like a slot machine. It has a stronger risk of feeling "cute" than the Ridge. My proxy used a skeleton, so the real sprite needs its own look.
- **Size.** About 35 lines.

### 2.3 Ledger (a simpler fallback)
- **What.** Every hit of the song as a solid block, width 5.5 px, height `26 + 210e`, at `x = 24 + 1032·t/T`. Pale until struck, ink after. Silences show as true gaps.
- **Why it isn't cheap.** It shows the song's real structure, not a generic spectrum, and it is strictly on-the-hit motion.
- **Fails if** it reads as a SoundCloud waveform, which it does a bit in the mock-up. The Ridge is the same idea with the course added, so I would only keep this if the Ridge's black mass is rejected.

---

## 3. Hits, in the spirit of "Today, refined"

Everything below starts from a shared strength map and envelope.

```js
const w = h => Math.pow(h.I, 2.2);                 // excess strength; p50 ≈ 0.2, p90 ≈ 0.55, max 1
const env = (age, w) => {                          // recovery ends exactly, never exceeds 0.25 s
  const hold = (1 + 2 * w) / 60, L = 0.10 + 0.10 * w;
  return age < 0 ? 0 : age < hold ? 1 : Math.pow(Math.max(0, 1 - (age - hold) / L), 2);
};
```

### 3.1 The Shade: the struck line divides the frame — my pick (see `hits.png`, panels 1–2)
- **What.** For an instant, everything beyond the struck line (extended to the frame's edges) drops in tone, with a razor edge along the line. The rider's side stays paper.
- **Rule.** A half-plane through `h.pos`, on the `into(h)` side, reusing the clip polygon from the `slice` accent. `multiply` with tone `mix('#787e88', RED, w²)`, alpha `(0.04 + 0.26w)·env`.
- **On phone at 60 fps.** At p50, paper dips to about 241 for 9 frames: a light hard-edged wedge. At p90, about 229. At the top, about 214, with a pink cast, for 15 frames. This is a poster-like diagonal **without adding a single stroke near the line**.
- **Why it isn't cheap.** The shape *is* the struck line. Its angle changes hit by hit (−13° to +62°), and it flips above the line for ceiling hits, so it never repeats like a template. This is the only accent on the list that truly touches 99 % of the frame.
- **Fails if** it reads as a rendering glitch or a page turn, or the band's mass fights with it. Worth checking early. Also it must not be confused with the rejected inversion; it should stay at or under about 30 % darkening.
- **Safety, measured.** Paper falls below luminance 0.8 on only 7–19 % of hits (8–15 per minute), at most 2 in any second, so it stays under the three-flashes-per-second guideline. Keep the 0.30 cap, and recheck on any new song.
- **Size.** About 15 lines.

### 3.2 Strength as duration (applies to kick, split, flash)
- **Rule.** Replace every `decay(age, …)` with `env(age, w)`. Amplitudes: kick `6 + 30w` px (cap 36), split `2 + 16w` px (cap 18), flash `0.10 + 0.20w`.
- **Why.** Three problems go together:
  1. The p90/p50 ratio of the kick grows from ×1.27 to about ×1.6.
  2. The peak is held for at least one full frame, which removes the aliasing lottery.
  3. Below roughly 100 ms the eye integrates intensity × time, so a longer hold reads as stronger with no extra amplitude. Envelope energy (`hold + L/3`) grows ×1.75 from median to top, on top of amplitude.
- **Reads as** ordinary hits being crisp ticks of 9 frames, and the biggest hits being a heavy 15-frame thud. Recovery is guaranteed ≤ 0.25 s by construction, and at the gap p10 of 0.25 s nothing overlaps.
- **Fails if** ordinary hits lose energy he liked: median kick falls from about 16 px to about 13 px. If so, use `10 + 26w`. This is the cheapest idea here (about 10 lines) and should go first.

### 3.3 Clean rider, turning split
- **Clean rider (hits.png, panel 4).** Split the world but not the rider: run the split before `drawRider`, about 3 lines of reordering in `draw()`. The rider stays razor sharp while the world tears around it. The eye's target is always legible, and the rider pops as if on its own layer.
- **Turning split.** The split vector rotates from the blow to the wake, joining the two things he liked: `S = a·env·[(1−q)·into(h) − q·v̂]`, `q = smoothstep(0, 1, (age − hold) / 0.08)`. The mode changes from `centre` to `trail` at q > 0.5. The first 3 frames are a symmetric fringe along the normal, and the next 5–6 a one-sided fringe behind the rider's motion. For a landing, n̂ and v̂ are nearly perpendicular, so the fringe visibly swings through 90°.
- **Fails if** he misses the rider split, which was part of the "crazy RGB" he approved. If so, keep it on the rider at one third. The turn may be too fast to see, in which case keep only the clean rider.
- **Size.** About 12 lines.

### 3.4 One overshoot on the kick
- **Rule.** Kick displacement `A·exp(−age/τ)·cos(π·age/T)`, `T = 0.11 + 0.08w` s, `τ = T/2`. The frame crosses rest at T/2, overshoots once by about 13 % at T, then settles. Heavier hits ring lower.
- **Why.** A sign change gives a recoil a sharper ending than a slide back, and the "pitch" of the recoil carries weight continuously.
- **Fails if** it looks like wobble: today's shake was fine because it is short, but two swings may start to look like the camera moving. Compare to §3.2 alone. If the difference isn't visible, drop it. It is a 2-line test, so it costs little to find out.

### 3.5 Considered and dropped
- **Shock front (a split band sweeping away from the line).** With 99 % paper there is nothing to displace, so it would be invisible most of the time.
- **Ducking small hits before strong ones.** Only 0–3 % of strong hits have a hit in the prior 0.25 s, so there's nothing to duck.
- **Local-contrast gain (hit vs previous 3 s).** Contrast p10–p90 is about ±0.25, so it could work, but it makes the same hit look different in different places, against the agreed absolute scale. Try only if §3.2 isn't enough.
- **Hit-stop.** Breaks sync and misrepresents motion.

---

## 4. Suggested test order

1. §3.2, then §3.1, on los at 48.25 s and petrunko at 22.4 s. Judge in motion and on a phone before anything else, since the Shade's main risk (looking like a glitch) can't be judged from a still.
2. §2.1 Ridge, with slits in red on contact, on all six songs. Compare ink and graphite, at full length.
3. §1.4 Standing red on the tuning fork against the raw top 3, on coma (hardest: its raw red is 91 % on the left) and lua (the quiet test).
4. Together: Ridge + Shade + clean rider. Red appears in three places, so check it still feels like *one* red. If it doesn't, Ridge's slits go white and the Shade's tone stays grey.
