# Creative workflow — from a song to an expressive Line Rider track

A worked example of turning a piece of music into a hand-shaped, music-synced
track with the **handoff** compiler. The running example is the first 56s of
*Believer* (`beats/audio.mp3`), producing `scripts/v0/specs/drums_0_56s_creative.ts`
→ `generated/believer_v3.track.json` → `shakedown/believer_v3/`.

The pipeline has five stages. The compiler only ever *hits the detected beats*;
everything expressive lives in the **spec** you write, informed by the music.

```
1. clean beat grid   2. understand the music   3. design a spec   4. compile+iterate   5. render
   (beats/*.json)        (madmom analysis)         (axis arc)        (handoff)            (mp4+audio)
```

## 1. A clean beat grid (the contacts)

The compiler's contacts should be *catchable*. The handoff compiler nails ~98%
of contacts at **≥0.4s spacing** but **stalls on sub-0.4s clusters** (see
`docs/optimizer/12_handoff_prefix_search.md` and the experiments below), so the
raw detection (with its dense ~0.12s ornament clusters) is not directly usable.

For *Believer* the main drum is a steady **125 BPM** pulse (period 60/125 =
0.48s). `beats/drums_0_56s.json` is the cleaned grid: the on-grid main beat
extracted from `beats/drums_0_56s_60_125.json` by a greedy "chain to the next
beat ~0.48s away, pick the onset closest to the grid" pass — which drops the
off-grid cluster ornaments and **adds nothing** where the drums genuinely drop
out (e.g. the 53–55s thinning). Result: 113 clean contacts, 0–30s identical to
the reference `drums_0_30s_60_125.json`.

## 2. Understand the music — madmom as a listening aid

Use `scripts/analyze_music.py` (madmom; install recipe in its docstring). It is
**not** generating beats — it tells you how the song is built so you can shape
the spec:

```
/tmp/mm310/bin/python scripts/analyze_music.py --audio beats/audio.mp3 --duration 56
```

Three readouts, three design inputs:

| madmom processor | what it answers | how it feeds the spec |
|---|---|---|
| `RNNBeatProcessor`→`DBNBeatTrackingProcessor` | tempo & drift | confirmed 125.0 BPM, dead steady → validates the 0.48s grid |
| `RNNDownBeatProcessor`→`DBNDownBeatTrackingProcessor` | meter & phrasing | 4/4, 30 bars, **4-bar phrase boundaries** `0.02 / 7.7 / 15.4 / 23.1 / 30.7 / 38.4 / 46.1 / 53.8s` → use as section `t0/t1` so changes land on phrase lines |
| `RNNOnsetProcessor` (onset-activation, bucketed) | energy contour | low intro (0–8s) → build (8–16s) → verse (16–31s) → pre-chorus dip (31–38s) → **chorus peak (38–52s)** → wind-down (52–56s) → drives the air/speed/grain arc |

## 3. Design the spec — map structure to axes

Sections are soft style blocks; each can set any of the axes (see
`scripts/v0/types.ts`):

- **`air`** — airborne fraction. The most expressive, most controllable axis.
- **`speed`** — `mean|v| / cap`. Climbs naturally; see the caveat below.
- **`grain`** — median line length (long swooping lines vs short choppy ones).
- **`contact_style`** — slide-along-the-line ratio (subtle; usually left default).

Put the section boundaries on the madmom phrase lines, then choose axis targets
to match the energy contour: grounded/restrained intro, airy flowing verse, a
high-air chorus peak, etc.

## 4. Compile with handoff, then iterate on what it *achieves*

```
npx tsx scripts/v0/run.ts --spec=scripts/v0/specs/drums_0_56s_creative.ts \
  --compiler=handoff --out=generated/believer_v3
```

The DriftReport's per-section `achieved/target` is the feedback loop. **The
achievable envelope is narrower than you'd guess** — three lessons from this
example (v1→v3):

- **Air tracks the target well** within ~**0.62–0.80**. It resists going truly
  grounded (a 0.50 target lands ~0.66) *and* truly airborne (0.85 → ~0.78).
  Design the air arc inside that band — it still reads clearly.
- **Speed overshoots and gets *worse* the higher you aim.** The rider
  accumulates speed under gravity; by the late chorus it exceeds the cap
  (achieved 1.0–1.3) no matter the target. Raising speed targets (v2) made it
  *faster* and dropped the score. Keep speed targets modest and let the natural
  climb carry the energy.
- **Grain undershoots** in the big sections (0.70 target → ~0.57). Aim a touch
  high if you want long lines.

Scores this produced (all 111/113 contacts hit, full ride, 0 off-beat):
`v1` (over-ambitious air/speed) **69.86** → `v2` (air good, speed too high)
**63.26** → `v3` (good air arc + modest speed) **79.63**. Tune, recompile, read
the achieved column, repeat.

> Budget note: handoff is **budget-saturated** on these specs — `--budget=2000000`
> produced byte-identical output to the 200k default. More compute is not the
> lever; spec design is.

## 5. Render to mp4 with audio

Serve the mirror and dashboard, then render (drives the mirror via Playwright):

```
python3 -m http.server 8765 --bind 127.0.0.1 --directory mirror   # terminal 1
npx tsx scripts/serve.ts                                          # terminal 2 (dashboard :8767)
npx tsx scripts/inspect.ts --track=generated/believer_v3.track.json --name=believer_v3 --render
```

The render is silent video. For audio, the dashboard syncs `shakedown/<run>/audio.mp3`
at playback; for a standalone shareable file, mux it in:

```
cp beats/audio.mp3 shakedown/believer_v3/audio.mp3
ffmpeg -y -i shakedown/believer_v3/video.mp4 -i shakedown/believer_v3/audio.mp3 \
  -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -shortest \
  shakedown/believer_v3/video_with_audio.mp4
```

Open `http://127.0.0.1:8767/dashboard/?run=believer_v3` and play.

## TL;DR

The detected drum grid is the rhythm; **the spec is the choreography**. madmom
tells you the song's tempo, phrasing, and energy; you translate that into an air
arc (your main lever), a modest speed shape, and grain; handoff hits the beats;
you iterate against the achieved axes; then render with audio.
