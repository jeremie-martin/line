/**
 * Amor na Praia (slowed), first 46 s: the measured layers every variant reads.
 * Event times are from productions/amor_na_praia_46s/events.json (Demucs stems +
 * ADTOF drum classes); sung notes from sung.json. Loudness is the stem envelope as a
 * fraction of the mix's 99th-percentile RMS (generated/stems/amor_na_praia_46s).
 *
 * Structure, section by section (loudness = mix envelope):
 *
 *   0–4.46  SOFT INTRO. One 808 kick at 0.337 (drums 0.47) whose low boom sustains and
 *           dies away by about 3.4 s. Over it, a chopped, mostly UNPITCHED vocal
 *           (sung.py finds no pitched note before 5.29) in three short phrases:
 *           0.89–1.68, 2.55–3.37, 3.91–4.18. From 2.0 to 4.4 the mix sits at 0.31:
 *           the quietest stretch of the clip. Nothing else plays (bass, other ≈ 0).
 *   4.46–7.9 BURST. The 808 alone, very loud (drums 0.83–0.98, mix ≈ 1.0), no bass.
 *           4.458 is the loudest hit of the clip; 4.725 (kick+snare) answers it
 *           0.267 s later; then a kick roughly every 0.55 s (5.283 … 6.931), tightening
 *           to 0.42/0.41 at 7.349 and 7.755.
 *   7.9–9.1 BREATH. Drums and bass stop; the voice alone (mix 0.32–0.41). One clear
 *           vocal onset (8.046); the rest are faint (rise ≤ 0.12).
 *   9.125   DROP. Kick+snare and, for the first time, the bass and the synth (other).
 *   9.1–26.3 GROOVE. Four-on-the-floor 808 every 0.55 s (drums 0.80–0.91, all nearly
 *           equal), over a side-chained bass drone. The "bass onsets" between kicks
 *           are the drone recovering from the ducking, not attacks; the vocal is
 *           breathy chops (x marks on the sheets). Nothing audible sits between the
 *           kicks: this groove has no off-beat layer (checked kick by kick: the
 *           strongest in-between rises are 0.1–0.33 against kicks at 0.8–0.9).
 *   26.3–26.7 HOLE. After the kick at 26.180 the bass and synth cut out (mix 0.31–0.36);
 *           a sung "hey" (26.285, C♯4, salience 0.90) fills it.
 *   26.726  RE-DROP. Kick+tom, bass and synth back together.
 *   26.7–43.2 GROOVE 2. The same groove; toms double many kicks from here on. Even
 *           loudness again: there is no build and no louder section.
 *   43.3–46 FADE. The master drops after the kick at 43.236 (mix 0.40); the voice
 *           sings two notes (43.654, 43.897 C♯4, salience 0.80); a soft kick with the
 *           bass returns at 44.339 (drums 0.27), then everything fades.
 *
 * Calm vs intense, by loudness: calm = 0–4.46 (after the boom), 7.9–9.1, 43.3–46;
 * intense = everything else, at one level. The patterns this song really has:
 * floats in two genuinely quiet stretches, each ended by the clip's strongest hits
 * (P3); stops and re-entries at 4.458, 9.125, 26.726 and 44.339 (P5). It has no dense
 * stretch (P4): the loudest music is one kick every 0.55 s with nothing audible in
 * between, and the only gap under 0.45 s between strong sounds is the burst's
 * 4.458→4.725 (plus 7.349→7.755 at 0.406).
 */
import { measuredSong, clamp } from "../../scripts/v0/core/measured.ts";
import type { SpecCamera, SpecMusic } from "../../scripts/v0/types.ts";

export const { events, audio, event, rise, drumPeak, drumStrength, voiceStrength, landings, sungNotes } =
  measuredSong(import.meta.dirname);
export { clamp };

// ─────────── Sections ───────────
export const DURATION = 46;
export const BOOM = 0.337; // the intro's single 808, sustaining to ~3.4 s
export const BURST_START = 4.458; // loudest hit of the clip: drums enter after the quiet
export const BREATH_START = 7.9; // drums stop after the kick at 7.755
export const DROP = 9.125; // kick+snare, bass and synth arrive
export const HOLE_START = 26.29; // bass and synth cut after the kick at 26.180
export const REDROP = 26.726; // everything back
export const FADE_START = 43.3; // master drops after the kick at 43.236
export const SOFT_RETURN = 44.339; // a soft kick and the bass come back once

// ─────────── Layers (measured event times) ───────────

/** Intro vocal chops (unpitched), by phrase. Rises 0.04–0.24, the only sound after the boom dies. */
export const INTRO_PHRASES = [
  [0.894, 1.138, 1.463, 1.683],
  [2.554, 3.1, 3.367],
  [3.913, 4.18],
];
/** The first chop of each intro phrase. */
export const INTRO_PHRASE_STARTS = INTRO_PHRASES.map((p) => p[0]);

