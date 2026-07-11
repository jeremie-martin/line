/**
 * Rendering for the eval chain: the stage-0 screen, interim look lines, and
 * the verdict report. Pure formatting over data computed by eval.ts — no
 * state reads, no gating.
 */

import type { EraState } from "./attempts.ts";
import type { CertifiedOperatingPoint } from "./calibration_guard.ts";
import { renderDecision, type DecisionArtifact } from "./decide.ts";
import { studentTQuantile, type V2Decision } from "./decision_model.ts";

const Z_80 = 0.8416212335729143;

export type Stage0Report = {
  result: V2Decision;
  baseLabel: string;
  archivePath: string;
  scoreIdenticalFraction: number;
  era: EraState | null;
  /** The cheapest certified row for each mode, for the advice line. */
  menu: Array<{ id: string; mode: string; margin: number | null; depth: number }>;
};

/**
 * The projection from a 3-seed probe SE to a depth-D confirmation SE assumes
 * pure 1/sqrt(blocks) scaling. The studies deliberately avoid certifying a
 * universal depth-scaling law — certified quantities are the grid cells —
 * so every use is labeled a heuristic.
 */
export function projectProbeSeToDepth(probeSe: number, probeDepth: number, depth: number): number {
  return probeSe * Math.sqrt(probeDepth / depth);
}

export function stage0ResolvabilityAdvice(
  delta: number,
  probeSe: number,
  probeDepth: number,
  depth: number,
  criticalAlpha: number,
  threshold = 0,
): string {
  const projected = projectProbeSeToDepth(probeSe, probeDepth, depth);
  const distance = delta - threshold;
  if (distance <= 0) {
    return `delta ${formatSigned(delta)} does not clear the threshold; confirmation would test a non-positive effect (projected depth-${depth} SE ~${projected.toFixed(2)}, heuristic)`;
  }
  const requiredSe = distance / (studentTQuantile(1 - criticalAlpha, Infinity) + Z_80);
  if (projected <= requiredSe) {
    return `an effect of this size would likely resolve at depth ${depth} (projected SE ~${projected.toFixed(2)} vs ~${requiredSe.toFixed(2)} needed; heuristic)`;
  }
  const suggested = Math.ceil(depth * (projected / requiredSe) ** 2);
  return `an effect of this size looks under-powered at depth ${depth} (projected SE ~${projected.toFixed(2)} vs ~${requiredSe.toFixed(2)} needed); ` +
    `resolving would need roughly depth ${suggested}, which is NOT on the certified menu (heuristic)`;
}

export function renderStage0(report: Stage0Report, probeDepth: number, confirmDepth: number): string {
  const result = report.result;
  const central = result.confidence;
  const orderedCases = [...result.perCase].sort((a, b) => a.delta - b.delta);
  const lines = [
    `Benchmark V2 eval - stage 0 (informational screen; no state consumed)`,
    `  base: ${report.baseLabel}`,
    `  headline: ${result.baseHeadline.toFixed(2)} -> ${result.candidateHeadline.toFixed(2)} ` +
      `(delta ${formatSigned(result.delta)})`,
    `  seed-block SE: ${result.uncertainty.seed.standardError.toFixed(2)}; ` +
      `${(central.centralLevel * 100).toFixed(0)}% coverage-target interval ` +
      `[${formatSigned(central.centralLo)}, ${formatSigned(central.centralHi)}]`,
    `  realized pairing: ${(report.scoreIdenticalFraction * 100).toFixed(1)}% of paired scores identical`,
    `  validity: ${result.validity.baseValid}/${result.validity.total} -> ` +
      `${result.validity.candidateValid}/${result.validity.total} ` +
      `(gained ${result.validity.gained}, lost ${result.validity.lost})`,
    `  top movers:`,
    ...orderedCases.slice(0, 3).map((entry) =>
      `    ${entry.sourceId.padEnd(45)} ${formatSigned(entry.delta)}`
    ),
    ...orderedCases.slice(-3).reverse().map((entry) =>
      `    ${entry.sourceId.padEnd(45)} ${formatSigned(entry.delta)}`
    ),
    `  advice: ${stage0ResolvabilityAdvice(
      result.delta,
      result.uncertainty.seed.standardError,
      probeDepth,
      confirmDepth,
      0.01,
    )}`,
    ...eraLines(report.era),
    `  archive: ${report.archivePath}`,
    `  nextCommand: npm run benchmark -- eval --to-verdict` +
      (result.delta > 0 ? "" : "  # or iterate further; this screen consumed nothing"),
  ];
  return lines.join("\n");
}

