/**
 * "AMOR NA PRAIA" — first 46s, hand-authored from analyze_audio.py.
 *
 * Co-located inputs: productions/amor_na_praia_46s/{audio.mp3, audio.json} (the
 * analyze_audio.py output). Read relative to this file (import.meta.dirname).
 *
 * Authoring stance (manual-first): the analyzer only DESCRIBES the audio. Every
 * musical choice is made here, by reading those measured layers. madmom puts the
 * pulse at ~109 BPM / 0.55s, but its grid is QUANTIZED and disagrees with the
 * played percussion in two places that matter (see the burst, below) — so where
 * the ear and the energy layers disagree with the grid, we follow the energy.
 *
 *   - Body (9.1–43.2s): a smooth, sub-driven four-on-the-floor. EVERY grid beat
 *     carries a real bass pulse (sub ≥ 0.5), so the grid times are the backbone.
 *   - Burst (4.46–7.66s): the punchiest part of the clip — but the real hits are
 *     OFF the grid. The first/loudest hit is 4.46 (rms peaks to the track max,
 *     pratio 0.94), which madmom quantized to 4.70; the strong hit near the end
 *     is 7.34 (pratio 0.97), which madmom put at 7.46 (a weak, harmonic 7.50 is
 *     NOT played); a softer real hit follows at 7.66. We land on the measured
 *     onsets, not the grid. (Heard & confirmed in the dashboard.)
 *   - Beatless stretches (0–4.4 intro tail, 7.9–9.1 breath, the 26.3–26.7 hole,
 *     the post-43.2 fade) get gentle support touches only — no hard landings on
 *     extrapolated pulse.
 *   - The drop is 9.10 (sub → 1.00, the sustained groove arrives) — pinned 1.
 *   - 26.70 is a RE-DROP: the segmenter finds a ~0.25s hole at 26.29–26.70 (rms
 *     0.30, sub 0.04), then the groove re-enters at 26.70 with the body's highest
 *     onset (0.62). Pinned 1, like the drop.
 *   - The master collapses at ~43.3s; 43.20 is the last full beat (medium), then
 *     two near-silent grid touches (43.75 fully decayed, 44.30 a soft swell)
 *     ride the fade out smoothly.
 *
 * IMPACT = how loud the beat actually is, NOT the grid.
 *   Earlier this spec drove impact from `onset_strength` + a downbeat bonus. That
 *   was wrong: `onset_strength` spikes on CHORD-CHANGE downbeats (a melodic
 *   novelty signal), not on loudness. In this even groove the kick is steady on
 *   every beat, and the chord-change downbeats are often slightly QUIETER in
 *   rms/sub than the off-beats around them (e.g. 33.30 sits among the quietest
 *   beats, yet the old map hammered it at 0.64). So impact now reads a measured
 *   LOUDNESS composite (percussive + sub-kick + rms) at each beat. The result is
 *   honest: a fairly even body (~0.3–0.5) that DIPS on the genuinely quiet beats
 *   and rises on the genuinely loud ones, a loud burst (~0.6–0.74), and two
 *   pinned drops. The two named drops are the only 1.0s; the dynamism elsewhere
 *   is carried by air/speed/camera (see the axes).
 *
 * No elevation (it would fight amplitude for launch angle); amplitude omitted on
 * this dense 0.55s groove (it can't pop) — air + speed + impact carry the motion.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Contact, Curve, Spec } from "../../scripts/v0/types.ts";
import { keyframes } from "../../scripts/v0/core/curves.ts";
import { beats } from "../../scripts/v0/core/beats.ts";

type BeatRow = { t: number; meter_pos: number | null; percussive: number; band_sub: number; onset_strength: number };
type AudioAnalysis = {
  duration: number;
  tempo: { madmom_bpm: number | null; librosa_bpm: number | null };
  frames: Record<string, number[]>;
  beat_grid: { beats: BeatRow[] };
};

const audio = JSON.parse(
  readFileSync(resolve(import.meta.dirname, "audio.json"), "utf8"),
) as AudioAnalysis;

const DURATION = 46;
const DROP_T = 9.10; // the main drop: sustained groove arrives (sub → 1.00)
const REDROP_T = 26.70; // re-drop: groove re-enters after the 26.29–26.70 hole
const LAST_BODY_T = 43.20; // last full beat before the master collapses to fade

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

// Local peak of a measured layer around t (max within ±win s). win=0.10 is wide
// enough to catch a hit whose energy peak sits a frame off the onset time, yet
// well inside the 0.55s beat spacing so it never bleeds into a neighbour.
const T = audio.frames.times;
function layerAt(layer: string, t: number, win = 0.10): number {
  const arr = audio.frames[layer];
  let best = 0;
  for (let i = 0; i < T.length; i++) {
    if (T[i] < t - win) continue;
    if (T[i] > t + win) break;
    if (arr[i] > best) best = arr[i];
  }
  return best;
}

// "How loud is the beat" — a perceptual composite weighted toward the hit (the
// percussive transient and the sub-kick) with rms as support.
function loudAt(t: number): number {
  return 0.40 * layerAt("percussive_rms", t) + 0.35 * layerAt("band_sub", t) + 0.25 * layerAt("rms", t);
}

// Map measured loudness → felt impact, calibrated to this track's own body range.
// The body groove is steady but it should HIT harder than a soft glide — it spans
// loud ≈ 0.627…0.770, which we spread to impact 0.45…0.65 (still proportional: quiet
// chord-dip downbeats land ~0.45, the heavier off-beats ~0.65). This is the BALANCED
// setting: harder than a 0.3–0.5 body, but not so hard it drives the rider flat and
// kills the bounce (a 0.55–0.80 body zeroed the nose/tail-stands; this keeps a little).
// The percussion burst is far louder (loud ≈ 0.86…0.95) so it rides up to the 0.80
// cap — the hardest hits short of the two pinned 1.0 drops.
function impactFromLoud(t: number): number {
  return Number(clamp(0.45 + 1.40 * (loudAt(t) - 0.627), 0.42, 0.80).toFixed(3));
}

// ─────────── Contact times ───────────

// Soft melodic intro + beatless tail (0.30–3.59): gentle support touches on the
// grid. We drop the grid's 4.13 so the last support (3.59) floats 0.87s into the
// loud first burst hit at 4.46 — room for it to actually slam.
const INTRO_SUPPORT = audio.beat_grid.beats
  .filter((b) => b.t >= 0.2 && b.t < 4.0)
  .map((b) => Number(b.t.toFixed(3)));

// PERCUSSION BURST — the real hits, read off analyze_audio `onsets[]` (high
// percussive_ratio), NOT the quantized grid. 4.46 is the loudest; 7.34 & 7.66
// replace the grid's 7.46 (the played hit is 7.34; 7.50 is a weak harmonic that
// is NOT a beat). 6.90 has no discrete onset but a sustained perc/sub roll.
const BURST_HITS = [4.46, 5.27, 5.83, 6.36, 6.90, 7.34, 7.66];

// BREATH (7.9–9.1, sub → 0): genuinely beatless, so NO support touch — the rider
// floats the full 1.44s from the last burst hit (7.66) straight into the drop.
// That long entering arc is what lets the drop slam: with a 0.55s setup it caps
// at a soft 0.35 catch; floated, it lands with real force (mirrors the re-drop's
// 1.1s float across the hole). The drop is THE moment — it should hit hardest.
const BREATH_SUPPORT: number[] = [];

// BODY backbone: every grid beat with a real bass pulse, from the drop to the
// last full beat — EXCEPT the 26.15 pickup right before the hole: dropping it
// floats the rider 1.1s across the break (25.60 → 26.70) so the re-drop lands
// with real force instead of the 0.11 it achieves when caught straight out of
// the hole. The hole (26.29–26.70) is a genuine break, so the float is faithful.
const REDROP_LEADIN = 26.15;
const BODY = audio.beat_grid.beats
  .filter((b) => b.t >= DROP_T - 0.02 && b.t <= LAST_BODY_T && b.band_sub >= 0.5)
  .filter((b) => Math.abs(b.t - REDROP_LEADIN) > 0.05)
  .map((b) => Number(b.t.toFixed(3)));

// FADE: two near-silent grid touches after the last full beat so the ride eases
// out instead of stopping dead. 43.75 is fully decayed; 44.30 is a soft swell.
const FADE_SUPPORT = [43.75, 44.30];

const SUPPORT = new Set([...INTRO_SUPPORT, ...BREATH_SUPPORT]);
const FADE = new Map<number, number>([[43.75, 0.05], [44.30, 0.10]]);

const contactTimes = [
  ...INTRO_SUPPORT,
  ...BURST_HITS,
  ...BREATH_SUPPORT,
  ...BODY,
  ...FADE_SUPPORT,
].map((t) => Number(t.toFixed(3))).sort((a, b) => a - b);

function impactFor(t: number): number {
  if (Math.abs(t - DROP_T) < 0.03) return 1.0; // the drop
  if (Math.abs(t - REDROP_T) < 0.03) return 1.0; // the re-drop (after the hole)
  if (FADE.has(t)) return FADE.get(t)!; // smooth fade-out touches
  if (SUPPORT.has(t)) return 0.04; // beatless support
  return impactFromLoud(t); // burst + body: driven by measured loudness
}

const contacts: Contact[] = beats(
  contactTimes.map((t) => ({ t, impact: impactFor(t) })),
);

// ─────────── Axes ───────────
// `amplitude` intentionally omitted: a dense 0.55s groove physically can't pop,
// and the only sparse gaps (the breaths) are quiet support, not big arcs. Let
// air + speed + impact carry the motion.

const speed: Curve = keyframes([
  { t: 0.0, v: 0.32, ease: "smooth" }, // soft melodic intro
  { t: 3.6, v: 0.42, ease: "easeIn" }, // build into the burst
  { t: 5.83, v: 0.56, ease: "smooth" }, // burst peak (loudest perc)
  { t: 7.66, v: 0.50, ease: "smooth" },
  { t: 8.30, v: 0.52, ease: "easeIn" }, // breath, then ramp hard into the drop
  { t: DROP_T, v: 0.72, ease: "smooth" },
  { t: 16.0, v: 0.78, ease: "smooth" },
  { t: 23.0, v: 0.84, ease: "smooth" }, // groove climax
  { t: 26.29, v: 0.70, ease: "easeOut" }, // the hole: pull back
  { t: REDROP_T, v: 0.82, ease: "easeIn" }, // slam back in on the re-drop
  { t: 34.0, v: 0.80, ease: "smooth" },
  { t: LAST_BODY_T, v: 0.62, ease: "easeOut" },
  { t: DURATION, v: 0.50 },
]);

const air: Curve = keyframes([
  // air = airborne fraction within a gap = the BOUNCINESS / dynamism lever, NOT
  // floatiness. On these dense ~0.55s beats a high target means the rider leaves
  // the ground repeatedly (bounces, partial flips, end-stands) — that liveliness
  // is what carries an even groove whose impact is (honestly) fairly flat.
  { t: 0.0, v: 0.50, ease: "smooth" }, // grounded soft intro
  { t: 4.46, v: 0.60, ease: "smooth" }, // burst: lively but still punchy
  { t: 7.66, v: 0.62, ease: "smooth" },
  { t: DROP_T, v: 0.72, ease: "smooth" }, // body comes alive
  { t: 16.0, v: 0.72, ease: "smooth" },
  { t: 23.0, v: 0.66, ease: "easeIn" }, // climax a touch more grounded
  { t: REDROP_T, v: 0.72, ease: "smooth" },
  { t: 34.0, v: 0.76, ease: "smooth" },
  { t: LAST_BODY_T, v: 0.82, ease: "smooth" },
  { t: DURATION, v: 0.85 }, // float out
]);

export const overlayMeta = {
  title: "AMOR NA PRAIA",
  artist: "SLOWED",
  tempo: `${audio.tempo.madmom_bpm?.toFixed(1) ?? "109.1"} BPM (madmom) / ` +
    `${audio.tempo.librosa_bpm?.toFixed(1) ?? "143.6"} BPM (librosa)`,
  phases: [
    { name: "SOFT INTRO", t0: 0.0, t1: 4.46, color: "#3a5f8a" },
    { name: "PERC BURST", t0: 4.46, t1: 7.87, color: "#d4843a" },
    { name: "BREATH", t0: 7.87, t1: DROP_T, color: "#5f7892" },
    { name: "DROP / GROOVE", t0: DROP_T, t1: 26.29, color: "#d4843a" },
    { name: "HOLE", t0: 26.29, t1: REDROP_T, color: "#6d5aa8" },
    { name: "RE-DROP / RUN", t0: REDROP_T, t1: LAST_BODY_T, color: "#d46a2e" },
    { name: "FADE", t0: LAST_BODY_T, t1: DURATION, color: "#3e8f6c" },
  ],
};

const spec: Spec = {
  duration: DURATION,
  music: {
    audio: "productions/amor_na_praia_46s/audio.mp3",
    title: "AMOR NA PRAIA (Slowed)",
    artist: "Unknown",
    tempo: overlayMeta.tempo,
    beats: "productions/amor_na_praia_46s/audio.json",
    spectrogram: {
      image: "productions/amor_na_praia_46s/spectrogram.png",
      metadata: "productions/amor_na_praia_46s/spectrogram.json",
    },
  },
  camera: {
    // Punch in on the genuinely loud beats (impact ≥ 0.62): the burst core and
    // the two drops — not the soft intro / steady body beats.
    beatPunch: { threshold: 0.62, amp: 0.13, floor: 0.5, decay: 4, attack: 1, dir: "in" },
    zoom: {
      smoothingFrames: 8,
      keyframes: [
        { t: 0.0, zoom: 2.60 }, // wide; gentle intro
        { t: 4.46, zoom: 2.00 }, // punch in on the burst's first (loudest) hit
        { t: 7.87, zoom: 2.30 }, // breathe
        { t: DROP_T, zoom: 1.85 }, // punch in on the drop
        { t: 16.0, zoom: 1.75 },
        { t: 23.0, zoom: 1.60 }, // climax: tightest, in the action
        { t: 26.29, zoom: 2.05 }, // the hole: open out
        { t: REDROP_T, zoom: 1.70 }, // re-drop: punch back in hardest
        { t: 34.0, zoom: 1.85 },
        { t: LAST_BODY_T, zoom: 2.40 }, // open out as it fades
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