/** The burst: the 808 alone (4.725 is kick+snare). */
export const BURST = [4.458, 4.725, 5.283, 5.828, 6.385, 6.931, 7.349, 7.755];

/** The one clear voice onset inside the breath (vocal rise 0.20). */
export const BREATH_VOICE = 8.046;

/** Every groove kick from the drop to the last full beat (19.586 and 35.538 are kick+snare). */
export const GROOVE_KICKS = [
  9.125, 9.683, 10.228, 10.786, 11.331, 11.889, 12.434, 12.98, 13.537, 14.083, 14.629, 15.186, 15.732, 16.289,
  16.834, 17.38, 17.937, 18.483, 19.029, 19.586, 20.132, 20.689, 21.235, 21.78, 22.338, 22.883, 23.429, 23.986,
  24.532, 25.089, 25.635, 26.18, 26.726, 27.283, 27.829, 28.386, 28.932, 29.489, 30.035, 30.581, 31.138, 31.684,
  32.229, 32.787, 33.321, 33.89, 34.435, 34.981, 35.538, 36.084, 36.641, 37.187, 37.732, 38.29, 38.835, 39.381,
  39.938, 40.484, 41.03, 41.587, 42.133, 42.69, 43.236,
];
/** The sung "hey" that fills the hole (C♯4, salience 0.90). Too close to the 26.180 kick (0.105 s) to land both. */
export const HOLE_VOICE = 26.285;

/** The fade: two sung notes (salience 0.54, 0.80), then the soft kick+bass return. */
export const FADE_VOICE = [43.654, 43.897];

// Every layer time must be a measured event (event() throws otherwise).
for (const t of [BOOM, ...INTRO_PHRASES.flat(), ...BURST, BREATH_VOICE, ...GROOVE_KICKS, HOLE_VOICE, ...FADE_VOICE, SOFT_RETURN])
  event(t);

/**
 * Not landed in any variant, with the reason:
 *  - 0.058 (vocal breath at the very start: before the first catchable frame);
 *  - 28.294 (a drum flam 0.092 s before the 28.386 kick, the same hit);
 *  - 40.937 (drum ghost, rise 0.23, 0.093 s before the 41.030 kick);
 *  - every bass/other/vocal onset between groove kicks (rises 0.1–0.33: ducking recoveries
 *    and breathy chops, a quarter of a kick or less; they would read as noise);
 *  - 44.919 and later (fade residue, rises ≤ 0.14).
 */

// ─────────── Strength ───────────
/** A kick's strength from its measured drum loudness. Groove kicks (0.80–0.91) land 0.60–0.68,
 * which leaves headroom for the pinned structural hits. */
export const kick = (t: number) => drumStrength(t, 0.75);

// ─────────── Presentation ───────────
export const overlayMeta = {
  title: "AMOR NA PRAIA",
  artist: "SLOWED",
  tempo: "109.1 BPM (madmom)",
  phases: [
    { name: "SOFT INTRO", t0: 0, t1: BURST_START, color: "#3a5f8a" },
    { name: "BURST", t0: BURST_START, t1: BREATH_START, color: "#d4843a" },
    { name: "BREATH", t0: BREATH_START, t1: DROP, color: "#5f7892" },
    { name: "GROOVE", t0: DROP, t1: HOLE_START, color: "#d4843a" },
    { name: "HOLE", t0: HOLE_START, t1: REDROP, color: "#6d5aa8" },
    { name: "GROOVE 2", t0: REDROP, t1: FADE_START, color: "#d46a2e" },
    { name: "FADE", t0: FADE_START, t1: DURATION, color: "#3e8f6c" },
  ],
};

export const music: SpecMusic = {
  audio: "productions/amor_na_praia_46s/audio.mp3",
  title: "AMOR NA PRAIA (Slowed)",
  artist: "Unknown",
  tempo: overlayMeta.tempo,
  beats: "productions/amor_na_praia_46s/audio.json",
  spectrogram: {
    image: "productions/amor_na_praia_46s/spectrogram.png",
    metadata: "productions/amor_na_praia_46s/spectrogram.json",
  },
};

/** Wide in the quiet, in on the loud entries. */
export const camera: SpecCamera = {
  zoom: {
    smoothingFrames: 8,
    keyframes: [
      { t: 0, zoom: 2.6 },
      { t: BURST_START, zoom: 2.0 },
      { t: BREATH_START, zoom: 2.35 },
      { t: DROP, zoom: 1.85 },
      { t: 23.0, zoom: 1.7 },
      { t: HOLE_START, zoom: 2.0 },
      { t: REDROP, zoom: 1.7 },
      { t: FADE_START, zoom: 2.4 },
      { t: DURATION, zoom: 2.55 },
    ],
  },
};
