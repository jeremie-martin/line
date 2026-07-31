/**
 * Lab dataset schema — an indexed SQLite extraction of generated/golden-runs.
 *
 * Tiers:
 *   runs           one row per run dir (from golden.json aggregate)
 *   budget_scores  run × budget suite score
 *   spec_scores    run × budget × spec score (loss-attribution backbone)
 *   checkpoints    run × spec × variant × seed × budget (the dedup key)
 *   gaps           per-gap axis measurements (wide: one column set per axis)
 *   arcs           per-arc track geometry (chains of connected line segments),
 *                  paired to gaps via contact_index when the pairing is clean
 *   ingest_issues  every skipped/corrupt file — ingest never crashes
 *
 * checkpoints.compile_stats_json is a raw JSON blob, queryable with SQLite
 * JSON1: json_extract(compile_stats_json, '$.handoff_brake_successes').
 *
 * Versioning: SCHEMA_VERSION mismatch ⇒ drop + full rebuild (rebuild < 2 min,
 * so there is deliberately no migration framework).
 */

import { AXES } from "../types.ts";

export const SCHEMA_VERSION = 2;

const axisColumns = AXES.flatMap((axis) => [
  `${axis}_target REAL`,
  `${axis}_achieved REAL`,
  `${axis}_error REAL`,
]).join(",\n  ");

