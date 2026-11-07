# Final fresh-eyes review: the morning experience (2026-11-03)

How I tested it: Playwright at 390×844, DPR 3, mobile and touch, muted (`walk.mjs`, `films.mjs`). I walked morning → all 7 questions (every option captured at the loop start and at +1.5 s and +3 s) → films player (play, switch versions, switch song) → free lab. I pulled film frames with ffmpeg at Petrunko 22.35/22.42 (strongest hit), Petrunko 30, Lua 0.4 (opening), Lua 25, LOS 21, LOS 48.2 and LOS 56.8 (ending), and measured luma around the flash.
- Screenshots: `shots/` (per-question montages `shots/m-q1..7.png`, ink and stamp crops `shots/z-*.png`).
- Film montages: `frames/M-*.png` (order: today, ride, catch, score, iris, sections, together), plus `frames/M-overture.png` and `frames/flash-strip.png`.

There were no page errors and no HTTP failures. All 21 films are 1080×1920 at 60 fps, and their audio starts at 0 like the shipped films (shipped ones are only ~0.5 s longer, a silent tail). Switching versions in the player keeps the time and playback state. This part works.

## 1. Broken, confusing or misleading (most important first)

1. **Q7 tells the owner to "tap 'Ending'", but there is no Ending button.** In question mode, `renderUI()` returns into `renderQuestion()` before it fills `#moments`, so the row is empty on every question. Playwright confirms `moments=[]` for Q1–Q7. The CSS rule `body.qmode #moments .moment:not(:first-child):not(:last-child)` shows the intent was to keep Opening and Ending, but nothing is ever rendered. As a result, half of Q7 (the pull-back ending) can't be seen inside the flow.
2. **Q7's options are not "everything else held constant".** "No" is `ink: 'inking'`. An owner who answered "All ink" in Q5 still sees pencil in both Q7 options, and nothing says so. This biases Q7 and mixes it into Q5.
3. **Copying answers is fragile on a real phone.** The owner previously reached the server through the LAN IP (`10.77.77.1:8770`). Plain HTTP on a LAN IP is not a secure context, so `navigator.clipboard` is undefined and the fallback is `select()` on a **readonly** textarea, which iOS often ignores. On top of that, the done screen makes **"Start again"** the black primary button and "Copy answers" a secondary pill. The one action that matters looks like the least important one.
4. **The morning link is `127.0.0.1`.** That won't open on a phone. The morning page's own links are root-relative, so this is fine once the owner is given the LAN URL, but make sure the hand-off message uses the LAN address.
5. **Q6 (sections) barely differs within its loop.** Petrunko 20.2–24.2: at loop start "Steady" and "Camera breathes" are identical frames. After that the frame is just the rider in empty white in all three options; the only visible change is the rider getting a little smaller and the paper tint stepping. The owner will struggle to judge "camera breathes" from this 4 s window. A longer or denser window (crossing a sparse→dense boundary with track in view) would be fairer.
6. **Q4's flash only exists in motion,** and it is 2 frames (33 ms at 60 fps). Fine on a phone at 60 Hz, but if the owner pauses or scrubs they will see two identical options. The why-text should say "watch it play".
7. Minor:
   - On Q1–Q7 the question title sits below the picture and the option chips, so on a phone with Safari chrome the owner sees "A · Today / B · Closer" before knowing what is being asked.
   - The "My pick" letters A–F don't repeat the option names, so after swiping the owner must remember which letter was which.
   - The keyboard hint is still shown in this emulation.

## 2. Artistic read, as the owner might see it

**What looks strong**
- **Closer, look-ahead framing (Ride first).** It is the clearest single improvement. The rider reads as a character rather than a speck, the line weight is confident, and the view between accents is exactly the clean, crisp resting state the owner asked for. Q1 makes this case well.
- **Iris below.** It is the most "designed" of the lower bands: a dark lead contour over fading lavender history. It is calm, clearly not a track line, and inside the Shorts safe area. It honours the owner's stated love of Iris's flowing history.
- **The film player itself.** Same-moment switching across 7 versions is a great review tool.

