# Round 4 ideas

Written 2026-11-06, on all six songs with real contacts from the native replay.

**Verified:** the numbers and stills on real frames (`stills/`, made with a private lab copy in `mock/`). **Not verified:** anything in motion, on a phone or through YouTube. Perception claims are inferred.

**Top bets:** Hokusai · Waterline · Ink ahead.

**One correction to the brief.** In these renders the native scarf is striped: `#fd4f38`, `#3995fd`, `#06a725`. Our `#d3262e` isn't its red (ΔE 16). Schemes were checked against all three stripes.

---

## 1. Colour schemes

`stills/colour-schemes.png` shows fork, bars and night, ranked left to right.

| # | Scheme | Paper | Ink | Pencil | Band mass | Accent | Night paper | Night ink |
|---|---|---|---|---|---|---|---|---|
| 1 | **Hokusai** (Prussian blue on washi) | `#f4ecdc` | `#12294d` | `#b8b4a4` | `#1d3e73` | `#d4412a` | `#0d1f3f` | `#f4ecdc` |
| 2 | **Salmon** (financial newsprint) | `#fce6d9` | `#3a1024` | `#cfb3a8` | `#7a1438` | `#007a78` | `#2b0a1a` | `#fce6d9` |
| 3 | **Klein** (Swiss poster, keeps white) | `#ffffff` | `#0d1433` | `#b4bcd8` | `#0f2fb5` | `#f2500f` | `#0a1a6e` | `#f5f7ff` |
| 4 | **Bottle** (old crime paperback) | `#f3f1e4` | `#0e2e27` | `#b0b9a8` | `#14604c` | `#c96805` | `#0a2a23` | `#f6efcf` |
| 5 | **Blueprint** (blue is the daylight) | `#123f7f` | `#f3f7ff` | `#4c70aa` | `#dfe9fb` | `#ffb300` | `#071d40` | `#f3f7ff` |

**Contrast (WCAG ratio).** Today's graphite and red shown for reference.

| | Ink/paper | Pencil/paper | Mass/paper | Accent/paper | Accent/mass | Night ink | Accent/night | Lowest scarf stripe/paper | Accent vs scarf red (ΔE76) |
|---|---|---|---|---|---|---|---|---|---|
| Today | 17.8 | 1.9 | 10.3 | 5.1 | 2.0 | 15.8 | 3.5 | 3.0 | 16 |
| Hokusai | 12.3 | 1.8 | 9.0 | 3.9 | 2.3 | 13.9 | 3.6 | 2.6 | 13 |
| Salmon | 13.6 | 1.6 | 8.8 | 4.3 | 2.0 | 15.0 | 3.5 | 2.5 | 110 |
| Klein | 18.0 | 1.9 | 10.0 | 3.5 | 2.8 | 14.2 | 4.3 | 3.0 | 15 |
| Bottle | 12.9 | 1.8 | 6.6 | 3.4 | 1.9 | 13.3 | 4.0 | 2.7 | 33 |
| Blueprint | 9.6 | 2.1 | 8.4 | 5.7 | **1.5** | 15.5 | 9.3 | 3.1 | 60 |

**Chroma.** Moving clips at 3 Mbps, 4:2:0: fork dots and bars keep 97–101 % of accent chroma, but these clean frames only needed about 1.2 Mbps, so that was not a starved encode. Strips at CRF 34: 3 px and wider keep 94–108 % in every scheme; 2 px keeps 27–62 %. The ≥ 4 px rule holds for all five. x264 only stands in for YouTube's encoder.

**Bet: Hokusai.** It's the furthest from black and red that still rhymes with the scarf, and indigo night is a soft step from a warm day.

**Risks.** Salmon's claret against teal may be hard for red-green colour-blind viewers (inferred). Blueprint's accent on bars relies on hue alone, and flipping its night to white failed at 1.7:1. Its rider stayed legible, to my surprise. On non-white paper, Held's white flash can now brighten the paper, which it couldn't do on white: check whether that's stronger or dirtier.

---

## 2. The Ridge

