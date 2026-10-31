/**
 * "Circus Minimus", 77.09 s: the measured music every variant of the spec shares.
 * Variants (variants/*.ts) choose from these layers; none of them re-reads the audio.
 *
 * Measured with docs/music-authoring.md: separated stems, drum classes, events.json.
 * Loudness below is each stem's peak as a fraction of the mix's 99th-percentile RMS.
 *
 * The grid. One beat is 0.40 s (150 BPM; madmom 150, librosa 152), and the song moves
 * in 3.2 s bars of eight beats, from 0.08. The kick is an 808: a kick drum (drum stem
 * ~0.40–0.50) fused with a bass swell (bass stem 0.5–0.9), so the bass is the loudest
 * layer in every section. It plays 3-2-3 (1.2, 0.8, 1.2 s: beats 0, 3 and 5 of each bar)
 * from the first second to the last, never changing. From 13.66 a snare plays on beats
 * 2 and 6 (every 1.6 s, a half-time backbeat). Each bar therefore reads
 *   BOOM . TAK BOOM . BOOM TAK .   (0, 0.8, 1.2, 2.0, 2.4 s)
 * and every other bar ends with a snare pickup on beats 6.5 and 7.5 into the downbeat.
 *
 *   0.00–12.86  INTRO, bars 0–3. The 808 alone, 3-2-3, with a soft voice murmuring
 *               between the kicks (vocals 0.15–0.30, about a third of the bass) and
 *               almost no other instrument. The calmest stretch: 1.2 s and 0.8 s gaps
 *               between kicks, room for floats. 0.08 is the first kick, too soon to land.
 *  12.86–25.68  VERSE, bars 4–7. Bar 4 changes the texture: a drum swell from 13.28,
 *               the voice entering at 13.42 (0.35), the first snare at 13.66. Then
 *               kick + snare backbeat with few hats; the voice leads in short sung
 *               phrases (0.3–0.5), with fast word runs (16.22–17.05, 20.14–20.55,
 *               24.54–25.73) and held lines (14.30–16.08, 20.97–22.42). The voice rests
 *               22.45–23.05 (the 22.48 kick alone). Snare pickups 18.68, 19.07 and
 *               25.09, 25.48.
 *  25.68–38.48  GROOVE, bars 8–11. The same kick and snare with busy 16th hats (the
 *               hats start exactly on the 25.68 downbeat, ~20 per bar). The voice keeps
 *               phrasing at 0.3–0.5; it rests 31.65–32.55 under the 31.27–31.88 snare
 *               pickup, the only vocal hole in the drummed sections. One cymbal (29.68,
 *               ADTOF's only one, mid-bar). Held line 33.51–35.27. Pickups 31.49, 31.88
 *               and 37.88, 38.28 lead into the hook. Busy.
 *  38.48–49.73  HOOK, bars 12–15. The voice leads, the loudest in the song (0.6–0.73):
 *               a legato sung line in three long phrases starting with the bars (38.48
 *               after a lift from 38.15, 41.68, 44.88; then 48.30). The drums thin out:
 *               no hats, the kick drum fades (0.28–0.37, then 0.04–0.15 at 41.68, 42.85,
 *               44.88 and 46.06, where only the bass swell is left), snares softer
 *               (0.30–0.41). A synth two-note pickup (0.2 s apart) ends each phrase:
 *               41.27-41.47, 44.48-44.67, 47.67-47.87 into the next bar. Intense but
 *               smooth: long low rides on the phrases suit it better than drum hits.
 *  49.73–51.28  BREAK. The bass stops (fades 49.6–49.8; the 808 is silent until 51.28),
 *               the kick with it. Voice and synth alone, with a drum swell 50.07 into a
 *               soft hit at 50.47 (0.37), and the synth pickup 50.86-51.07. The second
 *               calm spot: a float fits here, into the re-entry.
 *  51.28        RE-ENTRY. The bass returns (rise 0.66, the largest bass rise after the
 *               opening hit); the voice pauses 51.28–51.59 to let it through.
 *  51.28–77.09  FULL GROOVE, bars 16–24. Everything at once and evenly loud to the end:
 *               constant 16th hats, a sustained synth (0.2–0.3), the voice continuous
 *               (0.3–0.6, almost no rests), the 808 3-2-3. The kick drum is lighter than
 *               in the verse (0.2–0.37): it is clear on beats 3 and 5, while most
 *               downbeats (54.51, 57.69, 64.09, 67.28, 70.48) are the bass swell alone.
 *               Snares (0.33–0.43) are now louder than the kicks. Pickups again every
 *               other bar (57.09-57.48, 63.49-63.90, 69.89-70.28, 76.29-76.68). The
 *               busiest section, with no change of texture through to the end; a rising
 *               vocal run 68.08–68.93 is its high point. 76.88 (bar 24's downbeat, 808 +
 *               kick + snare) is the last event, 0.21 s before the end.
 *
 * Practically inaudible or not landable (do not land on these):
 *   - 0.08, the first kick: too soon after the start for any ride (compile: no_arc).
 *   - the ghost drum hit on beat 1 of drummed bars (16.48, 19.68, 22.87, 26.08, 29.28,
 *     32.48, 35.68, 38.87, 42.06, 45.27, 48.47; drum stem 0.14–0.21, under the 808
 *     sustain): about a third of a kick, not exported as a layer.
 *   - single hats (drum stem 0.06–0.20, e.g. 54.08, 66.89 at 0.06–0.07).
 *   - the intro's "other" stem (synth, ≤0.15): nearly silent in the mix.
 *   - vocal events that coincide with a drum hit (e.g. 20.07, 23.27, 26.47) are mostly
 *     drum bleed into the vocal stem; the vocal layers below avoid them.
 * Soft but audible: the intro voice (a third of the bass) and the hook's kickless 808
 * downbeats (41.68, 42.85, 44.88, 46.06), a bass swell without a click.
 */
