/**
 * "LUNA BALA (Slowed)", first 44 s: the measured layers, read event-first from the
 * Demucs stems, ADTOF drum classes and sung notes (events.json, sung.json,
 * generated/stems/luna_bala_44s/sheets). Every time below is an events.json event;
 * `event(t)` throws on any that is not. The variants in variants/ are whole specs
 * chosen from these layers; spec.ts (the panel's "ordinary groove") is the older
 * grid-first reading and is left unchanged.
 *
 * Loudness is in the stems' unit (fraction of the mix's 99th-percentile RMS).
 *
 * Structure, section by section:
 *
 * - 0.00–3.50 VOICE, PHRASE 1. A solo voice, nothing else (mix 0.17–0.35, about
 *   half the body's level: calm). Legato, one word every 0.4–0.6 s (sung notes
 *   G4 A♯4 C5 G4 A♯4 A♯4 A4), with a breath dip at 1.40. Only two pairs of words
 *   are closer than 0.45 s in the whole intro (0.174–0.441 and 4.493–5.387):
 *   this voice is legato, not fast. The first word's note is
 *   detected at 0.081, but its loudness arrives at the vocal onset 0.174
 *   (vocals 0.36, rise 0.31); 0.081 is also before the 0.13 s first-landing floor.
 * - 3.50–4.49 STOP. The voice stops dead: mix 0.03–0.07 for a full second.
 * - 4.49–8.61 VOICE, PHRASE 2. Re-enters on 4.493 (salience 1.0) with the only
 *   close words of the intro (4.493, 4.667, 5.074, 5.387: 0.17–0.41 s), then
 *   one word every 0.5–0.55 s up to 8.069. No drums, bass or chords at all.
 * - 8.615 DROP. Kick and snare together (drums 0.85, mix rise 0.85), the
 *   loudest arrival in the song; bass and chords enter with it.
 * - 8.61–23.87 BODY A. The drums lead: a kick every 0.545 s (110 BPM), all of
 *   equal loudness (drums 0.82–0.88; this master is flat). Bars of four kicks; the
 *   bar's first kick carries a layered snare or tom and a short vocal "hey"
 *   (G4) on top: the downbeats below. Between kicks, an off-beat chord stab
 *   ("other" 0.35–0.52), a tom, a snare or a bass note, audible on only about
 *   half the half-beats (OFFBEATS lists those that are). Every 16 kicks, a kick
 *   triplet fill at 0.267 + 0.279 s (12.434 and 21.153): kick, then a
 *   kick/snare/tom on the off-beat (drums 0.61–0.66), then the next downbeat.
 *   Mix 0.65–0.76 throughout: loud and even.
 * - 23.87–26.05 TOM BREAK. After the downbeat 23.870 the bass and the voice stop
 *   (bass 0.44 → 0.01). Four kick/tom hits stand alone with space between them
 *   (mix 0.37–0.45 between hits against 0.6 in the body); the chords keep
 *   pulsing quietly. Not quiet: the toms are as loud as any kick.
 * - 26.053 RE-ENTRY. Bass and the vocal "hey" return on the downbeat.
 * - 26.05–42.96 BODY B. As body A, with snare off-beats more often and two more
 *   triplet fills (29.872, 38.592). The 8 s windows with the highest mean mix
 *   are 32–40 and 10–18 (0.709 and 0.707): the body is uniformly loud.
 * - 42.96–44.00 COLLAPSE. The last kick is 42.957; by 43.2 the mix falls to
 *   0.05 and stays there. A faint sung A♯4 at 43.514 (mix 0.05) is not a hit.
 *
 * Not used anywhere: vocal onsets that are note-internal pitch moves without an
 * attack (0.731, 1.846, 2.310, 2.879: rise ≤ 0.09); mix-only onsets 30–70 ms
 * before a kick (the kick's own attack in the mix, e.g. 35.794, 38.011); the
 * off-beat "other" swells whose own rise is under 0.18 and that ADTOF does not
 * hear as a drum hit (e.g. 9.451, 17.078); and decaying kick tails that the drum
 * stem lists with zero rise (16.533, 33.402, 33.994).
 */