**Why climbing feels unintuitive.** The rider falls in 91–98 % of frames, but the ridge front rises for long stretches. When it rises, the rider is really falling 80–96 % of the time. Detrending flipped the meaning: "up" there only means "falling slower than average". The dot goes up and to the right while the rider goes down and to the right, at about 1/120 of its speed. So the complaint is right, I believe: the band contradicts the motion you feel.

**What the gaps are.** Not holes in the profile: its largest step is 7 px per column. They are the paper slits. Hits land where flights end, so slits gather at the flight cusps, and `top(round(u))` leaves crumbs on steep edges. **Exact fix: never cut to paper.** Delete the `th.bg` slit loop in `drawRidge`.

Shared silhouette for 2.1 and 2.2, drawn whole in pale from the first frame, now descending left to right: `top(u) = base − 26 − 105·(1−us[u]) − 155·(1−u/W)`.

### 2.1 Waterline: my bet (`stills/ridge-waterline-struck.png`)
- **Rule.** `rec(t)` = running maximum of the rider's raw y. `lv = crest + (base + 2 − crest)·(rec − y₀)/(yEnd − y₀)`. Ink the silhouette above `lv`; pale stays below. No dot, no slits.
- **Reads as** a pale sea draining as the rider falls, the mountain surfacing. The only moving edge goes down, like the rider. It ends as a fully inked poster.
- **Measured.** 4.3–5 px/s. The rider sets a new low on 80–93 % of frames; longest hold 1.1–4.0 s. Driving the level from the silhouette's own height stalled 15–32 s, so raw altitude is required.
- **Fails if** it reads as a vertical progress bar: it stays within 8–13 % of linear in time.

### 2.2 Struck
- **Rule.** Same pale silhouette, no front. Each hit inks one column at its own u, clipped to the silhouette, `2 + 10e` px wide, and shows accent for `held()`.
- **Reads as** a mountain built only by impacts: still between hits, ending as a barcode of the ride. The crest never breaks, because pale stays underneath.
- **Fails if** it's a jerky progress bar, or dense passages hatch after compression.

### 2.3 Horizon
- **Rule.** The ink/pale boundary stays fixed at 0.62 W, under the rider. Terrain scrolls left at 150 px/s (about 1:15 of the foreground, a true parallax). Height is raw altitude minus a 6 s gaussian.
- **Why.** The only option with no progress reading.
- **Fails.** In stills it becomes generic soft hills. It never rests, and it's close to the Score he didn't keep.

---

## 3. Zoom logic

**What the data says.**
- Tamed has no framing fault to fix: the rider stays near 0.62 W, 0.44 H. Look-ahead is about 0.15 s, and ±12 % zoom barely changes that.
- The ride is airborne 58–64 % of the time, so holding in the air chops Out when quiet into **34–47 starts per minute** of 0.05–0.17 s. Each step is about 0.2–0.7 %, probably invisible (inferred), but it isn't the smooth tide we describe.

My view: **clarity comes from steadiness, so the good logic spends the fewest moves.**

### 3.1 One breath: my bet
```js
breath(Rs) {
  const r = impactRate(Rs, 3), med = pct(r, .5), n = Rs.n, A = 6 * FPS, R = 4.8 * FPS; // R: 2.5 %/s
  let b = A; for (let f = A; f < n - A; f++) if (r[f] < r[b]) b = f;
  if (r[b] >= 0.6 * med) return new Float64Array(n);          // no real quiet: stays Steady
  let a0 = b, a1 = b; while (a0 > 0 && r[a0] < .75 * med) a0--; while (a1 < n - 1 && r[a1] < .75 * med) a1++;
  return Float64Array.from({length: n}, (_, f) => -0.12 * Math.min(smoothstep((f - a0 + R) / R), smoothstep((a1 + R - f) / R)));
},
```
- At most one excursion per song, only if the song earns it. Later, use `1 − intensity` for `r`.
- **Run as written.** Fires on los (22 s in all, quiet at 0.33 of median) and lua (18 s, 0.25). The other four stay Steady (0.70–0.88). No move while airborne; peak rate 3.75 %/s.
- **Fails if** the single move feels unmotivated, or the gate, tuned on six songs, refuses a song that deserves it.

