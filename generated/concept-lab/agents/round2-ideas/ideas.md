# Round 2: an automatic camera director and a family of hit accents

Written 2026-11-03, after reading `lab.js`, the three data files and the round-1 notes. Every number below
comes from re-running the lab's camera maths in Python on `data/*.json`, with the scripts in this session's
scratchpad. They are reproductions of `prepare()`/`camera()`, not of the browser itself, so expect small
differences of a few px.

Units: world units (u), output pixels on the 1080×1920 frame (px), seconds (s). `z` is px per u. "Sprite" means
the rider as drawn on screen. "Rider" means its world position R(t), the mean of its 10 contact points.

---

## 0. Diagnosis: why the rider seems to rise or stall

**What happens.** `prepare()` builds `smooth` as a centred Gaussian (σ = 10 physics frames = 0.25 s, window ±0.5 s)
over the rider centroid. `camera()` adds a look-ahead vector to it. The look-ahead is almost always clamped to its
maximum length (0.24·W/z, which is 259 px at any zoom), so its own motion is small: p90 is 9–12 u/s. **The fault is in
the centred smoothing, not in the look-ahead.** Using the smoothed path alone, without the look-ahead, gives
almost the same fake-motion count (table below).

A centred filter makes the camera react to a velocity change **before the rider makes it, and keep reacting after
it**. At a landing, the rider's vertical velocity drops from about 300 u/s to about 40 u/s within one physics frame.
The smoothed camera starts slowing down about 0.4 s early, and keeps sinking for about 0.4 s afterwards. Here is
Petrunko at the 0.91-strength hit at 22.40 s (the SUSPEND → RETURN landing):

| t (s) | rider vy (u/s) | camera vy (u/s) | sprite vy on screen (px/s) |
|---|---|---|---|
| 22.28 | 288 (falling) | 188 | +732 (dives faster than it falls) |
| 22.35 | 302 | 169 | +968 |
| 22.43 | 32 (landed, still going downhill) | 147 | **−837 (rises)** |
| 22.58 | 47 | 110 | −457 |
| 22.73 | 46 | 98 | −378 |

The rider is moving down the slope the whole time, yet for about 0.4 s after every hard landing the sprite climbs
about 200 px up the frame. The paper is mostly white, so there is little background flow to correct the eye: **the
sprite's own motion on screen is what the viewer reads as the rider's motion.** That is the illusion. It is worst
exactly at the strongest landings, which is where the eye is looking:

- Petrunko: the five largest vertical events are at 45.58 s (next to the 0.76 hit at 45.60), 22.40, 25.17, 33.32 and 34.67, at 197–216 px each.
- Lua: 7.82, 35.82, 39.17.
- LOS: 28.12, 55.48, 45.15.

The opposite case is the "stall". Before the rider speeds up horizontally, the camera has already sped up, so the
sprite slides backwards. The older rotation back-and-forth has the same root cause, from the other side: the camera
was following a single body point that swings when the body rotates. The **centroid of all 10 points** barely moves
under rotation (6 u peak to peak). Use it, and **do not smooth it**. Even a σ = 1.5-frame smoothing of the anchor
already produces violations on 6–13 % of frames, because contact physics changes the centroid velocity by up to
30–38 u/s per frame (p90).

The section-breath zoom is not the main cause. It pivots at (W/2, 0.38 H), but the look-ahead clamp is constant in
px, so zoom changes hardly move the sprite. It does change what the background around the rider does (§1.2, rule Z).

Fake-motion events counted with the metric defined in §1.1, for 60 fps output, at the lab's 7.3 zoom:

| camera | Petrunko | Lua | LOS | worst wrong-way slide |
|---|---|---|---|---|
| lab "closer, looking ahead" | 86 events (61 vertical), 20 s/min | 108 (68), 37 s/min | 120 (71), 35 s/min | 216–259 px |
| centred smoothing only (σ 0.25 s) | 85 | 99 | 114 | 218–244 px |
| centred smoothing σ 75 ms | 53 | 100 | 113 | 54–58 px |
| locked to the raw centroid | **0** | **0** | **0** | 0 |

