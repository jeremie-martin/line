# Round-6 review (lab.js / cam.js / fourup.sh / round5 copy)

Scripts and evidence are in this folder: `strengths.mjs`, `placedump.mjs` (copy of camdump writing `pos-<song>.json` here),
`analyse.mjs`, `episodes.mjs`, `kicks.mjs`, `shots.mjs`, `titlecross.mjs`, and renders in `shots/`.
Nothing outside this folder was modified.

## Findings, by severity

### 1. Medium-high: `round5/` is not a frozen round 5 (confirmed by running)
`round5/lab.js` and `round5/cam.js` were copied from the working tree partway through the round-6 edits. They contain the round-6
`hitZoom`, recoil, `titleCut`, the new title wrap, and the `high`/`dive` placements. They still have the round-5 QUESTIONS,
PRESETS and `STORE = 'concept-lab-answers-r5'` (round5/lab.js:112).
- Scenario: someone opens `round5/` to see what was shown in round 5. Lagoon's title comes out as two lines ("LET THE / WORLD BURN",
  `shots/burn-lagoon-none-10-round5.png`); round 5 put one word on each line. The chips also offer punch/recoil/dive, which round 5 did not have.
- Camera, hits and inking in the round-5 presets do render the same. The page loads with no console errors, and every path in it is
  correctly `../` (data, dist, intensity/pairs.json, fourup/r5, round1–4). STORE `r5` doesn't collide with the live `r6`; it
  reads the owner's real round-5 answers, which is fine.
- Fix: rebuild the copy from `git show HEAD:generated/concept-lab/{lab.js,cam.js,…}`, since HEAD is the round-5 state, then apply the same
  three path patches.

### 2. Medium: the `titleCut` rim cuts a gap in the pencil line next to the rider (confirmed by running)
lab.js:379 `cut()` strokes a 7 px paper rim on each side of every inked segment. It runs after the pencil pass (lab.js:375–376), so it
erases the pencil at the ink front. That front is always at the rider.
- Evidence: comparing `title` against `titleCut` renders gives a 7–10 px gap just ahead of the rider in 9/25 Lua frames and 10/18 Los frames
  (`shots/rimzoom.png`: left is title, right is titleCut). This contradicts "on bare paper the rim is invisible" (the comment at
  lab.js:377–378 and the owner text).
- By reading: the rim would also cut through anything drawn before the lines. That includes the lower band (`drawSpectrum`, lab.js:539,
  which the title question uses with `redbars`). I saw no inked line reach the band in the sampled frames.
