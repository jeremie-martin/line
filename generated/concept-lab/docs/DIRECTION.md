# The visual direction: where we are, where we're going

*Written 7 November 2026, after round 20; production updated 8 November. The owner reviews; Claude builds. This is the document to read first.*

## In one paragraph

The Line Rider videos now have a settled first version of their visual language (v1), arrived at over twenty review rounds. Round 20 showed twelve complete themes built on it, all on one song (Circus Minimus). The owner called it "such a massive success… the coolest thing I have ever seen". The direction from here is a **golden set of hand-crafted themes**, perhaps 18–32 of them, rather than random generation. Each theme is a deliberate combination of a palette, a band, a top element, a line mode and a drop treatment, all built on the same v1 camera, line and hits. The work ahead is mostly refinement and documentation, then growing the set. Since 8 November the lab's renderer is production's: every video is drawn by the same code the owner reviews here.

## Where we are

**The settled v1** (`V1` in `scripts/video/look.js`; the reasons per piece are in `LEDGER.md`):
- **Camera:** "Follows direction": the rider's height follows the slope it rides and never climbs on screen while descending. 15 % closer, steady zoom, the whole course at both ends.
- **Line:** pencil → ink, inked as the rider passes. Whole rail and all ink are alternatives.
- **Band:** low-middle, bars with the loudest in red. Fork, Iris and Three colours stay in the pool.
- **Hits:** driven only by what the ride actually did, each hit on its own, with no ceilings.
  - **No camera motion, but on strong hits:** the shake (the frame knocked along the hit) only from strength 0.6, reaching 24 px at 0.85 (R26). The clarity was "a complete game changer" (R25).
  - **Split:** halfway between sideways and the hit's direction, starting slowly from strength 0.3. It covers the whole picture with its zoom pulse, a little less on the title.
  - **Colour boost:** what is drawn on the paper gets more saturated and contrasted for an instant; the paper does not change. It replaced the flash (R24–R26).
- **Colour:** palettes from Sanzo Wada's *Dictionary of Color Combinations*, plus our own. A tiered library holds about 15 favourites and 27 keepers.
- **Top of the frame:** an optional title, or a sun where it fits. Night or a scheme switch at a hand-placed drop.

**The demo:** twelve themes on Circus Minimus (`round20.html`, `fourup/r20/circus-themes.mp4`). They're the `THEMES` of `scripts/video/look.js`, explained in `docs/THEME-CRAFT.md`.

**The rides:** recompiled with the current compiler. Seven lab songs plus Circus Minimus, which uses its latest spec, voice-drums.

## Where we want to go

1. **A golden set of themes.** The owner: "perhaps this idea of randomly generating stuff may not be necessary… if we have this set of golden 18 or 24 or 32 themes… we should be able to easily think about some new theme, learning from how to build a theme in the first place." This simplifies the direction layer a lot. A video picks a theme from the set, perhaps with weights or hand hints, instead of composing pieces at random. `docs/THEME-CRAFT.md` is the start of that craft.
2. **Keep refining v1**, methodically and without rushing. The open items are in `LEDGER.md`:
   - where Night ends on each song;
   - zoom per song.
3. **Drops from the spec, by hand.** A drop cue is read from the song's spec sections and placed by hand, never detected. Circus Minimus is the example: Night runs from the hook's first impact (38.5 s) to the re-entry hit (51.3 s).
4. **Whole films, regularly.** Round 20 proved the point: after many rounds of tuning on short loops, seeing whole films together is where the work is judged.
5. **Later:** per-song hint sheets, variety across uploads, and the jolt to 0 (the compiler's stage 4 of `TIMING-DESIGN.md`; timing itself is settled, R23). The production port is done (8 November): `npm run video -- --look=THEME`.

## How we work

These principles were learned over twenty rounds; `LEDGER.md` has the full list.
- **Separate idea, driver and execution.** Rejecting an execution is not rejecting the idea.
- **Comparisons go in the lab's switcher:** labelled, one variable at a time, at the owner's moments. Multi-panel 4K films are for showing finished looks.
- **Fair comparisons:** match the amounts, otherwise the bigger effect wins.
- **Curves before motion** when tuning a response.
- **Ask when a remark is ambiguous.** Three rounds were lost to one misheard word ("less impact" meant the title, not the shake).
- **One source of truth** (`scripts/video/look.js`, drawn by `picture.js` for the lab and production alike), a current-state ledger, verbatim answers archived (`docs/owner-answers/`). Cleanups keep the picture byte-identical.
- **Commit and push always.**

## Where things are

| What | Where |
|---|---|
| The defaults (v1), the themes, every option | `scripts/video/look.js` |
| The picture itself (camera, hits, band, title…) | `scripts/video/picture.js`, `camera.js` |
| Every piece: status, the owner's words, open items | `LEDGER.md` |
| How decisions were reached | `docs/DECISIONS.md` |
| How to build a theme | `docs/THEME-CRAFT.md` |
| The owner's answers, verbatim, by round | `docs/owner-answers/` |
| How the pieces fit (signals, elements, schemes, direction) | `system.html` |
| The lab's files and tools | `README.md` |
| Palettes and the library | `scripts/video/palettes.js` |
| Round pages | `morning.html` (index) |
