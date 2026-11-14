/** Voice to the end: the voice-and-drums reading carried from the hook to the last bar (2026-11-14).
 *
 * Up to 47.5 s this is voice-drums, the variant the owner approved. After it:
 *
 * 48.0–54.5 s follows the owner's 25 listening marks of 14 November. Each mark is placed on the
 * measured source nearest to it once the marks' usual lead is counted (a mark sits about 25 ms
 * before the detected onset). What the marks taught, beyond the hook:
 *   - in the break (50.4–51.3) he follows the synth's five even notes, 0.2 s apart, where the voice
 *     is "mixed with bgm": the `other` stem carries the line there, not the vocal stem;
 *   - in the full groove every beat (0.4 s) gets a landing, on the clearest sound near it: the
 *     kick or snare, a strong vocal attack, or failing both the synth;
 *   - a strong vocal attack between two beats gets its own landing (52.94, 53.98);
 *   - weak vocal estimates between beats (49.35 after the kick, 49.59, 53.52) get none.
 *
 * 54.5–77.1 s is the author's reading by those four observations; the owner heard it with clicks and
 * kept it, quiet beats and the ride over the held note included:
 * bars of eight beats from 54.51; the 808 downbeats and kicks firm, snares a little under, the
 * voice's clear attacks between, light landings on beats that only hats or synth mark. Two close
 * pairs keep one landing: a strong voice attack within 0.1 s of a kick or snare shares the drum's
 * (60.07, 68.49); at 74.87 the owner asked for the voice attacks on both sides of the kick as well. The held note from 70.54 is left to ride (no landing on beat 1 of that bar).
 *
 * Musical intent; compiler feasibility is not a filter here.
 */
import type {Spec} from '../../../scripts/v0/types.ts';
import {beats} from '../../../scripts/v0/core/beats.ts';
import previous from './voice-drums.ts';
export {overlayMeta} from '../music.ts';

type Source = 'vocals' | 'drums' | 'bass' | 'other';
type AuthoredBeat = {t: number; impact: number; source: Source};

/** 48.0–54.5 s: the owner's marks, each on its measured source. */
export const marked: AuthoredBeat[] = [
  {t: 48.065, impact: .76, source: 'bass'},
  {t: 48.298, impact: .58, source: 'vocals'},
  {t: 48.472, impact: .52, source: 'drums'},
  {t: 48.669, impact: .56, source: 'vocals'},
  {t: 48.866, impact: .66, source: 'drums'},
  {t: 49.099, impact: .50, source: 'other'},
  {t: 49.273, impact: .74, source: 'bass'},
  {t: 49.726, impact: .60, source: 'vocals'},
  {t: 49.900, impact: .50, source: 'vocals'},
  {t: 50.132, impact: .52, source: 'vocals'},
  {t: 50.294, impact: .45, source: 'other'},
  // the break: the synth's five even notes into the re-entry
  {t: 50.469, impact: .58, source: 'other'},
  {t: 50.666, impact: .50, source: 'other'},
  {t: 50.863, impact: .52, source: 'other'},
  {t: 51.072, impact: .50, source: 'other'},
  {t: 51.281, impact: 1, source: 'bass'}, // the re-entry, as before
  {t: 51.676, impact: .50, source: 'other'},
  {t: 52.071, impact: .64, source: 'drums'},
  {t: 52.477, impact: .72, source: 'drums'},
  {t: 52.941, impact: .62, source: 'vocals'},
  {t: 53.267, impact: .70, source: 'drums'},
  {t: 53.673, impact: .64, source: 'drums'},
  {t: 53.975, impact: .58, source: 'vocals'},
  {t: 54.277, impact: .66, source: 'drums'},
  {t: 54.509, impact: .70, source: 'bass'}, // marked at 54.46; the sung estimate at 54.428 is as near
];

