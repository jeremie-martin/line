/** Believer · stomp-voice: the whole stomp and the voice between its hits (first draft, 2026-11-14).
 *
 * The reading. The drums are the loudest layer throughout, and their pattern is the song, so every
 * bar lands the stomp complete: the downbeat kick, the snare, the two soft toms and the pickup kick,
 * which with the next downbeat makes four landings 0.16 s apart ("ta ta BOOM BOOM"). The voice rides
 * on top, as on Circus Minimus: a clear vocal attack between two drum hits gets its own landing; one
 * within 0.09 s of a drum hit shares the drum's, a little firmer; an estimate with no clear rise gets
 * none. In the stop bars the three guitar notes take the place of the toms, lightly, and the
 * downbeat that follows a stop falls alone and harder. The break floats on the bass into "Pain!",
 * the hardest landing of the excerpt.
 *
 * Strengths are authored by role: downbeat .78 (.90 after a stop, 1 for "Pain!"), pickup kick .70,
 * snare .58, toms .36 and .42, voice .42–.62 by its measured peak, guitar .40; the chorus's drums
 * are .05 firmer. Every time is a measured source time (events.json).
 *
 * Not heard by the author. The chorus's voice is the least certain part (see music.ts). Compiler
 * feasibility is not a filter: the four-hit runs every bar are deliberate.
 */
import type {Spec} from '../../../scripts/v0/types.ts';
import {beats} from '../../../scripts/v0/core/beats.ts';
import {keyframes} from '../../../scripts/v0/core/curves.ts';
import * as m from '../music.ts';
export {overlayMeta} from '../music.ts';