**What looks weak or cheap**
- **The frame is emptier than today's.** This is the big one. The brief's original problem was the empty vertical frame. In Ride, Catch and Sections the lower ~55% of every frame is blank white, and in Lua 25 / Petrunko 30 / LOS 56.8 the rider often floats alone with no line in view. Next to "Today", whose bars at least fill the space, the new films look unfinished on a phone, more like a debug view than a finished Short. The ideas are good, but the films as cut make the frame-filling problem worse, not better. Only Iris and Score put anything below the rider, and Score barely does.
- **Pencil → ink renders as Morse code.** Touched segments are drawn thicker than pencil and with round caps, but only the segments actually contacted get inked. The result is a chain of black sausages over a grey line (`shots/z-ink.png`, `frames/lt-0.8.png`, `frames/le-54.png`). It reads as a rendering glitch, not as "the music touched here". At the whole-course ending it becomes a dotted bead chain (`frames/le-57.3.png`). That is an interesting image, but only by accident.
- **The overture opening is invisible.** At t = 0 the whole course is a ~1 px grey hairline crack, the rider isn't visible, and the plunge is over in under a second. A viewer swiping in on Shorts sees a near-blank white frame for the first second, which is the worst possible second to waste. The concept is lovely; this execution doesn't sell it.
- **Score** reads like a sparse grey barcode with a tiny triangle cursor. Grey (pencil) bars against white have very little presence. Without the explanation, a reviewer won't understand it, and the owner already pushed back on things that are "not clear".
- **Stamp and burst accents.** At phone size the stamp is a pair of thin grey ticks plus a grey smear on the line (`shots/z-zoom.png`). It looks like a smudge, not a deliberate accent. Burst is comic-book speed lines ("|//"), which feels cheap next to the native artwork.
- **The Catch flash** is a full-frame inversion to black (mean luma 247 → 2 → 246 over 2 frames, `frames/flash-strip.png`). It is bold, which the owner allows, but on a white film a pure black 33 ms frame can be read as a dropped frame or decoder glitch. Six per song is OK for photosensitivity, but I'd show it to the owner as "deliberately bold", not as the default.
- **Sections paper.** The blue-grey porcelain tint covers the whole frame for long stretches. It isn't yellow, but it is the same "tinted paper" move the owner was lukewarm about. The stepping is also hard to perceive as musical.

**Embarrassment risk in front of a demanding reviewer:** "Together" opens on a near-blank frame, inks the track as dashes, and ends on a bead chain, while the lower band is the only thing filling the space. Against "Today" it can look like a regression. I would lead with Ride first + Iris as the strong pairing, and present Together as an experiment.

## 3. Five small fixes worth doing before the owner wakes up

1. **Q7 Ending.** In `renderQuestion()`, when `Q.id === 'ends'`, fill `#moments` with the existing `moments()` Opening and Ending chips (the CSS already hides the rest). Otherwise reword the why-text so it doesn't mention a button. Also make "No" plain ink, or say "both in pencil" in the why-text.
2. **Answers survive a phone.**
   - Make "Copy answers" the primary button and "Start again" secondary.
   - Drop `readonly` from `#qsummary` (or select it with `setSelectionRange`) and try `document.execCommand('copy')` before giving up.
   - Give the owner the LAN URL, not 127.0.0.1.
3. **Ink without dashes.** Draw ink at the same width as pencil (or pencil at the ink width), with `lineCap = 'butt'` for the ink pass. Also ink a segment if both of its endpoint neighbours are inked, to close one-segment gaps. This is a one-line width change plus a small neighbour pass in `prepare()`, and it removes the most "broken-looking" artifact in Q5, Q7 and Together. Re-render only the Together films if time allows.
4. **Overture readability.** Give the pencil a minimum on-screen width of about 2.5 px at 1080, and hold the whole-course view for about 0.5 s before the plunge, so the opening frame isn't blank.
5. **Honest framing on the morning page.** Add one line saying the new treatments are deliberately sparse and the lower band (Iris or Score) is what fills the frame. Suggest "Today vs Ride first, then Iris below" as the first comparison, so the owner judges the strongest pairing first rather than the empty ones.
