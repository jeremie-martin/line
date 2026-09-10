/**
 * Observation-only candidate-breadth saturation study.
 *
 * For every freshly generated ordinary pool, replay the raw sampled-candidate
 * quality order at 1/2, 3/4, and full requested breadth. The prospective rule
 * stops at 3/4 only when the quality top-five is unchanged from 1/2 to 3/4.
 * Full breadth remains an oracle here: it measures how often that online rule
 * would preserve the final raw top one/three/five and how many attempt slots it
 * could avoid. No compiler decision or candidate is changed by this script.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import {
  compileLegacyHandoff,
  setHandoffExpansionProbeHook,
  type HandoffExpansionProbeRecord,
} from "./optimizer/legacy_handoff.ts";
import {
  setNormalPoolSnapshotHook,
  type NormalPoolSnapshotRecord,
  type SearchNode,
} from "./optimizer/node.ts";
import { sortCandidatesByQuality } from "./optimizer/aim.ts";
import type { Candidate } from "./optimizer/sample.ts";
import { applyJolt } from "../produce/seed.ts";
import {
  loadSourceManifest,
  loadSourceSpec,
  resolveSources,
} from "./benchmark_v2/model.ts";

const argv = process.argv.slice(2);
const argValue = (name: string): string | undefined =>
  argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);

const DEFAULT_SOURCES = [
  "countercurrent",
  "offgrid_conversation",
  "rising_switch",
  "amplitude_tides",
  "dense_dialogue",
  "frontier_pickup_progression",
  "frontier_dense_recovery",
  "frontier_low_air_endurance",
];
const sourceIds = (argValue("sources") ?? DEFAULT_SOURCES.join(","))
  .split(",").filter(Boolean);
const seeds = (argValue("seeds") ?? "14016,14017").split(",").map(Number);
const budgets = (argValue("budgets") ?? "250000,750000,1500000,4000000")
  .split(",").map(Number);
const outPath = argValue("out") ??
  "generated/benchmark-v2/scale/candidate-breadth-saturation-observation.json";

for (const [name, values] of [["seeds", seeds], ["budgets", budgets]] as const) {
  if (values.length === 0 || values.some((value) => !Number.isSafeInteger(value) || value < 0)) {
    throw new Error(`invalid --${name}`);
  }
}

type Phase = "initial" | "resumed" | "repair";
type Row = {
  source: string;
  seed: number;
  budget: number;
  gapIndex: number;
  phase: Phase;
  requestedAttempts: number;
  halfAttempts: number;
  threeQuarterAttempts: number;
  halfViable: number;
  threeQuarterViable: number;
  fullViable: number;
  stableHalfToThreeQuarterTopFive: boolean;
  oracleFullTopOnePreserved: boolean;
  oracleFullTopThreePreserved: boolean;
  oracleFullTopFivePreserved: boolean;
  savedAttemptSlots: number;
};

type Pending = Omit<Row, "source" | "seed" | "budget" | "phase">;
const rows: Row[] = [];
const pending = new WeakMap<SearchNode, Pending>();
let activeSource = "";
let activeSeed = 0;
let activeBudget = 0;

function prefix(
  sampleOrder: readonly Candidate[],
  attempts: number,
): Candidate[] {
  return sampleOrder.filter((candidate) =>
    candidate.sampleAttempt !== undefined && candidate.sampleAttempt < attempts
  );
}

function sameHead(
  left: readonly Candidate[],
  right: readonly Candidate[],
  count: number,
): boolean {
  const width = Math.min(count, left.length, right.length);
  if (width < Math.min(count, right.length)) return false;
  for (let index = 0; index < width; index++) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

function qualityOrder(
  record: NormalPoolSnapshotRecord,
  attempts: number,
): Candidate[] {
  const costOrder = prefix(record.sampleOrder, attempts)
    .sort((left, right) => left.cost - right.cost);
  return sortCandidatesByQuality(
    record.node.prefixEngine,
    record.gap,
    [...record.gaps],
    costOrder,
    false,
    record.ctx,
  );
}

setNormalPoolSnapshotHook((record) => {
  // Exclude rollout width-one and small rescue pools. The mechanism under
  // study is the production breadth law, where quartile batching is meaningful.
  if (record.nCand < 16) return;
  const halfAttempts = Math.max(1, Math.round(record.nCand / 2));
  const threeQuarterAttempts = Math.max(
    halfAttempts + 1,
    Math.round(record.nCand * 3 / 4),
  );
  if (threeQuarterAttempts >= record.nCand) return;
  const half = qualityOrder(record, halfAttempts);
  const threeQuarter = qualityOrder(record, threeQuarterAttempts);
  const full = qualityOrder(record, record.nCand);
  const stable = sameHead(half, threeQuarter, 5);
  pending.set(record.node, {
    gapIndex: record.gapIndex,
    requestedAttempts: record.nCand,
    halfAttempts,
    threeQuarterAttempts,
    halfViable: half.length,
    threeQuarterViable: threeQuarter.length,
    fullViable: full.length,
    stableHalfToThreeQuarterTopFive: stable,
    oracleFullTopOnePreserved: !stable || sameHead(threeQuarter, full, 1),
    oracleFullTopThreePreserved: !stable || sameHead(threeQuarter, full, 3),
    oracleFullTopFivePreserved: !stable || sameHead(threeQuarter, full, 5),
    savedAttemptSlots: stable ? record.nCand - threeQuarterAttempts : 0,
  });
});

setHandoffExpansionProbeHook((record: HandoffExpansionProbeRecord) => {
  const observation = pending.get(record.node);
  if (observation === undefined || observation.requestedAttempts !== record.nCand) return;
  pending.delete(record.node);
  rows.push({
    source: activeSource,
    seed: activeSeed,
    budget: activeBudget,
    phase: record.repairLane ? "repair" : record.hasCompletion ? "resumed" : "initial",
    ...observation,
  });
});

const manifest = loadSourceManifest("benchmark/v2/compat/source-manifest.json");
const sources = resolveSources(manifest);
const selectedSources = sourceIds.map((id) => {
  const source = sources.find((candidate) => candidate.id === id);
  if (source === undefined) throw new Error(`unknown V2 source ${id}`);
  return source;
});

try {
  for (const source of selectedSources) {
    const spec = applyJolt(await loadSourceSpec(source), -15);
    for (const budget of budgets) {
      for (const seed of seeds) {
        activeSource = source.id;
        activeSeed = seed;
        activeBudget = budget;
        const before = rows.length;
        const started = Date.now();
        compileLegacyHandoff(spec, seed, { budget });
        console.error(
          `${source.id}/${budget}/s${seed}: ${rows.length - before} fresh breadth pools, ` +
            `${((Date.now() - started) / 1000).toFixed(1)}s`,
        );
      }
    }
  }
} finally {
  setNormalPoolSnapshotHook(null);
  setHandoffExpansionProbeHook(null);
}

function summarize(group: readonly Row[]): Record<string, number> {
  const stopped = group.filter((row) => row.stableHalfToThreeQuarterTopFive);
  const ratio = (count: number, total: number): number => total === 0 ? 0 : count / total;
  const sum = (values: readonly number[]): number => values.reduce((total, value) => total + value, 0);
  const requested = sum(group.map((row) => row.requestedAttempts));
  return {
    pools: group.length,
    stopEligiblePools: stopped.length,
    stopRate: ratio(stopped.length, group.length),
    savedAttemptSlots: sum(stopped.map((row) => row.savedAttemptSlots)),
    savedAttemptShare: ratio(sum(stopped.map((row) => row.savedAttemptSlots)), requested),
    oracleTopOnePreservationRate: ratio(
      stopped.filter((row) => row.oracleFullTopOnePreserved).length,
      stopped.length,
    ),
    oracleTopThreePreservationRate: ratio(
      stopped.filter((row) => row.oracleFullTopThreePreserved).length,
      stopped.length,
    ),
    oracleTopFivePreservationRate: ratio(
      stopped.filter((row) => row.oracleFullTopFivePreserved).length,
      stopped.length,
    ),
  };
}

const summaries = budgets.flatMap((budget) =>
  (["initial", "resumed", "repair"] as const).map((phase) => ({
    budget,
    phase,
    ...summarize(rows.filter((row) => row.budget === budget && row.phase === phase)),
  }))
);
const report = {
  schema: "line.candidate-breadth-saturation-observation.v1",
  generatedAt: new Date().toISOString(),
  sources: sourceIds,
  seeds,
  budgets,
  rule: {
    checkpoints: [0.5, 0.75, 1],
    stableHead: 5,
    action: "stop at three-quarter breadth when raw quality top-five is unchanged from half breadth",
    authority: "observation-only; full breadth is used only as an oracle",
  },
  overall: summarize(rows),
  summaries,
  rows,
};
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ overall: report.overall, summaries }, null, 2));
console.log(`observation -> ${outPath}`);