type Source = 'vocals' | 'drums' | 'bass' | 'other';
type AuthoredBeat = {t: number; impact: number; source: Source; role: string};
export const landings: AuthoredBeat[] = [
  // ── verse 1: "First things first" ──
  // bar 0, 0.43 s
  {t: 0.430, impact: .86, source: 'drums', role: 'downbeat+voice'},
  {t: 0.906, impact: .53, source: 'vocals', role: 'voice'},
  {t: 1.393, impact: .62, source: 'drums', role: 'snare+voice'},
  {t: 1.881, impact: .40, source: 'drums', role: 'tom+voice'},
  {t: 2.043, impact: .42, source: 'drums', role: 'tom'},
  {t: 2.206, impact: .70, source: 'drums', role: 'pickup'},
  // bar 1, 2.35 s
  {t: 2.368, impact: .82, source: 'drums', role: 'downbeat+voice'},
  {t: 2.856, impact: .57, source: 'vocals', role: 'voice'},
  {t: 3.170, impact: .55, source: 'vocals', role: 'voice'},
  {t: 3.309, impact: .58, source: 'drums', role: 'snare'},
  {t: 3.796, impact: .40, source: 'drums', role: 'tom+voice'},
  {t: 3.971, impact: .42, source: 'drums', role: 'tom'},
  {t: 4.122, impact: .70, source: 'drums', role: 'pickup'},
  // bar 2, 4.27 s
  {t: 4.284, impact: .78, source: 'drums', role: 'downbeat'},
  {t: 4.748, impact: .54, source: 'vocals', role: 'voice'},
  {t: 5.236, impact: .62, source: 'drums', role: 'snare+voice'},
  {t: 5.712, impact: .36, source: 'drums', role: 'tom'},
  {t: 5.886, impact: .42, source: 'drums', role: 'tom'},
  {t: 6.049, impact: .74, source: 'drums', role: 'pickup+voice'},
  // bar 3, 6.19 s (stop bar)
  {t: 6.211, impact: .78, source: 'drums', role: 'downbeat'},
  {t: 6.513, impact: .40, source: 'other', role: 'guitar'},
  {t: 6.989, impact: .54, source: 'vocals', role: 'voice'},
  {t: 7.152, impact: .58, source: 'drums', role: 'snare'},
  {t: 7.465, impact: .40, source: 'other', role: 'guitar'},
  {t: 7.628, impact: .49, source: 'vocals', role: 'voice'},
  // bar 4, 8.11 s
  {t: 8.104, impact: .90, source: 'drums', role: 'downbeat'},
  {t: 9.067, impact: .62, source: 'drums', role: 'snare+voice'},
  {t: 9.555, impact: .36, source: 'drums', role: 'tom'},
  {t: 9.729, impact: .42, source: 'drums', role: 'tom'},
  {t: 9.880, impact: .70, source: 'drums', role: 'pickup'},
  // bar 5, 10.03 s
  {t: 10.043, impact: .78, source: 'drums', role: 'downbeat'},
  {t: 10.786, impact: .58, source: 'vocals', role: 'voice'},
  {t: 10.995, impact: .58, source: 'drums', role: 'snare'},
  {t: 11.471, impact: .40, source: 'drums', role: 'tom+voice'},
  {t: 11.656, impact: .42, source: 'drums', role: 'tom'},
  {t: 11.807, impact: .70, source: 'drums', role: 'pickup'},
  // bar 6, 11.95 s
  {t: 11.970, impact: .78, source: 'drums', role: 'downbeat'},
  {t: 12.910, impact: .62, source: 'drums', role: 'snare+voice'},
  {t: 13.398, impact: .36, source: 'drums', role: 'tom'},
  {t: 13.572, impact: .42, source: 'drums', role: 'tom'},
  {t: 13.723, impact: .70, source: 'drums', role: 'pickup'},
  // bar 7, 13.87 s (stop bar)
  {t: 13.886, impact: .78, source: 'drums', role: 'downbeat'},
  {t: 14.187, impact: .40, source: 'other', role: 'guitar'},
  {t: 14.663, impact: .40, source: 'other', role: 'guitar'},
  {t: 14.838, impact: .58, source: 'drums', role: 'snare'},
  {t: 15.139, impact: .40, source: 'other', role: 'guitar'},
  // ── verse 1, second half: "Second things second" ──
  // bar 8, 15.79 s
  {t: 15.790, impact: .94, source: 'drums', role: 'downbeat+voice'},
  {t: 16.057, impact: .45, source: 'vocals', role: 'voice'},
  {t: 16.277, impact: .52, source: 'vocals', role: 'voice'},
  {t: 16.753, impact: .62, source: 'drums', role: 'snare+voice'},
  {t: 17.043, impact: .51, source: 'vocals', role: 'voice'},
  {t: 17.229, impact: .36, source: 'drums', role: 'tom'},
  {t: 17.403, impact: .42, source: 'drums', role: 'tom'},
  {t: 17.566, impact: .70, source: 'drums', role: 'pickup'},
  // bar 9, 17.71 s
  {t: 17.728, impact: .82, source: 'drums', role: 'downbeat+voice'},
  {t: 18.181, impact: .57, source: 'vocals', role: 'voice'},
  {t: 18.448, impact: .50, source: 'vocals', role: 'voice'},
  {t: 18.669, impact: .62, source: 'drums', role: 'snare+voice'},
  {t: 18.982, impact: .53, source: 'vocals', role: 'voice'},
  {t: 19.156, impact: .36, source: 'drums', role: 'tom'},
  {t: 19.331, impact: .42, source: 'drums', role: 'tom'},
  {t: 19.482, impact: .70, source: 'drums', role: 'pickup'},
  // bar 10, 19.63 s
  {t: 19.644, impact: .78, source: 'drums', role: 'downbeat'},
  {t: 20.062, impact: .55, source: 'vocals', role: 'voice'},
  {t: 20.399, impact: .56, source: 'vocals', role: 'voice'},
  {t: 20.596, impact: .58, source: 'drums', role: 'snare'},
  {t: 21.037, impact: .54, source: 'vocals', role: 'voice'},
  {t: 21.246, impact: .42, source: 'drums', role: 'tom'},
  {t: 21.409, impact: .74, source: 'drums', role: 'pickup+voice'},
  // bar 11, 21.55 s (stop bar)
  {t: 21.571, impact: .82, source: 'drums', role: 'downbeat+voice'},
  {t: 21.873, impact: .40, source: 'other', role: 'guitar'},
  {t: 22.036, impact: .52, source: 'vocals', role: 'voice'},
  {t: 22.338, impact: .52, source: 'vocals', role: 'voice'},
  {t: 22.512, impact: .58, source: 'drums', role: 'snare'},
  {t: 22.825, impact: .48, source: 'vocals', role: 'voice'},
  {t: 23.301, impact: .52, source: 'vocals', role: 'voice'},
  // bar 12, 23.47 s
  {t: 23.475, impact: .94, source: 'drums', role: 'downbeat+voice'},
  {t: 24.439, impact: .62, source: 'drums', role: 'snare+voice'},
  {t: 24.915, impact: .36, source: 'drums', role: 'tom'},
  {t: 25.089, impact: .42, source: 'drums', role: 'tom'},
  {t: 25.240, impact: .70, source: 'drums', role: 'pickup'},
  // bar 13, 25.39 s
  {t: 25.403, impact: .78, source: 'drums', role: 'downbeat'},
  {t: 26.157, impact: .59, source: 'vocals', role: 'voice'},
  {t: 26.355, impact: .58, source: 'drums', role: 'snare'},
  {t: 26.680, impact: .53, source: 'vocals', role: 'voice'},
  {t: 26.842, impact: .36, source: 'drums', role: 'tom'},
  {t: 27.005, impact: .42, source: 'drums', role: 'tom'},
  {t: 27.167, impact: .70, source: 'drums', role: 'pickup'},
  // bar 14, 27.31 s
  {t: 27.330, impact: .82, source: 'drums', role: 'downbeat+voice'},
  {t: 28.270, impact: .62, source: 'drums', role: 'snare+voice'},
  {t: 28.758, impact: .36, source: 'drums', role: 'tom'},
  {t: 28.932, impact: .42, source: 'drums', role: 'tom'},
  {t: 29.083, impact: .70, source: 'drums', role: 'pickup'},
  // bar 15, 29.23 s (stop bar)
  {t: 29.246, impact: .78, source: 'drums', role: 'downbeat'},
  {t: 29.547, impact: .40, source: 'other', role: 'guitar'},
  {t: 30.012, impact: .40, source: 'other', role: 'guitar'},
  {t: 30.198, impact: .58, source: 'drums', role: 'snare'},
  {t: 30.499, impact: .40, source: 'other', role: 'guitar'},
  {t: 30.871, impact: .53, source: 'vocals', role: 'voice'},
  // ── pre-chorus: "I was broken from a young age" ──
  // bar 16, 31.15 s
  {t: 31.150, impact: .90, source: 'drums', role: 'downbeat'},
  {t: 31.475, impact: .50, source: 'vocals', role: 'voice'},
  {t: 31.858, impact: .48, source: 'vocals', role: 'voice'},
  {t: 32.113, impact: .58, source: 'drums', role: 'snare'},
  {t: 32.578, impact: .36, source: 'drums', role: 'tom'},
  {t: 32.775, impact: .46, source: 'drums', role: 'tom+voice'},
  {t: 32.926, impact: .70, source: 'drums', role: 'pickup'},
  // bar 17, 33.07 s
  {t: 33.088, impact: .78, source: 'drums', role: 'downbeat'},
  {t: 33.402, impact: .54, source: 'vocals', role: 'voice'},
  {t: 34.029, impact: .58, source: 'drums', role: 'snare'},
  {t: 34.505, impact: .36, source: 'drums', role: 'tom'},
  {t: 34.691, impact: .42, source: 'drums', role: 'tom'},
  {t: 34.842, impact: .70, source: 'drums', role: 'pickup'},
  // bar 18, 34.99 s
  {t: 35.004, impact: .82, source: 'drums', role: 'downbeat+voice'},
  {t: 35.677, impact: .45, source: 'vocals', role: 'voice'},
  {t: 35.944, impact: .62, source: 'drums', role: 'snare+voice'},
  {t: 36.432, impact: .36, source: 'drums', role: 'tom'},
  {t: 36.618, impact: .46, source: 'drums', role: 'tom+voice'},
  {t: 36.769, impact: .70, source: 'drums', role: 'pickup'},
  // bar 19, 36.91 s (stop bar)
  {t: 36.931, impact: .78, source: 'drums', role: 'downbeat'},
  {t: 37.071, impact: .48, source: 'vocals', role: 'voice'},
  {t: 37.535, impact: .51, source: 'vocals', role: 'voice'},
  {t: 37.872, impact: .62, source: 'drums', role: 'snare+voice'},
  // bar 20, 38.83 s
  {t: 38.835, impact: .90, source: 'drums', role: 'downbeat'},
  {t: 39.544, impact: .46, source: 'vocals', role: 'voice'},
  {t: 39.787, impact: .62, source: 'drums', role: 'snare+voice'},
  {t: 40.275, impact: .36, source: 'drums', role: 'tom'},
  {t: 40.449, impact: .46, source: 'drums', role: 'tom+voice'},
  {t: 40.600, impact: .70, source: 'drums', role: 'pickup'},
  // bar 21, 40.75 s
  {t: 40.763, impact: .78, source: 'drums', role: 'downbeat'},
  {t: 41.053, impact: .48, source: 'vocals', role: 'voice'},
  {t: 41.436, impact: .49, source: 'vocals', role: 'voice'},
  {t: 41.703, impact: .58, source: 'drums', role: 'snare'},
  {t: 42.179, impact: .36, source: 'drums', role: 'tom'},
  {t: 42.376, impact: .46, source: 'drums', role: 'tom+voice'},
  {t: 42.527, impact: .70, source: 'drums', role: 'pickup'},
  // bar 22, 42.67 s
  {t: 42.678, impact: .78, source: 'drums', role: 'downbeat'},
  {t: 43.015, impact: .52, source: 'vocals', role: 'voice'},
  {t: 43.363, impact: .51, source: 'vocals', role: 'voice'},
  {t: 43.630, impact: .58, source: 'drums', role: 'snare'},
  {t: 44.106, impact: .36, source: 'drums', role: 'tom'},
  {t: 44.292, impact: .42, source: 'drums', role: 'tom'},
  {t: 44.443, impact: .70, source: 'drums', role: 'pickup'},
  // bar 23, 44.59 s (stop bar)
  {t: 44.606, impact: .82, source: 'drums', role: 'downbeat+voice'},
  {t: 45.232, impact: .54, source: 'vocals', role: 'voice'},
  {t: 45.558, impact: .58, source: 'drums', role: 'snare'},
  // ── the break: drums out, the bass alone, then the pickup kick ──
  // bar 24, 46.51 s
  {t: 46.556, impact: .35, source: 'bass', role: 'bass'},
  {t: 47.508, impact: .62, source: 'bass', role: 'bass+voice'},
  {t: 48.274, impact: .74, source: 'drums', role: 'pickup'},
  // ── chorus: "Pain!" ──
  // bar 25, 48.43 s
  {t: 48.437, impact: 1.00, source: 'drums', role: 'downbeat'},
  {t: 48.774, impact: .51, source: 'vocals', role: 'voice'},
  {t: 49.400, impact: .67, source: 'drums', role: 'snare+voice'},
  {t: 49.714, impact: .53, source: 'vocals', role: 'voice'},
  {t: 50.051, impact: .42, source: 'drums', role: 'tom'},
  {t: 50.213, impact: .75, source: 'drums', role: 'pickup'},
  // bar 26, 50.35 s
  {t: 50.352, impact: .83, source: 'drums', role: 'downbeat'},
  {t: 51.316, impact: .63, source: 'drums', role: 'snare'},
  {t: 51.804, impact: .36, source: 'drums', role: 'tom'},
  {t: 51.978, impact: .42, source: 'drums', role: 'tom'},
  {t: 52.129, impact: .79, source: 'drums', role: 'pickup+voice'},
  // bar 27, 52.27 s (stop bar)
  {t: 52.280, impact: .83, source: 'drums', role: 'downbeat'},
  {t: 53.069, impact: .40, source: 'other', role: 'guitar'},
  {t: 53.220, impact: .63, source: 'drums', role: 'snare'},
  // bar 28, 54.19 s
  {t: 54.195, impact: .92, source: 'drums', role: 'downbeat'},
  {t: 55.159, impact: .63, source: 'drums', role: 'snare'},
  {t: 55.960, impact: .75, source: 'drums', role: 'pickup'},
  // bar 29, 56.11 s
  {t: 56.111, impact: .83, source: 'drums', role: 'downbeat'},
  {t: 56.436, impact: .51, source: 'vocals', role: 'voice'},
  {t: 56.622, impact: .51, source: 'vocals', role: 'voice'},
  {t: 57.075, impact: .63, source: 'drums', role: 'snare'},
  {t: 57.377, impact: .54, source: 'vocals', role: 'voice'},
  {t: 57.736, impact: .42, source: 'drums', role: 'tom'},
  {t: 57.887, impact: .79, source: 'drums', role: 'pickup+voice'},
  // bar 30, 58.03 s
  {t: 58.038, impact: .83, source: 'drums', role: 'downbeat'},
  {t: 58.990, impact: .63, source: 'drums', role: 'snare'},
  {t: 59.490, impact: .36, source: 'drums', role: 'tom'},
  {t: 59.652, impact: .46, source: 'drums', role: 'tom+voice'},
  {t: 59.803, impact: .75, source: 'drums', role: 'pickup'},
  // bar 31, 59.95 s (stop bar)
  {t: 59.954, impact: .83, source: 'drums', role: 'downbeat'},
  {t: 60.743, impact: .40, source: 'other', role: 'guitar'},
  {t: 60.918, impact: .63, source: 'drums', role: 'snare'},
  {t: 61.231, impact: .40, source: 'other', role: 'guitar'},
  // bar 32, 61.87 s
  {t: 61.846, impact: .92, source: 'drums', role: 'downbeat+voice'},
  {t: 62.682, impact: .50, source: 'drums', role: 'fill'},
  {t: 62.833, impact: .63, source: 'drums', role: 'snare'},
  {t: 63.634, impact: .75, source: 'drums', role: 'pickup'},
  // ── chorus, second half ──
  // bar 33, 63.79 s
  {t: 63.797, impact: .83, source: 'drums', role: 'downbeat'},
  {t: 64.099, impact: .48, source: 'vocals', role: 'voice'},
  {t: 64.273, impact: .48, source: 'vocals', role: 'voice'},
  {t: 64.749, impact: .63, source: 'drums', role: 'snare'},
  {t: 65.097, impact: .45, source: 'drums', role: 'fill'},
  {t: 65.562, impact: .79, source: 'drums', role: 'pickup+voice'},
  // bar 34, 65.71 s
  {t: 65.712, impact: .83, source: 'drums', role: 'downbeat'},
  {t: 66.049, impact: .45, source: 'drums', role: 'fill'},
  {t: 66.525, impact: .45, source: 'drums', role: 'fill'},
  {t: 66.664, impact: .63, source: 'drums', role: 'snare'},
  {t: 67.477, impact: .79, source: 'drums', role: 'pickup+voice'},
  // bar 35, 67.63 s (stop bar)
  {t: 67.640, impact: .83, source: 'drums', role: 'downbeat'},
  {t: 67.930, impact: .51, source: 'vocals', role: 'voice'},
  {t: 68.441, impact: .49, source: 'drums', role: 'fill+voice'},
  {t: 68.592, impact: .67, source: 'drums', role: 'snare+voice'},
  // bar 36, 69.55 s
  {t: 69.567, impact: .92, source: 'drums', role: 'downbeat'},
  {t: 70.531, impact: .67, source: 'drums', role: 'snare+voice'},
  {t: 71.308, impact: .75, source: 'drums', role: 'pickup'},
  // bar 37, 71.47 s
  {t: 71.471, impact: .83, source: 'drums', role: 'downbeat'},
  {t: 71.796, impact: .52, source: 'vocals', role: 'voice'},
  {t: 72.423, impact: .63, source: 'drums', role: 'snare'},
  {t: 72.760, impact: .50, source: 'vocals', role: 'voice'},
  {t: 72.911, impact: .36, source: 'drums', role: 'tom'},
  {t: 73.247, impact: .79, source: 'drums', role: 'pickup+voice'},
  // bar 38, 73.39 s
  {t: 73.398, impact: .83, source: 'drums', role: 'downbeat'},
  {t: 73.723, impact: .45, source: 'drums', role: 'fill'},
  {t: 74.211, impact: .45, source: 'drums', role: 'fill'},
  {t: 74.350, impact: .63, source: 'drums', role: 'snare'},
  {t: 74.850, impact: .36, source: 'drums', role: 'tom'},
  {t: 75.024, impact: .46, source: 'drums', role: 'tom+voice'},
  {t: 75.163, impact: .75, source: 'drums', role: 'pickup'},
  // bar 39, 75.31 s (stop bar)
  {t: 75.314, impact: .83, source: 'drums', role: 'downbeat'},
  {t: 76.254, impact: .63, source: 'drums', role: 'snare'},
  // bar 40, 77.23 s
  {t: 77.241, impact: .92, source: 'drums', role: 'downbeat+voice'},
  {t: 77.415, impact: .45, source: 'drums', role: 'fill'},
  {t: 77.729, impact: .52, source: 'vocals', role: 'voice'},
  {t: 78.193, impact: .67, source: 'drums', role: 'snare+voice'},
];

/** Faster as the song builds; the chorus the fastest. */
export const speed = keyframes([
  {t: 0, v: 0.62, ease: 'smooth'},
  {t: m.VERSE_2_T, v: 0.68, ease: 'smooth'},
  {t: m.PRECHORUS_T, v: 0.72, ease: 'smooth'},
  {t: m.BREAK_T, v: 0.62, ease: 'smooth'},
  {t: m.CHORUS_T, v: 0.88, ease: 'easeIn'},
  {t: m.DURATION, v: 0.88},
]);
/** Low rides under the stomp; one float, over the break. */
export const air = keyframes([
  {t: 0, v: 0.52, ease: 'smooth'},
  {t: m.PRECHORUS_T, v: 0.50, ease: 'smooth'},
  {t: m.BREAK_T, v: 0.60, ease: 'smooth'},
  {t: 47.6, v: 0.86, ease: 'smooth'},
  {t: m.CHORUS_T, v: 0.50, ease: 'smooth'},
  {t: m.DURATION, v: 0.50},
]);

const spec: Spec = {
  duration: m.DURATION,
  music: m.music,
  camera: {zoom: m.zoom},
  contacts: beats(landings.map(({t, impact}) => ({t, impact}))),
  axes: {air, speed},
};
export default spec;
