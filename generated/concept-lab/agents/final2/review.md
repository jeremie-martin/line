# Round 2 review: independent pass at phone size (2026-11-03)

Method: I walked the 8 questions at 390×844 in Chromium (muted, touch). I tried every option and every moment chip, and tested Copy with and without clipboard permission. I took lab stills of all 9 presets on Petrunko, Los Voltaje and Lua, and made 60 fps strips at hits, the night cut, the locked-off shots and the bookends. I dumped zoom curves for 5 directors on 3 songs and ran `camcheck.mjs` on Petrunko, Lua and No Batidão. I ran ffprobe on all 27 films and pulled frames with ffmpeg. Evidence is in `agents/final2/shots/` (file names below). The scripts are `walk.mjs`, `stills.mjs`, `zdump.mjs`, `player.mjs` and `copy.mjs`.

**Verdict:** nothing is broken. There were no page errors, no failed requests and no horizontal overflow. Every chip loads its song and time, Copy works, and all 27 films decode. The weak points are what the owner will *see in the loops*: empty white frames, options that look the same, and two ideas (pre-ink, look-back) that mostly don't show up on screen.

## Blockers
None in the strict sense. Two problems come close, because they can make a question unanswerable:

1. **Q2 ("How close") can't really be judged.**
   - B–E differ by about 7 % per step. Rider bounding box at Lua 28.5 s: 165 → 176 → 194 → 208 px. Side by side on a phone they look identical (`size-lua-28.5.png`, `q2-opts.png`).
   - The 27–32 s loop is about 2 s of the rider alone on white. The ink only appears at about 32 s (`q2loop.png`), so the "watch the line turn to ink" premise isn't on screen.
   - Fix: offer 3 sizes (Today, 6.2, 7.3), and use a loop where the rider is on the line the whole time.
2. **"Next question" doesn't scroll back up.** `lab.js` never calls `scrollTo`. The Next button sits about 1,100–1,500 px down the page, so every new question opens with its picture scrolled off the top (`q7-view.png`). The owner will hit this 7 times. Fix: `scrollTo(0,0)` in `goQuestion`.

## Should-fix
3. **Question texts are too long for a phone.** Q1, Q3 and Q7 are about 80 words each (Q1 79, Q3 80, Q7 79). On a phone the text and the stage can't be on screen together, so he reads, scrolls up, watches, then scrolls down again. Keep each to one or two sentences, and put the per-option explanation in the `#line` text when that option is tapped. The moment chips sit below the answer box and Next, about 1,100–1,300 px down, where he'll likely miss them. Move them directly under the option chips.
4. **Q7's "Locked-off shots" option changes two things.** `tripod` = breathe + locked-off, so the camera also breathes for the whole loop, unlike "Without". Also, on Lua and Los the locked-off shots fall at 36.9 / 49.65 s and 40.5 / 56.5 s. Neither the "Lua quiet" chip (19.5 s) nor the "Los Voltaje" chip (5.5 s) contains a shot. Only the Petrunko loop (22.4 s) shows one.
5. **One of the two locked-off shots is wasted on the ending** on Lua (49.65 s) and Los (56.52 s). It runs straight into the closing zoom-out (`tri-lua.png`, `tri-los.png`). The other shots go very wide: zoom 2.1–2.7 against 6.2 at home, so the rider is a speck (`tri-detail.png`). Exclude the last section, and floor the zoom at about 0.6× home.
6. **Look-back can show an empty white frame.** On Lua at 13.7–14.1 s it fires mid-flight. It pulls out to zoom 2.8 and shows only a tiny rider, with no ink behind it and no pencil ahead (`lua-director-lookback.png`, `lb-all.png` first panel). This is inside the Q3 loop for both "Looks back" and "Director". On Petrunko and No Batidão it never fires: zoom travel is 0, so there it is identical to Steady (and the Q3 "Petrunko drop" chip shows no difference). At Lua 23.5 s and Los 9.5 s it works as intended. Fix: only fire it when there is line on screen.
7. **The landing pre-ink is mostly invisible.** The landing point enters the picture only 0.18–0.30 s before contact (camcheck `landing-lead`, every director, even `flight`), but the pre-ink window is 0.6 s. At Petrunko 24.2–25.2 s the pre-ink appears only in the last 2–3 frames (`preink.png`). Effects he can't see are waste. Either make "frames each jump" actually show the landing (lead ≥ 0.6 s), or drop the option. The `flight` director's text ("so the landing shows") is not borne out by the metric (0.28 vs 0.23 for Steady).
8. **Weight's "dark edge" is a soft gray gradient over half the frame.** It shows 8-bit banding when contrast is stretched, and a residue from the previous hit is still visible before the next one (`weight-pair-contrast.png`, row 2 of `hitstrips-los.png`). This is exactly the "banded vignette / a bit blurry" class he rejected, and YouTube will band it more. Give it a crisp edge or drop it.
9. **Every film is about 0.5 s short, and the closing hold is cut.**
   - The cause is `render.mjs`: it caps at 60 s and uses `-shortest`, and the song MP3s are 0.5 s shorter than the rides.
   - The result: Lua 3120/3150 frames, Los 3444/3474, Burn and Coma 3540/3570, Batidão 3570/3600. Petrunko 3600 is cut from 60.5 s by the cap.
   - Today's films run 52.54 / 57.96 / 60.54 s. The finished ending stroke (Lua 52.0–52.5 s, `close-lua.png`) never holds.
   - Fix: pad the audio (`-af apad`), drop `-shortest`, and lift the 60 s cap.
