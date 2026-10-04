/** Search configuration applied with the impact account. The measurement contract
 * lives separately: changing search work or preferences never moves its ruler.
 * Preparation 2 was selected on the song-level evaluation (docs/research/
 * strike-definition-20261004.md). The steep arrival before strong asks (≥ 0.6, at the
 * ordinary arrival weight) was selected under line.strike.v3 (REWORK.md log, L1); a
 * weight of 1 was worse. The lookahead into a strong ask widens 1.3× (L9; 1.6 cost
 * 5× more compile time for a similar gain). The rest is inherited from October 2. */
import {STRIKE_CONTRACT, STRIKE_V2_CONTRACT, STRIKE_V3_CONTRACT} from '../../lib/strike_impact.ts';

export const STRIKE_SEARCH_PROFILE = Object.freeze({
  id: 'line.strike-search.v3',
  impactPreparationFrames: 2,
  opposingEntryProposals: 24,
  coupledIntervalSamples: 64,
  impactSearch: Object.freeze({engagementGainWeight: .64, steepArrivalFrom: .6, strongLookahead: 1.3}),
} as const);

export function impactSearchProfile(contract: string) {
  // v2 and v3 change only the ruler; they start from the same search work.
  if ([STRIKE_CONTRACT.id, STRIKE_V2_CONTRACT.id, STRIKE_V3_CONTRACT.id].includes(contract)) return STRIKE_SEARCH_PROFILE;
  throw new Error('unknown impact contract');
}
