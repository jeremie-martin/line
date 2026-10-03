/** Search configuration applied with the impact account. The measurement contract
 * lives separately: changing search work or preferences never moves its ruler.
 * Preparation 2 was selected on the song-level evaluation (docs/research/
 * strike-definition-20261004.md); the rest is inherited from the October 2 campaign. */
import {STRIKE_CONTRACT} from '../../lib/strike_impact.ts';

export const STRIKE_SEARCH_PROFILE = Object.freeze({
  id: 'line.strike-search.v1',
  impactPreparationFrames: 2,
  opposingEntryProposals: 24,
  coupledIntervalSamples: 64,
  impactSearch: Object.freeze({engagementGainWeight: .64}),
} as const);

export function impactSearchProfile(contract: string) {
  if (contract === STRIKE_CONTRACT.id) return STRIKE_SEARCH_PROFILE;
  throw new Error('unknown impact contract');
}
