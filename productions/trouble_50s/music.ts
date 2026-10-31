/**
 * "Trouble", first 50.3 s: the measured music every variant of the spec shares.
 * Variants (variants/*.ts) choose from these layers; none of them re-reads the audio.
 *
 * Measured with docs/music-authoring.md: separated stems, drum classes, events.json.
 *
 *   0.13–14.44  intro led by the voice. Its syllables sit on a 0.45 s pulse
 *               (0.85, 1.30, 1.73, 2.18 …); chords enter every ~0.9–1.8 s;
 *               0.37 is the opening crash (cymbal + kick).
 *   14.71–27.25 groove. The kick plays 3-3-2 (0.67, 0.67, 0.45 s), a cycle of
 *               1.79 s that no regular grid fits. A lighter drum hit falls about
 *               0.22 s before most kicks (the pickups), over a faint 0.23 s
 *               percussion layer. The voice runs on top.
 *   27.6–29.0   break: drums and bass stop, voice alone.
 *   29.02       the drop (kick + crash + bass, the loudest rise in the clip).
 *   29.0–43.4   stop-and-go. Heavy kicks open each 1.79 s cycle; the bass
 *               re-enters ~0.22 s before a heavy kick and a snare or tom follows
 *               ~0.22 s after; twice three kicks 0.33 s apart (34.40, 41.56).
 *   43.4–46.95  vocal break; 46.2–46.9 a drum swell with no distinct hit.
 *   46.95–50.07 3-3-2 kicks again; 50.07 is one of the loudest, 0.23 s before the end.
 */
import type { Spec } from "../../scripts/v0/types.ts";
import { clamp, measuredSong } from "../../scripts/v0/core/measured.ts";

const song = measuredSong(import.meta.dirname);
const audio = song.audio;
export type { MusicEvent } from "../../scripts/v0/core/measured.ts";
export { clamp };
export const { event, rise, drumPeak, drumStrength, voiceStrength, landings, sungNotes } = song;

export const DURATION = 50.3;
export const GROOVE_T = 14.71;
export const BREAK_T = 27.6;
export const DROP_T = 29.02;
export const STOP_T = 43.4;
export const BUILD_END_T = 46.95;

// ─────────── The layers, as measured event times ───────────

export const OPENING_CRASH = 0.37;

/** Intro: every vocal syllable on the 0.45 s pulse (chord entries where they lead). The first
 *  syllable, 0.13, is too soon after the start for any ride to reach it (compile: no_arc). */
export const INTRO_VOICE = [0.85, 1.30, 1.73, 2.18, 3.10, 3.51, 3.95, 5.31, 5.77, 6.21, 6.66, 7.11, 7.55,
  8.01, 8.46, 8.85, 9.36, 9.82, 10.70, 11.12, 12.45, 12.93, 13.40, 13.83, 14.29];
/** Intro: the starts of vocal phrases and chord entries only. */
export const INTRO_PHRASES = [2.12, 3.51, 5.77, 7.55, 8.01, 8.85, 9.36, 10.70, 12.45, 12.93, 13.40, 13.83, 14.29];

/** Groove: every kick of the 3-3-2 pattern; the cycle starts are the 1.79 s downbeats. */
export const GROOVE_KICKS = [14.71, 15.38, 16.05, 16.50, 17.16, 17.83, 18.29, 18.96, 19.63, 20.09, 20.75, 21.42,
  21.87, 22.55, 23.21, 23.66, 24.34, 25.01, 25.45, 26.12, 26.80, 27.25];
export const GROOVE_CYCLES = [14.71, 16.50, 18.29, 20.09, 21.87, 23.66, 25.45, 27.25];
/** Groove: the lighter drum hit ~0.22 s before a kick. */
export const GROOVE_PICKUPS = [18.75, 19.41, 20.53, 21.21, 23.00, 24.11, 24.79, 25.90, 26.57];
/** Groove: vocal syllables that stand out over the drums (a kick where the two coincide). */
export const GROOVE_VOICE = [16.05, 16.78, 17.44, 17.83, 20.09, 21.42, 21.87, 22.34, 22.79, 23.66, 25.01, 26.80];

/** Break: the voice alone before the drop. */
export const BREAK_VOICE = [27.73, 28.09, 28.58];

/** Drop section: the heavy kicks, the toms and snares that stand alone, the bass entries and the voice. */
export const DROP_KICKS = [29.02, 30.82, 31.50, 32.61, 34.40, 34.74, 35.07, 36.19, 37.99, 38.66, 39.78, 41.56, 41.90, 42.24];
export const DROP_CYCLES = [29.02, 30.82, 32.61, 34.40, 36.19, 37.99, 39.78, 41.56];
export const DROP_SNARES = [29.94, 33.49, 37.08, 40.67];
export const DROP_BASS_ENTRIES = [30.59, 32.39, 34.18, 37.76, 39.55, 41.34];
export const DROP_AFTERHITS = [31.72, 35.29, 38.87, 42.47];
export const DROP_VOICE = [31.72, 33.77, 35.61, 38.93, 40.94, 42.53];

/** Vocal break, then the kicks after the swell. */
export const BREAK2_VOICE = [43.77, 44.23, 44.91, 45.62, 46.02];
export const OUTRO_KICKS = [46.95, 47.61, 48.29, 48.74, 49.41, 50.07];
export const OUTRO_VOICE = [47.86, 48.53, 49.03];

// ─────────── Shared presentation ───────────

export const phases = [
  { name: "VOICE INTRO", t0: 0.0, t1: GROOVE_T, color: "#3a5f8a" },
  { name: "GROOVE 3-3-2", t0: GROOVE_T, t1: BREAK_T, color: "#d46a2e" },
  { name: "BREAK", t0: BREAK_T, t1: DROP_T, color: "#5f7892" },
  { name: "DROP · STOP-AND-GO", t0: DROP_T, t1: STOP_T, color: "#c4483f" },
  { name: "VOCAL BREAK · BUILD", t0: STOP_T, t1: BUILD_END_T, color: "#5f7892" },
  { name: "GROOVE 3-3-2", t0: BUILD_END_T, t1: DURATION, color: "#d46a2e" },
];
export const overlayMeta = {
  title: "TROUBLE",
  artist: "",
  tempo: `${audio.tempo.librosa_bpm?.toFixed(1) ?? "129.2"} BPM (librosa); kick in 3-3-2`,
  phases,
};
/** Camera shared by the variants: wide in the intro, closer for the drop. */
export const zoom = {
  smoothingFrames: 8,
  keyframes: [
    { t: 0.0, zoom: 2.60 },
    { t: GROOVE_T, zoom: 2.10 },
    { t: DROP_T, zoom: 1.80 },
    { t: STOP_T, zoom: 2.30 },
    { t: BUILD_END_T, zoom: 2.00 },
    { t: DURATION, zoom: 2.30 },
  ],
};
export const music: Spec["music"] = {
  audio: "productions/trouble_50s/audio.mp3",
  title: "Trouble",
  artist: "Unknown",
  tempo: overlayMeta.tempo,
  beats: "productions/trouble_50s/audio.json",
  spectrogram: {
    image: "productions/trouble_50s/spectrogram.png",
    metadata: "productions/trouble_50s/spectrogram.json",
  },
};