/** 54.5–77.1 s: the author's reading, bar by bar. */
export const continued: AuthoredBeat[] = [
  // bar from 54.51
  {t: 54.927, impact: .58, source: 'vocals'},
  {t: 55.275, impact: .62, source: 'drums'},
  {t: 55.681, impact: .72, source: 'bass'},
  {t: 56.111, impact: .62, source: 'vocals'},
  {t: 56.483, impact: .70, source: 'bass'},
  {t: 56.866, impact: .45, source: 'drums'},
  {t: 57.086, impact: .58, source: 'drums'},
  {t: 57.272, impact: .42, source: 'other'},
  {t: 57.481, impact: .58, source: 'drums'},
  // bar from 57.69
  {t: 57.690, impact: .72, source: 'bass'},
  {t: 58.085, impact: .42, source: 'other'},
  {t: 58.479, impact: .64, source: 'drums'},
  {t: 58.886, impact: .76, source: 'vocals'},
  {t: 59.339, impact: .52, source: 'vocals'},
  {t: 59.687, impact: .72, source: 'vocals'},
  {t: 60.070, impact: .70, source: 'drums'},
  {t: 60.465, impact: .50, source: 'other'},
  {t: 60.685, impact: .52, source: 'other'},
  // bar from 60.88
  {t: 60.883, impact: .72, source: 'bass'},
  {t: 61.277, impact: .42, source: 'other'},
  {t: 61.672, impact: .64, source: 'drums'},
  {t: 61.939, impact: .52, source: 'vocals'},
  {t: 62.090, impact: .72, source: 'bass'},
  {t: 62.253, impact: .58, source: 'vocals'},
  {t: 62.485, impact: .40, source: 'drums'},
  {t: 62.868, impact: .70, source: 'drums'},
  {t: 63.274, impact: .56, source: 'drums'},
  {t: 63.495, impact: .52, source: 'drums'},
  {t: 63.901, impact: .56, source: 'vocals'},
  // bar from 64.09
  {t: 64.087, impact: .72, source: 'bass'},
  {t: 64.482, impact: .46, source: 'other'},
  {t: 64.877, impact: .56, source: 'drums'},
  {t: 65.283, impact: .72, source: 'drums'},
  {t: 65.701, impact: .62, source: 'vocals'},
  {t: 66.072, impact: .70, source: 'drums'},
  {t: 66.467, impact: .64, source: 'drums'},
  {t: 66.769, impact: .58, source: 'vocals'},
  {t: 67.071, impact: .58, source: 'drums'},
  // bar from 67.28: the rising vocal run 68.08–68.93, the section's high point
  {t: 67.280, impact: .72, source: 'bass'},
  {t: 67.686, impact: .42, source: 'other'},
  {t: 68.081, impact: .68, source: 'drums'},
  {t: 68.487, impact: .74, source: 'bass'},
  {t: 68.661, impact: .62, source: 'vocals'},
  {t: 68.928, impact: .66, source: 'vocals'},
  {t: 69.277, impact: .72, source: 'drums'},
  {t: 69.671, impact: .66, source: 'drums'},
  {t: 69.892, impact: .56, source: 'drums'},
  {t: 70.031, impact: .50, source: 'vocals'},
  {t: 70.275, impact: .58, source: 'drums'},
  // bar from 70.48: a held note, left to ride until the snare
  {t: 70.484, impact: .74, source: 'bass'},
  {t: 71.274, impact: .64, source: 'drums'},
  {t: 71.692, impact: .74, source: 'bass'},
  {t: 72.086, impact: .42, source: 'drums'},
  {t: 72.469, impact: .70, source: 'drums'},
  {t: 72.876, impact: .68, source: 'drums'},
  {t: 73.271, impact: .50, source: 'other'},
  {t: 73.445, impact: .52, source: 'vocals'},
  // bar from 73.69, to the last downbeat
  {t: 73.689, impact: .72, source: 'bass'},
  {t: 74.083, impact: .42, source: 'other'},
  {t: 74.478, impact: .64, source: 'drums'},
  // the owner: keep the voice around the kick too, ambitious as it is (0.09 s and 0.13 s apart)
  {t: 74.780, impact: .56, source: 'vocals'},
  {t: 74.873, impact: .74, source: 'bass'},
  {t: 75.000, impact: .58, source: 'vocals'},
  {t: 75.372, impact: .60, source: 'vocals'},
  {t: 75.674, impact: .70, source: 'drums'},
  {t: 76.080, impact: .62, source: 'drums'},
  {t: 76.359, impact: .54, source: 'vocals'},
  {t: 76.684, impact: .54, source: 'drums'},
  {t: 76.881, impact: .76, source: 'bass'},
];

const spec: Spec = {
  ...previous,
  contacts: beats([
    ...previous.contacts.filter(c => c.t < 48),
    ...[...marked, ...continued].map(({t, impact}) => ({t, impact})),
  ].sort((a, b) => a.t - b.t)),
};
export default spec;
