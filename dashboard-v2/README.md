# dashboard · cockpit (v2)

Drop-in replacement for the existing `dashboard/` folder.

The video is the hero. A live co-pilot sidebar updates frame-by-frame as
the video plays — current frame, speed (with % of peak bar), position.y
with direction, airborne state with current-flight duration, and the
nearest events (last + next) with signed time deltas. Below the video, a
single unified timeline strip fuses the speed waveform, airborne shading,
three event swim lanes (kick / bounce / landing — dot size scaled to
magnitude) and a time ruler into one navigable component. Click anywhere
on the strip to scrub; clicking a ledger entry or a nearby-events row
jumps the playhead there too.

## Install

Drop these four files into your existing `dashboard/` folder, replacing
`index.html`, `main.js`, and `style.css`. The `demo-detection.json` is
optional and only used for local preview.

```
dashboard/
├── index.html      ← replace
├── main.js         ← replace
├── style.css       ← replace
└── demo-detection.json   (optional — for ?demo=1)
```

The old `vendor/` folder (uPlot) is no longer needed — the timeline is
rendered with hand-rolled SVG. You can delete `vendor/` if nothing else
uses it.

## URLs

| URL                          | What it does                                              |
| ---------------------------- | --------------------------------------------------------- |
| `/dashboard/`                | Landing page; lists `/shakedown/runs.json` entries        |
| `/dashboard/?run=<name>`     | Loads `/shakedown/<name>/{detection.json, video.mp4}`     |
| `/dashboard/?demo=1`         | Loads bundled `./demo-detection.json` (no video required) |

Identical routing/data contracts to the original — `detection.json`
schema, `events` array, `terminus`, `params`, and `runs.json` are all
consumed exactly as before.

## Preview before integrating

From this folder:

```sh
python -m http.server 8080
# → http://localhost:8080/?demo=1
```

You should see the cockpit with the sample run, scrubbable via the
timeline strip below the (placeholder) video.

## Notes

- The frame counter in the video overlay reads from `video.currentTime`
  while playing; in demo mode (no video) it stays at 0 until you scrub.
- `requestAnimationFrame` loop runs only while the video is playing so
  the badge/cursor animations stay smooth without burning idle CPU.
- Sidebar re-renders are guarded with `if (textContent !== newValue)`
  so layout doesn't thrash even at 60Hz updates.
- The timeline SVG draws its static layers (speed line, event markers,
  lane dots, time ruler) once on load; only the playhead `<g>` and the
  hover `<g>` are mutated per frame.
- Responsive: stacks vertically below 900px viewport width.
