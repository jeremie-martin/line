/**
 * On-demand rider-dynamics tier: re-simulate archived tracks with the real
 * engine and store one row per landing event (speed in/out, redirection,
 * air time), paired to the gap whose contact it realizes.
 *
 * Uses the SAME production machinery as the scorer (extractRawTrajectory,
 * detect, redirImpactPxAtLanding), so redir_norm here agrees with the
 * impact axis by construction. ~10 ms per track ⇒ ~1 min per full run.
 *
 * Incremental per checkpoint via the `simulated` marker table; a run that is
 * re-ingested by the indexer drops its markers and landings automatically.
 */

import type { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { LineRiderEngine, createLineFromJson } from "../../lib/_lr_engine.ts";
import { extractRawTrajectory, detect } from "../../lib/detector.ts";
import { redirArcPxAtLanding } from "../core/substrate.ts";
import { FPS, IMPACT_WINDOW, normImpact } from "../types.ts";

export type SimulateOptions = {
  runId: number;
  budget?: number;
  /** Re-simulate even checkpoints already marked done. */
  force?: boolean;
  log?: (msg: string) => void;
};

export type SimulateStats = {
  checkpoints: number;
  simulated: number;
  skipped: number;
  failed: number;
  landings: number;
};

type Vec2 = { x: number; y: number };

export async function simulateRun(db: DatabaseSync, opts: SimulateOptions): Promise<SimulateStats> {
  const log = opts.log ?? (() => {});
  const now = new Date().toISOString();
  const stats: SimulateStats = { checkpoints: 0, simulated: 0, skipped: 0, failed: 0, landings: 0 };

  const rows = db.prepare(`
    SELECT c.checkpoint_id, c.track_path,
      (SELECT 1 FROM simulated s WHERE s.checkpoint_id = c.checkpoint_id) AS done
    FROM checkpoints c
    WHERE c.run_id = ? AND c.track_path IS NOT NULL
      ${opts.budget !== undefined ? "AND c.budget = ?" : ""}
    ORDER BY c.checkpoint_id
  `).all(...(opts.budget !== undefined ? [opts.runId, opts.budget] : [opts.runId])) as
    { checkpoint_id: number; track_path: string; done: number | null }[];

  const gapStmt = db.prepare(
    "SELECT gap_index, t_end FROM gaps WHERE checkpoint_id = ? AND t_end IS NOT NULL",
  );
  const insertStmt = db.prepare(`
    INSERT INTO landings (
      checkpoint_id, landing_index, frame, t_sec, contact_index, air_frames,
      speed_in_px, vx_in, vy_in, speed_out_px, dspeed_px, redir_px, redir_norm
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const markStmt = db.prepare(
    "INSERT OR REPLACE INTO simulated (checkpoint_id, at, n_landings) VALUES (?, ?, ?)",
  );
  const clearStmt = db.prepare("DELETE FROM landings WHERE checkpoint_id = ?");
  const issueStmt = db.prepare(
    "INSERT INTO ingest_issues (run_name, path, stage, error, at) VALUES (NULL, ?, 'simulate', ?, ?)",
  );

  for (const row of rows) {
    stats.checkpoints++;
    if (row.done !== null && !opts.force) {
      stats.skipped++;
      continue;
    }
    let landings: ReturnType<typeof landingDynamics>;
    try {
      landings = landingDynamics(row.track_path);
    } catch (err) {
      issueStmt.run(row.track_path, String(err instanceof Error ? err.message : err), now);
      stats.failed++;
      continue;
    }

    // Pair each landing to the gap whose contact time it realizes (±2 frames).
    const gapFrames = (gapStmt.all(row.checkpoint_id) as { gap_index: number; t_end: number }[])
      .map((g) => ({ gap_index: g.gap_index, frame: Math.round(g.t_end * FPS) }));

    db.exec("BEGIN");
    clearStmt.run(row.checkpoint_id);
    landings.forEach((l, i) => {
      let contactIndex: number | null = null;
      let best = 3;
      for (const g of gapFrames) {
        const d = Math.abs(g.frame - l.frame);
        if (d < best) {
          best = d;
          contactIndex = g.gap_index;
        }
      }
      insertStmt.run(
        row.checkpoint_id, i, l.frame, l.frame / FPS, contactIndex, l.air_frames,
        l.speed_in_px, l.vx_in, l.vy_in, l.speed_out_px, l.dspeed_px,
        l.redir_px, l.redir_px !== null ? normImpact(l.redir_px) : null,
      );
    });
    markStmt.run(row.checkpoint_id, now, landings.length);
    db.exec("COMMIT");
    stats.simulated++;
    stats.landings += landings.length;
    if (stats.simulated % 200 === 0) log(`  ${stats.simulated}/${rows.length} checkpoints simulated`);
    // WASM engine versions are reclaimed by GC finalizers, which only run when
    // the event loop turns — without this, a long synchronous batch exhausts
    // engine memory ("unreachable" wasm panics). gc() needs --expose-gc (set in
    // the lab npm script); the yield lets the finalizer callbacks actually run.
    if (stats.simulated % 50 === 0) {
      (globalThis as { gc?: () => void }).gc?.();
      await new Promise((r) => setImmediate(r));
    }
  }
  return stats;
}

type LandingRow = {
  frame: number;
  air_frames: number | null;
  speed_in_px: number | null;
  vx_in: number | null;
  vy_in: number | null;
  speed_out_px: number | null;
  dspeed_px: number | null;
  redir_px: number | null;
};

function landingDynamics(trackPath: string): LandingRow[] {
  const track = JSON.parse(readFileSync(trackPath, "utf8"));
  const rider = track.riders?.[0] ?? {};
  let engine = new LineRiderEngine();
  engine = engine.setStart(
    track.startPosition ?? rider.startPosition ?? { x: 0, y: 0 },
    rider.startVelocity ?? { x: 0.4, y: 0 },
  );
  // One batched addLine: intermediate engine versions are freed inside the
  // wrapper, so a whole track costs 3 live handles instead of one per line.
  const lines = (track.lines ?? []).map(createLineFromJson);
  if (lines.length > 0) engine = engine.addLine(lines);

  const raw = extractRawTrajectory(engine, track.duration ?? 1200);
  const det = detect(raw);
  const velocity = det.measurements.velocity as Vec2[];
  const lastFrame = velocity.length - 1;

  const out: LandingRow[] = [];
  for (const event of det.events as { type: string; frame: number; airborneFrom?: number }[]) {
    if (event.type !== "landing") continue;
    const vIn = velocity[event.frame - 1] ?? velocity[event.frame];
    const vOut = velocity[Math.min(event.frame + IMPACT_WINDOW, lastFrame)];
    const speedIn = vIn !== undefined ? Math.hypot(vIn.x, vIn.y) : null;
    const speedOut = vOut !== undefined ? Math.hypot(vOut.x, vOut.y) : null;
    const redir = redirArcPxAtLanding(det, event.frame);
    out.push({
      frame: event.frame,
      air_frames: event.airborneFrom !== undefined ? event.frame - event.airborneFrom : null,
      speed_in_px: speedIn,
      vx_in: vIn?.x ?? null,
      vy_in: vIn?.y ?? null,
      speed_out_px: speedOut,
      dspeed_px: speedIn !== null && speedOut !== null ? speedOut - speedIn : null,
      redir_px: redir ?? null,
    });
  }
  return out;
}