**Conclusion.** No amount of smoothing tuning fixes this. Under any smoothing, the camera necessarily moves
differently from the rider, and the question is only *in which direction it is allowed to differ*. That is a hard
rule to enforce, not a filter to tune (§1.2).

---

## 1. Automatic camera

### 1.1 A measurable definition of "the camera faked rider motion"

The check runs per output frame k at 60 fps, on the camera rig *before* hit accents are added. Accents are checked
separately, with their own bound (§2.0).

- R_k: the rider centroid, interpolated exactly as the rider is drawn (`riderAt`).
- r_k: its screen position.
- u_k = z_k·(R_{k+1} − R_{k−1})·30: the rider's world velocity, expressed in px/s at the current zoom.
- v_k = (r_{k+1} − r_{k−1})·30: the sprite's velocity on screen, in px/s.

On each axis a ∈ {x, y}, frame k is **wrong** if either of these holds:
- **counter-motion:** |u_a| > 150 px/s, u_a·v_a < 0 and |v_a| > 60 px/s. The sprite moves against the rider's real direction.
- **level drift:** |u_a| ≤ 150 px/s and |v_a| > 120 px/s. The rider is level on that axis, but the sprite slides along it.

A **fake-motion event** is a run of ≥ 5 consecutive wrong frames (≥ 83 ms) on one axis whose summed wrong-way
displacement Σ|v_a|/60 is ≥ 12 px.

A **zoom fake** is also checked. Let P_n be the next contact point: the next hit position, or the touchdown point
when airborne. Let d = |P_n − R|. A frame is a zoom fake if d/dt ln(z·d) and d/dt ln d have opposite signs and the
mismatch is > 0.3/s for ≥ 5 frames. In other words, the on-screen gap to the landing grows while the real gap
shrinks: the rider looks lifted.

Report events/min, wrong seconds/min and the worst slide in px. **The target for the rig is zero, asserted at build
time.** About 12 px is 1.1 % of the width, roughly 0.7 mm on a phone. Below that, and shorter than 83 ms, nobody sees
it. The thresholds can be tightened later if the owner still notices something.

### 1.2 The "truthful rig": one guarantee layer, with several directors on top

Represent the camera by the **sprite's screen position p(t)** and the **zoom z(t)**, not by a world camera centre:

```
screen(P) = p + z · (P − R)        // in lab terms: fr.ax = p.x, fr.ay = p.y, fr.z = z, cam = R
```

Each director (§1.3) only proposes targets: ln z_pref(t), a hard ceiling ln z_cap(t) ("at least this wide") and
p_pref(t). The rig turns these targets into a camera that cannot fake motion:

**Rule P (position).** On each axis, the sprite's velocity must stay in an interval set by the rider's velocity u:

| rider on this axis | allowed sprite velocity v (px/s) |
|---|---|
| moving (+): u > 150 | [−ε, u] |
| moving (−): u < −150 | [u, +ε] |
| level: \|u\| ≤ 150 | [−ε_L, +ε_L] |

Use ε_x = 45, ε_y = 30 and ε_L = 60 px/s. Stated another way, **the camera's world velocity is always between 0 and
the rider's velocity, per axis**. It may lag the rider, or stop, but it never moves against the rider and never
overtakes it. The ε drift (≤ 2 mm/s on a phone, against a world crossing 3 widths/s) is the only way back.

**Rule Z (zoom).** Zoom always pivots on the rider, so p is unchanged by zoom. Then:
- |d ln z/dt| ≤ 0.30/s, with |d² ln z/dt²| ≤ 0.9/s² (enforced by the smoothing in step 2 below).
- Zoom in no faster than 0.5/T_next, where T_next is the time to the next contact.
- Zoom out no faster than 0.5/T_prev, where T_prev is the time since the last contact (this one only applies in the air).

With the 0.30/s cap, the T rule only binds when the next contact is more than 1.7 s away, which means long flights.
In practice: **hold the zoom during flights.**

