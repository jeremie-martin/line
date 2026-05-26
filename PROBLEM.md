# Problem

Procedurally generate Line Rider tracks synchronized to music.

## What we want

- **Beat sync.** The rider's visible ground contacts align with musical beats within ±1 frame (±25 ms at 40 fps). Sync is the central artistic property — getting it wrong wrecks the entire purpose.
- **Visual variety.** Tracks are interesting to watch — varied geometry, varied motion. Not 60 copies of the same primitive back-to-back. Repeated identical shapes are visually boring even when sync is perfect.
- **Creative control.** The user (or eventually a music-analysis script) expresses artistic intent at a meaningful authoring level — not by hand-placing lines, not by tuning fitness functions. The vocabulary should match how a human thinks about music-driven motion.
- **Procedural.** The system produces many tracks from many specs; tracks should differ even when specs are similar, because the goal is to generate lots of cool videos, not a single perfect one.

## Substrate available

- `lr-core` — deterministic Line Rider physics engine, ~4000 fps in Node, byte-identical to the rendering engine.
- Event detector — extracts landings, bounces, kicks, contacts, terminus from a simulation trace.
- Exporter — renders a track JSON to mp4 via the linerider.com mirror + Playwright.
- Dashboard — visualizes detection + rendered video synchronized with audio.

## Failure modes of previous attempts

- Sync precision collapsed on real-world specs: ~19% of beats within ±1 frame on a 30-second drum track despite >80% on tight synthetic specs.
- Visually monotone output: same geometric primitive repeated, same tangent angles, same arc lengths, same direction. Variation should come from the compiler structure rather than a bundled anti-uniformity term.
- Conceptual clutter: Moves, primitives, strategies, compilers — overlapping vocabularies fighting each other, no clear separation of intent from geometry.

## Out of scope for now

Multi-track sync, structural composition (verse/chorus narrative), camera tricks, decoration-only geometry, full music-driven spec generation. These come after the core spec → track pipeline works robustly.
