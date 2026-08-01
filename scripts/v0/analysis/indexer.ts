/**
 * Lab indexer — one pass over golden-run archives into the lab SQLite dataset.
 *
 * Incremental: a run is re-ingested only when its golden.json mtime or its
 * checkpoint file count changed since last index. Vanished run dirs are pruned.
 * Corrupt/missing files are logged to ingest_issues and skipped — never fatal.
 *
 * Read-only with respect to the archives; deterministic ingest order (sorted
 * dir names, golden.json row order) so two rebuilds of the same archives give
 * identical query results.
 */

import type { DatabaseSync } from "node:sqlite";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { AXES } from "../types.ts";
import { EVALUATOR_FINGERPRINT } from "../golden_suite.ts";
import { setMeta } from "./db.ts";
import { extractTrackArcs } from "./geometry.ts";

export const DEFAULT_ROOT = resolve(import.meta.dirname, "../../../generated/golden-runs");
export const OLD_ROOTS = [1, 2, 3, 4].map((n) =>
  resolve(import.meta.dirname, `../../../generated/golden-runs-old${n === 1 ? "" : n}`),
);

export type IndexOptions = {
  roots?: string[];
  includeOld?: boolean;
  /** Re-ingest every run even if it looks unchanged. */
  full?: boolean;
  log?: (msg: string) => void;
};

export type IndexStats = {
  scanned: number;
  ingested: number;
  skipped: number;
  pruned: number;
  issues: number;
  reports_ok: number;
  reports_skipped: number;
};