### 3.2 Fitted steady
- **Rule.** `fit: Rs => new Float64Array(Rs.n).fill(Math.log(360 / medianVx))`.
- **Result.** z from 5.83 (petrunko) to 6.64 (lua), so every song has about the same on-screen speed, with no motion at all. Combines with 3.1.
- **Fails if** the benefit is invisible, or the 13 % spread in rider size matters more.

### 3.3 Plateaus
- **Rule.** Fit Out when quiet to three levels `[0, −.06, −.12]` with Viterbi (switch cost 0.05), travelling at 3 %/s.
- **Measured.** 2–4.6 moves/min against 2–7. Better on batidao (7→2) and coma (4→2), worse on lua (moving 19 % vs 16 %).
- **Fails if** the steps show more than a tide. Its best use is shaping `intensity(t)`.

**Tested and dropped.** Room to land: zoomed out 86–100 % of the song, because flights are so frequent. Keep rails in frame: empty frames only fall from 12–26 % to 11–23 %. Speed-locked look-ahead: nearly the opposite of Out when quiet on five of six songs, and it hides the speed he loves. Move only on long rails: only 0–2 grounded spans ≥ 0.8 s per song.

---

## 4. Hits beyond the ladder

All three sit on top of Held; none replaces it. `w = e^2.2`.

### 4.1 Ink ahead: my bet (`stills/hit-ink-ahead.png`)
- **Rule.** In `drawLines`, ink is drawn up to `front = max(at, max over hits of (tc + 0.06 + 0.24w)·FPS)`. About 2 lines.
- **Meaning.** The blow runs down the rail, then the rider catches it. **There is no envelope: the rider's real speed is the recovery.** Nothing fades back, so it can't flicker.
- **Weak vs strong.** Weak: a short dash ahead of the sled. Strong: on the stills, ink reaches the frame edge along both rails.
- **Not a ladder.** One mechanism, one continuous length, and the course decides what it lands on. It extends pencil→ink, needs no colour, and leaves line width alone.
- **Measured.** Rail inked in that lead: p50 163–249 px, p90 394–462 px.
- **Fails if** there's no rail ahead: under 40 px on 12–17 % of hits, including los's strongest (48.2 s, 2 px). Held still covers those. It may also read as spoiling the reveal.

### 4.2 Afterimage (`stills/hit-afterimage.png`)
- **Rule.** Draw the native sprite in its exact pose at `tc`, flooded flat, at its world position, under the rider. Life `0.12 + 0.13w` s (stills used up to 0.32 s), alpha `(1 − age/life)^0.6`. Colour `mix(mix(paper, ink, .3), accent, smoothstep((e − .2)/.5))`.
- **Meaning.** The body the blow caught stays where it happened while the real rider leaves it. It shows true speed without fake motion: about 640 px apart by 0.25 s.
- **Weak vs strong.** Weak: a grey flicker near the sled. Strong: an accent figure left far behind, the only real mass of colour near the rider.
- **Not a ladder.** Pose and place are new each time; strength only sets how long it survives.
- **Fails if** it reads as a second rider, a game trail, or a cousin of the rejected stamp. Round 2 dismissed an "impact echo" on paper, unseen, predicting blur at 60 fps; motion is the real test.

### 4.3 Stay
- **Rule.** Keep Held's amplitude. Hold = `clamp(contactRun, (1 + 2w)/60, 0.18)`, then recover in 0.07 s, with the kick following the current line's normal during the hold.
- **Meaning.** Strength says how hard; the rail says how long. A bounce is a tick, a slam into a grind is a press.
- **Measured.** Contact after a hit: p50 0.15–0.18 s, p90 0.28–0.46 s. Correlation with strength −0.12 to 0.06, so it's new information, not another step on the same scale.
- **Fails if** the difference from Held can't be seen. Numbers only, not mocked.

---

**Files.** `mock/` takes `?pal=`, `?rv=level|struck|horizon`, `?hx=inkahead|ghost`. `analysis-colour.py` needs the frames `clip.mjs` writes.
