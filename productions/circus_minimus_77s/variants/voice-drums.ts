/** Voice + drums: a hand-authored hook study, 2026-11-01.
 *
 * Hypothesis: the repeated hook is clearer when raw vocal articulations (including
 * unpitched estimates) and drum attacks share the rhythmic line. The old sung-only
 * reading discarded useful raw vocal events and percussion-only positions.
 *
 * Three repeated phrases, each with a rapid run followed by breathing room. The
 * table is authored from measured source times, not loaded from listener notes.
 * Close voice/drum pairs share the drum onset; distinct vocal subdivisions remain.
 * Drum contacts are firmer than vocal-only articulations. Bass is not a selector.
 * Do not infer that a drum-only observation proves the presence of a sung word.
 *
 * This is NOT blind validation: the author had previously seen the listener's
 * marks. Freeze this draft before comparison; correspondence is descriptive, not
 * evidence of generalization. Compiler feasibility is deliberately not a filter.
 * Keep the preceding voice-led draft outside the repeated 38.4–47.5 s hook.
 */
import type {Spec} from '../../../scripts/v0/types.ts';
import {beats} from '../../../scripts/v0/core/beats.ts';
import previous from './voice-led.ts';
export {overlayMeta} from '../music.ts';

type Layer = 'vocals' | 'drums' | 'sung';
type AuthoredBeat = {t: number; impact: number; source: Layer; role: 'voice' | 'drum' | 'shared'};
// Times reference events.json source timestamps, except the sung-only 42.632.
// A source name records evidence provenance, not a claim about what caused it.
export const hookEvidence: AuthoredBeat[] = [
  {t: 38.475, impact: .76, source: 'drums', role: 'shared'},
  {t: 38.719, impact: .54, source: 'vocals', role: 'voice'},
  {t: 38.870, impact: .62, source: 'drums', role: 'drum'},
  {t: 39.102, impact: .59, source: 'vocals', role: 'voice'},
  {t: 39.277, impact: .69, source: 'drums', role: 'drum'},
  {t: 39.451, impact: .53, source: 'vocals', role: 'voice'},
  {t: 39.671, impact: .75, source: 'drums', role: 'shared'},
  {t: 39.869, impact: .48, source: 'vocals', role: 'voice'},
  {t: 40.136, impact: .61, source: 'vocals', role: 'voice'},
  {t: 40.298, impact: .51, source: 'vocals', role: 'voice'},
  {t: 40.461, impact: .78, source: 'drums', role: 'shared'},
  {t: 40.705, impact: .52, source: 'vocals', role: 'voice'},
  {t: 40.867, impact: .70, source: 'drums', role: 'shared'},
  // Second phrase. Retain the noisy articulation and the measured sung-only turn.
  {t: 41.668, impact: .73, source: 'drums', role: 'shared'},
  {t: 41.935, impact: .53, source: 'vocals', role: 'voice'},
  {t: 42.063, impact: .62, source: 'drums', role: 'drum'},
  {t: 42.307, impact: .56, source: 'vocals', role: 'voice'},
  {t: 42.481, impact: .68, source: 'drums', role: 'drum'},
  {t: 42.632, impact: .53, source: 'sung', role: 'voice'},
  {t: 42.876, impact: .64, source: 'drums', role: 'drum'},
  {t: 43.073, impact: .49, source: 'vocals', role: 'voice'},
  {t: 43.305, impact: .54, source: 'vocals', role: 'voice'},
  {t: 43.503, impact: .60, source: 'vocals', role: 'voice'},
  {t: 43.665, impact: .75, source: 'drums', role: 'drum'},
  {t: 43.909, impact: .55, source: 'vocals', role: 'voice'},
  {t: 44.071, impact: .70, source: 'drums', role: 'shared'},
  // Third phrase: same reading, actual measured times; no synthetic beat grid.
  {t: 44.873, impact: .72, source: 'drums', role: 'shared'},
  {t: 45.116, impact: .55, source: 'vocals', role: 'voice'},
  {t: 45.267, impact: .62, source: 'drums', role: 'shared'},
  {t: 45.500, impact: .59, source: 'vocals', role: 'voice'},
  {t: 45.674, impact: .69, source: 'drums', role: 'drum'},
  {t: 45.848, impact: .54, source: 'vocals', role: 'voice'},
  {t: 46.080, impact: .65, source: 'drums', role: 'shared'},
  {t: 46.266, impact: .49, source: 'vocals', role: 'voice'},
  {t: 46.533, impact: .62, source: 'vocals', role: 'voice'},
  {t: 46.695, impact: .52, source: 'vocals', role: 'voice'},
  {t: 46.869, impact: .75, source: 'drums', role: 'shared'},
  {t: 47.090, impact: .54, source: 'vocals', role: 'voice'},
  {t: 47.276, impact: .70, source: 'drums', role: 'shared'},
];

const spec: Spec = {
  ...previous,
  contacts: beats([
    ...previous.contacts.filter(c => c.t < 38.4 || c.t >= 47.5),
    ...hookEvidence.map(({t, impact}) => ({t, impact})),
  ].sort((a, b) => a.t - b.t)),
};
export default spec;
