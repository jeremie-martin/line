/**
 * v0 contract score.
 *
 * This operates only on DriftReport: hard sync events, off-beat landings,
 * survival, and section-axis fidelity.
 */

import type { ContactReport, DriftReport } from "./types.ts";

export const AXIS_ZERO_CREDIT_ERROR = 0.25;

export type AxisDetail = {
  section_index: number;
  axis: string;
  target: number;
  achieved: number;
  error: number;
};

export type WorstContact = {
  t_target: number;
  t_actual: number | null;
  frame_error: number | null;
  status: ContactReport["status"];
};

export type V0ContractScore = {
  score: number;
  passed: boolean;
  hard_failures: string[];
  contacts: number;
  hits: number;
  drift: number;
  missing: number;
  sync_score: number;
  off_beat_landings: number;
  died: number;
  axis_count: number;
  axis_error_total: number;
  axis_error_mean: number;
  axis_error_max: number;
  axis_score: number;
};

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export function axisDetails(report: DriftReport): AxisDetail[] {
  const out: AxisDetail[] = [];
  for (const section of report.sections) {
    for (const [axis, value] of Object.entries(section.axes)) {
      out.push({
        section_index: section.section_index,
        axis,
        target: value.target,
        achieved: value.achieved,
        error: value.error,
      });
    }
  }
  return out;
}

export function worstContacts(report: DriftReport, limit = 3): WorstContact[] {
  return [...report.contacts]
    .filter((c) => c.status !== "hit")
    .sort((a, b) => contactSeverity(b) - contactSeverity(a))
    .slice(0, limit)
    .map((c) => ({
      t_target: c.t_target,
      t_actual: c.t_actual,
      frame_error: c.frame_error,
      status: c.status,
    }));
}

function contactSeverity(c: ContactReport): number {
  if (c.status === "missing") return Infinity;
  return c.frame_error === null ? 0 : Math.abs(c.frame_error);
}

export function scoreDriftReport(report: DriftReport): V0ContractScore {
  const contacts = report.contacts.length;
  const hits = report.contacts.filter((c) => c.status === "hit").length;
  const drift = report.contacts.filter((c) => c.status === "drift").length;
  const missing = report.contacts.filter((c) => c.status === "missing").length;
  const sync_score = contacts > 0 ? hits / contacts : 1;

  const axes = axisDetails(report);
  const axis_count = axes.length;
  const axis_error_total = axes.reduce((sum, a) => sum + a.error, 0);
  const axis_error_mean = axis_count > 0 ? axis_error_total / axis_count : 0;
  const axis_error_max = axes.reduce((max, a) => Math.max(max, a.error), 0);
  const axis_score = axis_count > 0
    ? clamp01(1 - axis_error_mean / AXIS_ZERO_CREDIT_ERROR)
    : 1;

  const off_beat_landings = report.off_beat_landings.length;
  const died = report.terminus.reason !== "endOfSpec" ? 1 : 0;
  const hard_failures: string[] = [];
  if (drift > 0 || missing > 0) hard_failures.push(`sync:${drift}drift/${missing}missing`);
  if (died) hard_failures.push(`died:${report.terminus.reason}@${report.terminus.frame}`);
  if (off_beat_landings > 0) hard_failures.push(`offBeat:${off_beat_landings}`);

  const passed = hard_failures.length === 0;
  const score = passed ? 1000 * sync_score * axis_score : 0;

  return {
    score,
    passed,
    hard_failures,
    contacts,
    hits,
    drift,
    missing,
    sync_score,
    off_beat_landings,
    died,
    axis_count,
    axis_error_total,
    axis_error_mean,
    axis_error_max,
    axis_score,
  };
}
