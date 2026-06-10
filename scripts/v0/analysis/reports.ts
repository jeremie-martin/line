/**
 * Canned lab reports. All read-only over the lab SQLite dataset.
 *
 * `loss` generalizes study_score_without_impact.ts: only axis_quality depends
 * on a given axis, so dropping that axis's per-gap error terms and rescaling
 * (score · aq_without / aq_with) yields the same row's score without the axis.
 * Recomputing the full headline from gap rows doubles as the ETL self-check —
 * it must reproduce the run's stored headline and score_without_impact.
 */

import type { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { AXES } from "../types.ts";
import { AXIS_QUALITY_TOLERANCE, shiftedGeometricMean } from "../score.ts";
import { suiteFromGroups, weightedBudgetScore } from "../metric.ts";
import { getMeta } from "./db.ts";

export type ReportOptions = {
  run?: string;
  axis?: string;
  spec?: string;
  json?: boolean;
  allFingerprints?: boolean;
};

type RunRow = {
  run_id: number;
  name: string;
  evaluator_fingerprint: string | null;
  headline_score: number | null;
  score_without_impact: number | null;
  budgets_json: string | null;
  weights_json: string | null;
};

export function resolveRun(db: DatabaseSync, opts: ReportOptions): RunRow {
  if (opts.run !== undefined) {
    const row = db.prepare("SELECT * FROM runs WHERE name = ?").get(opts.run) as RunRow | undefined;
    if (row === undefined) throw new Error(`run "${opts.run}" not in lab db (see \`lab runs\`)`);
    return row;
  }
  const fingerprint = getMeta(db, "current_fingerprint");
  const fpClause = opts.allFingerprints ? "" : "AND evaluator_fingerprint = ?";
  const row = db.prepare(`
    SELECT * FROM runs
    WHERE tier = 'canonical' AND headline_score IS NOT NULL ${fpClause}
    ORDER BY headline_score DESC LIMIT 1
  `).get(...(opts.allFingerprints ? [] : [fingerprint])) as RunRow | undefined;
  if (row === undefined) {
    throw new Error(
      `no canonical run found${opts.allFingerprints ? "" : ` at fingerprint ${fingerprint} (try --all-fingerprints or --run)`}`,
    );
  }
  return row;
}

const f2 = (x: number | null | undefined): string =>
  x === null || x === undefined || !Number.isFinite(x) ? "—" : x.toFixed(2);
const f3 = (x: number | null | undefined): string =>
  x === null || x === undefined || !Number.isFinite(x) ? "—" : x.toFixed(3);

export function printRows(rows: Record<string, unknown>[], json: boolean): void {
  if (json) {
    for (const row of rows) console.log(JSON.stringify(row));
    return;
  }
  if (rows.length === 0) {
    console.log("(no rows)");
    return;
  }
  const cols = Object.keys(rows[0]);
  const cells = rows.map((r) =>
    cols.map((c) => {
      const v = r[c];
      return typeof v === "number" ? (Number.isInteger(v) ? String(v) : v.toFixed(4)) : String(v ?? "—");
    }),
  );
  const widths = cols.map((c, i) => Math.max(c.length, ...cells.map((row) => row[i].length)));
  console.log(cols.map((c, i) => c.padEnd(widths[i])).join("  "));
  for (const row of cells) console.log(row.map((v, i) => v.padStart(widths[i])).join("  "));
}

function requireAxis(opts: ReportOptions): string {
  const axis = opts.axis ?? "impact";
  if (!(AXES as readonly string[]).includes(axis)) {
    throw new Error(`unknown axis "${axis}" (have: ${AXES.join(", ")})`);
  }
  return axis;
}

/** Per-checkpoint per-axis Σerror² and count, straight from the gaps tier. */
function checkpointAxisAggregates(db: DatabaseSync, runId: number) {
  const axisSelects = AXES.map(
    (a) => `SUM(g.${a}_error * g.${a}_error) AS ${a}_sq, COUNT(g.${a}_error) AS ${a}_n`,
  ).join(",\n      ");
  return db.prepare(`
    SELECT c.checkpoint_id, c.spec, c.seed, c.budget, c.score, c.axis_quality, c.has_report,
      ${axisSelects}
    FROM checkpoints c
    LEFT JOIN gaps g ON g.checkpoint_id = c.checkpoint_id
    WHERE c.run_id = ?
    GROUP BY c.checkpoint_id
    ORDER BY c.spec, c.seed, c.budget
  `).all(runId) as any[];
}

// ── loss ────────────────────────────────────────────────────────────────────

export function reportLoss(db: DatabaseSync, opts: ReportOptions): void {
  const run = resolveRun(db, opts);
  const budgets = JSON.parse(run.budgets_json ?? "[]") as number[];
  const weights = JSON.parse(run.weights_json ?? "[]") as { budget: number; weight: number }[];
  const rows = checkpointAxisAggregates(db, run.run_id);

  const aq = (sq: number, n: number): number =>
    n === 0 ? 1 : Math.exp(-Math.sqrt(sq / n) / AXIS_QUALITY_TOLERANCE);

  // variant key: "with" plus one "without_<axis>" per axis.
  const variants = ["with", ...AXES.map((a) => `without_${a}`)];
  // variant -> budget -> spec -> seed scores
  const acc = new Map<string, Map<number, Map<string, number[]>>>();
  for (const v of variants) acc.set(v, new Map(budgets.map((b) => [b, new Map()])));
  const push = (variant: string, budget: number, spec: string, score: number) => {
    const bySpec = acc.get(variant)!.get(budget);
    if (bySpec === undefined) return;
    const arr = bySpec.get(spec) ?? [];
    arr.push(score);
    bySpec.set(spec, arr);
  };

  let aqCheckMax = 0;
  let noReport = 0;
  for (const cp of rows) {
    if (!budgets.includes(cp.budget)) continue;
    const score = cp.score ?? 0;
    let totalSq = 0;
    let totalN = 0;
    for (const a of AXES) {
      totalSq += cp[`${a}_sq`] ?? 0;
      totalN += cp[`${a}_n`] ?? 0;
    }
    push("with", cp.budget, cp.spec, score);
    if (cp.has_report !== 1 || totalN === 0) {
      noReport++;
      for (const a of AXES) push(`without_${a}`, cp.budget, cp.spec, score);
      continue;
    }
    const aqFull = aq(totalSq, totalN);
    if (cp.axis_quality > 1e-9) {
      aqCheckMax = Math.max(aqCheckMax, Math.abs(aqFull - cp.axis_quality));
    }
    for (const a of AXES) {
      const without = aq(totalSq - (cp[`${a}_sq`] ?? 0), totalN - (cp[`${a}_n`] ?? 0));
      const scoreWithout = cp.axis_quality > 1e-9 ? score * (without / cp.axis_quality) : score;
      push(`without_${a}`, cp.budget, cp.spec, scoreWithout);
    }
  }

  const headlineOf = (variant: string): number => {
    const byBudget = acc.get(variant)!;
    const points = budgets.map((b) => ({
      budget: b,
      score: suiteFromGroups([...byBudget.get(b)!.values()]),
    }));
    return weightedBudgetScore(points, weights);
  };
  const specScoreOf = (variant: string, spec: string): number => {
    const byBudget = acc.get(variant)!;
    const points = budgets.map((b) => ({
      budget: b,
      score: shiftedGeometricMean(byBudget.get(b)!.get(spec) ?? []),
    }));
    return weightedBudgetScore(points, weights);
  };

  const headlineWith = headlineOf("with");
  console.log(`run: ${run.name}`);
  console.log(`checkpoints: ${rows.length} (${noReport} without report — counted at stored score)`);
  console.log(`self-check: max|recomputed axis_quality − stored| = ${aqCheckMax.toExponential(2)}`);
  console.log(
    `self-check: recomputed headline ${f2(headlineWith)} vs stored ${f2(run.headline_score)}` +
      ` · without-impact ${f2(headlineOf("without_impact"))} vs stored ${f2(run.score_without_impact)}`,
  );

  console.log("\nheadline lift from dropping each axis (cost the axis imposes):");
  const axisRows = AXES.map((a) => ({
    axis: a,
    headline_without: headlineOf(`without_${a}`),
    cost: headlineOf(`without_${a}`) - headlineWith,
  })).sort((x, y) => y.cost - x.cost);
  printRows(axisRows, opts.json ?? false);

  const specs = [...new Set(rows.map((r) => r.spec))].sort();
  const axis = requireAxis(opts);
  console.log(`\nper-spec cost (sorted by ${axis}):`);
  const specRows = specs
    .map((spec) => {
      const withScore = specScoreOf("with", spec);
      const out: Record<string, number | string> = { spec, score: withScore };
      for (const a of AXES) {
        const delta = specScoreOf(`without_${a}`, spec) - withScore;
        if (Math.abs(delta) > 1e-9 || a === axis) out[`cost_${a}`] = delta;
      }
      return out;
    })
    .sort((x, y) => Number(y[`cost_${axis}`] ?? 0) - Number(x[`cost_${axis}`] ?? 0));
  printRows(specRows, opts.json ?? false);
}

// ── axis-vs-target ──────────────────────────────────────────────────────────

export function reportAxisVsTarget(db: DatabaseSync, opts: ReportOptions): void {
  const run = resolveRun(db, opts);
  const axis = requireAxis(opts);
  console.log(`run: ${run.name} · axis: ${axis} · error binned by target decile`);
  const rows = db.prepare(`
    SELECT
      CAST(MIN(9, CAST(g.${axis}_target * 10 AS INTEGER)) AS INTEGER) AS target_decile,
      COUNT(*) AS n,
      AVG(g.${axis}_target) AS avg_target,
      AVG(g.${axis}_achieved) AS avg_achieved,
      AVG(g.${axis}_achieved - g.${axis}_target) AS bias,
      AVG(g.${axis}_error) AS avg_error,
      SQRT(AVG(g.${axis}_error * g.${axis}_error)) AS rms_error
    FROM gaps g
    JOIN checkpoints c ON c.checkpoint_id = g.checkpoint_id
    WHERE c.run_id = ? AND g.${axis}_target IS NOT NULL
    GROUP BY target_decile
    ORDER BY target_decile
  `).all(run.run_id) as Record<string, unknown>[];
  printRows(rows, opts.json ?? false);
}

// ── ceiling ─────────────────────────────────────────────────────────────────

export function reportCeiling(db: DatabaseSync, opts: ReportOptions): void {
  const run = resolveRun(db, opts);
  const axis = requireAxis(opts);
  if (axis !== "impact" && axis !== "elevation") {
    throw new Error(`ceiling report only applies to impact/elevation, got "${axis}"`);
  }
  const col = `${axis}_ceiling`;
  console.log(
    `run: ${run.name} · axis: ${axis}\n` +
      `clamped = target sits at the feasibility ceiling (authored ask was infeasible, target was lowered)\n` +
      `at_ceiling = achieved ≥ 95% of ceiling (compiler maxed out what physics allows)`,
  );
  const rows = db.prepare(`
    SELECT c.spec,
      COUNT(*) AS n,
      AVG(g.${col}) AS avg_ceiling,
      AVG(g.${axis}_target) AS avg_target,
      AVG(g.${axis}_achieved) AS avg_achieved,
      AVG(CASE WHEN g.${axis}_target >= g.${col} - 1e-9 THEN 1.0 ELSE 0.0 END) AS clamped_frac,
      AVG(CASE WHEN g.${axis}_achieved >= 0.95 * g.${col} THEN 1.0 ELSE 0.0 END) AS at_ceiling_frac,
      AVG(g.${axis}_error) AS avg_error
    FROM gaps g
    JOIN checkpoints c ON c.checkpoint_id = g.checkpoint_id
    WHERE c.run_id = ? AND g.${axis}_target IS NOT NULL AND g.${col} IS NOT NULL
    GROUP BY c.spec
    ORDER BY clamped_frac DESC
  `).all(run.run_id) as Record<string, unknown>[];
  printRows(rows, opts.json ?? false);
}

// ── interference ────────────────────────────────────────────────────────────

function corrFromSums(s: { n: number; sx: number; sy: number; sxy: number; sxx: number; syy: number }): number {
  const { n, sx, sy, sxy, sxx, syy } = s;
  if (n < 3) return NaN;
  const cov = sxy - (sx * sy) / n;
  const vx = sxx - (sx * sx) / n;
  const vy = syy - (sy * sy) / n;
  return vx > 0 && vy > 0 ? cov / Math.sqrt(vx * vy) : NaN;
}

export function reportInterference(db: DatabaseSync, opts: ReportOptions): void {
  const run = resolveRun(db, opts);
  const axis = requireAxis(opts);
  const others = AXES.filter((a) => a !== axis);
  console.log(
    `run: ${run.name} · Pearson corr of ${axis}_error vs other axes' error, within the same gap\n` +
      `(positive = where ${axis} misses, the other axis misses too — shared failure; near 0 = independent)`,
  );
  const rows: Record<string, unknown>[] = [];
  for (const other of others) {
    const sums = db.prepare(`
      SELECT COUNT(*) AS n,
        SUM(x) AS sx, SUM(y) AS sy, SUM(x * y) AS sxy, SUM(x * x) AS sxx, SUM(y * y) AS syy,
        SUM(xs) AS _sx2, SUM(ys) AS _sy2, SUM(xs * ys) AS sxys, SUM(xs * xs) AS sxxs, SUM(ys * ys) AS syys
      FROM (
        SELECT g.${axis}_error AS x, g.${other}_error AS y,
               g.${axis}_achieved - g.${axis}_target AS xs, g.${other}_achieved - g.${other}_target AS ys
        FROM gaps g
        JOIN checkpoints c ON c.checkpoint_id = g.checkpoint_id
        WHERE c.run_id = ? AND g.${axis}_error IS NOT NULL AND g.${other}_error IS NOT NULL
      )
    `).get(run.run_id) as any;
    if (sums === undefined || sums.n === 0) continue;
    rows.push({
      vs: other,
      n: sums.n,
      corr_error: corrFromSums(sums),
      corr_signed_deviation: corrFromSums({
        n: sums.n, sx: sums._sx2, sy: sums._sy2, sxy: sums.sxys, sxx: sums.sxxs, syy: sums.syys,
      }),
    });
  }
  printRows(rows, opts.json ?? false);
}

// ── position ────────────────────────────────────────────────────────────────

export function reportPosition(db: DatabaseSync, opts: ReportOptions): void {
  const run = resolveRun(db, opts);
  const axis = requireAxis(opts);
  console.log(`run: ${run.name} · ${axis} error by normalized gap position (0 = first gap, 9 = last)`);
  const rows = db.prepare(`
    SELECT
      CAST(MIN(9, CAST(g.gap_index * 10.0 / MAX(1, c.n_gaps) AS INTEGER)) AS INTEGER) AS position_bin,
      COUNT(*) AS n,
      AVG(g.${axis}_target) AS avg_target,
      AVG(g.${axis}_achieved - g.${axis}_target) AS bias,
      AVG(g.${axis}_error) AS avg_error,
      SQRT(AVG(g.${axis}_error * g.${axis}_error)) AS rms_error
    FROM gaps g
    JOIN checkpoints c ON c.checkpoint_id = g.checkpoint_id
    WHERE c.run_id = ? AND g.${axis}_error IS NOT NULL
    GROUP BY position_bin
    ORDER BY position_bin
  `).all(run.run_id) as Record<string, unknown>[];
  printRows(rows, opts.json ?? false);
}

// ── speed-impact (PoC: cross-axis physics at gap level, pure SQL) ───────────

export function reportSpeedImpact(db: DatabaseSync, opts: ReportOptions): void {
  const run = resolveRun(db, opts);
  console.log(
    `run: ${run.name} · impact outcome by raw landing-approach speed (px/frame deciles)\n` +
      `(tests "impact needs speed": if high speed ⇒ high achieved impact, slow gaps can't hit high targets)`,
  );
  const bounds = db.prepare(`
    SELECT MIN(g.speed_raw_achieved) AS lo, MAX(g.speed_raw_achieved) AS hi
    FROM gaps g JOIN checkpoints c ON c.checkpoint_id = g.checkpoint_id
    WHERE c.run_id = ? AND g.impact_target IS NOT NULL AND g.speed_raw_achieved IS NOT NULL
  `).get(run.run_id) as { lo: number | null; hi: number | null };
  if (bounds.lo === null || bounds.hi === null || bounds.hi <= bounds.lo) {
    console.log("(no impact-targeted gaps with raw speed)");
    return;
  }
  const rows = db.prepare(`
    SELECT
      CAST(MIN(9, CAST((g.speed_raw_achieved - ?) * 10.0 / ? AS INTEGER)) AS INTEGER) AS speed_bin,
      COUNT(*) AS n,
      AVG(g.speed_raw_achieved) AS avg_speed_px,
      AVG(g.impact_target) AS avg_target,
      AVG(g.impact_achieved) AS avg_achieved,
      AVG(g.impact_achieved - g.impact_target) AS bias,
      AVG(g.impact_error) AS avg_error,
      AVG(g.impact_ceiling) AS avg_ceiling
    FROM gaps g
    JOIN checkpoints c ON c.checkpoint_id = g.checkpoint_id
    WHERE c.run_id = ? AND g.impact_target IS NOT NULL AND g.speed_raw_achieved IS NOT NULL
    GROUP BY speed_bin
    ORDER BY speed_bin
  `).all(bounds.lo, bounds.hi - bounds.lo, run.run_id) as Record<string, unknown>[];
  printRows(rows, opts.json ?? false);

  const sums = db.prepare(`
    SELECT COUNT(*) AS n, SUM(x) AS sx, SUM(y) AS sy, SUM(x*y) AS sxy, SUM(x*x) AS sxx, SUM(y*y) AS syy
    FROM (
      SELECT g.speed_raw_achieved AS x, g.impact_achieved AS y
      FROM gaps g JOIN checkpoints c ON c.checkpoint_id = g.checkpoint_id
      WHERE c.run_id = ? AND g.impact_target IS NOT NULL AND g.speed_raw_achieved IS NOT NULL
    )
  `).get(run.run_id) as any;
  console.log(`\ncorr(raw speed, impact_achieved) = ${f3(corrFromSums(sums))} over ${sums.n} gaps`);
}

// ── geometry (PoC: on-demand track.json join, no geometry indexing) ─────────

type TrackFeatures = {
  n_lines: number;
  total_len: number;
  mean_seg_len: number;
  mean_abs_angle_deg: number;
  steep_frac: number;
};

function trackFeatures(path: string): TrackFeatures | null {
  let track: any;
  try {
    track = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
  const lines = track.lines ?? [];
  if (lines.length === 0) return null;
  let totalLen = 0;
  let angleSum = 0;
  let steep = 0;
  for (const l of lines) {
    const dx = l.x2 - l.x1;
    const dy = l.y2 - l.y1;
    totalLen += Math.hypot(dx, dy);
    const angle = Math.abs(Math.atan2(Math.abs(dy), Math.abs(dx))) * (180 / Math.PI);
    angleSum += angle;
    if (angle > 30) steep++;
  }
  return {
    n_lines: lines.length,
    total_len: totalLen,
    mean_seg_len: totalLen / lines.length,
    mean_abs_angle_deg: angleSum / lines.length,
    steep_frac: steep / lines.length,
  };
}

function pearson(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 3) return NaN;
  let sx = 0, sy = 0, sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    sx += xs[i]; sy += ys[i]; sxy += xs[i] * ys[i]; sxx += xs[i] * xs[i]; syy += ys[i] * ys[i];
  }
  return corrFromSums({ n, sx, sy, sxy, sxx, syy });
}

