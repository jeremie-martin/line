/**
 * "TIKI TIKI (Slowed)", first 48 s: the measured layers, read event-first from the
 * Demucs stems, ADTOF drum classes and sung notes (events.json, sung.json,
 * generated/stems/tiki_tiki_48s/sheets). Every time below is an events.json event;
 * `event(t)` throws on any that is not. The variants in variants/ are whole specs
 * chosen from these layers; spec.ts (the panel's "ordinary groove") is the older
 * analysis-score reading and is left unchanged.
 *
 * Loudness is in the stems' unit (fraction of the mix's 99th-percentile RMS).
 *
 * Structure, section by section:
 *
 * - 0.00–4.90 VOICE INTRO. A quiet solo voice (vocals 0.10–0.21, mix 0.12–0.26;
 *   the groove is 0.45–0.65). Phrase 1: five words 0.35–0.86 s apart (0.406–2.705,
 *   a held C5 at 1.277). Phrase 2 is the hook motif: four F♯4 words and a fifth,
 *   0.26–0.30 s apart (3.320 3.576 3.855 4.156 4.423), then a faint tail 4.853.
 * - 4.90–7.00 SILENCE. Near-silence (mix 0.04–0.06) for two seconds.
 * - 7.00–9.60 BUILD. The voice again, unpitched and breathy (7.001 7.372 7.872
 *   8.243 9.102), with two faint drum ticks (7.001, 7.872; drums 0.05–0.08) and a
 *   drum swell rising from 8.731 to 9.5 (drums 0.10 → 0.25).
 * - 9.60–10.47 DRUM CUT. The swell stops dead at 9.6; only the voice (9.660,
 *   9.961: the intro's loudest notes, vocals 0.18–0.26) before the drop.
 * - 10.472 DROP. Kick and snare (drums 0.70, mix rise 0.84); bass and chords enter.
 * - 10.47–24.38 GROOVE. The drums lead, at 69 BPM: a kick every 0.87 s, all of
 *   equal loudness (drums 0.69–0.74). A bar is four kicks and repeats exactly:
 *     K(1) s K(2) s K(3) x K(4) . p | K(1)
 *   where s is a backbeat snare/tom 0.43 s after a kick (drums 0.27–0.29, mix rise
 *   0.21–0.33: clearly audible over the gap), x is the slot after beat 3, filled
 *   by a vocal hook (13.526 G5), an extra kick (16.985) or a chord stab (20.480),
 *   and p is the PICKUP: a snare 0.21–0.22 s before the next bar's downbeat, the
 *   song's signature "ta-BOOM" (11.122, 14.605, 18.088, 21.560). The drop 10.472
 *   is beat 4 of the bar before the first downbeat 11.343. Some bars put an E4
 *   syllable 0.21 s before the pickup (14.396, 17.868) and vocal pickups
 *   0.19–0.20 s before beat 3 (12.875, 16.358).
 * - 24.38–27.86 BOOM AND RESET. On 24.381 an 808 boom (drums 0.42) holds and
 *   decays (mix 0.59 → 0.31 by 25.6), bass and chords stop; from 25.9 it is quiet
 *   (mix 0.16–0.31) with three murmured syllables (26.482, 26.796, 27.040,
 *   vocals 0.10–0.16). A drum swell from 27.6 lands on 27.864 (mix 0.97, rise
 *   0.60), which is again beat 4 before a bar.
 * - 27.86–39.17 RUN. The groove again, with hats added: pickups 28.514, 31.997,
 *   35.468; hooks 30.917 (G5), 37.872 (G5); an extra kick 34.377. The loudest
 *   stretch of the song (8 s mean mix 0.545 at 29.5–37.5).
 * - 39.17–41.78 RUN END. The bar breaks: a weak snare 39.172 where the downbeat
 *   should be, then kicks on 39.602, 40.472, 40.902 and a last soft kick 41.784
 *   into a held 808 that decays until about 44.3.
 * - 41.78–48.00 VOICE OUTRO. Drums gone; the voice alone again, quiet (vocals
 *   0.08–0.17): 42.655, a held C5 at 43.003, A♯4 at 43.537, 44.408, then the
 *   F♯4 hook motif again, 0.23–0.30 s apart (45.012 45.256 45.534 45.836
 *   46.103), and a faint 46.916.
 *
 * Measurement notes:
 * - Five kicks (13.955, 20.944, 27.864, 31.347, 38.301) have no drum-stem onset
 *   (the stem had not decayed from the previous hit); ADTOF hears a kick at each
 *   (25 ms early, as everywhere in this song) and the mix rises 0.42–0.62. Their
 *   strength cannot come from `drumPeak`, so kickStrength uses the bar position.
 * - Mix-only onsets 50–90 ms before a kick are that kick's click in the mix
 *   (29.536, 31.300, 32.125, 33.890, 36.513, 38.232); not used.
 * - sung.py attaches the F♯4 note at 45.279 to 45.302, an "other" event without
 *   vocals; its vocal attack is 45.256, used instead.
 */
