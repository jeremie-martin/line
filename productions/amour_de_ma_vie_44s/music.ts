/**
 * L'amour de ma vie, 44.5 s cut (the first 44.5 s of amour_de_ma_vie_108s: the same
 * recording; their strong events agree within one analysis frame, ≤ 12 ms). The
 * measured layers every variant reads. Event times are from
 * productions/amour_de_ma_vie_44s/events.json (Demucs stems + ADTOF drum classes);
 * sung notes from sung.json. Loudness is the stem envelope as a fraction of the mix's
 * 99th-percentile RMS (generated/stems/amour_de_ma_vie_44s).
 *
 * Structure, section by section (loudness = mix envelope):
 *
 *   0–3.25  INTRO. The voice leads, over a soft pad (mix 0.15–0.6, no drums or bass).
 *           A short phrase of pitched words: A3 0.604 (salience 0.98), then a fast run
 *           E4 1.625, D4 1.962, D4 2.264 (0.86), D4 2.856, D4 3.053, gaps 0.20–0.34 s,
 *           running straight into the drums.
 *   3.25–24.3 GROOVE. The drums lead (kicks 0.62–0.85, snares 0.40–0.54; mix ≈ 1.0 on
 *           the hits): a syncopated two-bar pattern on an 8th-note grid at ~90 BPM
 *           (0.333 s), snare on beats 1 and 3 of each bar:
 *               bar A  S . K . K . . . S . w . K . K .
 *               bar B  S . K . . . . . S . K . K . K .
 *           (one slot = 1/16 = 0.167 s; S snare, K kick, w a sung word in the kick's
 *           place). So hits come in runs of 3–7 at 0.33 s, separated by rests of
 *           0.66–1.0 s. The drums enter with three kicks (3.251, 3.587, 3.924). The
 *           voice sings mostly ON the drum hits; it is alone only in some rests:
 *           4.795 (G♯3, 0.98), 10.275 (C♯4, 0.96), 15.604 (C♯4, 0.96), 23.766 (F4, 0.72).
 *           The vocal is busiest 17–25 s (the hook, a G4 held 2.88 s from 19.4 under
 *           the drums). At 23.4 everything drops for a moment and a bass note (23.591)
 *           leads back into the kick at 23.905.
 *   24.3–25.25 BREAK. After the kick at 24.242 the bass and synth cut and the drums
 *           rest for a bar; the voice holds a word (24.300, 0.96 s) alone (mix 0.45).
 *   25.252  RE-ENTRY: kick, bass and synth together.
 *   25.25–44.26 GROOVE 2. The same pattern, a little softer kicks (0.62–0.80) and less
 *           voice, but the loudest stretch of the cut overall (mean mix over 10 s: 0.578
 *           at 25–36 s, against 0.50 at 3–14 s).
 *   44.257  FILL: a snare starts the drum fill that leads into the next section of the
 *           song; the cut ends 0.29 s later.
 *
 * Calm vs intense, by loudness: calm = the intro and the break; the rest is one
 * intense groove, slightly louder after the break. The patterns this cut really has:
 * short audible pairs everywhere in the groove (snare → kick at 0.31–0.35 s, sung word
 * or bass note → kick at 0.30–0.31 s, snare → word at 0.21 s) (P1); dense runs at speed
 * in its loudest stretch (P4); a stop and re-entry (P5, 24.242 → 25.252). Voice-led
 * close words (P2) exist only in the intro (≈ 1.6–3.1 s) and as single words in the
 * drum rests; elsewhere the drums are about twice as loud as the voice.
 */
import { measuredSong, clamp } from "../../scripts/v0/core/measured.ts";
import type { SpecCamera, SpecMusic, StartState } from "../../scripts/v0/types.ts";

export const { events, audio, event, rise, drumPeak, drumStrength, voiceStrength, landings, sungNotes } =
  measuredSong(import.meta.dirname);
export { clamp };

// ─────────── Sections ───────────
export const DURATION = 44.544;
export const DRUMS_IN = 3.251; // first kick
export const BREAK_LAST = 24.242; // last kick before the break
export const BREAK_START = 24.3; // bass and synth cut; the held word starts
export const REENTRY = 25.252; // kick, bass and synth back
export const FILL = 44.257; // the fill's first snare, 0.29 s before the end

// ─────────── Layers (measured event times) ───────────

/** The intro words (sung.json pitched notes; the voice alone). */
export const INTRO_WORDS = [0.604, 1.625, 1.962, 2.264, 2.856, 3.053];

/** All kicks (ADTOF kick, drum rise ≥ 0.3). */
export const KICKS = [
  3.251, 3.587, 3.924, 5.236, 5.584, 6.246, 7.581, 7.918, 8.255, 8.916, 9.253, 10.577, 10.925, 11.587, 12.922, 13.247,
  13.572, 14.257, 14.582, 15.917, 16.254, 16.904, 18.251, 18.576, 18.913, 19.586, 19.923, 21.258, 21.583, 22.256,
  23.905, 24.242, 25.252, 26.587, 26.924, 27.597, 28.92, 29.257, 29.594, 30.256, 30.592, 31.916, 32.253, 32.914,
  34.261, 34.586, 34.911, 35.585, 35.921, 37.245, 37.581, 38.243, 39.59, 39.915, 40.252, 40.914, 41.25, 42.585,
  42.91, 43.572,
];
/** All snares, on beats 1 and 3. 17.868 is a flam: its second stroke is FLAM_SECOND. */
export const SNARES = [
  4.586, 5.909, 7.245, 8.58, 9.915, 11.25, 12.574, 13.92, 15.267, 16.591, 17.868, 19.249, 20.596, 21.92, 23.255,
  25.925, 27.249, 28.584, 29.919, 31.254, 32.589, 33.913, 35.248, 36.583, 37.918, 39.253, 40.588, 41.912, 43.236,
  44.257,
];
export const FLAM_SECOND = 17.926;
/** Every drum hit of the groove, in time order. */
export const DRUM_HITS = [...KICKS, ...SNARES].sort((a, b) => a - b);

