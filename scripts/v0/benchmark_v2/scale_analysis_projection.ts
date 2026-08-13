/**
 * Keep the scale decision archive small without discarding mechanics that the
 * scale comparison promises to report. Raw compile stats remain in the full
 * archive. Repair target-search and the small aim-work/yield funnel are the
 * deliberately retained compact subsets.
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
  const aim = compactAimStats(stats?.aim);
  const finalTrackAimedFits = finite(stats?.handoff_aimed_selected);
  const compactStats = {
    ...(repairTargetSearch === undefined
      ? {}
      : { repair_target_search: { ...repairTargetSearch } }),
    ...(aim === null ? {} : { aim }),
    ...(finalTrackAimedFits === null
      ? {}
      : { handoff_aimed_selected: finalTrackAimedFits }),
  };
  return {
    ...core,
    stats: Object.keys(compactStats).length === 0 ? null : compactStats,
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

const AIM_COMPACT_FIELDS = [
  "enum_lane_bases",
  "enum_lane_base_skips",
  "joint_probe_rows",
  "joint_probe_frames_charged",
  "enum_emitted",
  "aimed_pool_entries",
  "aimed_rank0",
  "aimed_top3",
  "aimed_rank_sum",
  "aimed_pool_size_sum",
] as const;

function compactAimStats(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== "object") return null;
  const source = value as Record<string, unknown>;
  const entries = AIM_COMPACT_FIELDS.flatMap((field) => {
    const value = finite(source[field]);
    return value === null ? [] : [[field, value] as const];
  });
  const resolution = compactAimImpactResolutionStats(source.study);
  if (entries.length === 0 && resolution === null) return null;
  return {
    ...Object.fromEntries(entries),
    ...(resolution === null ? {} : { study: resolution }),
  };
}

function compactAimImpactResolutionStats(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== "object") return null;
  const source = value as Record<string, unknown>;
  const policy = source.model_impact_resolution_policy;
  const changed = finite(source.enum_model_impact_top1_changed);
  const advantage = finite(source.enum_model_impact_top1_advantage_mean);
  const suppressed = finite(source.enum_model_impact_top1_resolution_suppressed);
  if (
    (policy !== "off" && policy !== "validated-mae-top1") ||
    changed === null || advantage === null || suppressed === null
  ) return null;
  return {
    model_impact_resolution_policy: policy,
    enum_model_impact_top1_changed: changed,
    enum_model_impact_top1_advantage_mean: advantage,
    enum_model_impact_top1_resolution_suppressed: suppressed,
  };
}

function finite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