import { measuredSong, clamp } from "../../scripts/v0/core/measured.ts";
import type { Keyframe } from "../../scripts/v0/core/curves.ts";

export const { events, audio, event, rise, drumPeak, drumStrength, voiceStrength, landings, sungNotes } =
  measuredSong(import.meta.dirname);
export { clamp };

export const DURATION = 48;

// ─────────── Section boundaries (event times, or the measured silence edges) ───────────
export const SILENCE_T0 = 4.9;
export const BUILD = 7.001;
export const DRUM_CUT_T0 = 9.6;
export const DROP = 10.472;
export const BOOM = 24.381;
export const REENTRY = 27.864;
export const RUN_END = 39.172;
export const LAST_DRUM = 41.784;

// ─────────── Voice ───────────

/** Intro phrase 1: five words, sung.json (salience 0.76–1.0). */
export const INTRO_WORDS = [0.406, 0.929, 1.277, 1.846, 2.705];
/** The F♯4 hook motif, intro: words 0.26–0.30 s apart (salience 0.67–0.81). */
export const INTRO_RUN = [3.32, 3.576, 3.855, 4.156, 4.423];
/** The faint tail of the intro (vocals 0.08, salience 0.45). */
export const INTRO_TAIL = 4.853;
/** Build: unpitched breathy words (salience 0.40–1.0); 7.001 and 7.872 carry a faint drum tick. */
export const BUILD_WORDS = [7.001, 7.372, 7.872, 8.243, 9.102];
/** The two notes in the drum cut before the drop (the intro's loudest). */
export const CUT_WORDS = [9.66, 9.961];
/** Murmured syllables in the reset (vocals 0.10–0.16, salience 0.31–0.45). */
export const RESET_WORDS = [26.482, 26.796, 27.04];
/** Outro, before the hook motif: 42.655, held C5 43.003, A♯4 43.537, 44.408. */
export const OUTRO_WORDS = [42.655, 43.003, 43.537, 44.408];
/** The F♯4 hook motif, outro: 0.23–0.30 s apart (salience 0.48–0.82). */
export const OUTRO_RUN = [45.012, 45.256, 45.534, 45.836, 46.103];
/** Vocal hooks in the groove, in the slot after beat 3 (vocals 0.25–0.46, G5). */
export const HOOKS = [13.526, 30.917, 37.872];
/** The chord stab that fills the same slot once ("other" 0.51, rise 0.38). */
export const STAB = 20.48;

// ─────────── Drums ───────────

/** Every kick, groove and run (the drop and the re-entry included, the boom apart). */
export const KICKS = [
  10.472, 11.343, 12.214, 13.073, 13.955, 14.826, 15.685, 16.556, 16.985, 17.427, 18.297, 19.168,
  20.039, 20.944, 21.78, 22.639, 23.51, // groove
  27.864, 28.735, 29.605, 30.476, 31.347, 32.218, 33.077, 33.948, 34.377, 34.818, 35.689, 36.56,
  37.431, 38.301, // run
  39.602, 40.472, 40.902, 41.784, // run end
];
/** Bar downbeats (beat 1), each preceded by a pickup. */
export const DOWNBEATS = [11.343, 14.826, 18.297, 21.78, 28.735, 32.218, 35.689];
/** Pickup snares, 0.209–0.221 s before each downbeat (drums 0.27–0.29). */
export const PICKUPS = [11.122, 14.605, 18.088, 21.56, 28.514, 31.997, 35.468];
/** The pickup → downbeat pairs: the song's "ta-BOOM". */
export const PAIRS = PICKUPS.map((p, i) => [p, DOWNBEATS[i]]);
/** Backbeat snares/toms, 0.43 s after a kick (drums 0.19–0.30). */
export const BACKBEATS = [
  11.773, 12.643, 15.256, 16.126, 18.727, 19.598, 22.21, 23.081, // groove
  29.176, 30.035, 32.647, 33.518, 36.13, 37.001, // run
  39.172, // run end (the weak snare on the missing downbeat)
];

