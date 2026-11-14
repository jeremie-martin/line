/**
 * "Believer" (Imagine Dragons), 78.5 s: the first verse, the pre-chorus and the whole first chorus.
 * The excerpt is 7.3–85.8 s of the official video's audio (the song proper starts 7.7 s into it).
 *
 * Measured with docs/music-authoring.md: separated stems, drum classes, events.json, sung.json.
 * Loudness is each stem's peak as a fraction of the mix's 99th-percentile RMS.
 *
 * The grid. 125 BPM; a bar is four beats, 1.92 s, from 0.43 s; each beat divides in three (0.16 s).
 * The drums are the loudest layer from the first bar to the last (kicks 0.65–0.78; the voice 0.4–0.67).
 * One bar of the stomp reads
 *     BOOM . . . . . TAK . . ta ta BOOM | BOOM
 *     0.00           0.96    1.45 1.62 1.78   (seconds into the bar)
 * a kick on the downbeat, a snare/clap on beat 3, two soft toms (0.19–0.31) and a pickup kick that
 * runs straight into the next downbeat: four hits 0.16 s apart, the song's signature.
 * Every fourth bar is a STOP: kick and snare only, no toms and no pickup, three guitar notes in the
 * gap (0.32, 0.79 and 1.27 s into the bar), so the next downbeat falls alone, with the bass under it.
 *
 *    0.43–15.79  VERSE 1, bars 0–7. "First things first": fast words in bars 0–2 (0.4–0.63), long held
 *                notes in bars 4–7 (9.06 holds 1.1 s). Stops: bars 3 and 7.
 *   15.79–31.15  VERSE 1, second half, bars 8–15. "Second things second": the densest words of the
 *                excerpt in bars 8–11 (five or six clear attacks a bar), held notes in 12–15.
 *                Stops: bars 11 and 15.
 *   31.15–46.51  PRE-CHORUS, bars 16–23. "I was broken from a young age": the voice steady, two to
 *                four attacks a bar (0.4–0.58). Stops: bars 19 and 23.
 *   46.51–48.43  THE BREAK, bar 24. The drums stop. A soft bass note (46.56), a strong one with the
 *                voice (47.51, 0.52), then the pickup kick alone (48.27) into the chorus.
 *   48.43–78.50  CHORUS, bars 25–40. "Pain!": hats and a bass line join, the snare is louder
 *                (0.43–0.50), the toms thinner. The voice is long held notes; the vocal stem shows
 *                few clear attacks here and sung.json almost no pitched note, so the voice of the
 *                chorus is the least certain reading of the excerpt. From bar 32 a second percussion
 *                layer adds hits between the beats (drum stem 0.34–0.46, class unknown).
 *                Stops: bars 27, 31, 35 and 39.
 *
 * Not landed on: hats (0.07–0.2), the bass line's notes just after a kick (0.12–0.15 s after the
 * downbeat), single soft toms in the chorus's stop bars, vocal estimates with no clear rise.
 */
import type {Spec} from '../../scripts/v0/types.ts';

export const DURATION = 78.5;
export const BAR = 1.92;
export const FIRST_BAR = 0.43;
export const VERSE_2_T = 15.79;
export const PRECHORUS_T = 31.15;
export const BREAK_T = 46.51;
export const CHORUS_T = 48.43;

const phases = [
  {name: 'VERSE', t0: 0, t1: VERSE_2_T, color: '#4f7f73'},
  {name: 'VERSE · DENSER', t0: VERSE_2_T, t1: PRECHORUS_T, color: '#7a8f4a'},
  {name: 'PRE-CHORUS', t0: PRECHORUS_T, t1: BREAK_T, color: '#8a5fa8'},
  {name: 'BREAK', t0: BREAK_T, t1: CHORUS_T, color: '#5f7892'},
  {name: 'CHORUS', t0: CHORUS_T, t1: DURATION, color: '#c4483f'},
];
export const overlayMeta = {title: 'BELIEVER', artist: 'Imagine Dragons', tempo: '125 BPM; a stomp in triplets, every fourth bar a stop', phases};
/** Camera shared by the variants: wider in the break, closest in the chorus. */
export const zoom = {
  smoothingFrames: 8,
  keyframes: [
    {t: 0, zoom: 2.3}, {t: VERSE_2_T, zoom: 2.15}, {t: PRECHORUS_T, zoom: 2.05}, {t: BREAK_T, zoom: 2.5}, {t: CHORUS_T, zoom: 1.85}, {t: DURATION, zoom: 2.0},
  ],
};
export const music: Spec['music'] = {
  audio: 'productions/believer_78s/audio.mp3',
  title: 'Believer',
  artist: 'Imagine Dragons',
  tempo: overlayMeta.tempo,
  beats: 'productions/believer_78s/audio.json',
  spectrogram: {image: 'productions/believer_78s/spectrogram.png', metadata: 'productions/believer_78s/spectrogram.json'},
};
