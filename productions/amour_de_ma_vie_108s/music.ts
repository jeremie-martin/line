/**
 * L'amour de ma vie, 108.5 s (the full long cut; its first 44.5 s are the
 * amour_de_ma_vie_44s cut: their strong events agree within one analysis frame).
 * The measured layers every variant reads. Event times are from
 * productions/amour_de_ma_vie_108s/events.json (Demucs stems + ADTOF drum classes);
 * sung notes from sung.json. Loudness is the stem envelope as a fraction of THIS
 * file's mix 99th-percentile RMS (generated/stems/amour_de_ma_vie_108s), so drum
 * peaks here read a little higher than in the 44 s cut.
 *
 * Structure, section by section (loudness = mean mix over 8 s):
 *
 *   0–3.25  INTRO. The voice leads over a soft pad (no drums, no bass). Pitched words
 *           A3 0.604 (salience 0.98), then E4 1.625, D4 1.962, D4 2.264 (0.86), D4 2.868,
 *           D4 3.065, gaps 0.20–0.34 s, straight into the drums.
 *   3.25–24.3 GROOVE A (0.52 rising to 0.56). The drums lead (kicks 0.65–0.90, snares
 *           0.42–0.57): a syncopated two-bar pattern on an 8th-note grid at ~90 BPM
 *           (0.333 s), snare on beats 1 and 3:
 *               bar A  S . K . K . . . S . w . K . K .
 *               bar B  S . K . . . . . S . K . K . K .
 *           so hits come in runs of 3–7 at 0.33 s, with rests of 0.66–1.0 s. Entry: three
 *           kicks (3.251, 3.587, 3.924). The voice sings mostly on the drum hits and is
 *           alone in a few rests (4.795, 10.286, 15.604, 23.766); it is busiest 17–25 s
 *           (the hook). At 23.4 everything drops for a moment; a bass note (23.591)
 *           leads back in.
 *   24.3–25.25 BREAK. Bass and synth cut, the drums rest a bar, the voice holds a word
 *           (24.300) alone.
 *   25.252  RE-ENTRY.
 *   25.25–43.6 GROOVE A after the break: the loudest stretch of the song (0.59 at
 *           25–35 s), easing to 0.54 by 43 s as the voice thins out.
 *   43.6–46.6 FILL. The drums drop the pattern for a fill: snare 44.257, tom 44.594,
 *           snares 45.082/45.256, toms 45.592, 45.917; the voice returns (44.954, 45.650).
 *   46.579  GROOVE B enters (kick).
 *   46.6–64.9 GROOVE B (0.54, lifting to 0.57 from 57 s). The same pattern, slightly
 *           softer kicks (0.64–0.80); the voice comes forward again, alone in rests at
 *           47.601 and 58.259, and climbs (C♯5 61.986, the highest note, peak 0.59).
 *           Ends with a fill: snare 63.878, toms 64.250, 64.598, and a last kick with a
 *           cymbal, 64.935: the drums stop for 24 s.
 *   65–89   BREAKDOWN (0.28). Calm. A held bass note (65–67.5), then one bass note per
 *           bar on the downbeat (70.589, 73.213, 75.952, 78.553, 81.223, 83.963, 86.610;
 *           every 2.65 s, plus 74.606 and 85.264 mid-bar) under a soft sung melody
 *           (vocal peaks 0.15–0.3; words every 0.3–0.9 s in phrases, notes held up to 0.8 s).
 *   89.2–97.3 LIGHT DRUMS (0.31). The kick pattern returns, very soft (drum peaks
 *           0.14–0.27) with cymbals; the voice over it (G♯4 91.788, salience 0.87). A
 *           swell at 94.575 (bass, kick and voice together; mix 0.56) is the loudest
 *           moment of the second half.
 *   97.3–105.2 OUTRO. Bass and voice only, thinning (0.27 → 0.20): words at 98.360,
 *           98.952, 102.028, 104.861; bass notes 97.257, 99.950, 102.272.
 *   105.2–108.5 FADE. The pad alone fades out; no attack is heard.
 *
 * The story by loudness: a soft vocal opening, a long intense groove that peaks after
 * its break, a fill and a second groove that lifts at its end, then the drums leave
 * for a long calm, return softly, and the song fades on the voice.
 */