export function reportGeometry(db: DatabaseSync, opts: ReportOptions): void {
  const run = resolveRun(db, opts);
  const budgets = JSON.parse(run.budgets_json ?? "[]") as number[];
  const topBudget = budgets.length > 0 ? Math.max(...budgets) : null;
  const specClause = opts.spec !== undefined ? "AND c.spec = ?" : "";
  const params: (string | number)[] = [run.run_id];
  if (topBudget !== null) params.push(topBudget);
  if (opts.spec !== undefined) params.push(opts.spec);
  const checkpoints = db.prepare(`
    SELECT c.checkpoint_id, c.spec, c.seed, c.track_path,
      AVG(g.impact_achieved) AS avg_impact_achieved,
      AVG(g.impact_error) AS avg_impact_error,
      COUNT(g.impact_error) AS n_impact_gaps
    FROM checkpoints c
    JOIN gaps g ON g.checkpoint_id = c.checkpoint_id
    WHERE c.run_id = ? ${topBudget !== null ? "AND c.budget = ?" : ""} ${specClause}
      AND c.track_path IS NOT NULL AND g.impact_error IS NOT NULL
    GROUP BY c.checkpoint_id
  `).all(...params) as any[];

  console.log(
    `run: ${run.name} · budget ${topBudget ?? "all"}${opts.spec !== undefined ? ` · spec ${opts.spec}` : ""}\n` +
      `on-demand track.json geometry vs per-checkpoint impact (PoC for full geometry analysis)`,
  );

  const featureNames = ["n_lines", "total_len", "mean_seg_len", "mean_abs_angle_deg", "steep_frac"] as const;
  const feats: TrackFeatures[] = [];
  const achieved: number[] = [];
  const errors: number[] = [];
  let missingTracks = 0;
  for (const cp of checkpoints) {
    const ft = trackFeatures(cp.track_path);
    if (ft === null) {
      missingTracks++;
      continue;
    }
    feats.push(ft);
    achieved.push(cp.avg_impact_achieved);
    errors.push(cp.avg_impact_error);
  }
  console.log(`checkpoints with impact gaps: ${checkpoints.length} · tracks loaded: ${feats.length} · unreadable: ${missingTracks}`);
  if (feats.length < 3) {
    console.log("(not enough data — try without --spec)");
    return;
  }
  const rows = featureNames.map((name) => ({
    feature: name,
    mean: feats.reduce((s, x) => s + x[name], 0) / feats.length,
    corr_vs_impact_achieved: pearson(feats.map((x) => x[name]), achieved),
    corr_vs_impact_error: pearson(feats.map((x) => x[name]), errors),
  }));
  printRows(rows, opts.json ?? false);
}

export const REPORTS: Record<string, (db: DatabaseSync, opts: ReportOptions) => void> = {
  loss: reportLoss,
  "axis-vs-target": reportAxisVsTarget,
  ceiling: reportCeiling,
  interference: reportInterference,
  position: reportPosition,
  "speed-impact": reportSpeedImpact,
  geometry: reportGeometry,
};