**Rule C (cuts).** A discontinuity is not motion, as long as it is unambiguous: a zoom change of at least ×1.15, or
a re-placement of the sprite by at least 80 px. Anything smaller reads as a glitch and is forbidden. Cuts happen only
at a hit's contact frame.

**What this means in practice.** The rider descends almost all the time: vy p10 is about 0 in all three songs, so
it practically never rises. The sprite can therefore drop on screen freely when the camera lags, but it comes back
up only at ε. Under the rule, **the camera is nearly a lock-on**, and the dynamism has to come from three places:
zoom (about the rider), cuts, and the accents. That is not a limitation to work around; it is the honest grammar of
a single continuous take. It also explains why a smoothed look-ahead felt "alive": it was faking motion.

**Algorithm.** Offline, at 60 fps, about 50 lines in `prepare()`:

```js
// R[k] = lerpPt(S.centres, k*FPS/60) — raw centroid, the same interpolation as riderAt.
// tNext[k], tPrev[k] from native.contacts (0 while touching).
// 1. zoom (ln domain)
cap[K-1] = zCap[K-1]; for (k = K-2..0) cap[k] = min(zCap[k], cap[k+1] + 0.30/60);    // backward pass = pre-roll
s = filtfilt(min(zPref, cap), tau = 0.30 s);           // zero-phase one-pole, forward then backward
lz[0] = min(s[0], cap[0]);
for k: if (cut[k]) { lz[k] = cut[k].lz; p[k] = cut[k].p ?? p[k-1]; v = 0; continue; }
       up   = min(0.30, tNext[k] > 0 ? 0.5 / tNext[k] : 0.30);
       down = min(0.30, tPrev[k] > 0 ? 0.5 / tPrev[k] : 0.30);
       lz[k] = clamp(min(s[k], cap[k]), lz[k-1] - down/60, lz[k-1] + up/60);
// 2. position
w = 2π·0.5; AMAX = 2500;                               // critically damped tracker, 0.4 s of anticipation
for k, axis a:
   u  = exp(lz[k]) * (R[k+1][a] - R[k-1][a]) * 30;
   [lo, hi] = u > 150 ? [-EPS[a], u] : u < -150 ? [u, EPS[a]] : [-60, 60];
   acc = w*w*(pPref[k+24][a] - p[a]) - 2*w*vel[a];
   vel[a] = clamp(vel[a] + clamp(acc, -AMAX, AMAX)/60, lo, hi);
   if (p[a] + vel[a]/60 is outside BOX[a]) vel[a] = clamp(0, lo, hi);   // 0 is always legal: lock at the edge
   p[a] += vel[a]/60;
// 3. assert fakeMotion(rig) has zero events; log Q1–Q5 (§1.4)
```

Box for p: x ∈ [0.20 W, 0.45 W], y ∈ [0.24 H, 0.50 H]. This keeps the rider clear of the top bar (about 8 % H),
the lower music band (0.67 H and below) and the right rail.

In `draw()`: `fr = {z: exp(lz), ax: p.x, ay: p.y}`, and the camera is `lerpPt(S.centres, at)`. The existing
`bookend()` stays as it is. In its last 0.4 s it already converges to the rig, and the overture itself is an
establishing move that is exempt from the rule.

**Home framing.** z_home = 6.2 (Z0·1.15), between today's 5.4 and the lab's 7.3. The owner asked for "slightly less
close". p_home = (0.30 W, 0.36 H).

A measured fact to keep in mind: **in px, the visible path is width-bound and almost independent of zoom.**
- At every zoom from 5.4 to 7.3, the frame shows about 300 px of trail behind the rider and 500–630 px of path ahead.
- That is only **0.20–0.33 s of future**. Seeing 0.5 s ahead needs z ≈ 3.

So "readable" moments cannot come from slightly wider framing. They need brief, deep pull-outs (D2 and D6).

### 1.3 Directors

Each director is a function that returns zPref/zCap/pPref/cuts. They compose in the ln domain:
- preferences add: ln z_pref = ln z_home + b_D1 + b_D3;
- ceilings take the minimum: z_cap = min(D2, D6);
- D5 supplies pPref;
- D4 supplies cuts.