import { measuredSong, clamp } from "../../scripts/v0/core/measured.ts";
import type { SpecCamera, SpecMusic, StartState } from "../../scripts/v0/types.ts";

export const { events, audio, event, rise, drumPeak, drumStrength, voiceStrength, landings, sungNotes } =
  measuredSong(import.meta.dirname);
export { clamp };

// ─────────── Sections ───────────
export const DURATION = 108.528;
export const DRUMS_IN = 3.251;
export const BREAK_LAST = 24.242; // last kick before the break
export const BREAK_START = 24.3;
export const REENTRY = 25.252;
export const FILL_START = 44.257;
export const GROOVE_B = 46.579;
export const LIFT = 57; // groove B lifts: louder mix, higher voice
export const DRUMS_OUT = 64.935; // last kick + cymbal
export const BREAKDOWN = 65;
export const LIGHT_DRUMS = 89.234; // soft kick: drums return
export const SWELL = 94.575; // bass + kick + voice, loudest moment of the second half
export const OUTRO = 97.3;
export const FADE = 105.2;

// ─────────── Layers (measured event times) ───────────

/** The intro words (pitched, the voice alone). */
export const INTRO_WORDS = [0.604, 1.625, 1.962, 2.264, 2.868, 3.065];
/** The drums' entry: three kicks 0.336 s apart. */
export const ENTRY_CLUSTER = [3.251, 3.587, 3.924];

/** Groove kicks (ADTOF kick, drum rise ≥ 0.3), A then B. */
export const KICKS_A = [
  3.251, 3.587, 3.924, 5.236, 5.584, 6.246, 7.581, 7.918, 8.255, 8.916, 9.253, 10.588, 10.925, 11.587, 12.922, 13.247,
  13.572, 14.257, 14.594, 15.917, 16.254, 16.904, 18.251, 18.576, 18.913, 19.586, 19.923, 21.258, 21.595, 22.256,
  23.905, 24.242, 25.252, 26.587, 26.924, 27.597, 28.92, 29.257, 29.594, 30.256, 30.592, 31.916, 32.253, 32.914,
  34.261, 34.598, 34.911, 35.585, 35.921, 37.245, 37.581, 38.243, 39.59, 39.915, 40.252, 40.914, 41.25, 42.585,
  42.91, 43.584,
];
export const KICKS_B = [
  46.579, 47.914, 48.251, 48.913, 50.248, 50.585, 50.921, 51.583, 51.908, 53.255, 53.592, 54.253, 55.577, 55.925,
  56.25, 56.912, 57.249, 58.584, 58.921, 59.594, 60.918, 61.254, 61.591, 62.253, 62.578, 63.588,
];
/** Groove snares (beats 1 and 3). 17.868 is a flam: its second stroke is FLAM_SECOND. */
export const SNARES_A = [
  4.586, 5.909, 7.245, 8.58, 9.915, 11.25, 12.574, 13.92, 15.267, 16.591, 17.868, 19.249, 20.596, 21.92, 23.255,
  25.925, 27.249, 28.584, 29.919, 31.254, 32.589, 33.913, 35.248, 36.583, 37.918, 39.253, 40.588, 41.924, 43.236,
];
export const SNARES_B = [
  47.253, 48.588, 49.911, 51.246, 52.582, 53.917, 55.24, 56.587, 57.911, 59.257, 60.581, 61.928, 63.251,
];
export const FLAM_SECOND = 17.926;
/** The two fills: snares and toms (45.256 is a second snare 0.174 s after 45.082). */
export const FILL_A = [44.257, 44.594, 45.082, 45.256, 45.592, 45.917];
export const FILL_END = [63.878, 64.25, 64.598, DRUMS_OUT];

