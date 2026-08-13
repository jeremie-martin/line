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
        const repairNodePolicy = compactRepairNodePolicy(budgetTelemetry);
        return {
          ...compactTelemetry,
          ...(repairNodePolicy === null
            ? {}
            : { repair_node_policy: repairNodePolicy }),
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

type CompactNodePolicyBucket = {
  pool_builds: number;
  requested_normal_proposals: number;
  requested_normal_proposals_min: number | null;
  requested_normal_proposals_max: number | null;
};

/** Preserve the positional nCand evidence without retaining every trace node.
 * Counts are policy requests at atomic frontier nodes, not candidate samples. */
function compactRepairNodePolicy(budgetTelemetry: any): Record<string, unknown> | null {
  if (!Array.isArray(budgetTelemetry?.node_events)) return null;
  const decisionByEpisode = new Map<number, { anchorGapIndex: number; targetGapIndex: number }>();
  for (const episode of budgetTelemetry.episodes ?? []) {
    if (
      episode?.lane === "repair" && Number.isSafeInteger(episode?.episode_id) &&
      Number.isSafeInteger(episode?.anchor?.gap_index) &&
      Number.isSafeInteger(episode?.repair_decision?.target_gap_index)
    ) {
      decisionByEpisode.set(episode.episode_id, {
        anchorGapIndex: episode.anchor.gap_index,
        targetGapIndex: episode.repair_decision.target_gap_index,
      });
    }
  }
  const empty = (): CompactNodePolicyBucket => ({
    pool_builds: 0,
    requested_normal_proposals: 0,
    requested_normal_proposals_min: null,
    requested_normal_proposals_max: null,
  });
  const anchor = empty();
  const beforeTarget = empty();
  const target = empty();
  const postTarget = empty();
  const descendant = empty();
  for (const event of budgetTelemetry.node_events) {
    const decision = decisionByEpisode.get(event?.episode_id);
    const requested = finite(event?.requested_normal_proposals);
    if (
      event?.lane !== "repair" || decision === undefined || requested === null ||
      !Number.isSafeInteger(event?.gap_index)
    ) continue;
    const record = (bucket: CompactNodePolicyBucket): void => {
      bucket.pool_builds++;
      bucket.requested_normal_proposals += requested;
      bucket.requested_normal_proposals_min = bucket.requested_normal_proposals_min === null
        ? requested
        : Math.min(bucket.requested_normal_proposals_min, requested);
      bucket.requested_normal_proposals_max = bucket.requested_normal_proposals_max === null
        ? requested
        : Math.max(bucket.requested_normal_proposals_max, requested);
    };
    if (event.gap_index === decision.anchorGapIndex) {
      record(anchor);
    } else if (
      event.gap_index > decision.anchorGapIndex &&
      event.gap_index < decision.targetGapIndex
    ) {
      record(beforeTarget);
      record(descendant);
    } else if (
      event.gap_index === decision.targetGapIndex &&
      event.gap_index > decision.anchorGapIndex
    ) {
      record(target);
      record(descendant);
    } else if (event.gap_index > decision.targetGapIndex) {
      record(postTarget);
      record(descendant);
    }
  }
  return {
    anchor,
    before_target_descendant: beforeTarget,
    target,
    post_target: postTarget,
    descendant,
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