export function indexRoots(db: DatabaseSync, opts: IndexOptions = {}): IndexStats {
  const log = opts.log ?? (() => {});
  const roots = opts.roots ?? [DEFAULT_ROOT, ...(opts.includeOld ? OLD_ROOTS : [])];
  const now = new Date().toISOString();
  const stats: IndexStats = {
    scanned: 0, ingested: 0, skipped: 0, pruned: 0,
    issues: 0, reports_ok: 0, reports_skipped: 0,
  };

  // Issues describe the archive as of the latest index pass — stale rows from
  // prior passes (e.g. a since-fixed run) would otherwise accumulate forever.
  db.exec("DELETE FROM ingest_issues");
  const issueStmt = db.prepare(
    "INSERT INTO ingest_issues (run_name, path, stage, error, at) VALUES (?, ?, ?, ?, ?)",
  );
  const issue = (runName: string | null, path: string | null, stage: string, error: unknown) => {
    issueStmt.run(runName, path, stage, String(error instanceof Error ? error.message : error), now);
    stats.issues++;
  };

  const seen = new Set<string>();
  for (const root of roots) {
    if (!existsSync(root)) {
      issue(null, root, "root", "root directory does not exist");
      continue;
    }
    const dirs = readdirSync(root, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();
    for (const name of dirs) {
      const dir = join(root, name);
      stats.scanned++;
      seen.add(name);
      try {
        indexRun(db, { name, dir, now, full: opts.full ?? false, stats, issue, log });
      } catch (err) {
        // Last-resort guard: a half-ingested run is rolled back and logged.
        try { db.exec("ROLLBACK"); } catch { /* no open transaction */ }
        issue(name, dir, "run", err);
      }
    }
  }

  // Prune runs whose dirs vanished (renamed/deleted archives).
  const known = db.prepare("SELECT run_id, name, dir FROM runs").all() as
    { run_id: number; name: string; dir: string }[];
  for (const run of known) {
    if (!seen.has(run.name) && !existsSync(run.dir)) {
      deleteRun(db, run.run_id);
      stats.pruned++;
      log(`pruned ${run.name}`);
    }
  }

  setMeta(db, "current_fingerprint", EVALUATOR_FINGERPRINT);
  setMeta(db, "indexed_at", now);
  return stats;
}

function deleteRun(db: DatabaseSync, runId: number): void {
  db.prepare(
    "DELETE FROM gaps WHERE checkpoint_id IN (SELECT checkpoint_id FROM checkpoints WHERE run_id = ?)",
  ).run(runId);
  db.prepare(
    "DELETE FROM arcs WHERE checkpoint_id IN (SELECT checkpoint_id FROM checkpoints WHERE run_id = ?)",
  ).run(runId);
  db.prepare(
    "DELETE FROM landings WHERE checkpoint_id IN (SELECT checkpoint_id FROM checkpoints WHERE run_id = ?)",
  ).run(runId);
  db.prepare(
    "DELETE FROM simulated WHERE checkpoint_id IN (SELECT checkpoint_id FROM checkpoints WHERE run_id = ?)",
  ).run(runId);
  db.prepare("DELETE FROM checkpoints WHERE run_id = ?").run(runId);
  db.prepare("DELETE FROM spec_scores WHERE run_id = ?").run(runId);
  db.prepare("DELETE FROM budget_scores WHERE run_id = ?").run(runId);
  db.prepare("DELETE FROM runs WHERE run_id = ?").run(runId);
}

type RunContext = {
  name: string;
  dir: string;
  now: string;
  full: boolean;
  stats: IndexStats;
  issue: (runName: string | null, path: string | null, stage: string, error: unknown) => void;
  log: (msg: string) => void;
};

function countCheckpointFiles(dir: string): number {
  const cpDir = join(dir, "checkpoints");
  if (!existsSync(cpDir)) return 0;
  return readdirSync(cpDir).length;
}

function indexRun(db: DatabaseSync, ctx: RunContext): void {
  const goldenPath = join(ctx.dir, "golden.json");
  if (!existsSync(goldenPath)) {
    ctx.issue(ctx.name, goldenPath, "golden", "golden.json missing");
    ctx.stats.skipped++;
    return;
  }
  const mtimeMs = Math.round(statSync(goldenPath).mtimeMs);
  const fileCount = countCheckpointFiles(ctx.dir);

  const existing = db
    .prepare("SELECT run_id, golden_mtime_ms, checkpoint_file_count FROM runs WHERE name = ?")
    .get(ctx.name) as
    | { run_id: number; golden_mtime_ms: number; checkpoint_file_count: number }
    | undefined;
  if (
    !ctx.full &&
    existing !== undefined &&
    existing.golden_mtime_ms === mtimeMs &&
    existing.checkpoint_file_count === fileCount
  ) {
    ctx.stats.skipped++;
    return;
  }

  let golden: any;
  try {
    golden = JSON.parse(readFileSync(goldenPath, "utf8"));
  } catch (err) {
    ctx.issue(ctx.name, goldenPath, "golden", err);
    ctx.stats.skipped++;
    return;
  }

  db.exec("BEGIN");
  if (existing !== undefined) deleteRun(db, existing.run_id);

  const headline = golden.headline ?? {};
  const scope = golden.scope ?? {};
  const runInfo = db.prepare(`
    INSERT INTO runs (
      name, dir, tier, canonical, compiler, evaluator_fingerprint,
      source_commit, source_dirty, headline_score, score_without_impact,
      n_seeds, headline_specs, seed_count, row_count, checkpoint_count,
      budgets_json, weights_json, golden_mtime_ms, checkpoint_file_count, indexed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    ctx.name, ctx.dir,
    headline.tier ?? null,
    golden.canonical === true ? 1 : golden.canonical === false ? 0 : null,
    golden.compiler ?? null,
    golden.evaluator_fingerprint ?? null,
    golden.source?.commit ?? null,
    golden.source?.dirty === true ? 1 : golden.source?.dirty === false ? 0 : null,
    headline.score ?? null,
    headline.score_without_impact ?? null,
    headline.n_seeds ?? null,
    scope.headline_specs ?? null,
    scope.seed_count ?? null,
    scope.row_count ?? null,
    scope.checkpoint_count ?? null,
    golden.budgets !== undefined ? JSON.stringify(golden.budgets) : null,
    headline.weight_by_budget !== undefined ? JSON.stringify(headline.weight_by_budget) : null,
    mtimeMs, fileCount, ctx.now,
  );
  const runId = Number(runInfo.lastInsertRowid);

  const budgetStmt = db.prepare(`
    INSERT INTO budget_scores (run_id, budget, score, passed, total, contract_pass_rate)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const specStmt = db.prepare(`
    INSERT INTO spec_scores (run_id, budget, spec, score, passed, total)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  for (const bs of golden.budget_scores ?? []) {
    budgetStmt.run(
      runId, bs.budget, bs.score ?? null, bs.passed ?? null, bs.total ?? null,
      bs.contract_pass_rate ?? null,
    );
    for (const ss of bs.spec_scores ?? []) {
      specStmt.run(runId, bs.budget, ss.name, ss.score ?? null, ss.passed ?? null, ss.total ?? null);
    }
  }

  const cpStmt = db.prepare(`
    INSERT INTO checkpoints (
      run_id, spec, variant, seed, budget, status, score, contract_passed,
      contacts, hits, drift, missing, axis_quality, axis_loss, axis_error_rms,
      elapsed_ms, track_hash, track_path, report_path, has_report,
      terminus_frame, terminus_reason, n_off_beat, n_gaps,
      n_arcs, arc_pairing_confident, compile_stats_json, budget_telemetry_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const arcStmt = db.prepare(`
    INSERT INTO arcs (
      checkpoint_id, arc_index, contact_index, is_start, n_segments,
      x_start, y_start, x_end, y_end, path_len, chord_len, straightness,
      entry_angle_deg, exit_angle_deg, turn_deg, descent
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const gapCols = AXES.flatMap((a) => [`${a}_target`, `${a}_achieved`, `${a}_error`]);
  const gapStmt = db.prepare(`
    INSERT INTO gaps (
      checkpoint_id, gap_index, t_end, survived,
      ${gapCols.join(", ")},
      impact_ceiling, elevation_ceiling, speed_raw_achieved
    ) VALUES (${new Array(4 + gapCols.length + 3).fill("?").join(", ")})
  `);

  let reportsOk = 0;
  let reportsSkipped = 0;
  for (const row of golden.rows ?? []) {
    for (const cp of row.checkpoints ?? []) {
      // Reports live next to golden.json; stored paths are absolute and stay
      // valid because archives are never moved (verified: track_path/report_path
      // in every sampled golden.json point inside the run dir itself).
      let report: any = null;
      const reportPath = cp.report_path ?? null;
      if (reportPath !== null) {
        try {
          report = JSON.parse(readFileSync(reportPath, "utf8"));
          reportsOk++;
        } catch (err) {
          ctx.issue(ctx.name, reportPath, "report", err);
          reportsSkipped++;
        }
      }

      let track: any = null;
      const trackPath = cp.track_path ?? null;
      if (trackPath !== null) {
        try {
          track = JSON.parse(readFileSync(trackPath, "utf8"));
        } catch (err) {
          ctx.issue(ctx.name, trackPath, "track", err);
        }
      }
      const trackArcs = track !== null
        ? extractTrackArcs(track, report?.contacts?.length ?? cp.contacts ?? 0)
        : null;

      const cpInfo = cpStmt.run(
        runId, row.name, row.variant ?? "base", row.seed ?? 0, cp.budget,
        cp.status ?? null, cp.score ?? null,
        cp.contract_passed === true ? 1 : cp.contract_passed === false ? 0 : null,
        cp.contacts ?? null, cp.hits ?? null, cp.drift ?? null, cp.missing ?? null,
        cp.axis_quality ?? null, cp.axis_loss ?? null, cp.axis_error_rms ?? null,
        cp.elapsed_ms ?? null, cp.track_hash ?? null, trackPath, reportPath,
        report !== null ? 1 : 0,
        report?.terminus?.frame ?? null, report?.terminus?.reason ?? null,
        report !== null ? (report.off_beat_landings?.length ?? 0) : null,
        report !== null ? (report.gaps?.length ?? 0) : null,
        trackArcs !== null ? trackArcs.arcs.length : null,
        trackArcs !== null ? trackArcs.pairing_confident : null,
        cp.compile_stats !== undefined ? JSON.stringify(cp.compile_stats) : null,
        cp.budget_telemetry !== undefined ? JSON.stringify(cp.budget_telemetry) : null,
      );
      const checkpointId = Number(cpInfo.lastInsertRowid);

      if (trackArcs !== null) {
        for (const arc of trackArcs.arcs) {
          arcStmt.run(
            checkpointId, arc.arc_index, arc.contact_index, arc.is_start,
            arc.n_segments, arc.x_start, arc.y_start, arc.x_end, arc.y_end,
            arc.path_len, arc.chord_len, arc.straightness,
            arc.entry_angle_deg, arc.exit_angle_deg, arc.turn_deg, arc.drop,
          );
        }
      }
      if (report === null) continue;
      for (const gap of report.gaps ?? []) {
        const values: (number | null)[] = [
          checkpointId,
          gap.gap_index,
          gap.t_end ?? null,
          gap.survived === true ? 1 : gap.survived === false ? 0 : null,
        ];
        for (const axis of AXES) {
          const v = gap.axes?.[axis];
          values.push(v?.target ?? null, v?.achieved ?? null, v?.error ?? null);
        }
        values.push(
          gap.axes?.impact?.ceiling ?? null,
          gap.axes?.elevation?.ceiling ?? null,
          gap.axes?.speed?.raw?.achieved ?? null,
        );
        gapStmt.run(...values);
      }
    }
  }

  db.prepare("UPDATE runs SET n_reports_ok = ?, n_reports_skipped = ? WHERE run_id = ?")
    .run(reportsOk, reportsSkipped, runId);
  db.exec("COMMIT");

  ctx.stats.ingested++;
  ctx.stats.reports_ok += reportsOk;
  ctx.stats.reports_skipped += reportsSkipped;
  ctx.log(`indexed ${ctx.name} (${reportsOk} reports)`);
}
