# Visual direction for the finished videos — brief (2026-11-03)

## The project
Line Rider tracks are compiled automatically from hand-authored musical specifications:
the rider's hits land on chosen musical beats with chosen strengths, and sections of the
song ask for more or less air and speed. The compiler and the specs are mature and the
owner is very happy with them. The final step is the **visual presentation of the
finished video**: vertical 1080×1920, 60 fps, meant for YouTube Shorts / phones.
Nobody else makes this kind of thing, so there are no references to copy.

## Where the visuals stand
- The production look ("Approved"): white background, the native black Line Rider lines
  and rider, a large rainbow frequency-bar spectrum in the lower third (mirrored), impact
  camera shake + RGB split + white flash on strong measured hits, a faint static vignette.
- An earlier agent ran four rounds of style studies (34 treatments). Almost all were
  re-skins of the same composition: tint the background, redraw the bar chart (brackets,
  stems, contours, dots, ribbons), change the hit accent. See the stills in
  `generated/style-lab-v5/catalog/*.png` (same moment, many treatments).
- Owner's own words on that work are in `2026-11-02-style-post-processing-context.md`
  (repo root), especially lines 906–1012. Summary of the owner's taste:
  - prefers light/bright themes, but not "light = yellow/warm paper";
  - wants a clean, readable view between accents (disliked persistent shadows, halos,
    blurry atmospheric colour fields, RGB offsets that linger, decorative ellipses);
    accents may be bold when they happen;
  - liked: Graphite's crispness, the Cobalt and "tuning fork" spectra, Iris's flowing
    history of spectra, mirrored spectra; disliked a spectrum drawn as a single line
    because the rider "rides lines" (confusing);
  - the spectrum is NOT sacred: it was added only to fill the empty top/bottom of the
    vertical frame;
  - no text on the video for now;
  - mindful of Shorts UI: bottom ~15% and right ~12% are covered by UI on phones.

## Data available for every ride (all aligned in seconds; ride frame = t × 40)
- Track: ~5,000 straight line segments (only about half are ever touched; the rest are
  guide rails / paired rails).
- Rider pose every physics frame (40 fps), 10 named body/sled points; which lines are in
  contact at each frame.
- Measured hits: time, strength 0–1 (typically 0.4–0.8), and the musical source the spec
  author assigned (drums / vocals / bass / other instrument).
- Spec sections with names (e.g. DRUM BUILD, ROLL, SUSPEND, RETURN, DECAY) and requested
  air and speed per section.
- Audio, a 56-band spectrum at 30 fps, separated stems and vocal evidence in
  `productions/<song>/`.

## Facts discovered tonight
- In today's video the rider is about 1/10 of the frame width; the frame is mostly empty.
- At a closer zoom (rider ~1/6 of width) the rider crosses roughly **three screen widths
  per second**. Anything anchored in the world behind it (marks, ghosts, trails) leaves
  the frame almost instantly. The rider is airborne most of the time and touches lines
  mainly at the hits.
- A live browser "concept lab" exists: `http://127.0.0.1:8770/generated/concept-lab/`
  (params `?song=petrunko|lua|los&c=<preset>&t=<seconds>`). It draws the real ride with
  the native artwork and replay. Stills: `node generated/concept-lab/shoot.mjs
  song=los c=<preset> t=20,33 out=DIR [m=frame:wide,ink:inking]` (1080×1920 PNGs).
  Montage with ImageMagick `montage` to look at several at once.

## Rules
- Do not spawn sub-agents. Do not edit or commit tracked repository files.
- Write only inside `generated/concept-lab/agents/<your-name>/`.
- Audio stays muted; there is no listening review.