Each director can also be switched on alone in the lab's "Framing" row.

#### D1. Breathing with density (the family the owner liked, made continuous and anticipatory)
**Idea.** Tighter when the music is busy, wider when it opens up. Today this happens per section, and the zoom
changes with a 1.2 s ease that is often *inside* dense runs. The new version follows a strength-weighted hit
density, reads 0.35 s ahead, and stays stable within sections.

**Algorithm.**
- ρ(t) = Σ_i (0.5 + s_i)·N(t + 0.35 − tc_i; σ = 1.0 s), where tc_i is the contact onset.
- q = clamp((ρ − ρ_p10)/(ρ_p90 − ρ_p10), 0, 1), using song percentiles over all frames.
- Blend with the section mean of q to remove chatter: q̄ = 0.5·q + 0.5·mean_section(q).
- b_D1 = 0.40·(q̄ − 0.5). That gives ×0.82 to ×1.22, so z goes from 5.1 to 7.6.
- If ρ_p90 − ρ_p10 < 0.6 hits/s (a uniformly dense song), scale b_D1 by spread/0.6, so that no contrast is invented.

**Why it is legal.** It only changes zoom about the rider, within the rate caps.

**Failure modes.**
- It can "pump" if density alternates on a period of 2–3 s. σ = 1 s, the section blend and the 0.30/s cap all damp this.
- Sections with no hits but lots of air (Petrunko SUSPEND, Lua PHRASE GAP and QUIET) go to the widest framing. That is right.

#### D2. Flight framing (readability: the landing is in frame from takeoff)
**Idea.** A jump is the one moment the viewer needs to see where the rider is going. The data has 7–32 flights of
≥ 0.3 s per song (Petrunko has the most). The best ones lead straight into the strongest hits (Petrunko 22.40,
45.60).

**Algorithm.**
- From `S.air`, find runs [fa, fb] of no contact lasting ≥ 0.30 s.
- Window W_f = [fa − 0.25 s, fb + 0.15 s]. B = the bounding box of R over W_f, plus 30 u on each side.
- z_fit = min(0.70 W / B_w, 0.50 H / B_h, z_home). Set zCap = ln z_fit over W_f.
- The rig's backward pass starts the pull-out early enough, and Rule Z holds the zoom constant through the flight.
- Position: during the flight, raise the tracker's allowance so the sprite can drift with the rider (camera lagging,
  never leading) by up to 150 px. This lets the fall read as a fall. The rig recovers that drift afterwards at ε, or
  instantly via a D4 cut on the landing hit.

**Measure.** Q1 below must be ≥ min(0.45 s, 0.7 × flight duration).

**Failure modes.**
- Very long, tall flights would need z < 3. Floor z_fit at 2.8 and accept that the landing enters late.
- Many short flights in a row cause flicker in the zoom. Merge flights less than 0.5 s apart into one window.

#### D3. Lean into strong hits (all of them, at an absolute strength)
**Idea.** The camera pushes in slightly during the approach to a strong hit and releases after it, like an operator
leaning in. The strength scale is absolute, not a rank, so a song full of strong hits gets a lot of leaning. Where
strong hits overlap, the camera simply stays leaned in.

**Algorithm.**
- e_i = E(s_i), with the shared strength curve from §2.0.
- Per hit: A(x) = smoothstep((x + 0.8)/0.8) for x ∈ [−0.8, 0] and exp(−x/0.7) for x > 0, where x = t − tc_i.
- b_D3 = 0.16·(1 − Π_i(1 − e_i²·A(t − tc_i))). The soft-or saturates instead of piling up.
- The peak rate is 0.2/s, inside the cap.
- If a flight ceiling is active, the ceiling wins. So D3 acts on grounded approaches, and D4 handles landings.

**Failure modes.**
- In 2+ hits/s passages it merges with D1. That is acceptable.
- It is invisible if lean and release are much below ×1.08. Keep 0.16 in the ln domain (×1.17) as the full value.