export function renderLookLine(look: {
  k: number;
  depth: number;
  delta: number;
  standardError: number;
  upperBound: number;
  threshold: number;
  fired: boolean;
  scoreIdenticalFraction: number;
}): string {
  return `  look k=${look.k}/${look.depth}: delta ${formatSigned(look.delta)} ` +
    `SE ${look.standardError.toFixed(2)} ` +
    `UB95 ${formatSigned(look.upperBound)} vs ${formatSigned(look.threshold)} ` +
    `identical ${(look.scoreIdenticalFraction * 100).toFixed(1)}% ` +
    (look.fired ? "-> FUTILITY STOP" : "-> continue");
}

export function renderEvalVerdict(input: {
  artifact: DecisionArtifact;
  artifactPath: string;
  certified: CertifiedOperatingPoint;
  era: EraState;
  attemptSpend: number;
  priorAttempts: number;
  compoundAlpha: number;
  looks: Array<{ k: number; fired: boolean }>;
}): string {
  const base = renderDecision(input.artifact, input.artifactPath);
  const realizedSe = input.artifact.result.uncertainty.seed.standardError;
  const extra = [
    `  operating point: ${input.certified.point.id} ` +
      `(certified to detect ${formatSigned(input.certified.mde80)} at >=80% power; ` +
      `envelope SE ${input.certified.envelopeSe.toFixed(2)}, realized ${realizedSe.toFixed(2)})`,
    `  era budget: spent ${round4(input.era.budgetSpent)} of ${input.era.budgetCap} ` +
      `(this attempt ${round4(input.attemptSpend)}); ` +
      `cumulative expected false accepts ${round4(input.era.cumulativeExpectedFalseAccepts)}`,
    ...(input.priorAttempts > 0
      ? [`  retry: attempt ${input.priorAttempts + 1} of this candidate; compound alpha ${input.compoundAlpha}`]
      : []),
    ...(input.looks.length > 0
      ? [`  futility looks: ${input.looks.map((look) => `k=${look.k}${look.fired ? " FIRED" : ""}`).join(", ")}`]
      : []),
  ];
  const lines = base.split("\n");
  const outcomeIndex = lines.findIndex((line) => line.startsWith("  OUTCOME:"));
  lines.splice(outcomeIndex, 0, ...extra);
  return lines.join("\n");
}

export function evalNextCommand(outcome: string, attemptId: string): string {
  switch (outcome) {
    case "accept":
      // Concrete and runnable verbatim (agents execute nextCommand blindly);
      // a human may of course substitute a nicer label.
      return `npm run benchmark -- rebaseline --label=accept-${attemptId}`;
    case "inconclusive":
    case "unresolved":
      return `npm run benchmark -- eval --to-verdict --acknowledge-retry  # fresh epoch; prior evidence is not pooled`;
    case "futility-stop":
      return `npm run benchmark -- eval  # iterate at stage 0; attempt ${attemptId} stopped early`;
    default:
      return `npm run benchmark -- eval  # iterate at stage 0`;
  }
}

function eraLines(era: EraState | null): string[] {
  if (era === null) {
    return [`  era budget: ledger not initialized (bootstraps on the first --to-verdict)`];
  }
  return [
    `  era budget: spent ${round4(era.budgetSpent)} of ${era.budgetCap}; ` +
      `cumulative expected false accepts ${round4(era.cumulativeExpectedFalseAccepts)}`,
  ];
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function formatSigned(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}`;
}