/** Sung words alone in a drum rest, and the bass pickup at 23.591. */
export const EXPOSED_WORDS_A = [4.795, 10.286, 15.604, 23.766];
export const EXPOSED_WORDS_B = [47.601, 58.259];
export const BASS_PICKUP = 23.591;
export const BREAK_WORD = 24.3;
/** Groove B's high notes (each within 0.06 s of a drum hit): C♯4 held 1 s, C♯5, F♯4. */
export const HIGH_NOTES_B = [60.976, 61.986, 63.936];

/**
 * Short audible pairs, a lighter sound then a heavier one 0.2–0.35 s later: backbeat
 * snare → kick, sung word or bass note → kick, snare → word (4.586 → 4.795).
 */
export const PAIRS_A: [number, number][] = [
  [4.586, 4.795], [5.909, 6.246], [7.245, 7.581], [8.58, 8.916], [10.286, 10.588], [11.25, 11.587], [12.574, 12.922],
  [13.92, 14.257], [15.604, 15.917], [16.591, 16.904], [17.926, 18.251], [19.249, 19.586], [21.92, 22.256],
  [23.591, 23.905], [27.249, 27.597], [28.584, 28.92], [29.919, 30.256], [32.589, 32.914], [33.913, 34.261],
  [35.248, 35.585], [37.918, 38.243], [39.253, 39.59], [40.588, 40.914], [43.236, 43.584],
];
export const PAIRS_B: [number, number][] = [
  [47.601, 47.914], [48.588, 48.913], [49.911, 50.248], [51.246, 51.583], [53.917, 54.253], [55.24, 55.577],
  [56.587, 56.912], [58.259, 58.584], [59.257, 59.594], [60.581, 60.918], [61.928, 62.253], [63.251, 63.588],
];
/** Backbeat snares with no kick within 0.35 s after them (pair-less). */
export const LONE_SNARES = [20.596, 25.925, 31.254, 36.583, 41.924, 52.582];

/** Breakdown: the bass note on each bar's downbeat, and the two mid-bar notes. */
export const BASS_BARS = [70.589, 73.213, 75.952, 78.553, 81.223, 83.963, 86.61];
export const BASS_MID = [74.606, 85.264];
/** Breakdown words (sung notes with salience ≥ 0.4). */
export const BREAKDOWN_WORDS = [
  68.998, 70.217, 74.257, 74.675, 75.697, 76.545, 77.322, 78.263, 79.61, 80.271, 82.663, 83.127, 84.045, 87.562,
  87.841, 88.654,
];
/** Light drums: the soft kicks, and the words over them. */
export const LIGHT_KICKS = [89.234, 90.581, 90.918, 91.58, 92.915, 93.576, 94.238, 94.575, 95.933, 96.235, 96.908];
export const LIGHT_WORDS = [89.536, 91.788, 92.973];
/** Outro: words and bass notes. */
export const OUTRO_WORDS = [98.36, 98.952, 102.028, 104.861];
export const OUTRO_BASS = [97.257, 99.95, 102.272];

// Every layer time must be a measured event, and every pair 0.2–0.35 s apart.
for (const t of [
  ...INTRO_WORDS, ...KICKS_A, ...KICKS_B, ...SNARES_A, ...SNARES_B, FLAM_SECOND, ...FILL_A, ...FILL_END,
  ...EXPOSED_WORDS_A, ...EXPOSED_WORDS_B, BASS_PICKUP, BREAK_WORD, ...HIGH_NOTES_B, ...BASS_BARS, ...BASS_MID,
  ...BREAKDOWN_WORDS, ...LIGHT_KICKS, ...LIGHT_WORDS, ...OUTRO_WORDS, ...OUTRO_BASS,
]) event(t);
for (const [a, b] of [...PAIRS_A, ...PAIRS_B]) {
  const gap = event(b).t - event(a).t;
  if (gap < 0.2 || gap > 0.35) throw new Error(`pair ${a}→${b} is ${gap.toFixed(3)} s apart`);
}