export const DDL = `
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS runs (
  run_id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  dir TEXT NOT NULL,
  tier TEXT,
  canonical INTEGER,
  compiler TEXT,
  evaluator_fingerprint TEXT,
  source_commit TEXT,
  source_dirty INTEGER,
  headline_score REAL,
  score_without_impact REAL,
  n_seeds INTEGER,
  headline_specs INTEGER,
  seed_count INTEGER,
  row_count INTEGER,
  checkpoint_count INTEGER,
  budgets_json TEXT,
  weights_json TEXT,
  golden_mtime_ms INTEGER NOT NULL,
  checkpoint_file_count INTEGER NOT NULL,
  indexed_at TEXT NOT NULL,
  n_reports_ok INTEGER NOT NULL DEFAULT 0,
  n_reports_skipped INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS budget_scores (
  run_id INTEGER NOT NULL REFERENCES runs(run_id),
  budget INTEGER NOT NULL,
  score REAL,
  passed INTEGER,
  total INTEGER,
  contract_pass_rate REAL,
  PRIMARY KEY (run_id, budget)
);

CREATE TABLE IF NOT EXISTS spec_scores (
  run_id INTEGER NOT NULL REFERENCES runs(run_id),
  budget INTEGER NOT NULL,
  spec TEXT NOT NULL,
  score REAL,
  passed INTEGER,
  total INTEGER,
  PRIMARY KEY (run_id, budget, spec)
);

CREATE TABLE IF NOT EXISTS checkpoints (
  checkpoint_id INTEGER PRIMARY KEY,
  run_id INTEGER NOT NULL REFERENCES runs(run_id),
  spec TEXT NOT NULL,
  variant TEXT NOT NULL DEFAULT 'base',
  seed INTEGER NOT NULL,
  budget INTEGER NOT NULL,
  status TEXT,
  score REAL,
  contract_passed INTEGER,
  contacts INTEGER,
  hits INTEGER,
  drift INTEGER,
  missing INTEGER,
  axis_quality REAL,
  axis_loss REAL,
  axis_error_rms REAL,
  elapsed_ms REAL,
  track_hash TEXT,
  track_path TEXT,
  report_path TEXT,
  has_report INTEGER NOT NULL DEFAULT 0,
  terminus_frame INTEGER,
  terminus_reason TEXT,
  n_off_beat INTEGER,
  n_gaps INTEGER,
  n_arcs INTEGER,
  arc_pairing_confident INTEGER,
  compile_stats_json TEXT,
  UNIQUE (run_id, spec, variant, seed, budget)
);

CREATE TABLE IF NOT EXISTS gaps (
  checkpoint_id INTEGER NOT NULL REFERENCES checkpoints(checkpoint_id),
  gap_index INTEGER NOT NULL,
  t_end REAL,
  survived INTEGER,
  ${axisColumns},
  impact_ceiling REAL,
  elevation_ceiling REAL,
  speed_raw_achieved REAL,
  PRIMARY KEY (checkpoint_id, gap_index)
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS arcs (
  checkpoint_id INTEGER NOT NULL REFERENCES checkpoints(checkpoint_id),
  arc_index INTEGER NOT NULL,
  -- gap/contact this arc catches (= gaps.gap_index); NULL when unpaired.
  -- Trust checkpoints.arc_pairing_confident before leaning on it.
  contact_index INTEGER,
  is_start INTEGER NOT NULL DEFAULT 0,
  n_segments INTEGER NOT NULL,
  x_start REAL, y_start REAL, x_end REAL, y_end REAL,
  path_len REAL,
  chord_len REAL,
  -- chord/path: 1 = perfectly straight, lower = more curved
  straightness REAL,
  -- segment tangents in degrees; positive = descending (LR screen +y is down).
  -- entry_angle_deg is the slope the rider lands on (landing tangent).
  entry_angle_deg REAL,
  exit_angle_deg REAL,
  -- total signed turn along the arc (sum of direction deltas between
  -- consecutive segments); positive = steepening downward, negative =
  -- flattening out (a scoop that redirects descent into forward speed).
  turn_deg REAL,
  descent REAL,
  PRIMARY KEY (checkpoint_id, arc_index)
) WITHOUT ROWID;

-- Landing dynamics from on-demand re-simulation (\`lab simulate\`), one row per
-- detector landing event. Additive tier: populated per run, not at index time.
CREATE TABLE IF NOT EXISTS landings (
  checkpoint_id INTEGER NOT NULL REFERENCES checkpoints(checkpoint_id),
  landing_index INTEGER NOT NULL,
  frame INTEGER NOT NULL,
  t_sec REAL NOT NULL,
  -- gap whose contact this landing realizes (frame within ±2 of gaps.t_end);
  -- NULL for off-beat/unmatched landings.
  contact_index INTEGER,
  air_frames INTEGER,
  speed_in_px REAL,
  vx_in REAL,
  vy_in REAL,
  speed_out_px REAL,
  -- speed_out − speed_in over the impact window: the landing's speed cost
  dspeed_px REAL,
  -- the SCORED impact metric at this landing: redir_px is the raw production
  -- measurement (px/frame) and redir_norm is normImpact(redir_px) — i.e. against
  -- REDIRARC.SOFT/VERY_STRONG, NOT REDIR_CAP. The metric itself moved on
  -- 2026-07-31 (net-form redirArc = v·Δθ → accumulated contacted-frame impulse
  -- Σ v̄·|Δθ|), so rows written on either side of that boundary are NOT comparable.
  -- Which ruler a row is on is recoverable: checkpoints.run_id → runs.evaluator_fingerprint
  -- (the promotion bumped it 6f760d9c1cc9 → afbdb18787e6). Canned reports are
  -- single-fingerprint by default; only --all-fingerprints can mix. See analysis/simulate.ts.
  redir_px REAL,
  redir_norm REAL,
  PRIMARY KEY (checkpoint_id, landing_index)
) WITHOUT ROWID;

-- Checkpoints already re-simulated (so empty results aren't redone).
CREATE TABLE IF NOT EXISTS simulated (
  checkpoint_id INTEGER PRIMARY KEY REFERENCES checkpoints(checkpoint_id),
  at TEXT NOT NULL,
  n_landings INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS ingest_issues (
  issue_id INTEGER PRIMARY KEY,
  run_name TEXT,
  path TEXT,
  stage TEXT NOT NULL,
  error TEXT NOT NULL,
  at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_checkpoints_run ON checkpoints(run_id);
CREATE INDEX IF NOT EXISTS idx_arcs_checkpoint ON arcs(checkpoint_id);
CREATE INDEX IF NOT EXISTS idx_checkpoints_spec_budget ON checkpoints(spec, budget);
CREATE INDEX IF NOT EXISTS idx_spec_scores_run_budget ON spec_scores(run_id, budget);
`;
