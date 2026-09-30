# Guide contacts and independently searched single rails

The [gallery](http://localhost:8767/motion-gallery/) now has an optional **Inspect
rail contacts** view. Blue identifies an opposing guide; orange identifies
segments that actually collided during the displayed integer physics frame.
The buttons jump to the previous or next frame containing a guide collision.
Both tracks share the playhead. Turning inspection off restores the native
black-line rendering and Bosh artwork.

This distinguishes a guide's presence from its use. It does not establish that
a contacted guide was necessary, identify an exact contact point on the body,
or predict what an independently optimized track could achieve without it.
Scattered fragments have no designated guide rail; their actual collided
segments are highlighted without inventing rail roles. Archived contour
experiments likewise show collisions without a main/guide classification.

## Three concrete comparisons

The new [single-versus-paired study](http://localhost:8767/motion-gallery/?data=/generated/motion-gallery/20260930-guidance-choice/manifest.json)
compares three implementations on matched inputs:

- **Single rail:** independently search each main curve with guides disabled
  throughout construction, lookahead, refinement and replay.
- **Arcs and guides:** search with opposing guides, then trim their unused
  sections, preserving a coherent curve around the contacted span.
- **Paired rails:** perform the same guided search and retain the full guides.

The existing distinction between the last two is presentation after search.
Ordinary arcs do not first solve a single-rail track and add a guide only when
that fails. This is why a short guide often appears near the end of a curve:
earlier, unused geometry has been removed after replay.

In the new study, paired tracks contain **408 guide rails** across 48 rides;
**354** are contacted. Ordinary arcs retain those 354, removing 54 entirely
unused guides and shortening others. All **48 pairs** have exactly the same
body traces, scores, observations and physical work; **20,761 guide segments**
are removed in total. Every main-rail segment remains unchanged. Independently
searched single tracks contain **408 main curves and zero guides**.

## Measured capability and limitations

The final study uses the six existing research passages, **four fresh seeds
(211–214)** with 2% target jitter, two physics-work ceilings (100,000/250,000),
and three methods: **144 rides**, all passing the timing and survival contract.
All **148,867 emitted segments are normal type-0 lines**. No acceleration lines,
judge changes, scorer changes or benchmark additions are involved.

| Physics allowance | Single rail mean | Guided mean, either presentation |
| --- | ---: | ---: |
| 100,000 | 778.1962 | 853.4370 |
| 250,000 | 793.4510 | 853.3610 |

These are research-passage means, not V4 headlines. At the larger allowance,
the four-seed means by passage are:

| Passage | Single rail | Guided |
| --- | ---: | ---: |
| Even catches | 865.38 | 937.25 |
| Alternating lift | 773.64 | 853.65 |
| Quick pickups | 622.23 | 877.77 |
| Quiet tail | 858.28 | 717.42 |
| Slow swell | 812.92 | 880.72 |
| Staccato release | 828.26 | 853.35 |

Single rails outperform guided search in **9 of 48 matched runs**, including
seven of eight quiet-tail comparisons. At 250,000 frames, all four quiet-tail
seeds favor single rails. Their terminal amplitude errors range from 0.0002
to 0.0392, compared with 0.1308–0.3560 for guided search. Conversely, quick
pickups expose much larger speed and impact errors without guides. These
observations identify useful follow-up experiments; they do not justify a
hardcoded passage-to-style rule or a claim that either geometry has reached
its ceiling. More allowance also does not monotonically improve each track.

Both modes retain the existing learned proposals, future-value model and
preview policy. No single-rail-specific model was trained. Candidate controls
are normalized with guide variables removed, and guide-only response,
coordinate and repair probes are excluded. Setting `channel: 0` also selects
the existing unguided initialization; `guides: false` enforces the geometric
constraint even when learned proposals explicitly request guide clearance.
The experiment therefore measures the geometry **with the current search**,
not the maximum attainable performance of an ideal single-rail compiler.

Before freezing the final configuration, a 30-run development pilot on seed
201 compared shared versus disabled models, a more restricted passive curve,
and the shared preview policy. Disabling the models reduced the pilot mean;
the passive restriction had mixed effects. The final comparison keeps the
shared production settings apart from the guide constraint. Pilot rows and
their weaker provenance are retained in the validation evidence. The final
four seeds are fresh target perturbations on reused passages, not independent
music or broad generalization evidence.

See [all measurements](evidence/motion-gallery-guidance-20260930.json),
[matched comparisons and axis errors](evidence/motion-gallery-guidance-20260930-comparison.json),
and [validation](evidence/motion-gallery-guidance-20260930-checks.json).
Wall times include model loading and shared-host contention; they are not a
controlled throughput comparison. All single-rail searches stayed within the
same declared allowances as their guided counterparts.

## Verification and production behavior

The inspector reads the native engine's actual collision IDs, not nearby
segments or a geometric approximation. An independent replay through the
fixed WASM engine agrees on the complete per-frame collision-ID sets for
**360 rides / 108,840 frames**: the 144 new rides and all 216 current functional
gallery rides. Native body positions match every saved trace with **zero
coordinate error**. Inspection uses the existing background replay and cached
frames; scrubbing does not run physics or compilation.

Browser checks exercised all 360 comparisons, contact navigation, inspection
toggles, mobile layout, playback and artifact rejection. A pixel comparison
confirms that toggling inspection off restores the exact same native image.
Desktop and mobile screenshots were inspected. The renderer adds about 4 KB
to the prior bundles, remaining approximately 389 KB before compression.

All **175 focused tests in 43 files** pass. TypeScript retains exactly its
**251 inherited diagnostics**, with no additions. The optional compiler mode
leaves the production default unchanged: all **176 canonical V4 specifications
× seeds 16/17 = 352 runs** reproduce the baseline's exact track hashes, scores,
observations, geometry, compiler statistics and physical work. The headline
remains **952.4726**, all 352 valid, using 46,454,822 total physical frames. See
[production parity](evidence/motion-gallery-guidance-20260930-production.json).

## Reproduce

The final study and canonical check used clean compiler commit `0471103d` in
an isolated worktree. Compiler, judge, harness and artifact hashes are recorded.
Generated tracks, traces, browser bundles and screenshots stay local; code
and compact evidence are versioned.

With a clean compiler checkout and built WASM engine, use a fresh output path:

```sh
LR_ENGINE=wasm node --import tsx scripts/gallery/build.ts \
  --compiler-root="$PWD" --methods=single,arcs,paired \
  --seeds=211,212,213,214 --budgets=100000,250000 \
  --out=generated/motion-gallery/my-guidance-study
npm run dash
```

Open `/motion-gallery/?data=/generated/motion-gallery/my-guidance-study/manifest.json`.
To reproduce the independent collision and browser checks:

```sh
node --import tsx scripts/gallery/contact_reference.ts \
  generated/motion-gallery/my-guidance-study/manifest.json \
  --out=generated/my-guidance-contacts.json
node scripts/gallery/check_renderer.mjs \
  generated/motion-gallery/my-guidance-study/manifest.json \
  --contacts=generated/my-guidance-contacts.json \
  --out=generated/my-guidance-browser.json
node --import tsx scripts/gallery/analyze_guidance.ts \
  generated/motion-gallery/my-guidance-study/manifest.json \
  --out=generated/my-guidance-comparison.json
```

The next useful experiment is to let single and guided construction compete
within a track, measuring the adherence/guide-use tradeoff and transition
behavior. This study establishes both options and makes their contacts visible;
it does not yet implement per-beat preferences, quotas or random style mixing.