import type { Spec } from "../../scripts/v0/types.ts";
import { clamp, measuredSong } from "../../scripts/v0/core/measured.ts";

const song = measuredSong(import.meta.dirname);
const audio = song.audio;
export type { MusicEvent } from "../../scripts/v0/core/measured.ts";
export { clamp };
export const { event, rise, drumPeak, drumStrength, voiceStrength, landings, sungNotes } = song;

export const DURATION = 77.09;
/** One beat, measured on the kicks (0.08 → 76.88 is exactly 192 beats); a bar is eight beats. */
export const BEAT = 0.4;
export const BAR = 3.2;
export const VERSE_T = 12.86;
export const GROOVE_T = 25.68;
export const HOOK_T = 38.48;
export const BREAK_T = 49.73;
export const REENTRY_T = 51.28;
/** The last event: bar 24's downbeat (808 + kick + snare), 0.21 s before the end. */
export const LAST_HIT = 76.88;

// ─────────── The layers, as measured event times ───────────

/** The first kick (808 + snare, the loudest hit in the mix); 0.08 s after the start, unlandable. */
export const OPENING_KICK = 0.08;

/** Intro: the 808 kicks, 3-2-3 (1.2, 0.8, 1.2 s), alone with the voice. Drum 0.35–0.45, bass 0.8–0.94. */
export const INTRO_KICKS = [1.26, 2.09, 3.29, 4.48, 5.28, 6.48, 7.69, 8.46, 9.68, 10.89, 11.67];
/** Intro: bar downbeats (0.08 is the first, unlandable). */
export const INTRO_BARS = [3.29, 6.48, 9.68];
/** Intro: the murmured voice between kicks; soft (0.15–0.29, about a third of the bass). */
export const INTRO_VOICE = [0.70, 0.95, 3.92, 7.36, 11.37, 12.71];

/** Bar 4's entry: drum swell start (0.17, faint), voice entry (0.35), first snare (0.49). */
export const VERSE_ENTRY = [13.28, 13.42, 13.66];
/** Verse: every 808 kick, 3-2-3. Drum 0.40–0.48, bass 0.72–0.78. */
export const VERSE_KICKS = [12.86, 14.10, 14.86, 16.08, 17.29, 18.07, 19.28, 20.48, 21.26, 22.48, 23.68, 24.47];
/** Verse: bar downbeats. */
export const VERSE_BARS = [12.86, 16.08, 19.28, 22.48];
/** Verse: the backbeat snare on beats 2 and 6 (0.44–0.51, as loud as the kick drum). */
export const VERSE_SNARES = [13.66, 15.27, 16.86, 18.47, 20.07, 21.66, 23.27, 24.87];
/** Verse: snare pickups on beats 6.5 and 7.5 into the next downbeat (0.35–0.43). */
export const VERSE_PICKUPS = [18.68, 19.07, 25.09, 25.48];
/** Verse: vocal phrase starts (after a dip in the voice). */
export const VERSE_PHRASES = [13.42, 16.22, 17.64, 18.91, 20.97, 23.07, 24.10];
/** Verse: the strongest syllables (vocal peak 0.35–0.47, sharp rise), none under a drum hit. */
export const VERSE_ACCENTS = [13.42, 17.76, 18.16, 18.91, 19.89, 20.14, 21.01, 23.07, 24.10, 24.93, 25.32];

