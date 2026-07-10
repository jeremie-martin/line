import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type { AxisName } from "../types.ts";
import type { CharacterizationReport, SourceCharacterization } from "./model.ts";

export const AUDIT_SCHEMA = "line.benchmark-v2.audit.v2" as const;

export type DirectSequenceMatch = {
  candidate: string;
  other: string;
  candidateStart: number;
  otherStart: number;
  contacts: number;
  scale: number;
  medianResidualMs: number;
  gapRmsMs: number;
};

export type TargetSimilarity = {
  a: string;
  b: string;
  axis: AxisName;
  correlation: number;
};

export type ImpactPeriodicity = {
  source: string;
  lag: number;
  correlation: number;
  coverage: number;
};

export type AuditReport = {
  schema: typeof AUDIT_SCHEMA;
  characterizationFingerprint: string;
  auditRuleFingerprint: string;
  auditFingerprint: string;
  hardFailures: string[];
  warnings: string[];
  directSequenceMatches: DirectSequenceMatch[];
  targetSimilarities: TargetSimilarity[];
  impactPeriodicity: ImpactPeriodicity[];
  gapDistributionSimilarities: Array<{ a: string; b: string; cosine: number }>;
};

// Eight contacts is the minimum evidence, but requiring twelve for an automatic
// failure avoids treating ordinary short pulse fragments as copied phrases.
const WINDOW_CONTACTS = 12;
const MAX_MEDIAN_RESIDUAL_MS = 75;
const MAX_GAP_RMS_MS = 75;

export function buildAuditReport(characterization: CharacterizationReport): AuditReport {
  const canonical = characterization.sources.filter((source) => source.role !== "qualification_reference");
  const authored = canonical.filter((source) => source.role !== "development_music_candidate");
  const qualification = characterization.sources.filter((source) => source.role === "qualification_reference");
  const directSequenceMatches: DirectSequenceMatch[] = [];
  const hardFailures: string[] = [];
  const warnings: string[] = [];

  for (const group of characterization.exactContactDuplicates) {
    if (intentionalParentCluster(group.members, canonical)) {
      warnings.push(`parent variant shares exact contact skeleton: ${group.members.join(", ")}`);
    } else if (group.members.some((id) => canonical.some((source) => source.id === id))) {
      hardFailures.push(`exact contact duplicate: ${group.members.join(", ")}`);
    }
  }
  for (const group of characterization.frameGapDuplicates) {
    if (intentionalParentCluster(group.members, canonical)) {
      warnings.push(`parent variant shares exact frame gaps: ${group.members.join(", ")}`);
    } else if (group.members.some((id) => canonical.some((source) => source.id === id))) {
      hardFailures.push(`exact frame-gap duplicate: ${group.members.join(", ")}`);
    }
  }

  for (const candidate of authored) {
    for (const other of qualification) {
      const match = bestDirectSequenceMatch(candidate, other);
      if (match !== undefined) directSequenceMatches.push(match);
    }
  }
  for (let i = 0; i < authored.length; i++) {
    for (let j = i + 1; j < authored.length; j++) {
      if (parentRoot(authored[i]) === parentRoot(authored[j])) continue;
      const match = bestDirectSequenceMatch(authored[i], authored[j]);
      if (match !== undefined) directSequenceMatches.push(match);
    }
  }
  for (const match of directSequenceMatches) {
    hardFailures.push(
      `direct sequence match: ${match.candidate}[${match.candidateStart}] and ` +
      `${match.other}[${match.otherStart}] (${match.medianResidualMs}ms median, ${match.gapRmsMs}ms gap RMS)`,
    );
  }

  const compared = [...canonical, ...qualification];
  const targetSimilarities: TargetSimilarity[] = [];
  const gapDistributionSimilarities: Array<{ a: string; b: string; cosine: number }> = [];
  for (let i = 0; i < compared.length; i++) {
    for (let j = i + 1; j < compared.length; j++) {
      if (compared[i].role === "qualification_reference" && compared[j].role === "qualification_reference") continue;
      const cosine = gapHistogramCosine(compared[i], compared[j]);
      gapDistributionSimilarities.push({ a: compared[i].id, b: compared[j].id, cosine: round(cosine) });
      if (cosine >= 0.98) warnings.push(`near-identical gap distribution: ${compared[i].id}, ${compared[j].id} (${round(cosine)})`);
      for (const axis of ["air", "speed", "amplitude", "impact"] as const) {
        const a = compared[i].targetSeries[axis];
        const b = compared[j].targetSeries[axis];
        if (a === undefined || b === undefined) continue;
        const correlation = normalizedSeriesCorrelation(a, b);
        if (correlation !== null && Math.abs(correlation) >= 0.95) {
          targetSimilarities.push({ a: compared[i].id, b: compared[j].id, axis, correlation: round(correlation) });
          warnings.push(`target similarity: ${compared[i].id}, ${compared[j].id}, ${axis} (${round(correlation)})`);
        }
      }
    }
  }

  const impactPeriodicity: ImpactPeriodicity[] = [];
  for (const source of authored) {
    const impacts = source.impacts.flatMap((value) => value === null ? [] : [value]);
    for (let lag = 1; lag <= Math.min(8, impacts.length - 2); lag++) {
      const correlation = pearson(impacts.slice(0, -lag), impacts.slice(lag));
      const coverage = (impacts.length - lag) / impacts.length;
      if (correlation !== null && Math.abs(correlation) >= 0.8 && coverage >= 0.75) {
        impactPeriodicity.push({ source: source.id, lag, correlation: round(correlation), coverage: round(coverage) });
        warnings.push(`impact periodicity: ${source.id} lag ${lag} (${round(correlation)})`);
      }
    }
  }

  for (const source of authored) {
    if (source.durationSeconds < 55 || source.durationSeconds > 65) {
      hardFailures.push(`${source.id}: canonical score duration outside 55-65s`);
    }
    if (source.contactCount < 55 || source.contactCount > 150) {
      hardFailures.push(`${source.id}: canonical score contacts outside 55-150`);
    }
    if (source.activeTargetAxes.includes("elevation") || source.activeTargetAxes.includes("grain")) {
      hardFailures.push(`${source.id}: canonical score uses elevation or grain`);
    }
    if (
      source.role === "representative_candidate" &&
      source.cadence.rawInterContactGapsSeconds.min !== null &&
      source.cadence.rawInterContactGapsSeconds.min < 0.25
    ) {
      hardFailures.push(`${source.id}: sub-250ms gap belongs in capability coverage`);
    }
    if (source.role === "capability_candidate" && (source.scoreMetadata?.phases.length ?? 0) < 3) {
      hardFailures.push(`${source.id}: capability score needs named progressive phases`);
    }
  }

  const withoutFingerprint = {
    schema: AUDIT_SCHEMA,
    characterizationFingerprint: characterization.dataFingerprint,
    auditRuleFingerprint: auditRuleFingerprint(),
    hardFailures: [...new Set(hardFailures)].sort(),
    warnings: [...new Set(warnings)].sort(),
    directSequenceMatches: directSequenceMatches.sort(compareMatches),
    targetSimilarities: targetSimilarities.sort((a, b) => a.a.localeCompare(b.a) || a.b.localeCompare(b.b) || a.axis.localeCompare(b.axis)),
    impactPeriodicity: impactPeriodicity.sort((a, b) => a.source.localeCompare(b.source) || a.lag - b.lag),
    gapDistributionSimilarities: gapDistributionSimilarities.sort((a, b) => a.a.localeCompare(b.a) || a.b.localeCompare(b.b)),
  };
  return {
    ...withoutFingerprint,
    auditFingerprint: createHash("sha256").update(JSON.stringify(withoutFingerprint)).digest("hex"),
  };
}

