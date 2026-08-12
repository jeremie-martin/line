import { createReadStream, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

type Target = { gap: number; sse: number };
type Anchor = {
  gap: number;
  pointCost: number;
  upperCost: number;
  suffixSse: number;
  worstTarget: Target;
};
export type RepairSchemeChoice = {
  targetGap: number;
  anchorGap: number;
  parentDepth: number;
  targetSse: number;
  suffixSse: number;
  pointCost: number;
  upperCost: number;
  suffixSsePerMillionPointFrames: number;
  targetSsePerMillionPointFrames: number;
};

type EpisodeRow = {
  sourceId: string;
  budget: number;
  seedSlot: number;
  iteration: number;
  remainingFrames: number;
  current: RepairSchemeChoice;
  schemes: Record<string, RepairSchemeChoice>;
  terminal: boolean;
  accepted: boolean;
  spentFrames: number;
  internalGain: number;
};

const SCHEMES = [
  "max_suffix_opportunity",
  "suffix_opportunity_per_cost",
  "single_gap_opportunity_per_cost",
  "max_local_window_opportunity",
  "reserve_selected_depth_zero",
  "reserve_cheapest_current_repair",
  "reserve_cheapest_else_deepest",
  "density_guarded_depth_eight",
] as const;

/** Counterfactual repair decisions derivable from one repair-decision payload.
 * This does not predict the terminal an unexecuted choice would produce. */
export function deriveRepairSchemeChoices(decision: any): Record<string, RepairSchemeChoice> {
  const targets: Target[] = decision.considered_targets.map((target: any) => ({
    gap: target.target_gap_index,
    sse: target.target_gap_sse,
  }));
  const targetByGap = new Map(targets.map((target) => [target.gap, target]));
  const anchors = new Map<number, Omit<Anchor, "suffixSse" | "worstTarget">>();
  const affordablePairs: Array<{ target: Target; anchor: Omit<Anchor, "suffixSse" | "worstTarget"> }> = [];
  for (const observed of decision.considered_targets) {
    const target = targetByGap.get(observed.target_gap_index)!;
    for (const option of observed.anchor_options) {
      if (option.affordability !== "affordable") continue;
      const candidate = {
        gap: option.anchor_gap_index,
        pointCost: option.estimated_anchor_cost_frames,
        upperCost: option.estimated_anchor_cost_upper_frames,
      };
      const previous = anchors.get(candidate.gap);
      if (previous !== undefined && (
        previous.pointCost !== candidate.pointCost || previous.upperCost !== candidate.upperCost
      )) throw new Error(`anchor ${candidate.gap} has inconsistent cost observations`);
      anchors.set(candidate.gap, candidate);
      affordablePairs.push({ target, anchor: candidate });
    }
  }
  if (anchors.size === 0) throw new Error(`repair decision has no affordable anchor`);
  const enriched: Anchor[] = [...anchors.values()].map((anchor) => {
    const suffix = targets.filter((target) => target.gap >= anchor.gap);
    if (suffix.length === 0) throw new Error(`anchor ${anchor.gap} has no reported suffix target`);
    return {
      ...anchor,
      suffixSse: suffix.reduce((sum, target) => sum + target.sse, 0),
      worstTarget: [...suffix].sort((a, b) => b.sse - a.sse || a.gap - b.gap)[0]!,
    };
  });
  const opportunity = [...enriched].sort((a, b) =>
    b.suffixSse - a.suffixSse || a.gap - b.gap
  )[0]!;
  const density = [...enriched].sort((a, b) =>
    b.suffixSse / b.pointCost - a.suffixSse / a.pointCost ||
    b.suffixSse - a.suffixSse || b.gap - a.gap
  )[0]!;
  const local = [...affordablePairs].sort((a, b) =>
    b.target.sse / b.anchor.pointCost - a.target.sse / a.anchor.pointCost ||
    b.target.sse - a.target.sse || b.anchor.gap - a.anchor.gap
  )[0]!;
  const localWindow = affordablePairs.map((pair) => ({
    ...pair,
    windowSse: targets.filter((target) =>
      target.gap >= pair.anchor.gap && target.gap <= pair.target.gap
    ).reduce((sum, target) => sum + target.sse, 0),
  })).sort((a, b) =>
    b.windowSse - a.windowSse ||
    b.target.sse - a.target.sse ||
    b.target.gap - b.anchor.gap - (a.target.gap - a.anchor.gap) ||
    a.target.gap - b.target.gap
  )[0]!;
  const currentAnchor = enriched.find((anchor) => anchor.gap === decision.anchor_gap_index);
  const currentTarget = targetByGap.get(decision.target_gap_index);
  if (currentAnchor === undefined || currentTarget === undefined) {
    throw new Error(`recorded repair choice is absent from its decision payload`);
  }
  const currentTargetPairs = affordablePairs.filter((pair) =>
    pair.target.gap === currentTarget.gap
  );
  const latestCurrentPair = [...currentTargetPairs].sort((a, b) =>
    a.target.gap - a.anchor.gap - (b.target.gap - b.anchor.gap) ||
    a.anchor.upperCost - b.anchor.upperCost
  )[0];
  if (latestCurrentPair === undefined) {
    throw new Error(`recorded repair target has no affordable anchor`);
  }
  const usableBudget = Number.isFinite(decision.usable_budget_frames)
    ? decision.usable_budget_frames
    : decision.remaining_budget_frames * (1 - (decision.headroom_fraction ?? 0));
  const chooseWithReserve = (reserveCost: number) =>
    [...currentTargetPairs].filter((pair) =>
      pair.anchor.upperCost + reserveCost <= usableBudget
    ).sort((a, b) =>
      b.target.gap - b.anchor.gap - (a.target.gap - a.anchor.gap) ||
      a.anchor.upperCost - b.anchor.upperCost
    )[0] ?? latestCurrentPair;
  const selectedDepthZero = currentTargetPairs.find((pair) =>
    pair.anchor.gap === currentTarget.gap
  ) ?? latestCurrentPair;
  const cheapestCurrentRepair = [...affordablePairs].sort((a, b) =>
    a.anchor.upperCost - b.anchor.upperCost ||
    b.anchor.gap - a.anchor.gap
  )[0]!;
  const reserveSelectedDepthZero = chooseWithReserve(selectedDepthZero.anchor.upperCost);
  const reserveCheapestCurrentRepair = chooseWithReserve(cheapestCurrentRepair.anchor.upperCost);
  const reserveCheapestElseDeepest = [...currentTargetPairs].filter((pair) =>
    pair.anchor.upperCost + cheapestCurrentRepair.anchor.upperCost <= usableBudget
  ).sort((a, b) =>
    b.target.gap - b.anchor.gap - (a.target.gap - a.anchor.gap) ||
    a.anchor.upperCost - b.anchor.upperCost
  )[0] ?? { target: currentTarget, anchor: currentAnchor };
  const depthSixPair = [...currentTargetPairs].filter((pair) =>
    pair.target.gap - pair.anchor.gap <= 6
  ).sort((a, b) =>
    b.target.gap - b.anchor.gap - (a.target.gap - a.anchor.gap) ||
    a.anchor.upperCost - b.anchor.upperCost
  )[0] ?? { target: currentTarget, anchor: currentAnchor };
  const currentSuffixDensity = currentAnchor.suffixSse / currentAnchor.pointCost;
  const depthSixAnchor = enriched.find((anchor) => anchor.gap === depthSixPair.anchor.gap)!;
  const depthSixSuffixDensity = depthSixAnchor.suffixSse / depthSixAnchor.pointCost;
  const densityGuardedDepthEight = currentTarget.gap - currentAnchor.gap <= 6 ||
      currentSuffixDensity >= depthSixSuffixDensity
    ? { target: currentTarget, anchor: currentAnchor }
    : { target: currentTarget, anchor: depthSixAnchor };
  return {
    current: choice(currentTarget, currentAnchor),
    max_suffix_opportunity: choice(opportunity.worstTarget, opportunity),
    suffix_opportunity_per_cost: choice(density.worstTarget, density),
    single_gap_opportunity_per_cost: choice(
      local.target,
      enriched.find((anchor) => anchor.gap === local.anchor.gap)!,
    ),
    max_local_window_opportunity: choice(
      localWindow.target,
      enriched.find((anchor) => anchor.gap === localWindow.anchor.gap)!,
    ),
    reserve_selected_depth_zero: choice(
      reserveSelectedDepthZero.target,
      enriched.find((anchor) => anchor.gap === reserveSelectedDepthZero.anchor.gap)!,
    ),
    reserve_cheapest_current_repair: choice(
      reserveCheapestCurrentRepair.target,
      enriched.find((anchor) => anchor.gap === reserveCheapestCurrentRepair.anchor.gap)!,
    ),
    reserve_cheapest_else_deepest: choice(
      reserveCheapestElseDeepest.target,
      enriched.find((anchor) => anchor.gap === reserveCheapestElseDeepest.anchor.gap)!,
    ),
    density_guarded_depth_eight: choice(
      densityGuardedDepthEight.target,
      densityGuardedDepthEight.anchor,
    ),
  };
}

function choice(target: Target, anchor: Anchor): RepairSchemeChoice {
  return {
    targetGap: target.gap,
    anchorGap: anchor.gap,
    parentDepth: target.gap - anchor.gap,
    targetSse: target.sse,
    suffixSse: anchor.suffixSse,
    pointCost: anchor.pointCost,
    upperCost: anchor.upperCost,
    suffixSsePerMillionPointFrames: anchor.suffixSse / anchor.pointCost * 1_000_000,
    targetSsePerMillionPointFrames: target.sse / anchor.pointCost * 1_000_000,
  };
}

async function analyze(checkpoint: string): Promise<any> {
  const rows: EpisodeRow[] = [];
  const input = createInterface({ input: createReadStream(checkpoint), crlfDelay: Infinity });
  for await (const line of input) {
    if (line.trim().length === 0) continue;
    const record = JSON.parse(line);
    if (
      record.type !== "result" ||
      !/^line\.compile-budget-telemetry\.v(?:4|5|6|7|8|9)$/.test(
        record.result?.budgetTelemetry?.schema ?? "",
      )
    ) continue;
    const sourceId = record.result.task.sourceId;
    const budget = record.result.task.budget;
    const seedSlot = record.result.task.seedSlot;
    for (const episode of record.result.budgetTelemetry.episodes) {
      if (episode.lane !== "repair" || episode.repair_decision === null) continue;
      const choices = deriveRepairSchemeChoices(episode.repair_decision);
      const outcome = episode.outcome;
      rows.push({
        sourceId,
        budget,
        seedSlot,
        iteration: episode.repair_decision.iteration_index,
        remainingFrames: episode.repair_decision.remaining_budget_frames,
        current: choices.current,
        schemes: Object.fromEntries(SCHEMES.map((scheme) => [scheme, choices[scheme]])),
        terminal: outcome.terminal_reached,
        accepted: outcome.accepted_alternative,
        spentFrames: outcome.spent_frames,
        internalGain: outcome.internal_full_score_delta,
      });
    }
  }
  if (rows.length === 0) throw new Error(`${checkpoint}: no V4-V9 repair episodes`);
  const schemeSummaries = Object.fromEntries([
    ["current", summarizeChoices(rows, (row) => row.current)],
    ...SCHEMES.map((scheme) => [scheme, summarizeChoices(rows, (row) => row.schemes[scheme])]),
  ]);
  return {
    schema: "line.repair-scheme-space-analysis.v1",
    generatedAt: new Date().toISOString(),
    evidence: {
      checkpoint: resolve(checkpoint),
      cells: new Set(rows.map((row) => `${row.sourceId}:${row.budget}:${row.seedSlot}`)).size,
      episodes: rows.length,
    },
    definitions: {
      current: "Worst affordable single-gap SSE, then deepest affordable parent up to the production cap.",
      max_suffix_opportunity: "Affordable anchor whose mutable suffix contains the greatest total incumbent SSE; target is that suffix's worst gap. With non-negative SSE this is the earliest affordable reported anchor.",
      suffix_opportunity_per_cost: "Affordable anchor maximizing total mutable-suffix SSE per estimated point-cost frame; target is that suffix's worst gap.",
      single_gap_opportunity_per_cost: "Affordable target-anchor pair maximizing the selected gap's SSE per estimated point-cost frame.",
      max_local_window_opportunity: "Affordable target-anchor pair maximizing summed incumbent SSE from anchor through target within the declared option radius.",
      reserve_selected_depth_zero: "Keep the current worst affordable target. Choose its deepest anchor whose upper cost also leaves the current estimate for a depth-zero repair of that target; if two repairs do not fit, make one final depth-zero repair.",
      reserve_cheapest_current_repair: "Keep the current worst affordable target. Choose its deepest anchor whose upper cost also leaves the cheapest currently affordable repair estimate; if two repairs do not fit, make one final depth-zero repair.",
      reserve_cheapest_else_deepest: "Keep the current worst affordable target. Choose its deepest anchor whose upper cost also leaves the cheapest currently affordable repair estimate; if two repairs do not fit, spend the final repair from the ordinary deepest affordable anchor.",
      density_guarded_depth_eight: "Keep the current worst affordable target. Permit its deepest affordable anchor through depth eight only when its mutable-suffix SSE per point-cost frame is at least the density of the deepest affordable anchor capped at depth six; otherwise use the depth-six-capped anchor.",
    },
    limits: [
      "Counterfactual choices are exact replays of recorded decision inputs, not simulated outcomes.",
      "Observed gain/acceptance associations apply only to choices executed by the current controller.",
      "Budgets are deterministic policy conditions; rows are not treated as independent samples.",
    ],
    currentBehavior: {
      terminalRate: fraction(rows.filter((row) => row.terminal).length, rows.length),
      acceptancePerTerminal: fraction(
        rows.filter((row) => row.accepted).length,
        rows.filter((row) => row.terminal).length,
      ),
      targetShareOfMutableSuffixSse: distribution(rows.map((row) =>
        row.current.suffixSse > 0 ? row.current.targetSse / row.current.suffixSse : 0
      )),
      actualGainPerMillionFrames: perMillion(
        rows.reduce((sum, row) => sum + row.internalGain, 0),
        rows.reduce((sum, row) => sum + row.spentFrames, 0),
      ),
      suffixDensityBudgetStratifiedQuartiles: budgetStratifiedQuartiles(rows),
    },
    schemes: schemeSummaries,
    perBudget: [...new Set(rows.map((row) => row.budget))].sort((a, b) => a - b).map((budget) => ({
      budget,
      episodes: rows.filter((row) => row.budget === budget).length,
      schemes: Object.fromEntries(Object.keys(schemeSummaries).map((scheme) => [
        scheme,
        summarizeChoices(
          rows.filter((row) => row.budget === budget),
          (row) => scheme === "current" ? row.current : row.schemes[scheme],
        ),
      ])),
    })),
  };
}

function summarizeChoices(
  rows: EpisodeRow[],
  select: (row: EpisodeRow) => RepairSchemeChoice,
): Record<string, any> {
  const choices = rows.map(select);
  const current = rows.map((row) => row.current);
  return {
    episodes: rows.length,
    sameTargetAsCurrent: fraction(
      choices.filter((entry, index) => entry.targetGap === current[index]!.targetGap).length,
      rows.length,
    ),
    sameAnchorAsCurrent: fraction(
      choices.filter((entry, index) => entry.anchorGap === current[index]!.anchorGap).length,
      rows.length,
    ),
    anchorMovementVsCurrent: {
      earlier: choices.filter((entry, index) => entry.anchorGap < current[index]!.anchorGap).length,
      same: choices.filter((entry, index) => entry.anchorGap === current[index]!.anchorGap).length,
      later: choices.filter((entry, index) => entry.anchorGap > current[index]!.anchorGap).length,
    },
    anchorGap: distribution(choices.map((entry) => entry.anchorGap)),
    parentDepth: distribution(choices.map((entry) => entry.parentDepth)),
    pointCostShareOfRemaining: distribution(choices.map((entry, index) =>
      entry.pointCost / rows[index]!.remainingFrames
    )),
    upperCostShareOfRemaining: distribution(choices.map((entry, index) =>
      entry.upperCost / rows[index]!.remainingFrames
    )),
    targetSse: distribution(choices.map((entry) => entry.targetSse)),
    mutableSuffixSse: distribution(choices.map((entry) => entry.suffixSse)),
    suffixSsePerMillionPointFrames: distribution(
      choices.map((entry) => entry.suffixSsePerMillionPointFrames),
    ),
  };
}

function budgetStratifiedQuartiles(rows: EpisodeRow[]): any[] {
  const quartiles: EpisodeRow[][] = [[], [], [], []];
  for (const budget of new Set(rows.map((row) => row.budget))) {
    const selected = rows.filter((row) => row.budget === budget).sort((a, b) =>
      a.current.suffixSsePerMillionPointFrames - b.current.suffixSsePerMillionPointFrames
    );
    selected.forEach((row, index) => quartiles[Math.min(3, Math.floor(index * 4 / selected.length))]!.push(row));
  }
  return quartiles.map((selected, index) => {
    const terminals = selected.filter((row) => row.terminal);
    return {
      quartile: index + 1,
      episodes: selected.length,
      terminalRate: fraction(terminals.length, selected.length),
      acceptancePerTerminal: fraction(selected.filter((row) => row.accepted).length, terminals.length),
      internalGain: selected.reduce((sum, row) => sum + row.internalGain, 0),
      spentFrames: selected.reduce((sum, row) => sum + row.spentFrames, 0),
      gainPerMillionFrames: perMillion(
        selected.reduce((sum, row) => sum + row.internalGain, 0),
        selected.reduce((sum, row) => sum + row.spentFrames, 0),
      ),
    };
  });
}

function distribution(values: number[]): Record<string, number> {
  const sorted = [...values].sort((a, b) => a - b);
  const quantile = (p: number): number => {
    const at = (sorted.length - 1) * p;
    const lo = Math.floor(at);
    const f = at - lo;
    return sorted[lo]! + f * (sorted[Math.min(lo + 1, sorted.length - 1)]! - sorted[lo]!);
  };
  return {
    mean: round(values.reduce((sum, value) => sum + value, 0) / values.length),
    p25: round(quantile(0.25)),
    median: round(quantile(0.5)),
    p75: round(quantile(0.75)),
  };
}

function fraction(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : round(numerator / denominator);
}

function perMillion(gain: number, frames: number): number {
  return frames === 0 ? 0 : round(gain / frames * 1_000_000);
}

function round(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

function render(report: any): string {
  const lines = [
    "# Repair scheme-space analysis",
    "",
    `Evidence: ${report.evidence.episodes.toLocaleString("en-US")} accepted-controller repair episodes across ${report.evidence.cells} cells.`,
    "",
    "This is an exact counterfactual replay of decision inputs, not a simulation of unexecuted repairs. Associations below describe the current policy only.",
    "",
    "## Scheme choices",
    "",
    "| Scheme | Same anchor | Earlier / same / later | Mean parent depth | Mean cost / remaining | Mean mutable suffix SSE | Mean suffix SSE / M point frames |",
    "|---|---:|---:|---:|---:|---:|---:|",
    ...Object.entries(report.schemes).map(([name, value]: [string, any]) =>
      `| ${name} | ${(100 * value.sameAnchorAsCurrent).toFixed(1)}% | ` +
      `${value.anchorMovementVsCurrent.earlier} / ${value.anchorMovementVsCurrent.same} / ${value.anchorMovementVsCurrent.later} | ` +
      `${value.parentDepth.mean.toFixed(2)} | ${(100 * value.pointCostShareOfRemaining.mean).toFixed(1)}% | ` +
      `${value.mutableSuffixSse.mean.toFixed(4)} | ${value.suffixSsePerMillionPointFrames.mean.toFixed(2)} |`
    ),
    "",
    `The selected worst gap contains a median ${(100 * report.currentBehavior.targetShareOfMutableSuffixSse.median).toFixed(1)}% ` +
      `of the current anchor's mutable suffix SSE (IQR ${(100 * report.currentBehavior.targetShareOfMutableSuffixSse.p25).toFixed(1)}–` +
      `${(100 * report.currentBehavior.targetShareOfMutableSuffixSse.p75).toFixed(1)}%).`,
    "",
    "## Current-policy density association, stratified within budget",
    "",
    "| Suffix-density quartile | Episodes | Terminal | Accepted / terminal | Internal gain / M frames |",
    "|---:|---:|---:|---:|---:|",
    ...report.currentBehavior.suffixDensityBudgetStratifiedQuartiles.map((entry: any) =>
      `| ${entry.quartile} | ${entry.episodes} | ${(100 * entry.terminalRate).toFixed(1)}% | ` +
      `${(100 * entry.acceptancePerTerminal).toFixed(1)}% | ${entry.gainPerMillionFrames.toFixed(2)} |`
    ),
    "",
    "## Interpretation boundary",
    "",
    "- Max-suffix opportunity is the original earliest-affordable-anchor idea expressed as an objective; non-negative SSE makes the two definitions equivalent.",
    "- Suffix opportunity per cost asks how much incumbent global axis loss is mutable per estimated frame, instead of treating one gap as the whole opportunity.",
    "- Single-gap opportunity per cost is a cheap-local-repair policy. Existing executed-depth evidence should be considered beside it because this replay cannot predict alternate terminals.",
    "- A target-aware DFS cannot be evaluated from these decision records; it requires an explicit compiler arm and direct behavior telemetry.",
  ];
  return `${lines.join("\n")}\n`;
}

function argument(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.slice(2).find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

if (resolve(process.argv[1] ?? "") === resolve(fileURLToPath(import.meta.url))) {
  const checkpoint = argument("checkpoint");
  const out = argument("out");
  if (checkpoint === undefined || out === undefined) {
    throw new Error(`usage: analyze_repair_scheme_space.ts --checkpoint=RUN.checkpoint.jsonl --out=REPORT`);
  }
  const report = await analyze(checkpoint);
  mkdirSync(dirname(resolve(out)), { recursive: true });
  writeFileSync(`${resolve(out)}.json`, `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(`${resolve(out)}.md`, render(report));
  console.log(render(report));
}
