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

The worked example throughout is `scripts/v0/specs/luna_bala_44s.ts`, driven by
`beats/luna_bala_44s.audio.json`.

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
ffmpeg -y -i "LUNA BALA (Slowed) [dukNdSgaLtc].opus" \
  -t 44 -vn -codec:a libmp3lame -q:a 2 beats/luna_bala_44s.mp3

/tmp/mm310/bin/python scripts/analyze_audio.py \
  --audio beats/luna_bala_44s.mp3 \
  --out beats/luna_bala_44s.audio.json \
  --window 0:10           # finer console tables for a region (optional)
```

Optional spectrogram assets for the dashboard:

```bash
/tmp/mm310/bin/python - <<'PY'
from pathlib import Path
import importlib.util
spec = importlib.util.spec_from_file_location("extract_spectrogram", "beats/extract_spectrogram.py")
mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
mod.main(Path("beats/luna_bala_44s.mp3"),
         Path("beats/luna_bala_44s.spectrogram.png"),
         Path("beats/luna_bala_44s.spectrogram.json"))
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
- **The accent hierarchy** is `onset_strength` per beat: high on snares/claps and
  the drop, low on held kicks. Drive `impact` from this.
- **Syncopation** lives in `onsets[]` vs the grid. In LUNA's breakdown the felt
  kicks (36.94 / 37.36 / 37.78s, high `percussive_ratio`) fall *off* the grid,
  while the grid beat at 37.47 is a weak in-between that isn't actually hit.
  Land on the onsets, drop the grid beat — exactly what the ear reports.
- **The ending** often collapses: `rms`/`sub` fall to ~0 (LUNA: silence past
  ~43.2s). Stop contacts there.

Argue with the analysis. If a layer disagrees with what you hear, trust your
ears and write down why — but first check you are reading the right layer (the
beat grid is a hypothesis; the energy/onset layers are the evidence).

---

## 3. Author the spec

A spec is a TypeScript module exporting a `Spec`. The authoring surface:

```ts
import type { Contact, Curve, Spec } from "../types.ts";
import { keyframes } from "../core/curves.ts";   // also: constant, ramp
import { beats } from "../core/beats.ts";         // also: withImpact

const spec: Spec = {
  duration: 44,
  music: { audio, title, artist, tempo, beats: "...audio.json", spectrogram },
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
strong; it is the velocity-redirection arc at the catch). Map it transparently
from the measured **attack**: harder `onset_strength` ⇒ harder landing. A
one-line rule plus a pin on the marquee drop is plenty:

```ts
if (isSupport) return 0.04;
if (isDrop) return 1.0;
return clamp(0.18 + 0.85 * onsetStrengthAt(t) + 0.10 * percussiveAt(t), 0.12, 1.0);
```

`impact` is **scored** but bounded by physics: dense (~0.5s) beats cap impact
well below 1.0 because the rider must immediately launch into the next beat, and
slow sections cap it too (a slow catch can't redirect hard). So a 1.0 ask on a
dense climax bar is fine — the compiler clamps it to what is catchable and the
report tells you the achieved value. Big slams need *room* (a longer entering
gap) and *speed*.

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
  --spec=scripts/v0/specs/luna_bala_44s.ts \
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

Useful failures:

- A hard landing sits where you hear no beat → you trusted the beat grid instead
  of `band_sub`/`percussive_rms`. The beats there are extrapolated.
- A real beat is missing → it is off-grid; find it in `onsets[]`.
- A "support" touch lands hard → its entering gap is too long; add a touch to
  shorten it.
- High amplitude on dense beats does nothing → make a longer gap or lower the ask.
- High impact and high amplitude fight → decide which the moment needs.
- Report score improves but shape regresses → watch the video; prefer the version
  that reads better.
