# Creative workflow — music to an expressive Line Rider spec

This is the human-led workflow for turning a song into a Line Rider spec. It is
**not** automatic spec generation. The guiding principle, learned the hard way:

> **The analyzer MEASURES. The spec DECIDES. Nothing in between hides a decision.**

`scripts/analyze_audio.py` produces a neutral, layered *description* of the audio
— energy by band, percussive/harmonic split, onsets, a tempo/beat hypothesis,
structure. It never says "this is a beat" or "land here this hard." Those are
authoring choices, and they live in the spec, made by a person reading the
layers (ideally in the dashboard, with their ears), under the physical gap
budget. There is no single correct spec for a song, so the analyzer must not
pretend to compute one.

Why this matters: a previous analyzer emitted weighted "contact/impact" scores.
Those scores quietly baked in the rule *onset/energy ⇒ beat*. A beat tracker
that extrapolates a constant pulse over a percussion-free intro then produced
phantom beats that an author trusted — placing hard landings (even a "drop")
in a section with no drums at all. The fix was not a smarter threshold inside
the analyzer; it was to **surface the raw, corroborating evidence and let the
author judge**.

The worked example throughout is `productions/luna_bala_44s/spec.ts`, driven by its
co-located `productions/luna_bala_44s/audio.json`; `productions/amor_na_praia_46s/`
is the second worked example, the one that taught loudness-driven impact, off-grid
hits, and re-drops (§2/§3). Each production song lives in its own self-contained
`productions/<song>/` folder (spec + analysis + config + assets); §5 covers turning
a finished spec into videos at scale.

---

## 1. Author manually first

Default to authoring by hand. A 44s clip has ~50–70 landings — that is tractable
to read and decide deliberately. Reach for logic/automation only where the music
is genuinely **regular**, and be explicit about which parts those are:

- **Reliable-procedural** — where the answer needs no judgment. In a steady
  section with a kick on every beat, the beat-grid times *are* the landing
  backbone; reading them off the analysis is fine because every one is a real
  hit. Loud, regular, on-grid ⇒ trust it.
- **Manual judgment** — everywhere the music is irregular: beatless intros,
  syncopated fills/breakdowns, drops, transitions, the ending, and the impact
  hierarchy. Hand-list these by reading the measured layers. This is where taste
  lives and where a procedural rule will fight you.

A hand-authored contact list is also *more* transparent than a selection
algorithm: every beat and impact is a visible choice you (or a reviewer) can
veto in the dashboard, instead of an output you must reverse-engineer from
threshold parameters. The spec is per-song; it does not need to generalize, and
it should not silently change when the analyzer is re-run.

---

## 2. Analyze the audio

Extract a fixed excerpt, then describe it:

```bash
mkdir -p productions/luna_bala_44s

ffmpeg -y -i "LUNA BALA (Slowed) [dukNdSgaLtc].opus" \
  -t 44 -vn -codec:a libmp3lame -q:a 2 productions/luna_bala_44s/audio.mp3

/tmp/mm310/bin/python scripts/analyze_audio.py \
  --audio productions/luna_bala_44s/audio.mp3 \
  --out productions/luna_bala_44s/audio.json \
  --window 0:10           # finer console tables for a region (optional)
```

Optional spectrogram assets for the dashboard:

```bash
/tmp/mm310/bin/python - <<'PY'
from pathlib import Path
import importlib.util
spec = importlib.util.spec_from_file_location("extract_spectrogram", "beats/extract_spectrogram.py")
mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
mod.main(Path("productions/luna_bala_44s/audio.mp3"),
         Path("productions/luna_bala_44s/spectrogram.png"),
         Path("productions/luna_bala_44s/spectrogram.json"))
PY
```

### What the analysis contains

All layers are interpretation-neutral measurements. The JSON has:

- `frames.*` — continuous envelopes on a shared `times` grid, each normalized to
  the track's own max (true zeros survive, so "no kick here" stays 0):
  - `rms` — full-mix loudness.
  - `percussive_rms` / `harmonic_rms` / `percussive_ratio` — HPSS split. The
    layer that tells a **drum hit** from a sustained **melodic/vocal** onset.
  - `band_sub` (30–140 Hz, kick), `band_low`, `band_mid`, `band_high`.
  - `onset_strength`, `onset_strength_percussive` — attack envelopes.
  - `novelty` — how fast the timbre is changing (peaks ≈ section edges).
- `onsets[]` — detected onset events, each with `strength`, `percussive_ratio`,
  and per-band content. **This is where off-grid / syncopated hits show up** that
  a sparse beat grid lands between.
- `beat_grid` — the madmom DBN beat **HYPOTHESIS**. Read its `note`. Each beat is
  annotated with the *measured* local `percussive` / `band_sub` / `onset_strength`.
  **A beat sitting on ~0 percussion is extrapolated pulse, not a played beat.**
- `tempo` — madmom + librosa BPM cross-check.
- `segments[]` — timbral/energy segmentation; each summarized by its mean energy
  profile, so structure (intro / drop / breakdown) emerges from the data.

### Reading the layers (the part that makes the spec good)

- **Is there even a beat here?** Look at `band_sub` / `percussive_rms`, not the
  beat grid. In LUNA the kick band is flat-**zero** until 8.58s — the whole intro
  is beatless even though the grid lists beats through it. Those grid beats sit
  on `sub`=0.00; they are extrapolated and must not become hard landings.
- **Where is the drop?** A sharp `segments` boundary where `sub`/`perc` jump
  (LUNA: 8.57s, `sub` 0.00→0.65). Confirm with a strong `onset_strength` there.
- **How hard is each hit?** Read measured **loudness** — the drum transient
  (`percussive_rms`), the kick (`band_sub`), and the overall level (`rms`) at the
  beat. **Do not use `onset_strength` as the loudness.** It is an *attack/novelty*
  envelope: it spikes on chord changes and new timbres, which in an even groove
  land on the harmonic **downbeats** — beats that are frequently *no louder, even
  quieter*, than the off-beats around them. It happens to track loudness when the
  accents really are louder (LUNA's snares/claps/drop), and to *anti*-track it
  when they aren't (AMOR's body: the chord-change downbeat at 33.30 sits among the
  **quietest** beats, while the off-beat at 33.85 is louder). Measure the loudness
  you actually mean and you are never fooled by which one a song happens to be.
- **The grid is quantized — trust the onsets for *where*.** madmom snaps beats to
  a constant pulse, so even a main, loud hit can be placed 0.2–0.3s off where it
  is played. In AMOR the **loudest hit of the whole clip** (4.46s, `rms` at the
  track max, `percussive_ratio` 0.94) was gridded to 4.70; the played hit at 7.34
  was gridded to 7.46, with a weak *harmonic* blip at 7.50 that is **not** a beat.
  In any percussive/fill/syncopated section, cross-check each grid beat against
  `onsets[]` (high `percussive_ratio`) and the local energy peak, and land on the
  onset. (LUNA's breakdown: the felt kicks 36.94 / 37.36 / 37.78 fall *off* the
  grid; the grid's 37.47 is a weak in-between that isn't hit — land on the onsets.)
- **Re-drops and re-entries.** A `segments` boundary where `rms`/`sub` briefly
  *collapse and then resume* is a **break followed by a re-entry** — musically a
  second drop, and it should hit like one. AMOR has a ~0.25s hole at 26.29–26.70
  (rms 0.30, sub 0.04), then the groove slams back at 26.70 (the body's highest
  `onset_strength`). Treat the re-entry as a pinned drop, and (see §3) float the
  rider across the hole so it actually lands hard rather than limping out of it.
- **The ending** often collapses: `rms`/`sub` fall to ~0 (LUNA: silence past
  ~43.2s). Stop the musical contacts there — though a couple of *near-silent*
  grid touches (impact ~0.05–0.1) on a soft tail (AMOR: 43.75, 44.30) ride the
  fade out smoothly instead of stopping the wheels dead.

