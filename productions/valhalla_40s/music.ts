/**
 * "Valhalla", 40.07 s: the measured music every variant of the spec shares.
 * Variants (variants/*.ts) choose from these layers; none of them re-reads the audio.
 *
 * Measured with docs/music-authoring.md: separated stems, drum classes, events.json.
 * Tempo about 92 BPM (madmom): one beat every 0.65 s.
 *
 *   0.06–9.3   calm opening: the voice alone, long held notes about 2.5 s apart
 *              (1.46, 4.16, 6.75, 8.58). The 0.06 note is too early for any ride.
 *   9.32       a lone kick + snare: the drums announce themselves once.
 *   9.97–19.0  the voice in phrases: phrase starts, then fast runs of words about
 *              0.32 s apart (10.30–10.91, 12.56–13.85, 15.17–15.89), each closing
 *              on an accent (11.26, 14.50, 16.14, 17.09, 18.40, 19.03).
 *   19.69      a second lone kick, with the voice.
 *   20.36–29.4 more phrases, the same shape (runs 20.36–21.00, 21.63–22.28,
 *              23.27–24.24); a quiet gap 27.5–29.37, then one syllable before the drop.
 *   30.06      the drop: full drums and bass, the loudest hit in the song.
 *   30.06–40.07 the groove: kick on beat 1 and the "and" of 3, snare on 2 and 4,
 *              so the kicks alternate 1.6 s and 1.0 s apart and three kicks are
 *              followed 0.31–0.33 s later by a snare (31.67→32.00, 34.27→34.60,
 *              36.86→37.17). Snares are about 0.4, a third of a kick. The voice goes
 *              on over the drums. The last kick, 39.45, is 0.62 s before the end.
 */
import type { Spec } from "../../scripts/v0/types.ts";
import { clamp, measuredSong } from "../../scripts/v0/core/measured.ts";

const song = measuredSong(import.meta.dirname);
export type { MusicEvent } from "../../scripts/v0/core/measured.ts";
export { clamp };
export const { event, rise, drumPeak, drumStrength, voiceStrength, landings } = song;

export const DURATION = 40.07;
export const PHRASES_T = 9.97;
export const DROP_T = 30.06;

// ─────────── The layers, as measured event times ───────────

/** Opening: the held notes of the voice alone, about 2.5 s apart. */
export const OPENING_NOTES = [1.46, 4.16, 6.75, 8.58];
/** The two lone drum hits before the drop (9.32 kick + snare, drums 0.57; 19.69 kick, loud in the mix). */
export const LONE_HITS = [9.32, 19.69];

/** Phrases: where each sung phrase starts, after a pause. */
export const PHRASE_STARTS = [10.30, 12.56, 15.17, 17.09, 20.36, 23.27, 26.19, 29.37];
/** Phrases: the strongest syllable of each phrase (the sharpest vocal rise). */
export const ACCENTS = [11.26, 14.50, 16.14, 18.40, 19.03, 21.63, 24.24, 26.64];
/** Phrases: fast runs of words, about 0.32 s apart (each run starts on a phrase start). */
export const WORD_RUNS = [
  10.30, 10.61, 10.91,
  12.56, 12.89, 13.20, 13.53, 13.85,
  15.17, 15.49, 15.89,
  20.36, 20.68, 21.00,
  21.63, 21.97, 22.28,
  23.59, 23.91, 24.24,
];

/** Phrases: every heard word. The vocal onsets with a clear attack (rise ≥ 0.12), at least
 *  0.2 s apart, corrected by the owner's ear (2026-10-31): 11.92 is a sung "ho" that the stem
 *  separation put in "other"; 17.75 and 18.08 open the "oh-oh-oh" ending on 18.40; 13.53 is
 *  not heard (it measures like 18.08, so loudness alone cannot tell them apart). */
export const WORDS = [10.91, 11.26, 11.92, 12.56, 12.89, 13.20, 13.85, 14.50, 15.17, 16.14, 16.39, 17.09,
  17.75, 18.08, 18.40, 19.03, 20.36, 20.68, 21.00, 21.30, 21.63, 21.97, 22.28, 23.91, 24.24, 24.89, 26.64, 29.37];

/** Groove: every kick (loud, 0.99–1.13). */
export const KICKS = [30.06, 31.67, 32.65, 34.27, 35.24, 36.86, 37.84, 39.45];
/** Groove: every snare, on 2 and 4 (about 0.4, a third of a kick). */
export const SNARES = [30.71, 32.00, 33.30, 34.60, 35.89, 37.17, 38.48];
/** Groove: bass entries between the hits (about 0.25–0.35 in the bass; often with a syllable). */
export const BASS_ENTRIES = [31.02, 32.34, 33.63, 36.22, 37.52];
/** Groove: syllables over the drums (not landed by default: the drums lead). */
export const GROOVE_VOICE = [31.02, 31.37, 33.97, 34.92, 38.77, 39.79];

// ─────────── Shared presentation ───────────

export const phases = [
  { name: "OPENING", t0: 0.0, t1: PHRASES_T, color: "#3a5f8a" },
  { name: "PHRASES", t0: PHRASES_T, t1: DROP_T, color: "#5f7892" },
  { name: "DROP · GROOVE", t0: DROP_T, t1: DURATION, color: "#c4483f" },
];
export const overlayMeta = {
  title: "VALHALLA",
  artist: "",
  tempo: `${song.audio.tempo.madmom_bpm?.toFixed(1) ?? "92.3"} BPM`,
  phases,
};
/** Camera shared by the variants: wide in the calm opening, closer for the drop. */
export const zoom = {
  smoothingFrames: 8,
  keyframes: [
    { t: 0.0, zoom: 2.70 },
    { t: PHRASES_T, zoom: 2.30 },
    { t: DROP_T, zoom: 1.80 },
    { t: DURATION, zoom: 2.00 },
  ],
};
export const music: Spec["music"] = {
  audio: "productions/valhalla_40s/audio.mp3",
  title: "Valhalla",
  artist: "Unknown",
  tempo: overlayMeta.tempo,
  beats: "productions/valhalla_40s/audio.json",
  spectrogram: {
    image: "productions/valhalla_40s/spectrogram.png",
    metadata: "productions/valhalla_40s/spectrogram.json",
  },
};
