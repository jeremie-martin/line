/**
 * Offline analysis for study_cc_explore shard outputs.
 */

import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

type StudyFile = {
  config: {
    budget: number;
    specs: string[];
    seeds: number[];
    study: "cc_explore";
    quality_ncand: number[];
    cc_explore: number[];
    baseline_quality_ncand: number;
    baseline_cc_explore: number;
  };
  rows: Row[];
};

type Row = {
  spec: string;
  seed: number;
  budget: number;
  quality_ncand: number;
  cc_explore: number;
  score: number;
  contract_passed: boolean;
  sim_frames: number;
  first_completion_frame: number | null;
  candidates_sampled: number;
  candidates_viable: number;
  viability_rate: number | null;
  fwd_eval_frames_charged: number;
  repair_frames_spent: number;
};

type GroupSummary = {
  q: number;
  cc_explore: number;
  n: number;
  valid: number;
  score_mean: number;
  score_p50: number;
  first_mean: number | null;
  candidate_mean: number;
  viability_mean: number | null;
  repair_mean: number;
};

type PairSummary = {
  q: number;
  cc_explore: number;
  baseline_q: number;
  baseline_cc_explore: number;
  pairs: number;
  score_delta_mean: number;
  score_delta_p50: number;
  first_ratio_mean: number | null;
  candidate_ratio_mean: number | null;
  viability_delta_mean: number | null;
  repair_delta_mean: number;
};

type SpecPairSummary = PairSummary & {
  spec: string;
};

const argv = process.argv.slice(2);
const inputPaths = inputList();
if (inputPaths.length === 0) {
  throw new Error("usage: --dir=study-dir or --inputs=a.json,b.json [--out=analysis.json]");
}
const outPath = arg("out");
const studies = inputPaths.map(readStudy);
const rows = dedupeRows(studies.flatMap((study) => study.rows));
const baselineQ = studies[0].config.baseline_quality_ncand;
const baselineExplore = studies[0].config.baseline_cc_explore;

const output = {
  config: {
    inputs: inputPaths,
    rows: rows.length,
    budgets: [...new Set(rows.map((row) => row.budget))].sort((a, b) => a - b),
    specs: [...new Set(rows.map((row) => row.spec))].sort(),
    seeds: [...new Set(rows.map((row) => row.seed))].sort((a, b) => a - b),
    quality_ncand: [...new Set(rows.map((row) => row.quality_ncand))].sort((a, b) => a - b),
    cc_explore: [...new Set(rows.map((row) => row.cc_explore))].sort((a, b) => a - b),
    baseline_quality_ncand: baselineQ,
    baseline_cc_explore: baselineExplore,
  },
  by_q_explore: summarizeGroups(rows),
  paired_vs_same_q_x1: pairedSummaries(rows, "same_q"),
  paired_vs_q32_x1: pairedSummaries(rows, "global"),
  paired_by_spec_vs_same_q_x1: pairedBySpec(rows, "same_q"),
  paired_by_spec_vs_q32_x1: pairedBySpec(rows, "global"),
  best_explore_by_q: bestByQ(rows),
  best_explore_by_spec_q: bestBySpecQ(rows),
};