/**
 * Never landed, with the reason:
 *  - pad/breath onsets in the intro (rises ≤ 0.09, not sung);
 *  - hi-hat and cymbal onsets alone (drum rise ≤ 0.05; inaudible under the groove);
 *  - sung notes within 0.1 s of a drum hit (the drum hit is the landing);
 *  - 46.266 (a soft kick+tom, drum rise 0.24, 0.31 s before groove B's first kick: the
 *    fill's last ghost, not landed so groove B enters clean);
 *  - 65–68.9: nothing attacks (a held bass note; the faint onsets have rise ≤ 0.04);
 *  - breakdown words with salience < 0.4, and unpitched vocal onsets;
 *  - light-drum cymbal and snare onsets (drum rise ≤ 0.12);
 *  - everything after 104.861 (pad fade, rises ≤ 0.09).
 */

// ─────────── Strength ───────────
/** A drum hit's strength from its measured loudness (groove kicks 0.58–0.81, snares 0.38–0.51,
 * light-drum kicks 0.13–0.24 → floor 0.2 in drumStrength). */
export const drum = (t: number) => drumStrength(t, 0.9);
/** A sung word as a clear light hit (0.2–0.35), by how sharply the voice enters. */
export const word = (t: number) => clamp(0.12 + 0.6 * rise(t, "vocals"), 0.2, 0.35);
/** A bass note by the bass stem's loudness (breakdown notes 0.22–0.31). */
export const bass = (t: number) => clamp(0.75 * (event(t).sources.bass?.peak ?? 0), 0.1, 1);

// ─────────── Presentation ───────────
export const overlayMeta = {
  title: "L'AMOUR DE MA VIE",
  artist: "long cut, 108.5 s",
  tempo: "~90 BPM · 4/4 (syncopated)",
  phases: [
    { name: "INTRO (VOICE)", t0: 0, t1: DRUMS_IN, color: "#3a5f8a" },
    { name: "GROOVE A", t0: DRUMS_IN, t1: BREAK_START, color: "#d4843a" },
    { name: "BREAK", t0: BREAK_START, t1: REENTRY, color: "#6d5aa8" },
    { name: "GROOVE A (PEAK)", t0: REENTRY, t1: FILL_START, color: "#d46a2e" },
    { name: "FILL", t0: FILL_START, t1: GROOVE_B, color: "#c0504d" },
    { name: "GROOVE B", t0: GROOVE_B, t1: DRUMS_OUT, color: "#d4843a" },
    { name: "BREAKDOWN", t0: DRUMS_OUT, t1: LIGHT_DRUMS, color: "#3a5f8a" },
    { name: "LIGHT DRUMS", t0: LIGHT_DRUMS, t1: OUTRO, color: "#5f7892" },
    { name: "OUTRO", t0: OUTRO, t1: FADE, color: "#3e8f6c" },
    { name: "FADE", t0: FADE, t1: DURATION, color: "#2f5f4c" },
  ],
};

export const music: SpecMusic = {
  audio: "productions/amour_de_ma_vie_108s/audio.mp3",
  title: "L'amour de ma vie",
  artist: overlayMeta.artist,
  tempo: overlayMeta.tempo,
  beats: "productions/amour_de_ma_vie_108s/audio.json",
  spectrogram: {
    image: "productions/amour_de_ma_vie_108s/spectrogram.png",
    metadata: "productions/amour_de_ma_vie_108s/spectrogram.json",
  },
};

export const camera: SpecCamera = {
  zoom: {
    smoothingFrames: 10,
    keyframes: [
      { t: 0, zoom: 2.4 },
      { t: DRUMS_IN, zoom: 2.1 },
      { t: BREAK_START, zoom: 2.25 },
      { t: REENTRY, zoom: 1.85 },
      { t: GROOVE_B, zoom: 2.0 },
      { t: LIFT, zoom: 1.9 },
      { t: DRUMS_OUT, zoom: 2.0 },
      { t: 68, zoom: 2.6 },
      { t: LIGHT_DRUMS, zoom: 2.4 },
      { t: FADE, zoom: 2.7 },
      { t: DURATION, zoom: 2.8 },
    ],
  },
};

/** As the 44 s panel spec: start slightly elevated, with pre-roll freedom. */
export const start: StartState = { vx: 5, vy: 0, y: -180 };
export const preroll = 5;