10. **The player opens on "All treatments"** (8 chips) and Today, while the morning page says "Start with the Start here group" (`player.png`). Reorder the groups in `films2.json` so `start` comes first. On the phone the video starts about 575 px down.
11. **Bands on night.** Iris on the night background is dark gray lines on near-black, and almost invisible (`los46-detail.png`, `pre-petrunko-24.5.png`). The night pencil lines are also very low contrast.

## Nice-to-have
- The "Loop 4 s" button stays labelled 4 s even when a question loops 3, 5, 6 or 11 s. Toggling it resets the loop to 4 s at the current time.
- Hits that are probably too subtle on a phone:
  - Porcelain's zoom pulse is about +5 % for about 0.1 s (bounding box 514→538 px at Los 46.15 s).
  - Plucked line changes 0.3 % of pixels.
  - Given "the catch was invisible", expect these to read as nothing.
- Hits that are clearly visible: graphite ink pressure, refined, voltage, and Weight's kick.
- Graphite's ink pressure tints the struck rail in the source colour (blue for vocals, about 0.3 s, `batidao-blue-strip.png`). That is surprising under a name that suggests monochrome.
- The night transition is a 2-frame dissolve through mid-gray, not a hard cut (`nightcut.png`). It's fine at 60 fps, but "a cut" isn't literally true.
- The opening overview puts the course in the top third with a tiny ringed rider at the left edge (about 7 % in, near the Shorts crop) (`pg-ends.png`, `open-lua.png`).

## Camera (Q3)
- No fake motion under their own measure on Petrunko, Lua or Batidão, for any director.
- Cuts are ×1.30–1.40 and fall on hits or downbeats.
- `flight` holds 4.46 (wide) almost all the time, rather than pumping. Petrunko 3–9 s is a flat 4.5.
- `director` on Lua swings 8.1 → 2.8 → 8.1 in about 2 s (13.5–15.5 s). That is the most jarring move I found, and it's the empty look-back in item 6.
- `build` is gentle: 5.9–7.0, under 1 log-unit/s.
- I found nothing that looks like the camera faking rider motion. What does stand out is the composition: the rider sits high and left (about 30 % from the top), with large empty white below during flights in every preset.

## Films
- All 27 are 1080×1920 at 60 fps, with AAC audio. They decode fully apart from the 0.5 s truncation in item 9.
- The Petrunko Graphite film at 20.45 s matches the lab still pixel-for-pixel by eye (`film-vs-lab.png`).
- The other-song films (Coma, Burn, Batidão) look clean at 2/12/25/38/50/58.5 s (`othersongs.png`).

## Taste
- **Cut before he sees it:**
  - Plucked line and Porcelain's pulse as separate hit options. They're near-invisible; fold Porcelain into Graphite.
  - Cobalt and Score from Q5 (he already called the score "cheap").
  - The pre-ink option, until the camera shows landings.
  - Q2 down to 3 sizes.
  - Q3 has 7 options plus Director. Drop "Leans" (it isn't distinguishable in the loop) and make Director the combined option.
- **Single most valuable improvement:** fix how flights are framed. Long flights are where this round fails visually: rider alone on white at Petrunko 23–25 s and Lua 27–29 s, the empty look-back, and the invisible pre-ink. Pull out early enough that the landing (or the ink just ridden) is always in frame, with a landing lead of at least 0.6 s, still under Rule Z. That one change fixes empty frames, makes pre-ink and look-back meaningful, and fills the vertical frame the owner liked.