import { measuredSong, clamp } from "../../scripts/v0/core/measured.ts";
import type { Keyframe } from "../../scripts/v0/core/curves.ts";

export const { events, audio, event, rise, drumPeak, drumStrength, voiceStrength, landings, sungNotes } =
  measuredSong(import.meta.dirname);
export { clamp };

export const DURATION = 44;

// ─────────── Section boundaries (event times) ───────────
export const STOP_T0 = 3.5; // voice falls silent (end of 3.216's note)
export const VOICE_REENTRY = 4.493;
export const DROP = 8.615;
export const BREAK_IN = 23.87; // last downbeat with bass under it
export const REENTRY = 26.053;
export const LAST_KICK = 42.957;

// ─────────── Voice (0–8.6 s) ───────────

/**
 * Every sung word of the intro, sung.json notes (salience 0.32–1.0), at the note's
 * vocal attack: 0.174 for the first (see header), and 0.441 for the A♯4 whose note
 * sung.py attaches to 0.453, an "other"-stem event with no loudness 12 ms later.
 */
export const WORDS = [
  0.174, 0.441, 1.033, 1.579, 2.078, 2.659, 3.216, // phrase 1
  4.493, 4.667, 5.074, 5.387, 5.944, 6.444, 6.989, 7.523, 8.069, // phrase 2
];
/** The voice by phrases and half-phrases: a sub-phrase start every 1–1.4 s. */
export const PHRASES = [0.174, 1.579, 2.659, 4.493, 5.387, 6.444, 7.523];

// ─────────── Drums (8.6–43 s) ───────────

/** Every on-beat kick, 0.545 s apart (fill off-beats excluded; see FILLS). */
export const KICKS = [
  8.615, 9.172, 9.706, 10.252, 10.786, 11.355, 11.889, 12.434, 12.98, 13.526, 14.071, 14.605,
  15.151, 15.708, 16.242, 16.788, 17.334, 17.891, 18.425, 18.971, 19.505, 20.062, 20.608, 21.153,
  21.699, 22.245, 22.79, 23.336, 23.87, // body A
  24.416, 24.961, 25.507, // tom break (bass and voice out)
  26.053, 26.61, 27.156, 27.69, 28.235, 28.793, 29.327, 29.872, 30.418, 30.975, 31.509, 32.055,
  32.589, 33.146, 33.681, 34.226, 34.772, 35.329, 35.875, 36.42, 36.955, 37.512, 38.058, 38.592,
  39.149, 39.695, 40.24, 40.774, 41.32, 41.866, 42.411, 42.957, // body B
];
/** Bar downbeats: every fourth kick, with a layered snare/tom and the vocal "hey". */
export const DOWNBEATS = [
  8.615, 10.786, 12.98, 15.151, 17.334, 19.505, 21.699, 23.87, 26.053, 28.235, 30.418, 32.589,
  34.772, 36.955, 39.149, 41.32,
];
/** Kick triplet fills: kick, off-beat kick/snare/tom (+0.267), downbeat (+0.279 / +0.290). */
export const FILLS = [
  [12.434, 12.701, 12.98],
  [21.153, 21.42, 21.699],
  [29.872, 30.14, 30.418],
  [38.592, 38.859, 39.149],
];
export const FILL_OFFBEATS = FILLS.map((f) => f[1]);

/**
 * Audible off-beats between two kicks, 0.18–0.35 s from either: an ADTOF snare or
 * tom, an "other" chord stab rising ≥ 0.18, or a bass note rising ≥ 0.30. Half-beats
 * not listed have nothing that passes (see the header for what was left out).
 */
