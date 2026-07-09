/**
 * Analyze LR_REPAIR_LOG records as restart chains. The study asks whether the
 * incumbent's inherited arrival state predicts when a weak gap must be repaired
 * from its parent rather than directly.
 *
 *   npx tsx scripts/v0/study_repair_anchor_causality.ts \
 *     --golden=generated/golden-runs/study-repair-anchor-causality/golden.json \
 *     --out=generated/studies/repair-anchor-causality.json
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

type RepairRecord = {
  round?: number;
  worst: number;
  up: number;
  framesSpent: number;
  completed: boolean;
  accepted: boolean;
  afterScore: number;
  beforeScore: number;
  weakAxis?: string | null;
  weakAxisError?: number | null;
  weakGapSse?: number | null;
  weakArrivalReadiness?: number | null;
  weakArrivalCatchability?: number | null;
  weakArrivalSpeedFit?: number | null;
  weakArrivalImpactFeasibility?: number | null;
  weakArrivalAirFit?: number | null;
  weakArrivalElevationFit?: number | null;
};

type Archive = {
  rows: Array<{
    name: string;
    seed: number;
    checkpoints: Array<{
      budget: number;
      compile_stats?: { repair?: { records?: RepairRecord[] } } | null;
    }>;
  }>;
};

type Chain = {
  spec: string;
  seed: number;
  budget: number;
  records: RepairRecord[];
};

const FACTORS = [
  "weakArrivalReadiness",
  "weakArrivalCatchability",
  "weakArrivalSpeedFit",
  "weakArrivalImpactFeasibility",
  "weakArrivalAirFit",
  "weakArrivalElevationFit",
] as const;
type Factor = typeof FACTORS[number];

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.slice(2).find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function rate(numerator: number, denominator: number): number | null {
  return denominator > 0 ? round(numerator / denominator, 4) : null;
}

function round(value: number, digits = 3): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function summarize(chains: readonly Chain[]): Record<string, number | null> {
  const direct = chains.map((chain) => chain.records.find((record) => record.up === 0)).filter(Boolean) as RepairRecord[];
  const directAccepted = direct.filter((record) => record.accepted);
  const directFailedChains = chains.filter((chain) => {
    const record = chain.records.find((candidate) => candidate.up === 0);
    return record !== undefined && !record.accepted;
  });
  const parentAttempted = directFailedChains.filter((chain) => chain.records.some((record) => record.up === 1));
  const parentAccepted = parentAttempted.filter((chain) => chain.records.some((record) => record.up === 1 && record.accepted));
  const upstreamAccepted = directFailedChains.filter((chain) => chain.records.some((record) => record.up > 0 && record.accepted));
  const firstAcceptedUps = chains
    .map((chain) => chain.records.find((record) => record.accepted)?.up)
    .filter(finite);
  const wastedDirectFrames = upstreamAccepted.reduce((sum, chain) => {
    return sum + (chain.records.find((record) => record.up === 0)?.framesSpent ?? 0);
  }, 0);
  return {
    chains: chains.length,
    direct_attempted: direct.length,
    direct_accepted: directAccepted.length,
    direct_accept_rate: rate(directAccepted.length, direct.length),
    direct_failed: directFailedChains.length,
    parent_attempted_after_direct_failure: parentAttempted.length,
    parent_accepted: parentAccepted.length,
    parent_accept_rate_given_attempt: rate(parentAccepted.length, parentAttempted.length),
    any_upstream_accepted: upstreamAccepted.length,
    upstream_accept_rate_given_direct_failure: rate(upstreamAccepted.length, directFailedChains.length),
    mean_first_accepted_up: firstAcceptedUps.length > 0
      ? round(firstAcceptedUps.reduce((sum, value) => sum + value, 0) / firstAcceptedUps.length)
      : null,
    direct_frames_before_upstream_accept: wastedDirectFrames,
    mean_direct_frames_before_upstream_accept: rate(wastedDirectFrames, upstreamAccepted.length),
  };
}

function factorBins(chains: readonly Chain[], factor: Factor): unknown[] {
  const edges = [0, 0.2, 0.4, 0.6, 0.8, 1.000001];
  return edges.slice(0, -1).map((lo, index) => {
    const hi = edges[index + 1];
    const selected = chains.filter((chain) => {
      const value = chain.records[0]?.[factor];
      return finite(value) && value >= lo && value < hi;
    });
    return { lo, hi: hi > 1 ? 1 : hi, ...summarize(selected) };
  });
}

const goldenArg = arg("golden");
if (goldenArg === undefined) throw new Error("missing --golden=path");
const goldenPath = resolve(goldenArg);
const outPath = resolve(arg("out") ?? "generated/studies/repair-anchor-causality.json");
const archive = JSON.parse(readFileSync(goldenPath, "utf8")) as Archive;
const chains: Chain[] = [];

for (const row of archive.rows) {
  for (const checkpoint of row.checkpoints) {
    const records = checkpoint.compile_stats?.repair?.records ?? [];
    const grouped = new Map<number, RepairRecord[]>();
    let legacyRound = -1;
    for (let index = 0; index < records.length; index++) {
      const record = records[index];
      if (record.round === undefined && (index === 0 || record.up === 0)) legacyRound++;
      const roundId = record.round ?? legacyRound;
      const group = grouped.get(roundId) ?? [];
      group.push(record);
      grouped.set(roundId, group);
    }
    for (const group of grouped.values()) {
      group.sort((a, b) => a.up - b.up);
      chains.push({ spec: row.name, seed: row.seed, budget: checkpoint.budget, records: group });
    }
  }
}

const axes = [...new Set(chains.map((chain) => chain.records[0]?.weakAxis ?? "unknown"))].sort();
const result = {
  source: goldenPath,
  checkpoints: archive.rows.reduce((sum, row) => sum + row.checkpoints.length, 0),
  records: chains.reduce((sum, chain) => sum + chain.records.length, 0),
  overall: summarize(chains),
  by_weak_axis: Object.fromEntries(axes.map((axis) => [
    axis,
    summarize(chains.filter((chain) => (chain.records[0]?.weakAxis ?? "unknown") === axis)),
  ])),
  by_factor_bin: Object.fromEntries(FACTORS.map((factor) => [factor, factorBins(chains, factor)])),
};

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
