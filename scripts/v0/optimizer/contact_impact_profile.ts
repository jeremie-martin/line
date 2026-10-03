/** Search configuration applied with an impact account. The measurement contract
 * lives separately: changing search work or preferences never moves its ruler. */
import {CONTACT_IMPACT_CONTRACT} from '../../lib/contact_impact.ts';
import {STRIKE_CONTRACT} from '../../lib/strike_impact.ts';

/** October 2 campaign selection for line.contact-impact.v1 (development studies
 * 4–5 favoured the stronger gain preference over ~15 quality points). */
export const CONTACT_IMPACT_SEARCH_PROFILE = Object.freeze({
  id: 'line.contact-impact-search.v1',
  impactPreparationFrames: 1,
  opposingEntryProposals: 24,
  coupledIntervalSamples: 64,
  impactSearch: Object.freeze({engagementGainWeight: .64}),
} as const);

/** Search configuration for line.strike.v1. */
export const STRIKE_SEARCH_PROFILE = Object.freeze({
  id: 'line.strike-search.v1',
  impactPreparationFrames: 2,
  opposingEntryProposals: 24,
  coupledIntervalSamples: 64,
  impactSearch: Object.freeze({engagementGainWeight: .64}),
} as const);

export function impactSearchProfile(contract: string) {
  if (contract === CONTACT_IMPACT_CONTRACT.id) return CONTACT_IMPACT_SEARCH_PROFILE;
  if (contract === STRIKE_CONTRACT.id) return STRIKE_SEARCH_PROFILE;
  throw new Error('unknown impact contract');
}
