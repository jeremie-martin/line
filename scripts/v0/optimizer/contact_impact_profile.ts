/** Search configuration applied with each impact account. The measurement contract
 * lives separately: changing search work or preferences never moves its ruler.
 *
 * line.strike.v1 and v2 retain their impact-specific preferences. All accounts
 * share the physical-prefix search. line.strike.v3, the product
 * account, adds what was selected under it on the song-level evaluation (REWORK.md log):
 *  - steepArrivalFrom .6: the catch before an ask ≥ 0.6 gets a steep, ask-driven
 *    arrival at the ordinary arrival weight (weight 1 was worse; thresholds 0.4 and
 *    0.75 were worse);
 *  - uprightArrival 1: that steep arrival must not come head-down or backward (judged
 *    by the same geometric test as the eval guard row; perceptual confirmation pending);
 *  - constructionModel 'v3': learned construction policies rebuilt under line.strike.v3
 *    on songs disjoint from the evaluation panel (the V6-era ones were trained partly
 *    on evaluation songs); better on all four panels, body drag +30% (REWORK.md log).
 * Preparation 2 was selected on the song-level evaluation (docs/research/
 * strike-definition-20261004.md); the rest is inherited from October 2. */
import {STRIKE_CONTRACT, STRIKE_V2_CONTRACT, STRIKE_V3_CONTRACT} from '../../lib/strike_impact.ts';

export const STRIKE_SEARCH_PROFILE = Object.freeze({
  id: 'line.strike-search.v1',
  impactPreparationFrames: 2,
  opposingEntryProposals: 24,
  impactSearch: Object.freeze({engagementGainWeight: .64}),
} as const);
export const STRIKE_V3_SEARCH_PROFILE = Object.freeze({
  ...STRIKE_SEARCH_PROFILE,
  id: 'line.strike-search.v6',
  constructionModel: 'v3' as const,
  impactSearch: Object.freeze({...STRIKE_SEARCH_PROFILE.impactSearch, steepArrivalFrom: .6, uprightArrival: 1}),
} as const);

export function impactSearchProfile(contract: string) {
  if (contract === STRIKE_CONTRACT.id || contract === STRIKE_V2_CONTRACT.id) return STRIKE_SEARCH_PROFILE;
  if (contract === STRIKE_V3_CONTRACT.id) return STRIKE_V3_SEARCH_PROFILE;
  throw new Error('unknown impact contract');
}