#### D4. Cut on the drop
**Idea.** The one move a music-video editor makes that a continuous camera cannot: a cut to a closer framing exactly
on the downbeat that opens a section. It is honest under Rule C, and it is also the only legal way to re-place the
sprite instantly. That makes it a natural partner for D2 (fly wide, land on the hit, cut in).

**Algorithm.**
- Candidates are hits with e ≥ 0.45 that either start a section (|tc − p.t0| ≤ 0.15 s) with no hit in the preceding 0.8 s, or end a flight ≥ 0.4 s.
- Keep a spacing of ≥ 4 s, preferring the higher e. This is spacing, not a top-N.
- At the first output frame ≥ tc: ln z += ln(1.18 + 0.22·e), giving ×1.18 to ×1.40, and p := p_home.
- After the cut, the rig releases toward z_pref at its normal rates.

**Failure modes.**
- A cut on a weak or off-beat hit feels like a skipped frame. The section and flight conditions prevent this.
- Two cuts within 4 s look nervous, hence the spacing.
- Each song gets about 3–6 cuts. Petrunko: 22.40, 45.60 and the section openings.

#### D5. Placement from where the course goes (the position director)
**Idea.** Placement replaces the look-ahead. Leave room on the side the path is heading, and move only by legal
drift.

**Algorithm.**
- θ(t) = the angle below horizontal of R(t + 1.5) − R(t).
- pPref_y = 0.40 H − 0.12 H·clamp(θ/45°, 0, 1). Steep descents put the rider high (0.28 H) with room below. Flat
  rides put it lower (0.40 H), which shows more of the inked history above.
- pPref_x = 0.30 W − 0.04 W·clamp(θ/45°, 0, 1).
- Smooth pPref with σ = 1.5 s. Rule P turns it into a slow drift.

**Why it is legal.** Rule P forbids anything else.

**Trade-off.** Measured with the rider at x = 0.28 W, the frame shows about 290 px of ink trail and 600 px of path
ahead. At 0.36 W it shows 380 px of trail and 500 px ahead. The pencil → ink handover is most visible a little right
of today's position.

#### D6. Look back, look ahead (a mini overture inside the song)
**Idea.** The owner loved the opening and closing whole-course views and the pencil → ink transformation. In the
song's open stretches, pull far out to show the **section just inked behind** and the **pencil course waiting
ahead**, then return by the next hit. It is the most literal answer to "what's coming up", and it makes the sparse
sections, which the camera currently wastes, into moments.

**Algorithm.**
- Candidate windows are gaps between consecutive hits of ≥ 1.6 s (Lua PHRASE GAP and QUIET, LOS VOICE IN SPACE,
  Petrunko SUSPEND plus the flight before it).
- Over [gap start + 0.15, next hit − 0.35], set zCap = ln z_fit of the box containing R(t − 3 s .. t + 1.5 s).
  Typically z ≈ 2.5–3.5.
- For this move only, raise the zoom rate cap to 0.7/s. In log zoom that still reads as a smooth dolly.
- Rule Z still applies: the move starts while the rider is grounded, or it waits.
- During the hold, draw nothing extra. The ink against pencil tells the story.

**Failure modes.**
- In a 1.6 s gap, the round trip at 0.7/s only reaches about ×0.6. Below 1.6 s, skip the move.
- It must end ≥ 0.35 s before the next hit, or the hit lands while the zoom is still moving. That timing is a hard constraint.

**Not proposed.**
- Speed-driven zoom: rider speed varies only about ±15 %.
- Loudness-driven zoom: it pumps with the mix.
- Camera roll that follows the slope: it fakes gravity, so the rider could appear to fall uphill.

### 1.4 Framing-quality metrics (log these next to fake-motion events)

- **Q1 landing lead:** for each flight ≥ 0.3 s, how long before touchdown the touchdown point enters the safe
  rectangle S = [0.06 W, 0.82 W] × [0.08 H, 0.66 H] and stays in it. Report the median and minimum. Target ≥ min(0.45 s, 0.7 × flight duration).