/** Groove: every 808 kick, 3-2-3, under busy hats. Drum 0.42–0.49, bass 0.63–0.74. */
export const GROOVE_KICKS = [25.68, 26.89, 27.67, 28.87, 30.08, 30.87, 32.08, 33.29, 34.08, 35.27, 36.48, 37.27];
/** Groove: bar downbeats (25.68 is where the hats start). */
export const GROOVE_BARS = [25.68, 28.87, 32.08, 35.27];
/** Groove: the backbeat snare on beats 2 and 6 (0.44–0.52). */
export const GROOVE_SNARES = [26.47, 28.07, 29.68, 31.27, 32.87, 34.47, 36.07, 37.67];
/** Groove: the only cymbal ADTOF found (with kick and snare classes, drum 0.48); mid-bar, not a downbeat. */
export const GROOVE_CYMBAL = 29.68;
/** Groove: snare pickups on beats 6.5 and 7.5; 37.88, 38.28 lead into the hook. */
export const GROOVE_PICKUPS = [31.49, 31.88, 37.88, 38.28];
/** Groove: vocal phrase starts. 32.59 follows the song's only vocal rest under drums (31.65–32.55). */
export const GROOVE_PHRASES = [25.73, 27.24, 28.50, 29.43, 32.59, 33.51, 35.90, 36.94, 37.33];
/** Groove: the strongest syllables. */
export const GROOVE_ACCENTS = [25.73, 26.29, 26.95, 28.50, 29.43, 32.59, 36.94];

/** Hook: the 808 on 3-2-3. The kick drum fades: 0.28–0.37 at most, 0.04–0.15 at 41.68, 42.85,
 *  44.88 and 46.06, which are a bass swell (0.6–0.65) without a click. */
export const HOOK_BASS = [38.48, 39.68, 40.46, 41.68, 42.85, 43.66, 44.88, 46.06, 46.87, 48.06, 49.27];
/** Hook: bar downbeats, each also a vocal phrase start. */
export const HOOK_BARS = [38.48, 41.68, 44.88, 48.06];
/** Hook: snares on beats 2 and 6, softer than in the verse (0.30–0.41). */
export const HOOK_SNARES = [39.28, 40.87, 42.48, 44.07, 45.67, 47.28, 48.87];
/** Hook: the vocal phrase starts (38.15 is the lift into the hook's first phrase). */
export const HOOK_PHRASES = [38.15, 41.68, 44.88, 48.30];
/** Hook: the strongest syllables, the loudest voice in the song (0.55–0.73). */
export const HOOK_ACCENTS = [38.48, 39.10, 40.14, 40.51, 40.94, 41.68, 43.50, 44.12, 44.88, 45.50, 46.53, 46.92,
  48.30, 49.35, 49.73];
/** Hook: the synth's two-note pickup (0.2 s apart, 0.29–0.41) at the end of each phrase, into the next bar. */
export const HOOK_SYNTH_PICKUPS = [41.27, 41.47, 44.48, 44.67, 47.67, 47.87];

/** Break: the drum swell's start (0.24) and its soft hit (0.37); no kick, no bass. */
export const BREAK_HITS = [50.07, 50.47];
/** Break: the voice alone with the synth (0.35–0.40). */
export const BREAK_VOICE = [50.13, 50.59, 50.86];
/** Break: the synth pickup (0.29–0.33) into the re-entry, as in the hook. */
export const BREAK_SYNTH_PICKUPS = [50.86, 51.07];

/** Full groove: 808 + kick on beats 3 and 5, where the kick drum is clearest here (0.22–0.37). */
export const OUTRO_KICKS = [52.49, 53.27, 55.68, 56.48, 58.89, 59.69, 62.09, 62.87, 65.28, 66.07, 68.49, 69.28,
  71.69, 72.47, 74.87, 75.67];
/** Full groove: bar downbeats, mostly the bass swell alone (kick drum ≤0.25; 51.28 is the re-entry). */
export const OUTRO_BARS = [51.28, 54.51, 57.69, 60.88, 64.09, 67.28, 70.48, 73.69, 76.88];
/** Full groove: snares on beats 2 and 6 (0.33–0.43, louder than the kicks here). 63.27 is weak (0.25);
 *  bar 17's beat-6 snare comes late, at 57.09 (in the pickups). */
export const OUTRO_SNARES = [52.07, 53.67, 55.27, 58.48, 60.07, 61.67, 63.27, 64.88, 66.47, 68.08, 69.67, 71.27,
  72.88, 74.48, 76.08];