// ─────────── Strength helpers (measured loudness plus structure) ───────────

const peak = (t: number, stem: string) => event(t).sources[stem]?.peak ?? 0;

/**
 * A kick: groove kicks are all 0.69–0.74 in the drum stem (and five have no stem
 * onset), so loudness sets one level and the bar sets the accent: downbeat high,
 * the soft last kick of the run lower by its measured peak.
 */
export function kickStrength(t: number, base = 0.58, downbeat = 0.2): number {
  const p = drumPeak(t) || 0.72; // the five kicks without a stem onset: the groove's level
  const accent = DOWNBEATS.some((d) => Math.abs(d - t) < 0.02) ? downbeat : 0;
  return Number(clamp((base + accent) * p / 0.72, 0.2, 1).toFixed(3));
}
/** A snare (pickup or backbeat): by its drum-stem loudness, lighter than a kick. */
export const snareStrength = (t: number, gain = 1.4) => Number(clamp(gain * peak(t, "drums"), 0.22, 0.5).toFixed(3));
/** A word: by how sharply it enters (vocals rise), within a light, clear range. */
export const wordStrength = (t: number, base = 0.16, gain = 0.9) => Number(voiceStrength(t, base, gain).toFixed(3));

// ─────────── Shared presentation ───────────

export const phases = [
  { name: "VOICE", t0: 0.0, t1: SILENCE_T0, color: "#2f6f73" },
  { name: "SILENCE", t0: SILENCE_T0, t1: BUILD, color: "#22383a" },
  { name: "BUILD", t0: BUILD, t1: DRUM_CUT_T0, color: "#d09728" },
  { name: "CUT", t0: DRUM_CUT_T0, t1: DROP, color: "#5c4a1c" },
  { name: "GROOVE", t0: DROP, t1: BOOM, color: "#c4483f" },
  { name: "BOOM / RESET", t0: BOOM, t1: REENTRY, color: "#6d5aa8" },
  { name: "RUN", t0: REENTRY, t1: RUN_END, color: "#d46a2e" },
  { name: "RUN END", t0: RUN_END, t1: LAST_DRUM, color: "#a8553a" },
  { name: "VOICE OUTRO", t0: LAST_DRUM, t1: DURATION, color: "#3e8f6c" },
];

export const overlayMeta = {
  title: "TIKI TIKI",
  artist: "SLOWED",
  tempo: "69 BPM (kick) / 138 BPM (snare)",
  phases,
};

export const music = {
  audio: "productions/tiki_tiki_48s/audio.mp3",
  title: "TIKI TIKI (Slowed)",
  artist: "Unknown",
  tempo: overlayMeta.tempo,
  beats: "productions/tiki_tiki_48s/audio.json",
  spectrogram: {
    image: "productions/tiki_tiki_48s/spectrogram.png",
    metadata: "productions/tiki_tiki_48s/spectrogram.json",
  },
};

/** Base zoom: wide in the quiet voice, in at the drop and the re-entry, out in the reset and outro. */
export const zoom: Array<{ t: number; zoom: number }> = [
  { t: 0.0, zoom: 2.8 },
  { t: BUILD, zoom: 2.5 },
  { t: DROP, zoom: 1.75 },
  { t: 23.5, zoom: 2.0 },
  { t: BOOM, zoom: 2.3 },
  { t: 27.3, zoom: 2.5 },
  { t: REENTRY, zoom: 1.75 },
  { t: 38.3, zoom: 1.95 },
  { t: LAST_DRUM, zoom: 2.35 },
  { t: DURATION, zoom: 2.65 },
];

/** Helper for variants: a keyframe list from [t, v] pairs with one ease. */
export const kf = (pairs: Array<[number, number]>, ease: Keyframe["ease"] = "smooth"): Keyframe[] =>
  pairs.map(([t, v]) => ({ t, v, ease }));
