/**
 * "LUNA BALA (Slowed)" — first 44s, hand-authored from analyze_audio.py.
 *
 * Source slice: beats/luna_bala_44s.mp3 → beats/luna_bala_44s.audio.json.
 *
 * Authoring stance (manual-first): the analyzer only DESCRIBES the audio. Every
 * musical choice is made here, by reading those measured layers. The split is:
 *
 *   - Where the music is REGULAR, trust the analysis procedurally: in the body
 *     (8.6–42.4s) there is a kick on every ~0.54s beat and ~98% of the beat-grid
 *     hypothesis sits on a real kick, so the grid times ARE the landing backbone.
 *   - Where it needs JUDGMENT, hand-specify:
 *       · 0.0–8.58s has NO DRUMS (kick band flat-zero) but a clear VOICE beat —
 *         ride the vocal onsets, with impact AND speed ramping up into the drop;
 *       · the real drop is 8.58s (sub 0.00→0.89, perc→1.00) — the first hard slam;
 *       · the breakdown (~36–38s) is SYNCOPATED: the felt kicks (36.94 / 37.36 /
 *         37.78) fall off the grid, so we land on those and drop the in-between
 *         grid beat at 37.47 that isn't actually a hit;
 *       · the slowed master collapses to silence at ~43.2s — contacts stop ~42.9s.
 *
 *   - Impact is a one-line, transparent map of the measured ATTACK
 *     (`onset_strength`): harder attack → harder landing. Marquee drop pinned to 1.
 *   - Axes (air/speed/amplitude/camera) are continuous curves read off the
 *     energy/section profile.
 *
 * No elevation (it would fight amplitude for launch angle).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Contact, Curve, Spec } from "../types.ts";
import { keyframes } from "../core/curves.ts";
import { beats } from "../core/beats.ts";

type Frames = { times: number[]; onset_strength: number[]; percussive_rms: number[] };
type BeatRow = { t: number; meter_pos: number | null; band_sub: number; onset_strength: number };
type AudioAnalysis = {
  duration: number;
  tempo: { madmom_bpm: number | null; librosa_bpm: number | null };
  frames: Frames & Record<string, number[]>;
  beat_grid: { beats: BeatRow[] };
};

const audio = JSON.parse(
  readFileSync(resolve("beats/luna_bala_44s.audio.json"), "utf8"),
) as AudioAnalysis;

const DURATION = 44;
const DROP_T = 8.58; // first beat with real percussion (sub 0.00 → 0.89)
const LAST_BODY_T = 42.4; // last real hits before the master collapses to silence

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

// Read a measured layer's value at a time (max within ±win s).
const T = audio.frames.times;
function layerAt(layer: string, t: number, win = 0.06): number {
  const arr = audio.frames[layer];
  let best = 0;
  for (let i = 0; i < T.length; i++) {
    if (T[i] < t - win) continue;
    if (T[i] > t + win) break;
    if (arr[i] > best) best = arr[i];
  }
  return best;
}

// ─────────── Contact times (manual-first) ───────────

// Beatless intro: gentle support touches following the melodic pulse, ending
// well before the drop so a long arc carries the rider into the slam. Hand-
// chosen; their exact timing is for ride/camera continuity, not for a beat.
// The intro has NO drums, but the VOICE carries a clear beat — ride it. These
// are the vocal onsets (snapped from analyze_audio `onsets[]`, confirmed by ear
// in the dashboard). Impact and speed RAMP UP across them into the drop, so the
// intro builds rather than idling at the strict minimum.
const INTRO_VOICE_BEATS = [0.39, 0.81, 1.32, 1.90, 2.65, 3.20, 4.48, 5.74, 6.43, 6.97, 7.50, 8.06];

// Breakdown syncopation (~36–38s): the felt kicks, off the grid. These REPLACE
// the grid beats at 36.92 / 37.47 / 38.02 — keeping 36.9, adding 37.3 & 37.7,
// dropping the 37.5 that isn't a hit.
const BREAKDOWN_SYNC = [36.94, 37.36, 37.78];
const BREAKDOWN_LO = 36.7;
const BREAKDOWN_HI = 38.2;

// Body backbone: every grid beat that carries a real kick (reliable here), with
// the breakdown window handed over to the syncopated kicks above.
function bodyTimes(): number[] {
  const grid = audio.beat_grid.beats
    .filter((b) => b.t >= DROP_T - 0.05 && b.t <= LAST_BODY_T && b.band_sub >= 0.3)
    .filter((b) => !(b.t > BREAKDOWN_LO && b.t < BREAKDOWN_HI))
    .map((b) => b.t);
  return [...grid, ...BREAKDOWN_SYNC].sort((a, b) => a - b);
}

const contactTimes = [
  ...INTRO_VOICE_BEATS,
  ...bodyTimes(),
].map((t) => Number(t.toFixed(3))).sort((a, b) => a - b);

// ─────────── Per-beat impact: a transparent map of the measured attack ───────────
function impactFor(t: number): number {
  if (Math.abs(t - DROP_T) < 0.05) return 1.0; // the drop: pinned slam
  if (t < DROP_T) {
    // Voice intro: gentle early, then ramp up over the last ~2.5s into the drop.
    const ramp = t < 6.0 ? 0 : (t - 6.0) / (DROP_T - 6.0);
    return Number(clamp(0.06 + 0.30 * ramp, 0.04, 1.0).toFixed(3));
  }
  const impact = 0.18 + 0.85 * layerAt("onset_strength", t) + 0.10 * layerAt("percussive_rms", t);
  return Number(clamp(impact, 0.12, 1.0).toFixed(3));
}

const contacts: Contact[] = beats(
  contactTimes.map((t) => ({ t, impact: impactFor(t) })),
);

// ─────────── amplitude axis REMOVED (under review) ───────────
// `amplitude` (jump height) is intentionally left out: on a dense ~0.54s body it
// physically can't pop, and as a felt metric its value is questionable. Let air +
// speed + impact carry the motion. Re-add a `Curve` here and to `axes` to restore.

const speed: Curve = keyframes([
  { t: 0.0, v: 0.34, ease: "smooth" }, // voice intro — already building
  { t: 4.5, v: 0.40, ease: "smooth" },
  { t: 6.4, v: 0.46, ease: "easeIn" },
  { t: 7.5, v: 0.54, ease: "easeIn" }, // ramp hard into the drop
  { t: DROP_T, v: 0.70, ease: "smooth" },
  { t: 12.0, v: 0.74, ease: "smooth" },
  { t: 20.0, v: 0.78, ease: "smooth" },
  { t: 24.4, v: 0.90, ease: "easeIn" }, // climax
  { t: 25.8, v: 0.88, ease: "smooth" },
  { t: 30.0, v: 0.82, ease: "smooth" },
  { t: 38.0, v: 0.74, ease: "smooth" },
  { t: 42.4, v: 0.60, ease: "easeOut" },
  { t: DURATION, v: 0.50 },
]);

const air: Curve = keyframes([
  // High air across the beat sections is NOT "floaty" — it's a BOUNCINESS lever.
  // air = airtime fraction within a gap; on a short 0.54s gap the only way to hit a
  // high target is for the rider to leave the ground repeatedly (bounces, backflips,
  // tail-stands) rather than ride one clean arc. That dynamism is the point: the
  // grounded ~0.5 body read monotone; ~0.72 here makes it alive. (Sits just under the
  // ~0.78 air ceiling on these dense beats, so the asks aren't wasted.)
  { t: 0.0, v: 0.64, ease: "smooth" }, // intro left as-is
  { t: DROP_T, v: 0.72, ease: "smooth" },
  { t: 12.0, v: 0.72, ease: "smooth" },
  { t: 20.0, v: 0.70, ease: "smooth" },
  { t: 24.4, v: 0.62, ease: "easeIn" }, // climax: a touch more grounded
  { t: 25.8, v: 0.66, ease: "smooth" },
  { t: 30.0, v: 0.74, ease: "smooth" },
  { t: 38.0, v: 0.82, ease: "smooth" },
  { t: 42.4, v: 0.85, ease: "smooth" },
  { t: DURATION, v: 0.85 }, // float out as the track collapses
]);

export const overlayMeta = {
  title: "LUNA BALA",
  artist: "SLOWED",
  tempo: `${audio.tempo.madmom_bpm?.toFixed(1) ?? "111.1"} BPM (madmom) / ` +
    `${audio.tempo.librosa_bpm?.toFixed(1) ?? "112.4"} BPM (librosa)`,
  phases: [
    { name: "VOICE INTRO", t0: 0.0, t1: DROP_T, color: "#3a5f8a" },
    { name: "DROP / BODY", t0: DROP_T, t1: 24.2, color: "#d4843a" },
    { name: "CLIMAX", t0: 24.2, t1: 25.8, color: "#c4483f" },
    { name: "GROOVE", t0: 25.8, t1: 35.5, color: "#d46a2e" },
    { name: "BREAKDOWN", t0: 35.5, t1: 42.4, color: "#5f7892" },
    { name: "COLLAPSE", t0: 42.4, t1: DURATION, color: "#3e8f6c" },
  ],
};

const spec: Spec = {
  duration: DURATION,
  music: {
    audio: "beats/luna_bala_44s.mp3",
    title: "LUNA BALA (Slowed)",
    artist: "Unknown",
    tempo: overlayMeta.tempo,
    beats: "beats/luna_bala_44s.audio.json",
    spectrogram: {
      image: "beats/luna_bala_44s.spectrogram.png",
      metadata: "beats/luna_bala_44s.spectrogram.json",
    },
  },
  camera: {
    // Camera shake authored in the spec: every beat with impact ≥ 0.70 punches the
    // zoom in, scaled proportionally up to the hardest hit (the drop). This is the
    // drop, the climax, and the strong breakdown/groove accents — not the soft
    // intro/held-kick beats.
    beatPunch: { threshold: 0.70, amp: 0.13, floor: 0.5, decay: 4, attack: 1, dir: "in" },
    zoom: {
      smoothingFrames: 8,
      keyframes: [
        { t: 0.0, zoom: 2.60 }, // wide; nothing is happening yet
        { t: DROP_T, zoom: 1.95 }, // punch in on the drop
        { t: 12.0, zoom: 1.90 },
        { t: 24.4, zoom: 1.55 }, // climax: in the action
        { t: 25.8, zoom: 1.65 },
        { t: 30.0, zoom: 1.85 },
        { t: 38.0, zoom: 2.05 },
        { t: 42.4, zoom: 2.45 }, // open out as it collapses
        { t: DURATION, zoom: 2.55 },
      ],
    },
  },
  contacts,
  jitter: 0,
  axes: {
    air,
    speed,
  },
};

export default spec;