/** Full groove: snare and hat pickups on beats 6.5 and 7.5; 63.49-63.90 and 76.29-76.68 are softer (0.18–0.33). */
export const OUTRO_PICKUPS = [57.09, 57.48, 63.49, 63.90, 69.89, 70.28, 76.29, 76.68];
/** Full groove: vocal phrase starts (the voice barely rests; these follow its small dips). */
export const OUTRO_PHRASES = [51.73, 52.94, 53.98, 54.93, 56.11, 57.19, 58.89, 60.14, 62.25, 63.56, 65.70, 66.77,
  68.08, 69.74, 70.54, 71.69, 72.93, 74.78, 76.36];
/** Full groove: the strongest syllables (0.43–0.58). */
export const OUTRO_ACCENTS = [52.94, 53.98, 56.11, 58.89, 60.14, 62.25, 65.70, 66.77, 68.66, 68.93, 70.54, 74.78,
  75.37, 76.36];

/** Fast vocal runs, as [first, last] syllable: syllables 0.1–0.27 s apart. 68.08–68.93 rises to the
 *  song's last vocal peak. Close hits fit here. */
export const VOICE_RUNS: [number, number][] = [[16.22, 17.05], [20.14, 20.55], [24.54, 25.73], [46.53, 47.67],
  [68.08, 68.93]];
/** Held vocal lines, as [start, end] events: a steady voice with no sharp syllable. Long low rides fit here. */
export const HELD_LINES: [number, number][] = [[14.30, 16.08], [20.97, 22.42], [33.51, 35.27], [57.19, 58.63],
  [63.56, 65.53]];

// Every layer above must be a measured event: importing this file throws on a time that is not.
[OPENING_KICK, INTRO_KICKS, INTRO_BARS, INTRO_VOICE, VERSE_ENTRY, VERSE_KICKS, VERSE_BARS, VERSE_SNARES,
  VERSE_PICKUPS, VERSE_PHRASES, VERSE_ACCENTS, GROOVE_KICKS, GROOVE_BARS, GROOVE_SNARES, GROOVE_CYMBAL,
  GROOVE_PICKUPS, GROOVE_PHRASES, GROOVE_ACCENTS, HOOK_BASS, HOOK_BARS, HOOK_SNARES, HOOK_PHRASES, HOOK_ACCENTS,
  HOOK_SYNTH_PICKUPS, BREAK_HITS, BREAK_VOICE, BREAK_SYNTH_PICKUPS, OUTRO_KICKS, OUTRO_BARS, OUTRO_SNARES,
  OUTRO_PICKUPS, OUTRO_PHRASES, OUTRO_ACCENTS, VOICE_RUNS, HELD_LINES, VERSE_T, GROOVE_T, HOOK_T, BREAK_T,
  REENTRY_T, LAST_HIT].flat(2).forEach((t) => event(t));

// ─────────── Shared presentation ───────────

export const phases = [
  { name: "808 INTRO", t0: 0.0, t1: VERSE_T, color: "#3a5f8a" },
  { name: "VERSE", t0: VERSE_T, t1: GROOVE_T, color: "#d46a2e" },
  { name: "GROOVE · HATS", t0: GROOVE_T, t1: HOOK_T, color: "#c4483f" },
  { name: "HOOK · VOICE", t0: HOOK_T, t1: BREAK_T, color: "#8a5fa8" },
  { name: "BREAK", t0: BREAK_T, t1: REENTRY_T, color: "#5f7892" },
  { name: "FULL GROOVE", t0: REENTRY_T, t1: DURATION, color: "#c4483f" },
];
export const overlayMeta = {
  title: "CIRCUS MINIMUS",
  artist: "",
  tempo: `${audio.tempo.madmom_bpm?.toFixed(0) ?? "150"} BPM; 808 kick in 3-2-3, snare every 1.6 s`,
  phases,
};
/** Camera shared by the variants: wide in the intro and break, closest in the full groove. */
export const zoom = {
  smoothingFrames: 8,
  keyframes: [
    { t: 0.0, zoom: 2.60 },
    { t: VERSE_T, zoom: 2.20 },
    { t: GROOVE_T, zoom: 1.95 },
    { t: HOOK_T, zoom: 2.20 },
    { t: BREAK_T, zoom: 2.50 },
    { t: REENTRY_T, zoom: 1.85 },
    { t: DURATION, zoom: 2.00 },
  ],
};
export const music: Spec["music"] = {
  audio: "productions/circus_minimus_77s/audio.mp3",
  title: "Circus Minimus",
  artist: "Unknown",
  tempo: overlayMeta.tempo,
  beats: "productions/circus_minimus_77s/audio.json",
  spectrogram: {
    image: "productions/circus_minimus_77s/spectrogram.png",
    metadata: "productions/circus_minimus_77s/spectrogram.json",
  },
};