export const OFFBEATS = [
  10.437, // bass 0.46/0.40
  11.633, // stab 0.48/0.24 + tom
  12.19, // snare 0.22
  13.804, // stab 0.46/0.21 + tom
  14.362, // tom, bass 0.35
  14.814, // bass 0.45/0.39
  15.987, // stab 0.48/0.24
  18.17, // stab 0.44 + tom
  18.704, // stab 0.38 + tom
  19.168, // bass 0.50/0.39
  20.341, // stab 0.52/0.29
  20.886, // stab 0.40/0.20
  22.523, // stab 0.45/0.21
  23.081, // stab 0.41/0.19
  23.533, // bass 0.48/0.39
  26.889, // stab 0.46/0.20
  27.446, // snare 0.16 + stab 0.35
  27.91, // bass 0.53/0.42
  29.617, // snare 0.20
  31.254, // stab 0.44 + tom
  31.777, // snare 0.21
  32.287, // bass 0.48/0.36
  35.608, // stab 0.45/0.19
  36.177, // snare 0.20
  36.641, // bass 0.49/0.36
  38.301, // snare 0.23
  39.962, // stab 0.45/0.23 + tom
  40.484, // snare/tom 0.20
  41.006, // bass 0.50/0.37
];

// ─────────── Strength helpers (measured loudness plus structure) ───────────

const peak = (t: number, stem: string) => event(t).sources[stem]?.peak ?? 0;

/** A body kick: its measured loudness, with the bar downbeat (layered snare + "hey") a step up. */
export function kickStrength(t: number, base = 0.5, downbeat = 0.18): number {
  const isDownbeat = DOWNBEATS.some((d) => Math.abs(d - t) < 0.02);
  return Number(clamp((base + (isDownbeat ? downbeat : 0)) * drumPeak(t) / 0.86, 0.2, 1).toFixed(3));
}
/** An off-beat: by its loudest stem (stab, snare/tom or bass), lighter than a kick. */
export function offbeatStrength(t: number, base = 0.12, gain = 0.6): number {
  const p = Math.max(peak(t, "other"), peak(t, "bass"), 1.6 * peak(t, "drums"));
  return Number(clamp(base + gain * p, 0.22, 0.5).toFixed(3));
}
/** A sung word: a clear, light hit by how sharply it enters (0.2–0.35 for these words). */
export const wordStrength = (t: number) => Number(voiceStrength(t, 0.17, 0.55).toFixed(3));

// ─────────── Shared presentation ───────────

export const phases = [
  { name: "VOICE", t0: 0.0, t1: STOP_T0, color: "#3a5f8a" },
  { name: "STOP", t0: STOP_T0, t1: VOICE_REENTRY, color: "#2b3d52" },
  { name: "VOICE", t0: VOICE_REENTRY, t1: DROP, color: "#3a5f8a" },
  { name: "BODY A", t0: DROP, t1: BREAK_IN, color: "#d4843a" },
  { name: "TOM BREAK", t0: BREAK_IN, t1: REENTRY, color: "#6d5aa8" },
  { name: "BODY B", t0: REENTRY, t1: LAST_KICK, color: "#d46a2e" },
  { name: "COLLAPSE", t0: LAST_KICK, t1: DURATION, color: "#3e8f6c" },
];

export const overlayMeta = {
  title: "LUNA BALA",
  artist: "SLOWED",
  tempo: `${audio.tempo.madmom_bpm?.toFixed(1) ?? "110"} BPM`,
  phases,
};

export const music = {
  audio: "productions/luna_bala_44s/audio.mp3",
  title: "LUNA BALA (Slowed)",
  artist: "Unknown",
  tempo: overlayMeta.tempo,
  beats: "productions/luna_bala_44s/audio.json",
  spectrogram: {
    image: "productions/luna_bala_44s/spectrogram.png",
    metadata: "productions/luna_bala_44s/spectrogram.json",
  },
};

/** Base zoom: wide on the voice, in at the drop, out in the break and the collapse. */
export const zoom: Array<{ t: number; zoom: number }> = [
  { t: 0.0, zoom: 2.6 },
  { t: 7.5, zoom: 2.35 },
  { t: DROP, zoom: 1.9 },
  { t: 23.6, zoom: 1.9 },
  { t: 24.4, zoom: 2.2 },
  { t: REENTRY, zoom: 1.75 },
  { t: 40.0, zoom: 1.9 },
  { t: LAST_KICK, zoom: 2.3 },
  { t: DURATION, zoom: 2.55 },
];

/** Helper for variants: a keyframe list from [t, v] pairs with one ease. */
export const kf = (pairs: Array<[number, number]>, ease: Keyframe["ease"] = "smooth"): Keyframe[] =>
  pairs.map(([t, v]) => ({ t, v, ease }));
