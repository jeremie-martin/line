/** The compiler's definition of a valid ride, shared by search, production
 * and the gallery artifacts. Under the contact-impact contract the musical
 * impact account decides; it already requires the ride to survive. Otherwise
 * the ride must reach the end of the spec with every authored contact hit and
 * no off-beat landing. */
import type { DriftReport } from '../types.ts';

export type RideOutcome = {
  report: Pick<DriftReport, 'terminus' | 'off_beat_landings' | 'contacts'>;
  impactEvaluation?: {valid: boolean};
};

export function validRide({report, impactEvaluation}: RideOutcome): boolean {
  return impactEvaluation ? impactEvaluation.valid
    : report.terminus.reason === 'endOfSpec' && !report.off_beat_landings.length && report.contacts.every(c => c.status === 'hit');
}
