/** Selected experimental search configuration. The measurement contract lives
 * separately: changing search work/preferences does not move its ruler.
 * Development studies 4–5 favor the stronger gain preference over a roughly
 * 15-point quality advantage with visibly unexplained speed gains remaining.
 * This profile is applied only when the shared impact contract is requested. */
export const CONTACT_IMPACT_SEARCH_PROFILE = Object.freeze({
  id:'line.contact-impact-search.v1',
  impactPreparationFrames:1,
  opposingEntryProposals:24,
  coupledIntervalSamples:64,
  impactSearch:Object.freeze({engagementGainWeight:.64}),
} as const);