/** Sung words alone in a drum rest: the voice leads at these moments. */
export const EXPOSED_WORDS = [4.795, 10.275, 15.604, 23.766];
/** The bass note that leads back in after the 23.4 s drop-out (bass rise 0.39). */
export const BASS_PICKUP = 23.591;
/** The word held through the break (salience 0.67, 0.96 s); 0.058 s after the 24.242 kick. */
export const BREAK_WORD = 24.3;

/**
 * The groove's short audible pairs: a lighter sound, then a heavier one 0.2–0.35 s
 * later, with a rest or a lighter hit before. Snare → kick on the beat-1/beat-3 backbeat;
 * word → kick and bass → kick pickups ("ta-BOOM"); and snare → word (4.586 → 4.795, 0.209 s).
 * The flam pair uses its second stroke (17.926 → 18.251, 0.325 s).
 */
export const PAIRS: [number, number][] = [
  [4.586, 4.795], [5.909, 6.246], [7.245, 7.581], [8.58, 8.916], [10.275, 10.577], [11.25, 11.587], [12.574, 12.922],
  [13.92, 14.257], [15.604, 15.917], [16.591, 16.904], [17.926, 18.251], [19.249, 19.586], [21.92, 22.256],
  [23.591, 23.905], [27.249, 27.597], [28.584, 28.92], [29.919, 30.256], [32.589, 32.914], [33.913, 34.261],
  [35.248, 35.585], [37.918, 38.243], [39.253, 39.59], [40.588, 40.914], [43.236, 43.572],
];
/** The drums' entry: three kicks 0.336 s apart. */
export const ENTRY_CLUSTER = [3.251, 3.587, 3.924];

// Every layer time must be a measured event, and every pair 0.2–0.35 s apart.
for (const t of [...INTRO_WORDS, ...DRUM_HITS, FLAM_SECOND, ...EXPOSED_WORDS, BASS_PICKUP, BREAK_WORD]) event(t);
for (const [a, b] of PAIRS) {
  const gap = event(b).t - event(a).t;
  if (gap < 0.2 || gap > 0.35) throw new Error(`pair ${a}→${b} is ${gap.toFixed(3)} s apart`);
}

/**
 * Never landed, with the reason:
 *  - 0.058–0.546, 1.057–1.358, 1.881 (pad and breath onsets before and between the
 *    intro words; rises ≤ 0.09 or not sung);
 *  - hi-hat onsets (ADTOF "hat" alone, drum rise ≤ 0.05): inaudible under the mix;
 *  - sung notes on a drum hit (within 0.1 s): the drum hit is the landing;
 *  - the break's later vocal onsets (24.706, 24.950: rises ≤ 0.12, the held word's tail).
 */

// ─────────── Strength ───────────
/** A drum hit's strength from its measured loudness: kicks 0.56–0.77, snares 0.36–0.49. */
export const drum = (t: number) => drumStrength(t, 0.9);
/** A sung word as a clear light hit (0.2–0.35), by how sharply the voice enters. */
export const word = (t: number) => clamp(0.12 + 0.6 * rise(t, "vocals"), 0.2, 0.35);
/** The bass pickup, by the bass stem's loudness. */
export const bass = (t: number) => clamp(0.9 * (event(t).sources.bass?.peak ?? 0), 0.2, 1);

// ─────────── Presentation ───────────
export const overlayMeta = {
  title: "L'AMOUR DE MA VIE",
  artist: "cut 1:21.5–2:06",
  tempo: "~90 BPM · 4/4 (syncopated)",
  phases: [
    { name: "INTRO (VOICE)", t0: 0, t1: DRUMS_IN, color: "#3a5f8a" },
    { name: "GROOVE", t0: DRUMS_IN, t1: BREAK_START, color: "#d4843a" },
    { name: "BREAK", t0: BREAK_START, t1: REENTRY, color: "#6d5aa8" },
    { name: "GROOVE 2", t0: REENTRY, t1: FILL, color: "#d46a2e" },
    { name: "FILL", t0: FILL, t1: DURATION, color: "#3e8f6c" },
  ],
};

export const music: SpecMusic = {
  audio: "productions/amour_de_ma_vie_44s/audio.mp3",
  title: "L'amour de ma vie",
  artist: overlayMeta.artist,
  tempo: overlayMeta.tempo,
  beats: "productions/amour_de_ma_vie_44s/audio.json",
  spectrogram: {
    image: "productions/amour_de_ma_vie_44s/spectrogram.png",
    metadata: "productions/amour_de_ma_vie_44s/spectrogram.json",
  },
};

export const camera: SpecCamera = {
  zoom: {
    smoothingFrames: 10,
    keyframes: [
      { t: 0, zoom: 2.4 },
      { t: DRUMS_IN, zoom: 2.1 },
      { t: 17.0, zoom: 1.95 },
      { t: BREAK_START, zoom: 2.25 },
      { t: REENTRY, zoom: 1.85 },
      { t: 36.6, zoom: 1.95 },
      { t: DURATION, zoom: 2.3 },
    ],
  },
};

/** As in the panel spec: start slightly elevated, with pre-roll freedom. */
export const start: StartState = { vx: 5, vy: 0, y: -180 };
export const preroll = 5;