- **Q2 hit in frame:** at every hit's tc, the contact point lies in [0.08 W, 0.80 W] × [0.10 H, 0.62 H]. Target: 100 %.
- **Q3 ink story:** the on-screen length inside S of lines inked in the last 1.0 s (trail) and of pencil lines that
  ink in the next 1.0 s (promise). Target: p10 ≥ 200 px and median ≥ 300 px, for each. This is the number to tune
  "slightly less close" against.
- **Q4 empty frame:** the share of frames with no line inside S below or ahead of the rider. Target ≤ 3 %. The
  critic measured 5–22 % at the closest framing.
- **Q5 liveliness without pumping:** Σ|Δ ln z| per minute between 1.5 and 4, and ≤ 6 zoom direction reversals per minute.

---

## 2. Hit accents: the shake-and-split family

### 2.0 Shared rules

- **Strength curve (absolute, continuous, the same for every song):** e(s) = clamp((s − 0.20)/0.65, 0, 1)^1.4.
  - s = 0.3 → 0.07; s = 0.5 → 0.34; s = 0.6 → 0.51 (the median hit); s = 0.7 → 0.69; s ≥ 0.85 → 1.
  - Every parameter below is a + b·e: every hit gets a visible floor, and nothing has tiers.
  - Since e is not a rank, a song with many strong hits gets many strong accents.
  - Overlapping hits combine as a soft-or, 1 − Π(1 − x_i), or as a vector sum clamped to the stated maximum. Never a plain sum.
- **Clock:** peak on the first output frame ≥ tc, the native contact onset, with no pre-roll. Light then leads sound by
  25–75 ms. That is inside the usual broadcast tolerance (picture early by up to about 45 ms, audio late by up to
  about 125 ms, ITU-R BT.1359), and it matches what the eye sees: the sled touching.
  Decay: g(age) = exp(−age/τ), with τ = τ0·(0.8 + 0.4e). Cut off at 5τ.
- **Impact direction:**
  - n̂ = the struck line's normal **on the rider's side**: n0 = (−sin ang, cos ang); flip it if (R(tc) − pos)·n0 < 0.
  - î = −n̂ is the direction into the line. For a top-side hit it points down the screen; for an underside hit, up.
  - The scale is uniform and there is no rotation, so world directions are screen directions.
  - Note: `drawStamps`/`drawBursts` currently derive "up" from the line direction alone. That ignores which side the rider is on.
  - Store h.n, h.imp, h.e, and h.line (the nearest touched line, already found in `prepare`).
- **Visibility at 60 fps on a phone:**
  - An accent shorter than 4 frames reads as flicker; the two-frame inversion was rejected partly for this.
  - Displacement under about 5 px is invisible: 1080 px spans about 6.5 cm, so 5 px is 0.3 mm.
  - Colour fringes need ≥ 3 px against ink strokes that are about 12 px wide at z = 6.2.
  - Full-frame tone shifts need ≥ 4 % to register, and low-contrast gradients band on YouTube.
- **Gaps:** the gap between hits is p10 0.25–0.35 s and median 0.45–0.67 s. Every accent below is ≥ 95 % gone by 0.25 s.
- **Rule P exemption:** accents sit on top of the rig, so they are exempt from it, within a bound. Total accent
  displacement ≤ 24 px, and return speed ≤ 220 px/s. They must also follow the impact direction (into the line), so
  the jolt agrees with what the rider did.

### 2.1 The accents, ranked by expected owner appeal

#### 1. Impact kick (camera)
**Look.** Shake, but with a direction: the whole picture jolts once **into the struck line** and settles, with no
oscillation. A floor landing dips the frame. A ceiling or underside hit lifts it. A hit on a 30° slope jolts along
the slope's normal. It reads as weight.

**Parameters.**
- Offset δ(t) = î·A·k(age). A = 5 + 17e px (5–22 px).
- k = 1 on the first frame, then exp(−age/τ), with τ0 = 0.075 s (60–90 ms).
- Combine as a vector sum, clamped at 24 px.
- Return speed is at most A/τ ≈ 180 px/s.

**Implementation.** Replace `shakeAt()`'s two sinusoids, about 15 lines. The rider moves with the world, as it does today.

**Theme.** Universal. It is the direct successor of today's shake and the safest replacement.