function intentionalParentCluster(members: string[], sources: SourceCharacterization[]): boolean {
  const byId = new Map(sources.map((source) => [source.id, source]));
  const matched = members.map((id) => byId.get(id));
  return matched.every((source) => source !== undefined) &&
    new Set(matched.map((source) => parentRoot(source!))).size === 1 &&
    matched.some((source) => source!.parentId !== undefined);
}

function parentRoot(source: SourceCharacterization): string {
  return source.parentId ?? source.id;
}

export function auditDataFingerprint(report: AuditReport): string {
  const { auditFingerprint: _stored, ...contents } = report;
  return createHash("sha256").update(JSON.stringify(contents)).digest("hex");
}

export function auditRuleFingerprint(): string {
  return createHash("sha256")
    .update(readFileSync("scripts/v0/benchmark_v2/audit_model.ts"))
    .digest("hex");
}

export function renderAuditMarkdown(report: AuditReport): string {
  const lines = [
    "# Benchmark V2 Static Audit",
    "",
    `Characterization: \`${report.characterizationFingerprint.slice(0, 16)}\`. Audit: \`${report.auditFingerprint.slice(0, 16)}\`.`,
    "",
    "This report contains no compiler or heldout outcome.",
    "",
    "## Verdict",
    "",
    report.hardFailures.length === 0
      ? "PASS: no structural or direct-copy failure was detected."
      : `FAIL: ${report.hardFailures.length} hard failure(s).`,
    "",
    "## Hard failures",
    "",
    ...(report.hardFailures.length === 0 ? ["None."] : report.hardFailures.map((failure) => `- ${failure}`)),
    "",
    "## Review warnings",
    "",
    ...(report.warnings.length === 0 ? ["None."] : report.warnings.map((warning) => `- ${warning}`)),
    "",
    "## Interpretation",
    "",
    "Warnings identify correlated evidence for source review; they are not automatic rejection. " +
      "Generic musical pulse can be similar across independent scores, while direct nonuniform timing copies are hard failures.",
  ];
  return `${lines.join("\n")}\n`;
}

