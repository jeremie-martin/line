/**
 * Study-only catchability call telemetry — histograms every catchability
 * value produced during a run. Extracted out of the production readiness model
 * (optimizer/readiness.ts) so that core file carries no instrumentation state;
 * this module subscribes to the canonical readiness scorer and is
 * imported only by study drivers (study_catchability_histogram.ts). Gated on
 * LR_CATCHABILITY_TELEMETRY=1 (default off); when the flag is unset the recorder
 * no-ops, and in production this module is never imported at all so the observer
 * in readiness.ts stays null and the hot path is untouched.
 *
 * DELIBERATELY process-scoped, NOT per-compile: study_catchability_histogram.ts
 * resets once at process start and aggregates every catchability call across
 * ALL compiles in the run into one histogram. It is therefore intentionally
 * EXCLUDED from the per-compile lifecycle registry (core/compile_lifecycle.ts) —
 * registering resetCatchabilityTelemetry there would wipe the cross-compile
 * aggregate the study depends on. This never affects compile OUTPUT: the readiness
 * value is computed before the observer fires and the recorder no-ops unless the
 * env flag is set (default off). The study tool owns its own reset; a per-compile
 * snapshot of this state is meaningless by design.
 */

import {
  setReadinessCatchabilityObserver,
} from "./optimizer/readiness_scoring.ts";

export type CatchabilityTelemetryBin = {
  lo: number;
  hi: number;
  count: number;
  fraction: number;
};

export type CatchabilityTelemetrySnapshot = {
  enabled: boolean;
  binWidth: number;
  count: number;
  mean: number | null;
  sd: number | null;
  min: number | null;
  max: number | null;
  belowZero: number;
  aboveOne: number;
  bins: CatchabilityTelemetryBin[];
};

const DEFAULT_TELEMETRY_BIN_WIDTH = 0.05;

let catchabilityTelemetryEnabled =
  (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env?.LR_CATCHABILITY_TELEMETRY === "1";
let telemetryBinWidth = DEFAULT_TELEMETRY_BIN_WIDTH;
let telemetryBins = new Array(Math.ceil(1 / telemetryBinWidth)).fill(0) as number[];
let telemetryCount = 0;
let telemetrySum = 0;
let telemetrySumSq = 0;
let telemetryMin = Infinity;
let telemetryMax = -Infinity;
let telemetryBelowZero = 0;
let telemetryAboveOne = 0;

function recordCatchabilityTelemetry(value: number): void {
  if (!catchabilityTelemetryEnabled) return;
  telemetryCount++;
  telemetrySum += value;
  telemetrySumSq += value * value;
  telemetryMin = Math.min(telemetryMin, value);
  telemetryMax = Math.max(telemetryMax, value);
  if (value < 0) {
    telemetryBelowZero++;
    return;
  }
  if (value > 1) {
    telemetryAboveOne++;
    return;
  }
  const i = Math.min(telemetryBins.length - 1, Math.floor(value / telemetryBinWidth));
  telemetryBins[i]++;
}

// Subscribe once at module load. Present only when a study
// driver imports this module; production never does.
setReadinessCatchabilityObserver(recordCatchabilityTelemetry);

export function setCatchabilityTelemetryEnabled(enabled: boolean): void {
  catchabilityTelemetryEnabled = enabled;
}

export function resetCatchabilityTelemetry(binWidth = DEFAULT_TELEMETRY_BIN_WIDTH): void {
  if (!Number.isFinite(binWidth) || binWidth <= 0 || binWidth > 1) {
    throw new Error(`resetCatchabilityTelemetry: invalid bin width ${binWidth}`);
  }
  telemetryBinWidth = binWidth;
  telemetryBins = new Array(Math.ceil(1 / telemetryBinWidth)).fill(0) as number[];
  telemetryCount = 0;
  telemetrySum = 0;
  telemetrySumSq = 0;
  telemetryMin = Infinity;
  telemetryMax = -Infinity;
  telemetryBelowZero = 0;
  telemetryAboveOne = 0;
}

export function snapshotCatchabilityTelemetry(): CatchabilityTelemetrySnapshot {
  const bins = telemetryBins.map((count, i) => {
    const lo = i * telemetryBinWidth;
    const hi = Math.min(1, (i + 1) * telemetryBinWidth);
    return {
      lo,
      hi,
      count,
      fraction: telemetryCount > 0 ? count / telemetryCount : 0,
    };
  });
  const mean = telemetryCount > 0 ? telemetrySum / telemetryCount : null;
  const variance = telemetryCount > 0 && mean !== null
    ? Math.max(0, telemetrySumSq / telemetryCount - mean * mean)
    : null;
  return {
    enabled: catchabilityTelemetryEnabled,
    binWidth: telemetryBinWidth,
    count: telemetryCount,
    mean,
    sd: variance === null ? null : Math.sqrt(variance),
    min: telemetryCount > 0 ? telemetryMin : null,
    max: telemetryCount > 0 ? telemetryMax : null,
    belowZero: telemetryBelowZero,
    aboveOne: telemetryAboveOne,
    bins,
  };
}