- Fix: clip the rim to the title's screen box. Record the text rectangle in `drawTop` and run `ctx.save(); clip(rect in world
  coords); stroke; restore`. Or draw the rim before the pencil pass. The clip is the cleaner fix, because it makes the rim exist only where it is meant to show.

### 3. Medium: `dive` is not specific to dives (confirmed by running)
cam.js:181/188: `fast = ryFast·reach(max(0, vy − vs − 100), 160)`, where vy is smoothed with σ = 2 frames (0.05 s).
- Per song, with base 6.2 and a steady tide, I counted 9–12 episodes per minute where the rider drops more than 4 % H below `high`. Between 55 % and 80 % of them
  start airborne, i.e. the falling half of ordinary jumps. Los has 12 episodes (`episodes.mjs`).
- The named dive at Los 28.5 s: at 28.5 s, dive = high (0.381 vs 0.383 H), because vy = 179 ≈ vs = 178. The drop comes at 28.6–29.1 s and
  peaks at +6.5 % H (0.470 vs 0.405 at 29.05 s). The biggest drop in Los is at 10.25 s (9.5 %).
- "Up to ~10 %": the maximum dive−high gap is 7.6–12.5 % (Tomada 57.25 s: 12.5 %; Lua 27.25 s: 11 %). The fast term peaks at 0.11–0.14 H
  (the ceiling is 0.2).
- Fix, if a dive is meant to be rare: gate on excess sustained over about 0.3 s (smooth the excess, not vy, with σ ≈ 0.15 s), or raise the deadband.
  Either way, restate the claims (frequency; 6–12 %).

### 4. Low-medium: the recoil is not "one cycle" (confirmed by computing)
lab.js:308: `30·w²·e^(−age/0.13)·sin(2π·5·age)`. At e = 1 the lobes are +20.4, −9.5, +4.4, −2.0, +0.9 px (`kicks.mjs`), so
about 2½ cycles stay above 1 px. The Held kick has ended by 0.25 s, so the third lobe shows alone. The owner text says "rebounds once, past rest, and settles.
One cycle, not a shake."
- Fix: τ ≈ 0.06 s (third lobe < 1 px), or window the sine to one period with a smooth taper.

### 5. Low-medium: the Coma moment runs past the song's end, and the strongest hits sit inside the ending overview (confirmed)
- lab.js `big` question, moment `['Coma 58 s', 57.3, 'coma']`, len 4: 57.3 + 4 = 61.3 > duration 59.5. In `tick()` (lab.js:675), the loop
  bound is never reached, `seconds >= S.duration` pauses, and the moment plays 2.2 s once instead of looping.
  Fix: `loop = Math.min(at, S.duration - Q.len)`, or move the moment to 55.5.
- films6 uses the `paper` preset, which has `ends: 'overture'`. Coma's strongest hit (58.1 s) lands at u ≈ 0.33 of the ending zoom-out, and
  Tomada's (57–58 s) and Batidão's (58.65 s) also fall in the ending. There, the punch scales the whole-course view and the kick/split shake it
  (`shots/sheet3.png`). So the coma h-* films don't show what the question means by "Coma 58 s".
  Optional fix: scale `hitZoom` and the recoil by `(1 − v.over)`.

### 6. Low: the `cam` question's secondary moments barely contain a drop (confirmed)
'Petrunko 30 s' (loop 29–34) has only a 4 % drop at 33.2–34.1 s. 'Lua 20 s' (19–24) has one 0.1 s drop of 4 % and one starting at 23.7 s.
Stronger moments: Lua 26.8–28.6 s (11 %), Petrunko 39.9–42.2 s (8 %), Lua 29.3–31.1 s (8 %).

### 7. Low: 'dive' changes more than its label says (by running and reading)
- `dive.ry = 0.05` instead of 0.11, so normal vertical motion moves the rider less. On climbs the rider rises less: p5 is 0.34 H vs 0.31 H for `high`.
  The median is the same as `high`'s (0.37 vs 0.38). The label "Tamed, higher, dives drop" hides this.
- The comment "a 2 s average" (cam.js:180) is a Gaussian with σ = 2 s and kernel radius 5 s (cam.js:21), centred. The "stretch's slope" therefore
  includes up to 5 s of the future.

### 8. Low, latent: the afterimage ignores the punch (by reading)
lab.js:545 `drawGhosts(sheet, t, v, hc, k, th)` uses the unpunched `v`, while lines and rider use `vz`. No bundle combines `ghost` and `punch`
today, so this can't be reached yet. If one does, the afterimage will sit off its world position by up to 4.5 % about the rider. Fix: pass `vz`.

### 9. Low: stale text (by reading)
- README.md:1, 18 still say round 5, "Five questions", `concept-lab-answers-r5`, and don't mention `round5/` (line 7 lists only round1–4) or films6.
- The live `morning.html:53` still says "Five short questions" and links `./?q=1`, which now opens the three round-6 questions.
- "Invisible below 0.5" (BUNDLES comment and question text): at e = 0.5 the punch is 0.21 % (about 2.8 px at the frame corner) and the recoil 1.4 px.
  That is close enough, but "barely visible" would be accurate.
- FYI: Los's strongest hit is e = 0.91, so its punch peaks at 2.95 %, not 4.5 %. This is consistent with "a calm song gets less".

## Checked and correct

- **Punch transform (algebra, exact):** `v.rx = v.ax + (R.x − v.x)·z` (bookend, lab.js:248). So with `x = R.x, ax = rx`, at zp = 1 the
  transform is identical to the unpunched one, and there is no jump at onset or end (the `zp === 1` shortcut is a pure
  optimisation). With zp ≠ 1, R maps to `rx + hc` in both the world transform and `riderCamera(vz)`, so the rider's screen point
  stays fixed and the sprite scales about it. This also holds during the bookends, where v already has that form. `visibleLines(cc)` culls with
  the punched zoom, which is correct.
- **Recoil cap 36 → 56:** across 7 songs, the Held kick sum never exceeds 36 (the hits never overlap within their hold windows), so the
  larger cap never changes Held's kick. At e = 1 the first recoil lobe plus the kick is about 56.4, capped at 56.
- **Strength numbers:** w² = e^4.4 gives 1 at e = 1 and 0.208 at e = 0.7, as claimed. Petrunko, Lua, Coma and Tomada all reach e = 1.
- **'high':** exactly 5.0 % H above Tamed on all 7 songs (median, p5, p95). The Tamed figures check out: median 0.42–0.44 H, max 0.456–0.465 H.
- **Title:** the parenthetical strip works ("MONTAGEM TOMADA"). Four words split evenly ("LET THE / WORLD BURN"). A single word stays on one
  line, and the font shrinks only if it is wider than 62 % W. Colour is `th.ink`, so night uses nightInk. Alpha is (1 − over)². `cut` uses `th.bg`, which is exactly the
  colour filled behind it in whisper, night and xray. In Lua's 8–11 s loop the line crosses the title at 8.55–8.75 s and 9.95–10.15 s
  (`shots/sheet2.png`: Lagoon and Black both read as "in front"). That is only about 0.4 s of the 3 s loop.
- **Question moments exist:** Petrunko 22.4 s (e = 1, tied with 52.4 s), Tomada 43.2 s, Los 48.25 s, Coma 58.1 s.
- **fourup.sh:** `DIR` defaults to films5, so nothing changes for existing calls.
- FYI: `films6.out` records an earlier terminated run (FAILED petrunko p-high/p-dive after "Terminated"), which a rerun should fill in.