function bestDirectSequenceMatch(
  candidate: SourceCharacterization,
  other: SourceCharacterization,
): DirectSequenceMatch | undefined {
  const a = candidate.contactTimesSeconds;
  const b = other.contactTimesSeconds;
  let best: DirectSequenceMatch | undefined;
  for (let ai = 0; ai <= a.length - WINDOW_CONTACTS; ai++) {
    const aw = relative(a.slice(ai, ai + WINDOW_CONTACTS));
    if (!nonUniform(aw)) continue;
    for (let bi = 0; bi <= b.length - WINDOW_CONTACTS; bi++) {
      const bw = relative(b.slice(bi, bi + WINDOW_CONTACTS));
      if (!nonUniform(bw)) continue;
      const denominator = aw.reduce((sum, value) => sum + value * value, 0);
      const rawScale = denominator === 0
        ? 1
        : aw.reduce((sum, value, index) => sum + value * bw[index], 0) / denominator;
      const scale = Math.max(0.9, Math.min(1.1, rawScale));
      const residuals = aw.map((value, index) => Math.abs(value * scale - bw[index]));
      const ag = gaps(aw).map((value) => value * scale);
      const bg = gaps(bw);
      const gapRms = Math.sqrt(ag.reduce((sum, value, index) => sum + (value - bg[index]) ** 2, 0) / ag.length);
      const medianResidual = median(residuals);
      if (medianResidual * 1000 > MAX_MEDIAN_RESIDUAL_MS || gapRms * 1000 > MAX_GAP_RMS_MS) continue;
      const match = {
        candidate: candidate.id,
        other: other.id,
        candidateStart: ai,
        otherStart: bi,
        contacts: WINDOW_CONTACTS,
        scale: round(scale),
        medianResidualMs: round(medianResidual * 1000),
        gapRmsMs: round(gapRms * 1000),
      };
      if (best === undefined || match.medianResidualMs + match.gapRmsMs < best.medianResidualMs + best.gapRmsMs) {
        best = match;
      }
    }
  }
  return best;
}

function nonUniform(relativeTimes: number[]): boolean {
  const values = gaps(relativeTimes);
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const deviation = Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length);
  const distinctFrames = new Set(values.map((value) => Math.round(value * 40))).size;
  return distinctFrames >= 4 && mean > 0 && deviation / mean >= 0.05;
}

function gapHistogramCosine(a: SourceCharacterization, b: SourceCharacterization): number {
  const bins = (source: SourceCharacterization): number[] => {
    const out = Array.from({ length: 50 }, () => 0);
    for (const gap of source.rawInterContactGapsSeconds) {
      out[Math.min(out.length - 1, Math.floor(gap / 0.05))]++;
    }
    return out;
  };
  const av = bins(a);
  const bv = bins(b);
  const dot = av.reduce((sum, value, index) => sum + value * bv[index], 0);
  const an = Math.sqrt(av.reduce((sum, value) => sum + value * value, 0));
  const bn = Math.sqrt(bv.reduce((sum, value) => sum + value * value, 0));
  return an === 0 || bn === 0 ? 0 : dot / (an * bn);
}

function normalizedSeriesCorrelation(a: Array<number | null>, b: Array<number | null>): number | null {
  const samples = 64;
  const av = resample(a, samples);
  const bv = resample(b, samples);
  const pairs = av.flatMap((value, index) => value === null || bv[index] === null ? [] : [[value, bv[index]!] as const]);
  return pairs.length < 8 ? null : pearson(pairs.map((pair) => pair[0]), pairs.map((pair) => pair[1]));
}

function resample(values: Array<number | null>, count: number): Array<number | null> {
  if (values.length === 0) return [];
  return Array.from({ length: count }, (_, index) => {
    const position = index * (values.length - 1) / Math.max(1, count - 1);
    return values[Math.round(position)] ?? null;
  });
}

function pearson(a: number[], b: number[]): number | null {
  if (a.length !== b.length || a.length < 2) return null;
  const am = a.reduce((sum, value) => sum + value, 0) / a.length;
  const bm = b.reduce((sum, value) => sum + value, 0) / b.length;
  let numerator = 0;
  let ad = 0;
  let bd = 0;
  for (let i = 0; i < a.length; i++) {
    numerator += (a[i] - am) * (b[i] - bm);
    ad += (a[i] - am) ** 2;
    bd += (b[i] - bm) ** 2;
  }
  return ad === 0 || bd === 0 ? null : numerator / Math.sqrt(ad * bd);
}

function relative(values: number[]): number[] {
  return values.map((value) => value - values[0]);
}

function gaps(values: number[]): number[] {
  return values.slice(1).map((value, index) => value - values[index]);
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function compareMatches(a: DirectSequenceMatch, b: DirectSequenceMatch): number {
  return a.candidate.localeCompare(b.candidate) || a.other.localeCompare(b.other) || a.candidateStart - b.candidateStart;
}

function round(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