Argue with the analysis. If a layer disagrees with what you hear, trust your
ears and write down why — but first check you are reading the right layer (the
beat grid is a hypothesis; the energy/onset layers are the evidence).

---

## 3. Author the spec

A spec is a TypeScript module exporting a `Spec`. The authoring surface:

```ts
import type { Contact, Curve, Spec } from "../../scripts/v0/types.ts";
import { keyframes } from "../../scripts/v0/core/curves.ts";   // also: constant, ramp
import { beats } from "../../scripts/v0/core/beats.ts";         // also: withImpact

// the spec reads its co-located analysis relative to its own file:
//   const audio = JSON.parse(readFileSync(resolve(import.meta.dirname, "audio.json"), "utf8"));

const spec: Spec = {
  duration: 44,
  music: { audio, title, artist, tempo, beats: "productions/<song>/audio.json", spectrogram },
  contacts,                       // Contact[] = beats([{ t, impact }])
  jitter: 0,                      // curves carry the variation; no per-gap noise
  axes: { air, speed, amplitude },// each a Curve: keyframes([{ t, v, ease }]) or (t)=>number|undefined
  camera: { zoom: { smoothingFrames: 8, keyframes: [{ t, zoom }] } },
};
export default spec;
```

### Contacts (the landings)

The contact list is the heart of the spec. Build it by reading the layers:

- **Beatless sections**: a few **very gentle support touches** for ride/camera
  continuity, low impact (~0.04). Keep gaps small (~1s) — a long airborne float
  bows high and lands hard no matter how low you ask amplitude, so "gentle"
  means *frequent short* touches, not one big arc.
- **Steady body**: read the grid kick times directly (reliable-procedural).
- **Syncopated/fill sections**: hand-list the felt kicks from `onsets[]`,
  replacing the grid beats that aren't hits.
- **Gap budget**: keep contact gaps **≥ ~0.4s**. Sub-0.4s leaves no room for a
  readable arc; ~0.3s is risky; anticipation+primary pairs around 0.2s read
  badly. A detected onset is *evidence, not an obligation* — when two real
  events are too close, keep the one that carries the phrase and express the
  other through impact/speed/air/camera instead of cramming a landing.

LUNA's contacts, in three transparent pieces: a hand-listed intro support array;
the body grid kick times read from the analysis; and a hand-listed breakdown
syncopation array that swaps three grid beats for the kicks actually heard.

### Impact (felt landing intensity, per beat)

`impact ∈ [0,1]` is a per-beat qualifier on a felt scale (0 soft → 1 very
strong; it is the velocity-redirection arc at the catch).

**Map it from measured loudness, not from `onset_strength`** (see §2 for *why* —
onset is chord-change novelty, not loudness). "How hard is this landing" should
track how hard the hit actually is: a composite of the drum transient, the kick,
and the overall level, read at the beat. Pin the structural moments (the drop,
any re-drop) by hand and let the rest fall out of the composite:

```ts
// local peak around t, ±0.10s — wide enough to catch a hit a frame off the
// onset time, narrow enough never to bleed into a neighbouring beat.
const loud = 0.40 * peak("percussive_rms", t) + 0.35 * peak("band_sub", t) + 0.25 * peak("rms", t);

if (isSupport) return 0.04;          // beatless touch
if (isDrop || isReDrop) return 1.0;  // structural slam, pinned by hand
return clamp(0.45 + 1.40 * (loud - 0.627), 0.42, 0.80);  // calibrate to THIS song's body range
```

Calibrate the linear map to the song's **own** body range so the spread is real,
not invented. An even groove *should* read fairly flat in impact — that is honest
— with the dynamism carried by air/speed/camera, not by faking variation the
audio doesn't have. AMOR's body spans loud ≈ 0.627–0.770; the slope above turns
that into impact ≈ 0.45 (quiet chord-dip downbeats) … 0.65 (heavier off-beats),
with the far-louder fill riding up to the 0.80 cap and the two drops pinned at 1.

**The body's overall hardness is a creative dial — but a physically bounded one,
and it trades against bounce.** Two honesty checks live here:

- *The dense body has an impact ceiling.* At ~0.55s spacing the rider must launch
  straight into the next beat, so the per-gap ceiling sits around ~0.5 (read it as
  `target` in the report — it is `min(your ask, ceiling)`). Authoring *above* the
  ceiling does not buy more achieved impact; it only inflates the impact-error term
  and drops the score. So lift the body to hit harder, but know that on a wall-to-wall
  groove "harder" tops out near the ceiling — to make a specific beat truly slam,
  give it *room* (thin its neighbours, or float into it), don't just type a bigger number.
- *Harder catches kill the bounce.* A hard landing redirects velocity into the
  ground; that is the opposite of the airborne dynamism (rocking, nose/tail-stands)
  that `air` buys. Raising AMOR's body to 0.55–0.80 zeroed its stands (7%→0%) and
  cut rotations nearly in half; a balanced 0.45–0.65 kept ~3%. This is the
  "impact vs air fight" made concrete — decide per song which the body wants, and
  verify the consequence in `study_rotation.ts`, not just in the score.

`impact` is **scored** but bounded by physics: dense (~0.5s) beats cap impact
well below 1.0 because the rider must immediately launch into the next beat, and
slow sections cap it too (a slow catch can't redirect hard). So a 1.0 ask on a
dense climax bar is fine — the compiler clamps it to what is catchable and the
report tells you the achieved value.

**Big slams need room, and room is a lever you author: float the rider into the
drop.** A dense 0.55s entering gap clamps even a pinned 1.0 to a soft catch —
AMOR's drop achieved only ~0.35 that way. *Removing* the support touches before
it, so the rider floats ~1.4s into the drop, raised the catchable ceiling to 0.90
and it landed at **0.79**; the same trick across the 26.29–26.70 hole rescued the
re-drop from 0.11 to **0.69**. The cost is a long airborne arc — confirm it stays
controlled (`study_rotation.ts`, §4) — but a clean float into a slam is the single
most effective way to make a drop *feel* like one. (Beatless support touches exist
precisely to *prevent* unwanted long floats elsewhere — here you drop them on
purpose, exactly where you want the bow.)

### Axes (continuous fields between beats)

Author these as curves — they are continuous, so a handful of keyframes reads
better than per-beat values:

- `air` — the airborne-time **fraction within each gap**. This is the most
  misunderstood axis, so be precise: it is **not "floatiness" — it is a DYNAMISM /
  bounciness lever.** On a short (~0.5s) beat the rider can only reach a *high* air
  target by leaving the ground **repeatedly** — bounces, partial rotations,
  tail/nose-stands — because there isn't room for one long clean arc. So low air ⇒
  grounded, clean, and can read **monotone**; high air ⇒ busy, lively, *interesting*.
  Raising LUNA's body air from ~0.5 to ~0.7 is exactly what turned a monotone glide
  into a ride full of rocking and end-stands (see `study_rotation.ts` below). It
  **saturates around ~0.78** on dense 0.54s beats (asking more just pins there).
  Use it deliberately in BOTH directions — sometimes grounded is what the moment wants.
- `speed` — authored pace [0,1]. Builds into drops/climaxes; tends to overshoot
  late through gravity, so keep late-track speed modest.
- `amplitude` — jump height (bow above the takeoff→landing chord). **Needs sparse
  gaps and speed to read**: dense ~0.5s bars physically cannot pop, so keep them
  low (~0.12) and let impact/speed carry them; put big amplitude on long gaps
  (a float into a drop, a breakdown breath).
- `elevation` — altitude trend. Optional/advanced. **Do not pair with amplitude**
  (both steer launch angle). Not needed for a good first pass.
- Set `jitter: 0` when your curves already carry variation.

### Camera

`camera.zoom.keyframes` ([{ t, zoom }], lower = closer). Wide in a quiet intro,
punch in on the drop, tightest in the action/climax, pull back to breathe.
Render with `--zoom=action` to use these.

---

## 4. Compile, inspect, iterate

```bash
npx tsx scripts/v0/run.ts \
  --spec=productions/luna_bala_44s/spec.ts \
  --compiler=handoff --budget=1000000 --seed=0 \
  --out=generated/luna_bala_44s
```

Read the terminal summary first: contacts hit/drift/missing/off-beat, survival
reason, score, `axis_rms`, and the worst gaps (target→achieved per axis). The
goal is all contacts hit, `survival endOfSpec`, and per-axis errors that reflect
*intended* tradeoffs (e.g. dense-bar impact will undershoot — that is physics,
not a miss). LUNA at 1M lands 69/69 hit, 0 drift/missing/off-beat, endOfSpec.

Keep timing offsets explicit: the default jolt offset prints in the run header;
if you set `LR_JOLT_OFFSET_MS`, put it in the command and the output name.

Then inspect and check the shape (no render needed for a fast read):

```bash
npx tsx scripts/inspect.ts --track=generated/luna_bala_44s.track.json \
  --name=luna_bala_44s --no-render
/tmp/mm310/bin/python scripts/analyze_track_shape.py luna_bala_44s \
  --json generated/luna_bala_44s.shape.json
```

The shape analyzer flags issues (e.g. NO REAL JUMPS when median pop is tiny) —
read them as hints, not gates. A dense full-pulse track will read flat in pop
by nature; the contrast lives in the floaty/breakdown moments.

For the *rotation/behavior* read (what `analyze_track_shape.py` doesn't see — it
only knows position/airborne), use the sled-orientation analysis:

```bash
LR_ENGINE=wasm npx tsx scripts/v0/study_rotation.ts --track=generated/luna_bala_44s.track.json
```

It reports total angular travel / revolutions, **flips** (an airborne arc whose
net rotation exceeds 180°), and **stands** — the sled held near-vertical (≥45° from
flat), balanced on the **tail** or **nose**, *bouncing* on that end for at least two
landings in a row without tumbling. Stands are a distinct, harder-to-get behavior
than flips (full air-rotation is "cheap" — just raise `air`; a sustained end-stand
is not), so they're worth watching for on their own. High `air` tends to produce
both; if a section reads as endless backflips, that's the cheap kind — dialing air
or speed can trade it for more grounded rocking/stands.

Render with spec-authored camera, then mux audio and view in the dashboard:

```bash
npx tsx scripts/inspect.ts --track=generated/luna_bala_44s.track.json \
  --name=luna_bala_44s --render --zoom=action
# dashboard: http://127.0.0.1:8767/dashboard/?run=luna_bala_44s
```

### The loop

1. listen and annotate in the dashboard;
2. check the analysis layers agree with what you hear (fix the analysis or
   override deliberately if not);
3. adjust contacts (selection + gap budget), then impact, then axes/camera;
4. compile; read report + shape + rendered video; repeat.

### Is it actually in sync? (working honestly)

Your authored `impact`/`speed`/`air` are *asks*. The compiler reports what was
*achieved*. Syncing honestly means checking the achieved truth against the music —
not admiring your targets, and not chasing a bigger score number.

- **Check the achieved impact hierarchy, not the authored one.** Open the report's
  `gaps[].axes.impact.{target, achieved}` (`target` is the physics-clamped ceiling
  for that gap; `achieved` is what the rider actually did). The marquee drop should
  *achieve* the most, above any re-drop, above the loud-fill hits, above the body.
  If a secondary beat out-slams the drop, the drop lacks room — float into it (§3).
  AMOR ended at drop 0.79 > re-drop 0.63 ≈ burst 0.63 > body ~0.3–0.5: a true
  hierarchy, verified in the report, not assumed from the spec.
- **Every hit defensible, every beat accounted for.** For each hard landing you
  should be able to point at the energy/onset peak that earns it; for each place
  you hear a beat with no contact, you should find it in `onsets[]`. If you can't,
  you trusted the grid. The dashboard notes file
  (`generated/spec-dashboard/<spec>.notes.json`) is where you record these
  disagreements with yourself, then resolve them one by one against the layers.
- **Honest, not impressive.** Don't inflate impact to lift the score, or spread a
  flat groove into fake dynamics, or keep a contact just because an onset exists
  when it busts the gap budget. A spec is in sync when each landing is defensible
  from the measurements *and* the achieved shape matches what you hear — not when
  the number is big. When the analysis and your ear disagree, say which won and why.

Useful failures:

- A hard landing sits where you hear no beat → you trusted the beat grid instead
  of `band_sub`/`percussive_rms`. The beats there are extrapolated.
- Impact feels wrong — every downbeat hard, steady off-beats soft, quiet beats
  hammered → you drove it from `onset_strength` (chord-change novelty), not
  loudness. Read `percussive_rms` + `band_sub` + `rms` at the beat instead (§2/§3).
- A drop feels soft even pinned to 1.0 → it is caught from a dense gap; float the
  rider across a beatless stretch into it (drop the support touches there) and
  re-check `achieved` in the report.
- A real beat is missing → it is off-grid; find it in `onsets[]`.
- A "support" touch lands hard → its entering gap is too long; add a touch to
  shorten it.
- High amplitude on dense beats does nothing → make a longer gap or lower the ask.
- High impact and high amplitude fight → decide which the moment needs.
- Report score improves but shape regresses → watch the video; prefer the version
  that reads better.

---

## 5. Produce videos at scale (`characterize` → `select.json` → `produce`)

Once a spec rides well, you don't hand-pick seeds — you let the producer stream
finished videos. Two commands over the song folder.

**Characterize** — measure the seed distribution and get a starting config:

```bash
npm run characterize -- --song=productions/luna_bala_44s --seeds=0-99
```

Compiles the seed range, measures every metric (score, substantial stand-time %,
rotations, flips, validity) and writes `characterization.json` (per-metric
mean/median/percentiles + validity rate) plus a suggested `select.json` (never
clobbers an edited one — writes `select.suggested.json` instead). Floors are read
off the song's OWN distribution: the score floor is that song's **median** (a
shared absolute is wrong — luna's ≈686 yields zero tiki bundles). Creative floors
default to 0 = opt-in.

**Edit `select.json`** — the floors a seed must clear to become a video:

```jsonc
{
  "budget": 1000000,
  "floors": {
    "reachedEnd": true, "maxOffBeat": 0,   // validity — cuts garbage
    "score": 686,                           // ≥ the song's median (above-average quality)
    "standTimePctMin": 4,                   // creative gate: % of duration in substantial stands
    "rotationsMin": 0                       // absolute min revolutions (0 = off)
  },
  "render": { "res": "1080x1920", "zoomMult": 1.8, "beatPunchPct": 70 }
}
```

Floors CUT GARBAGE; they don't pick among good tracks. score and stand-time are
roughly independent (`corr ≈ 0`), so don't stack two aggressive floors — a high
stand floor AND an above-median score floor can leave ~nothing. Read
`characterization.json` to choose: e.g. luna `stand≥4% & score≥686` ≈ 4% of seeds.

**Produce** — the anytime, balanced, multi-song producer:

```bash
npm run produce                            # all songs, run until Ctrl-C
npm run produce -- --per-song-target=10    # 10 bundles per song, then stop
```

- Each launch writes a fresh timestamped run dir
  `generated/bundles/<YYMMDD-HHMMSS>/<song>/<song>-s<seed>/` (`video.mp4` +
  `upload.json`, `project: "line"`) — a self-contained batch to copy to the
  downstream processor. A bundle commits only after clearing every floor — no reprocessing.
- **Balanced**: compile lanes always feed the song most behind on bundle count, so
  output stays roughly equal across songs regardless of differing qualify rates.
- **Anytime + resumable**: Ctrl-C any time — in-flight renders finish (atomic
  commit), nothing half-written. A per-host cursor + skip-existing means one machine
  never repeats a seed.
- **Multi-machine**: give each machine a disjoint seed block with `--seed-base=N`
  (or `--auto-seed-base`) so no video is ever generated twice.

Compile (cheap, parallel worker_threads) and render (Playwright ride + Remotion
overlay — the bottleneck) overlap continuously; generation never blocks on rendering.
