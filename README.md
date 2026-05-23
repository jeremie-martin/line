# line

Procedural Line Rider videos synchronized to music.

## What this is

Take an audio file → generate a Line Rider track JSON whose ride lands beats /
events / shapes in sync with the music → render to mp4. The community
equivalent (DoodleChaos's hand-made music tracks) takes a month per video.
Nobody has published an automated pipeline; that's the gap this project fills.

Status: **substrate built**. The right half of the pipeline (JSON track → mp4)
is automated end-to-end and pixel-deterministic. The left half (audio → JSON
track — the actual procedural generator) is the remaining work.

## Quick start

```bash
# one-time setup
npm install
npx playwright install chromium

# in one terminal: serve the local linerider.com mirror
python3 -m http.server 8765 --bind 127.0.0.1
# (run this from /home/holo/prog/line/mirror/)

# in another: render a track to mp4
npx tsx scripts/export.ts \
  --track=test.track.json \
  --zoom=3 --1080p --hq \
  --out=shakedown/myvideo.mp4

# stress-test the helper (4 scenarios, ~7 min)
npx tsx scripts/stress.ts

# verify lr-core (Node-native physics) still matches the bundle exactly
npm run parity
```

`scripts/export.ts` flags:
- `--track=PATH` (required) — Line Rider JSON track
- `--zoom=N` (default 2; 3 is well-framed; UI's "zoom level N" = `2^N`)
- `--1080p` (default 720p) and `--hq` (default off)
- `--origin=URL` (default `http://127.0.0.1:8765`)
- `--out=PATH` (default `shakedown/out.mp4`)
- `--headed` (run the browser visibly)

## Architecture

```
audio file
  → analysis      (beat/onset/feature extraction)        ┐
  → planner       (timeline of "hit X at time T" events) │ TODO
  → generator     (place lines to satisfy timeline)      ┘
  → JSON track
─────────────── boundary of our code ───────────────
  linerider.com bundle  (vendored as mirror/_v2153.0/, served from localhost)
  + mirror/helper.js    (our window.__lr API on top of the bundle)
  → Playwright drives the browser
  → mp4 file
```

Everything left of the boundary is pure functions over data. Everything right
is built and validated already.

## Repository layout

| Path | What |
|---|---|
| `mirror/_v2153.0/` | Vendored linerider.com static SPA bundle. Untouched. |
| `mirror/helper.js` | Our `window.__lr` API — wraps Redux dispatches + React fiber walks into a clean Promise-based surface. |
| `mirror/index.html` | Upstream HTML + one `<script defer src="/helper.js">` line. |
| `unpacked/` | `webcrack` output of `main.js` — 1069 readable module files, used as a reference when designing the helper. Regenerate with `npm run unpack`. |
| `scripts/export.ts` | The working exporter. JSON track → mp4. |
| `scripts/stress.ts` | 4-scenario stress test for the helper. |
| `scripts/probe*.ts` | One-shot discovery scripts kept as history (Redux store shape, fiber walking, network capture, etc.). |
| `test.track.json` | Reference track used as a regression / parity test. |

## window.__lr API surface

Defined in `mirror/helper.js`. Use from the browser DevTools at
`http://localhost:8765/`, or from Playwright via `page.evaluate(() =>
__lr.foo(...))`.

```js
__lr.enterEditor()
__lr.loadTrack(trackJsonOrString)
__lr.setPlaybackZoom(zoom)              // linear; UI shows log2(this)
__lr.openVideoExporter() / closeVideoExporter()
__lr.waitForVideoExporterReady()        // resolves when status==='Config'
__lr.setResolution({width, height, preset})
__lr.setHighQuality(bool)               // QP 22 vs 28
__lr.setStartFrom('Beginning' | 'Checkpoint')
__lr.setEncoderSettings({               // beyond UI
  kbps, speed, quantizationParameter, groupOfPictures
})
__lr.render({timeoutMs, stallMs})       // returns blob URL on Postrender
__lr.triggerDownload(url, filename)
__lr.exportVideo({                      // high-level convenience
  track, zoom, resolution, hq, encoderSettings, startFrom, filename
})
__lr.getState()                         // store.getState()
```

Action shapes were extracted from `unpacked/279.js` (view actions) and
`unpacked/493.js` (camera actions). Component-local state field names from
`unpacked/1044.js` (the VideoExporter React component).

## Why this architecture

| Layer | Why |
|---|---|
| **linerider.com** (vs LROverhaul, lr-core, etc.) | Canonical physics + visuals (sledder, scarf, line ink) for free. Closed-source but a static SPA. The "feel" of Line Rider that the community recognizes. |
| **Local mirror** | Reproducibility — pinned to v2153.0; immune to upstream changes. Offline. Foundation for any future bundle patching. |
| **Helper script** (not main.js patch) | Additive, isolated. Re-applies cleanly after re-mirror. Touches only one extra `<script>` tag. |
| **Playwright** | The browser is the renderer. The export feature uses MediaRecorder + h264-mp4-encoder; we don't reimplement either. ~3× real-time render at 1080p HQ. |
| **Redux + fiber walk** | View transitions / track load / zoom are Redux. Modal-local state (resolution / HQ / render trigger) is React component state, reached via fiber walk. Both paths needed; helper hides the difference. |

Alternatives considered:
- `jealouscloud/linerider-advanced` (C#, last release 2018, dormant) — rejected
- `LunaKampling/LROverhaul` (C#, active; would need its own GUI driver, GPLv3 viral if we adopted its assets) — rejected
- `deanveloper/bosh-rs` (Rust port, archived) — rejected
- `conundrumer/lr-core` (JS, physics-only, no rendering) — **adopted for simulation** (see below)

## Which engine to use when

The bundle ships its physics engine (in `mirror/_v2153.0/main.js`) and we
have **`lr-core`** as an npm package (same author, David Lu / Conundrumer).
We've verified they produce **byte-identical trajectories** on the full
test track — same MD5 over 11 sampled frames × position + velocity + 11
contact points. Re-verify any time with `npm run parity`.

So pick whichever is convenient for the use case:

| Use case | Engine | Why |
|---|---|---|
| **Procedural generator inner loop** (place candidate lines → simulate → score → iterate) | **lr-core** | Native Node, ~4000 fps cold / much faster warm. Browser path can't keep up. |
| **Headless tests, batch jobs, CI** | **lr-core** | No Chromium, no mirror server, no Playwright. Direct `require()`. |
| **Quick scripts / one-off rider-position queries** | **lr-core** | Cheaper to spin up; debug in Node. |
| **Rendering a track to mp4** | **bundle** (via Playwright + `__lr.exportVideo`) | lr-core doesn't render. The bundle is the only thing that turns lines + simulator state into pixels. |
| **"Does my generated track look right when rendered?"** | **bundle** | Implicit re-verification of parity on every render. |
| **Regression test after a bundle bump or lr-core update** | **both** | `npm run parity` runs them on the same input and byte-diffs the trajectories. |

Default for any *physics* operation: **lr-core**. Default for *visuals*: **bundle**.

If parity ever breaks, the generator can no longer trust its simulations
will render the same way — that's the moment to either (a) pin to whichever
side stayed correct, (b) extract physics from `unpacked/`, or (c) re-derive
the engine. Today (v2153.0 bundle, lr-core@0.8.2): they match exactly.

## Music sync — two channels worth knowing about

1. **Physical sync** — lines arranged so the sledder lands on a beat at frame T.
   The hard problem; the generator is the open work.
2. **Camera sync** — `__lr.createZoomer(keyframes)` exists in the bundle (we
   haven't wired it through the helper yet). Zoom/pan/time-remap triggers are
   stored *in the JSON*, applied at render. Easy-impressive; could be a
   first-cut deliverable.

DoodleChaos-style videos mix both.

## What's verified working

- Pixel-deterministic export at 720p/1080p/custom resolutions.
- Custom encoder settings (`quantizationParameter`, `kbps`, etc.).
- Multiple back-to-back renders in one Playwright session, with track
  switching and zoom changes between renders.
- Friendly error when origin is unreachable.
- Forensics dump (screenshot + state.json + console.log + page-errors.log +
  error.txt) under `shakedown/debug/<ISO-timestamp>/` on any failure.
- **lr-core ↔ bundle physics parity** — byte-identical trajectories on the
  test track. `npm run parity` re-runs the check.

## Next directions (none of these picked yet)

- **Audio analysis** — pick a stack (essentia.js, Meyda, librosa, etc.) and
  extract beats / onsets / spectral features.
- **Procedural generator** — the real work. Greedy forward search vs.
  templates vs. optimization vs. trajectory-first.
- **Camera-sync prototype** — wire `createZoomer` keyframe arrays through the
  helper. Low-risk visual win independent of the generator.
- **Vendor the h264 encoder** — currently a runtime fetch from
  `unpkg.com/h264-mp4-encoder@1.0.12`. Single external CDN dep.
- **Helper observability** — H6/H7 from the code review are still open
  (fiber-walk could grab a stale instance during the 400 ms remount window;
  `loadTrack` swallows async bundle-side validation errors).

## Notes for future you

- `?forceMillions` URL flag is required for the graphics-card check to pass
  in headless Chromium. The helper assumes it.
- linerider.com is React 16 (fiber key prefix `__reactInternalInstance$`),
  not React 17/18. The fiber walk handles both prefixes defensively.
- Render is roughly **3× real-time** at 1080p HQ. A 3-min song → ~9 min export.
- Bundle's render IIFE is unawaited — encoder failures leave `status="Rendering"`
  silently. `helper.render()` detects this by polling `state.index` and aborting
  on 15 s of no progress.
- Trademark: "Line Rider" is Boštjan Čadež's. Personal/dev use is fine; any
  public distribution of the mirror or unpacked bundle is a copyright issue
  (linerider.com is not open source).