**Phone.** 22 px is 2 % of the width and is clearly felt. The 5 px floor is just perceptible, which is what a weak hit should be.

**Why it should beat the "catch".** The catch was an underdamped spring on the follow camera, about 2.4 Hz. Its
displacement was spread over 0.4 s. This one is on the very first frame, and its direction is meaningful.

#### 2. Ink pressure (line)
**Look.** The struck rail answers. At contact, the stroke under the sled swells, as if the pen pressed harder, and
"dries" back to its normal width in about 0.1 s. The swell is tapered along the line from the contact point and grows
**only on the far side of the line**, so the edge the rider sits on never moves. With pencil → ink, this is the
moment the ink is laid: the owner's favourite idea gets a pulse.

**Parameters.**
- At z = 6.2, ink width w0 = max(2, 3.2/z)·z ≈ 12 px.
- Extra width Δw = w0·(0.5 + 1.5e)·g, so the peak is 18–36 px. τ0 = 0.09 s.
- Taper: 5 stacked strokes along h.line, centred on the contact point. Stroke j (j = 1..5) has half-length
  L·(1.2 − 0.2j), with L = (50 + 140e)/z u, and width w0 + Δw·j/5. Each one is offset by î·(width − w0)/2, so the
  rider-side edge stays flush.
- Clip to the segment's ends. Optionally, continue onto connected chain segments.
- Colour: ink. For vocal and other sources, the core stroke j = 5 can take the source colour (#2b59d6 / #e0532f).
  That is the only place where colour encodes source, quietly.

**Implementation.** About 30 lines, drawn in world space after `drawLines`, before the rider.

**Theme.** Graphite / pencil and ink. It is the default for the paper look.

**Phone.** It is a local event, 40–200 px long, right where the eye already is. Alone it may be too subtle for the
strongest hits, so pair it with the kick at half strength.

#### 3. Normal split (colour)
**Look.** Today's RGB split, but along the impact normal instead of always horizontal. On white paper the split only
shows as red and cyan fringes on the ink and the rider. On a floor landing, the fringes stack vertically above and
below every stroke: a "thud" in colour.

**Parameters.**
- Split vector d = î·(2 + 12e)·g px (2–14 px). τ0 = 0.06 s.
- R channel at +d, G at 0, B at −d.
- Sleeker variant ("trailing"): R at +d, G at +d/2, B at 0. All of the fringe then falls on the far side of the
  line, behind the impact, and the rider's side stays clean.
- Overscan as today.

**Implementation.** `todayAccents()` with (dx, dy) instead of dx. Change about 10 lines.

**Theme.** Electronic / Los Voltaje. It also belongs in "today, refined".

**Phone.** ≥ 3 px fringes survive YouTube compression on high-contrast ink. Below 2 px, skip the pass entirely, which also saves time.

#### 4. Zoom pulse (camera)
**Look.** A one-frame bump in scale that relaxes, a "thump" felt at the edges of the frame. The pivot is the contact
point, so the struck spot stays nailed in place and the world swells out from it.

**Parameters.**
- z·(1 + (0.012 + 0.038e)·g), so ×1.012 to ×1.05. τ0 = 0.08 s.
- Pivot at contact point P_c: p' = p + (z − z')·(P_c − R).
- The sprite then moves by z(m − 1)·|P_c − R| ≤ 4 px. That is invisible, and it is why the contact point and not the
  frame centre is the pivot.

**Implementation.** About 15 lines in `framing()`/`draw()`.

**Theme.** Clean pop (Lua, porcelain). It also works without any colour.

**Phone.** At ×1.05 on 1920 px, the edges move 48 px. Clearly felt even when looking at the rider.

#### 5. Roll punch (camera)
**Look.** A tiny camera roll toward the leading edge, decaying fast, like a hand-held camera taking the weight. It
pivots on the contact point.

**Parameters.**
- θ = σ·(0.35° + 1.25°e)·g. The sign σ is sign(m̂ × î), where m̂ is the rider's direction of motion: clockwise for a
  rider going right onto a floor.