if (outPath !== undefined) {
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`);
}

printSummary(output);
if (outPath !== undefined) console.log(`wrote ${outPath}`);

function summarizeGroups(values: readonly Row[]): GroupSummary[] {
  return [...groupRows(values, (row) => `${row.quality_ncand}|${row.cc_explore}`).entries()]
    .sort(([a], [b]) => compareGridKey(a, b))
    .map(([key, group]) => {
      const [q, ccExplore] = key.split("|").map(Number);
      return {
        q,
        cc_explore: ccExplore,
        n: group.length,
        valid: group.filter((row) => row.contract_passed).length,
        score_mean: round(mean(group.map((row) => row.score)), 3),
        score_p50: round(quantile(group.map((row) => row.score), 0.5), 3),
        first_mean: meanNullable(group.map((row) => row.first_completion_frame)),
        candidate_mean: round(mean(group.map((row) => row.candidates_sampled)), 1),
        viability_mean: meanNullable(group.map((row) => row.viability_rate)),
        repair_mean: round(mean(group.map((row) => row.repair_frames_spent)), 1),
      };
    });
}

function pairedSummaries(rowsIn: readonly Row[], mode: "same_q" | "global"): PairSummary[] {
  const byKey = new Map<string, Row>();
  for (const row of rowsIn) byKey.set(rowKey(row.spec, row.seed, row.quality_ncand, row.cc_explore), row);
  const groups = new Map<string, Array<{ row: Row; baseline: Row }>>();
  for (const row of rowsIn) {
    const baselineForQ = mode === "same_q" ? row.quality_ncand : baselineQ;
    const baseline = byKey.get(rowKey(row.spec, row.seed, baselineForQ, baselineExplore));
    if (baseline === undefined) continue;
    if (row.quality_ncand === baselineForQ && row.cc_explore === baselineExplore) continue;
    const key = `${row.quality_ncand}|${row.cc_explore}|${baselineForQ}|${baselineExplore}`;
    groups.set(key, [...(groups.get(key) ?? []), { row, baseline }]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => comparePairKey(a, b))
    .map(([key, group]) => {
      const [q, ccExplore, baselineForQ, baselineForExplore] = key.split("|").map(Number);
      const firstRatios = group.map(({ row, baseline }) =>
        row.first_completion_frame !== null && baseline.first_completion_frame !== null &&
          baseline.first_completion_frame > 0
          ? row.first_completion_frame / baseline.first_completion_frame
          : null
      );
      const candidateRatios = group.map(({ row, baseline }) =>
        baseline.candidates_sampled > 0 ? row.candidates_sampled / baseline.candidates_sampled : null
      );
      const viabilityDeltas = group.map(({ row, baseline }) =>
        row.viability_rate !== null && baseline.viability_rate !== null
          ? row.viability_rate - baseline.viability_rate
          : null
      );
      const scoreDeltas = group.map(({ row, baseline }) => row.score - baseline.score);
      return {
        q,
        cc_explore: ccExplore,
        baseline_q: baselineForQ,
        baseline_cc_explore: baselineForExplore,
        pairs: group.length,
        score_delta_mean: round(mean(scoreDeltas), 3),
        score_delta_p50: round(quantile(scoreDeltas, 0.5), 3),
        first_ratio_mean: meanNullable(firstRatios),
        candidate_ratio_mean: meanNullable(candidateRatios),
        viability_delta_mean: meanNullable(viabilityDeltas),
        repair_delta_mean: round(mean(group.map(({ row, baseline }) =>
          row.repair_frames_spent - baseline.repair_frames_spent
        )), 1),
      };
    });
}

function pairedBySpec(rowsIn: readonly Row[], mode: "same_q" | "global"): SpecPairSummary[] {
  return [...groupRows(rowsIn, (row) => row.spec).entries()]
    .flatMap(([spec, group]) =>
      pairedSummaries(group, mode).map((row) => ({
        spec,
        ...row,
      }))
    )
    .sort((a, b) =>
      a.q === b.q
        ? a.cc_explore === b.cc_explore
          ? a.spec.localeCompare(b.spec)
          : a.cc_explore - b.cc_explore
        : a.q - b.q
    );
}

function bestByQ(rowsIn: readonly Row[]): Array<{
  q: number;
  best_cc_explore: number;
  baseline_score_mean: number;
  best_score_mean: number;
  score_delta_vs_x1: number;
  first_ratio_vs_x1: number | null;
  candidate_ratio_vs_x1: number | null;
}> {
  return [...groupRows(rowsIn, (row) => String(row.quality_ncand)).entries()]
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([qText, group]) => {
      const q = Number(qText);
      const byExplore = [...groupRows(group, (row) => String(row.cc_explore)).entries()]
        .map(([explore, exploreGroup]) => ({
          explore: Number(explore),
          score_mean: mean(exploreGroup.map((row) => row.score)),
        }))
        .sort((a, b) => b.score_mean - a.score_mean);
      const best = byExplore[0];
      const baselineRows = group.filter((row) => row.cc_explore === baselineExplore);
      const bestRows = group.filter((row) => row.cc_explore === best.explore);
      const paired = pairedSummaries([...baselineRows, ...bestRows], "same_q")
        .find((row) => row.q === q && row.cc_explore === best.explore);
      return {
        q,
        best_cc_explore: best.explore,
        baseline_score_mean: round(mean(baselineRows.map((row) => row.score)), 3),
        best_score_mean: round(best.score_mean, 3),
        score_delta_vs_x1: round(best.score_mean - mean(baselineRows.map((row) => row.score)), 3),
        first_ratio_vs_x1: paired?.first_ratio_mean ?? (best.explore === baselineExplore ? 1 : null),
        candidate_ratio_vs_x1: paired?.candidate_ratio_mean ?? (best.explore === baselineExplore ? 1 : null),
      };
    });
}

function bestBySpecQ(rowsIn: readonly Row[]): Array<{
  spec: string;
  q: number;
  best_cc_explore: number;
  baseline_score_mean: number;
  best_score_mean: number;
  score_delta_vs_x1: number;
  first_ratio_vs_x1: number | null;
  candidate_ratio_vs_x1: number | null;
}> {
  return [...groupRows(rowsIn, (row) => `${row.spec}|${row.quality_ncand}`).entries()]
    .map(([key, group]) => {
      const [spec, qText] = key.split("|");
      const q = Number(qText);
      const byExplore = [...groupRows(group, (row) => String(row.cc_explore)).entries()]
        .map(([explore, exploreGroup]) => ({
          explore: Number(explore),
          score_mean: mean(exploreGroup.map((row) => row.score)),
        }))
        .sort((a, b) => b.score_mean - a.score_mean);
      const best = byExplore[0];
      const baselineRows = group.filter((row) => row.cc_explore === baselineExplore);
      const bestRows = group.filter((row) => row.cc_explore === best.explore);
      const paired = pairedSummaries([...baselineRows, ...bestRows], "same_q")
        .find((row) => row.q === q && row.cc_explore === best.explore);
      return {
        spec,
        q,
        best_cc_explore: best.explore,
        baseline_score_mean: round(mean(baselineRows.map((row) => row.score)), 3),
        best_score_mean: round(best.score_mean, 3),
        score_delta_vs_x1: round(best.score_mean - mean(baselineRows.map((row) => row.score)), 3),
        first_ratio_vs_x1: paired?.first_ratio_mean ?? (best.explore === baselineExplore ? 1 : null),
        candidate_ratio_vs_x1: paired?.candidate_ratio_mean ?? (best.explore === baselineExplore ? 1 : null),
      };
    })
    .sort((a, b) => a.q === b.q ? a.spec.localeCompare(b.spec) : a.q - b.q);
}

function printSummary(result: typeof output): void {
  console.log(
    `cc-explore-analysis: rows=${result.config.rows} budgets=${result.config.budgets.join(",")} ` +
      `specs=${result.config.specs.length} seeds=${result.config.seeds.length} ` +
      `q=${result.config.quality_ncand.join(",")} x=${result.config.cc_explore.join(",")}`,
  );
  console.log("best explore by q:");
  for (const row of result.best_explore_by_q) {
    console.log(
      `  q=${row.q} best_x=${row.best_cc_explore.toFixed(2)} ` +
        `dScore=${row.score_delta_vs_x1.toFixed(2)} first=${fmt(row.first_ratio_vs_x1, 3)} ` +
        `cand=${fmt(row.candidate_ratio_vs_x1, 3)}`,
    );
  }
  console.log("paired vs x=1 at same q:");
  for (const row of result.paired_vs_same_q_x1) {
    console.log(
      `  q=${row.q} x=${row.cc_explore.toFixed(2)} pairs=${row.pairs} ` +
        `dScore=${row.score_delta_mean.toFixed(2)} p50=${row.score_delta_p50.toFixed(2)} ` +
        `first=${fmt(row.first_ratio_mean, 3)} cand=${fmt(row.candidate_ratio_mean, 3)} ` +
        `dViable=${fmt(row.viability_delta_mean, 4)} dRepair=${row.repair_delta_mean.toFixed(0)}`,
    );
  }
  console.log("largest same-q/spec score moves:");
  for (const row of [...result.paired_by_spec_vs_same_q_x1]
    .filter((item) => item.cc_explore !== baselineExplore)
    .sort((a, b) => Math.abs(b.score_delta_mean) - Math.abs(a.score_delta_mean))
    .slice(0, 10)) {
    console.log(
      `  q=${row.q} x=${row.cc_explore.toFixed(2)} ${row.spec} ` +
        `dScore=${row.score_delta_mean.toFixed(2)} first=${fmt(row.first_ratio_mean, 3)} ` +
        `cand=${fmt(row.candidate_ratio_mean, 3)}`,
    );
  }
}

function inputList(): string[] {
  const inputs = arg("inputs");
  if (inputs !== undefined && inputs.trim() !== "") {
    return inputs.split(",").filter((path) => path.trim() !== "");
  }
  const dir = arg("dir");
  if (dir === undefined || dir.trim() === "") return [];
  const shardDir = join(dir, "shards");
  try {
    return readdirSync(shardDir)
      .filter((name) => name.endsWith(".json"))
      .map((name) => join(shardDir, name));
  } catch {
    return readdirSync(dir)
      .filter((name) => name.endsWith(".json"))
      .map((name) => join(dir, name));
  }
}

function readStudy(path: string): StudyFile {
  const study = JSON.parse(readFileSync(path, "utf8")) as StudyFile;
  if (study.config?.study !== "cc_explore" || !Array.isArray(study.rows)) {
    throw new Error(`not a cc_explore study file: ${path}`);
  }
  return study;
}

function dedupeRows(values: readonly Row[]): Row[] {
  const byKey = new Map<string, Row>();
  for (const row of values) byKey.set(rowKey(row.spec, row.seed, row.quality_ncand, row.cc_explore), row);
  return [...byKey.values()];
}

function rowKey(spec: string, seed: number, q: number, ccExplore: number): string {
  return `${spec}|${seed}|${q}|${ccExplore}`;
}

function groupRows<T>(values: readonly T[], keyOf: (value: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const value of values) {
    const key = keyOf(value);
    groups.set(key, [...(groups.get(key) ?? []), value]);
  }
  return groups;
}

function compareGridKey(a: string, b: string): number {
  const [aq, ax] = a.split("|").map(Number);
  const [bq, bx] = b.split("|").map(Number);
  return aq === bq ? ax - bx : aq - bq;
}

function comparePairKey(a: string, b: string): number {
  const [aq, ax, abq, abx] = a.split("|").map(Number);
  const [bq, bx, bbq, bbx] = b.split("|").map(Number);
  return aq === bq
    ? ax === bx
      ? abq === bbq ? abx - bbx : abq - bbq
      : ax - bx
    : aq - bq;
}

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

function mean(values: readonly number[]): number {
  return values.length === 0 ? NaN : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function meanNullable(values: readonly (number | null)[]): number | null {
  const finite = values.filter((value): value is number => value !== null && Number.isFinite(value));
  return finite.length === 0 ? null : round(mean(finite), 4);
}

function quantile(values: readonly number[], q: number): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  const frac = pos - lo;
  return sorted[lo] * (1 - frac) + sorted[hi] * frac;
}

function round(value: number, digits = 3): number {
  if (!Number.isFinite(value)) return value;
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function fmt(value: number | null, digits = 1): string {
  return value === null || !Number.isFinite(value) ? "na" : value.toFixed(digits);
}
