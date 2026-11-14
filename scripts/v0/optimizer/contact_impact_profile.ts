/** Search configuration applied with the impact account. The measurement contract
 * lives separately: changing search work or preferences never moves its ruler.
 * Selected on the song-level evaluation (REWORK.md log):
 *  - steepArrivalFrom .6: the catch before a strong ask gets a steep, ask-driven
 *    arrival at the ordinary arrival weight, phased in smoothly from ask 0.4 (none)
 *    to 0.8 (all). It was a hard threshold at 0.6 until 2026-11-01 (V7: +0.2 and
 *    +3.8 on two seed sets, held out +4.7; docs/research/v7-rejudge-20261101.md);
 *  - uprightArrival 1: steep and unguided passive catches prefer an upright arrival (judged
 *    by the same geometric test as the eval guard row; perceptual confirmation pending);
 *  - learned construction policies rebuilt under line.strike.v3
 *    on songs disjoint from the evaluation panel (the V6-era ones were trained partly
 *    on evaluation songs); better on all four panels, body drag +30% (REWORK.md log).
 *    Retrained on 2026-11-01 from demonstrations of the compiler of that day
 *    (V7 +15.5 at 8 seeds, held out +10.5; REWORK.md).
 * Preparation 2 was selected on the song-level evaluation (docs/research/
 * strike-definition-20261004.md); the rest is inherited from October 2. */
export const IMPACT_SEARCH_PROFILE = Object.freeze({
  id: 'line.strike-search.v7',
  impactPreparationFrames: 2,
  opposingEntryProposals: 24,
  upperReceiverProposals: 12,
  impactSearch: Object.freeze({engagementGainWeight: .64, steepArrivalFrom: .6, uprightArrival: 1, upperArrival: 15}),
} as const);