- τ0 = 0.09 s.
- At 1.6° the corners move about 27 px.
- The sprite moves ≤ 2 px. Gravity is "tilted" for under 0.15 s, which is too short to read as a fake slope.

**Implementation.** Rotate the world transform about the screen position of P_c, about 12 lines. The rider painter
needs the same rotation: draw it into the overlay and rotate the drawImage.

**Theme.** Rock, energetic, hand-held. A good partner for the kick, at 0.6 of its strength.

**Phone.** The roll is felt at the frame's edges, not at the rider. That makes it useful when the rider is small, in D2 and D6 wides.

#### 6. Line slice (geometry glitch)
**Look.** For 3–5 frames, the picture is cut along the struck line's extension. The far half-plane, beyond the line
and away from the rider, slips sideways along the line, opposite to the rider's motion, then snaps back. The sled sits
exactly on the seam, and the rider's half never moves. It is a glitch that *knows the geometry*: sleek, technical,
not a sticker.

**Parameters.**
- Slip d = (6 + 26e)·g px along −m̂_tangent. τ0 = 0.04 s (32–48 ms, so gone in about 5 frames).
- Implementation:
  - Copy the canvas to `chan[0]`.
  - Build the half-plane polygon: P_c ± t̂·4000, then the same two points + î·4000.
  - Clip to it, fill with paper, and drawImage the copy offset by d.
  - About 25 lines.
- Optional seam: a 1.5 px line in the paper colour along the cut, at alpha g, so the edge reads as crisp.

**Theme.** Electronic / Voltage (LOS). Too mechanical for Petrunko.

**Phone.** Pencil lines and the music band below the cut jump by up to 32 px, which is very legible. Keep it off the
weakest hits (e < 0.15 → d < 10 px reads as an error, not a glitch). The floor can be a gate here, because it is a
property of the look, not a ranking.

#### 7. Floor thump (exposure, directional)
**Look.** Light pressure from the impact side: the frame edge in direction î darkens briefly, through a soft gradient
covering 45 % of the frame, as if the floor took the blow. Underside hits darken the top edge. It is the dark cousin of
today's white flash, and on white paper it is far more visible than a flash, because white on white barely shows.

**Parameters.**
- A linear gradient from the frame edge along î to 0.45 of the extent, ink colour, with α = (0.04 + 0.12e)·g.
- τ0 = 0.11 s.
- Add 1 px of noise dither, or keep α ≥ 0.05 at the edge, against YouTube banding.

**Implementation.** About 15 lines in screen space after everything except the UI-safe band.

**Theme.** Bass-heavy, dark and moody. It pairs with porcelain paper. The bottom-edge version mostly lands in the
lower music band (0.55–0.85 H), which is visible above the comment bubble.

**Phone.** 12 % darkening over a large area reads even on a dim phone. It is subtle under 5 %.

**Rejected after thought.** An "impact echo" (two ghost copies trailing behind the impact). At 60 fps on a phone it
reads as blur and as a compression smear, not as energy.

### 2.2 Bundles by theme (what to show the owner)

- **Today, refined:** kick + normal split + today's white flash, keyed at tc (α = 0.10 + 0.18e, τ0 = 0.05). Same spirit, but every part has a direction. Most likely pick.
- **Graphite:** ink pressure + kick at 0.5 + no colour. For pencil → ink.
- **Voltage:** normal split ("trailing") + line slice + kick at 0.6. LOS.
- **Porcelain:** zoom pulse + ink pressure. Lua, clean pop.
- **Weight:** floor thump + roll punch + kick at 0.5. Bass sections or darker songs.

---

## 3. What I'd build first

1. The fake-motion metric and the truthful rig with D1 + D5. Prove zero events on all three songs, then show the owner Petrunko 22.4 and 45.6 against today's lead camera.
2. Add D2 + D4 together. "Fly wide, land on the hit, cut in" is the move most likely to make the videos feel directed.
3. Add D6 on Lua QUIET and PHRASE GAP.
4. Accents: build "Today, refined" and "Graphite" first. Both share the normal and e(s) plumbing, so the rest are 15–30 lines each.
