/**
 * Keep the scale decision archive small without discarding mechanics that the
 * scale comparison promises to report. Raw compile stats remain in the full
 * archive; repair_target_search is the deliberately retained compact subset.
 */
export function scaleAnalysisRun(row: any): Record<string, unknown> {
  const {
    report: _report,
    stats,
    authoredContacts: _authoredContacts,
    phaseResults: _phaseResults,
    budgetTelemetry,
    ...core
  } = row;
  const repairTargetSearch = stats?.repair_target_search;
  return {
    ...core,
    stats: repairTargetSearch === undefined
      ? null
      : { repair_target_search: { ...repairTargetSearch } },
    budgetTelemetry: budgetTelemetry === null || budgetTelemetry === undefined
      ? null
      : (() => {
        const { node_events: _nodeEvents, ...compactTelemetry } = budgetTelemetry;
        return {
          ...compactTelemetry,
          episodes: budgetTelemetry.episodes.map((episode: any) => {
            const decision = episode.repair_decision;
            const outcome = episode.outcome;
            return {
              ...episode,
              repair_decision: decision === null
                ? null
                : (() => {
                  const {
                    considered_targets: _consideredTargets,
                    incumbent_track_hash: _incumbentTrackHash,
                    working_track_hash: _workingTrackHash,
                    ...compactDecision
                  } = decision;
                  return compactDecision;
                })(),
              outcome: (() => {
                const {
                  terminal_offer_track_hash: _terminalOfferTrackHash,
                  ...compactOutcome
                } = outcome;
                return compactOutcome;
              })(),
            };
          }),
        };
      })(),
  };
}
