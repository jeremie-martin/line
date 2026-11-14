/**
 * "Bones", a 54 s selection (the stripped bridge into the final chorus): the measured layers its handcrafted
 * variants share. Times are events from events.json; loudness is the mix envelope.
 *
 *   0–8.6      The voice alone, almost whispered (mix 0.3–0.4).
 *   8.6–15.0   The voice with three bass entries under it (8.94, 11.04, 13.14), each alone in the quiet.
 *   15.3–17.3  The pickup: four sharp words (15.28–16.35), then three drum strokes (16.56, 16.82, 17.11).
 *   17.36      The chorus enters (the sharpest attack of the clip).
 *   17.4–49.7  The chorus: sixteen bars of 2.1 s. Each bar has two heavy drum hits 0.8 s apart: the first sharp
 *              (attack 0.5–0.8), the second as loud or louder in the mix but softer in attack (about 0.4), a fatter
 *              sound. A lighter stroke comes 0.27 s before the second hit and another 0.55 s before the next bar.
 *              Every fourth bar (23.67, 32.09, 40.51, 48.92) plays three heavy hits: a fill.
 *   49.7–54    The release: two soft strokes (50.26, 50.53), then the tail rings out for three seconds.
 */
import type { Spec } from "../../scripts/v0/types.ts";
import { measuredSong } from "../../scripts/v0/core/measured.ts";

const song = measuredSong(import.meta.dirname);
export const { event, table } = song;

export const DURATION = 54;
export const CHORUS = 17.357;
export const RELEASE = 50.0;

/** Bridge: the clearly sung words (vocal attack 0.15 or more), and the softer ones between them. */
export const CLEAR_WORDS = [0.38, 2.50, 2.81, 3.54, 4.35, 4.60, 4.91, 5.14, 5.67, 6.69, 8.64, 9.97, 12.04, 14.27, 14.98];
export const SOFT_WORDS = [0.73, 1.50, 2.11, 3.04, 6.18, 9.57, 10.39, 11.42, 12.50, 13.57];
/** Bridge: the three bass entries. */
export const BASS_ENTRIES = [8.94, 11.04, 13.14];
/** Pickup: four sharp words, then three drum strokes into the chorus. */
export const PICKUP_WORDS = [15.28, 15.65, 16.03, 16.35];
export const PICKUP_DRUMS = [16.56, 16.82, 17.11];

/** Chorus: the first heavy hit of each bar (sharp), the chorus entry included. */
export const FIRST = [17.36, 19.46, 21.56, 23.67, 25.77, 27.89, 29.99, 32.09, 34.19, 36.30, 38.41, 40.51, 42.62, 44.72, 46.82, 48.92];
/** Chorus: the second heavy hit of each bar (as loud, softer attack). */
export const SECOND = [18.15, 20.26, 22.36, 24.46, 26.57, 28.68, 30.78, 32.88, 34.99, 37.09, 39.21, 41.31, 43.42, 45.52, 47.62, 49.73];
/** Chorus: the extra heavy hit in the middle of each fill bar. */
export const FILL = [23.93, 32.36, 40.77, 49.19];
/** Chorus: the lighter stroke 0.27 s before the second hit (bars without a fill). */
export const BEFORE_SECOND = [17.88, 19.97, 22.07, 26.29, 28.39, 30.52, 34.71, 36.81, 38.92, 43.14, 45.23, 47.34];
/** Chorus: the lighter stroke about 0.55 s before the next bar. */
export const BEFORE_BAR = [18.90, 21.05, 23.10, 24.98, 27.36, 29.47, 31.58, 33.40, 35.77, 37.90, 40.00, 42.08, 44.20, 46.29, 48.41];
/** Chorus: the voice's sharpest words between the drum hits (vocal attack 0.22 or more). */
export const VOICE_ACCENTS = [20.53, 23.41, 24.72, 31.84, 33.10, 37.58, 38.15, 41.53, 46.02, 48.67, 49.98];
/** Release: two soft strokes. */
export const RELEASE_STROKES = [50.26, 50.53];

for (const t of [...CLEAR_WORDS, ...SOFT_WORDS, ...BASS_ENTRIES, ...PICKUP_WORDS, ...PICKUP_DRUMS, ...FIRST, ...SECOND, ...FILL, ...BEFORE_SECOND,
  ...BEFORE_BAR, ...VOICE_ACCENTS, ...RELEASE_STROKES]) event(t);

export const overlayMeta = {
  title: "BONES", artist: "", tempo: "bars of 2.1 s",
  phases: [
    { name: "VOICE", t0: 0, t1: 8.6, color: "#3a5f8a" },
    { name: "VOICE + BASS", t0: 8.6, t1: 15.2, color: "#5f7892" },
    { name: "PICKUP", t0: 15.2, t1: CHORUS, color: "#d4843a" },
    { name: "CHORUS", t0: CHORUS, t1: RELEASE, color: "#c4483f" },
    { name: "TAIL", t0: RELEASE, t1: DURATION, color: "#3e8f6c" },
  ],
};
export const zoom = {
  smoothingFrames: 8,
  keyframes: [{ t: 0, zoom: 2.7 }, { t: 15.2, zoom: 2.4 }, { t: CHORUS, zoom: 1.85 }, { t: RELEASE, zoom: 2.0 }, { t: DURATION, zoom: 2.6 }],
};
export const music: Spec["music"] = {
  audio: "productions/bones_selection/audio.mp3", title: "Bones", beats: "productions/bones_selection/audio.json",
  spectrogram: { image: "productions/bones_selection/spectrogram.png", metadata: "productions/bones_selection/spectrogram.json" },
};
