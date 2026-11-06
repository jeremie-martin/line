/** The judge's span observations of one ride: air, speed and amplitude against
 * their targets, with the ride's terminus. The headline's impact comes from the
 * impact account instead (scripts/gallery/contact_impact_grade.ts). */
import type { Detection } from '../lib/detector.ts';
import { AXIS_MEASURE } from '../v0/core/measure.ts';
import { contactRedirArcPxAtLanding, findAuthoredContactNearFrame, offBeatLandingEvents } from '../v0/core/substrate.ts';
import { IMPACT_WINDOW, normImpact } from '../v0/types.ts';
import { caseGaps, targets, type Case, type Axis } from '../lib/case.ts';

const AXIS_WEIGHTS = { air: .3, speed: .3, impact: .3, amplitude: .1 }, TOLERANCE = .25;

export type Observation = { gap: number; startFrame: number; endFrame: number; tail: boolean; axis: Axis; target: number; achieved: number | null; error: number | null };
export type Score = { score: number; valid: boolean; hardFailures: string[]; weightedAxisRms: number | null;
  components: Partial<Record<Axis, { observations: number; weightSum: number; rmsError: number; weight: number }>> };
const round = (v: number) => Math.round(v * 10000) / 10000;
export function scoreObservations(rows: Observation[], failures: string[]): Score {
  const hardFailures = [...failures];
  for (const o of rows) if (o.achieved === null || o.error === null || !Number.isFinite(o.error)) hardFailures.push(`missing_measurement:${o.gap}:${o.axis}`);
  if (!rows.length) hardFailures.push('no_authored_measurements');
  const active = [...new Set(rows.map(o => o.axis))];
  const denominator = active.reduce((s, a) => s + AXIS_WEIGHTS[a], 0);
  const components: Score['components'] = {};
  let loss = 0;
  for (const axis of active) {
    const values = rows.filter(o => o.axis === axis);
    if (values.some(o => o.error === null || !Number.isFinite(o.error))) continue;
    const weight = (o: Observation) => axis === 'impact' ? 1 : o.endFrame - o.startFrame;
    const weightSum = values.reduce((s, o) => s + weight(o), 0);
    const mse = values.reduce((s, o) => s + weight(o) * o.error! ** 2, 0) / weightSum;
    const axisWeight = AXIS_WEIGHTS[axis] / denominator;
    loss += axisWeight * mse;
    components[axis] = { observations: values.length, weightSum, rmsError: Math.sqrt(mse), weight: axisWeight };
  }
  const rms = Math.sqrt(loss), valid = hardFailures.length === 0;
  return { score: valid ? round(1000 * Math.exp(-rms / TOLERANCE)) : 0, valid, hardFailures,
    weightedAxisRms: Number.isFinite(rms) ? rms : null, components };
}
export function evaluateDetection(c: Case, det: Detection, materialFailures: string[] = []) {
  const failures = [...materialFailures], gaps = caseGaps(c), frames = c.contacts.map(x => x.frame);
  if (det.terminus.reason !== 'endOfSpec' || det.terminus.frame < c.durationFrames) failures.push(`terminus:${det.terminus.reason}:${det.terminus.frame}`);
  const contacts = c.contacts.map((contact, i) => {
    const gap = gaps[i], event = findAuthoredContactNearFrame(det, contact.frame, 1, gap.endFrame - gap.startFrame);
    if (!event) failures.push(`missing_or_drifted_contact:${i}`);
    return { targetFrame: contact.frame, actualFrame: event?.frame ?? null, offset: event ? event.frame - contact.frame : null };
  });
  const offBeat = offBeatLandingEvents(det, frames).map(e => e.frame);
  if (offBeat.length) failures.push(`off_beat_landings:${offBeat.length}`);
  const observations: Observation[] = [];
  for (const gap of gaps) {
    const wanted = targets(c, gap), ctx = { det, gap, rangeEndFrame: gap.endFrame, gapLines: [] };
    for (const axis of ['air', 'speed', 'amplitude', 'impact'] as const) {
      const target = wanted[axis]; if (target === undefined) continue;
      let achieved: number | undefined;
      if (axis !== 'impact') achieved = AXIS_MEASURE[axis](ctx);
      else {
        const actual = contacts[gap.index].actualFrame;
        const raw = actual === null ? undefined : contactRedirArcPxAtLanding(det, actual, IMPACT_WINDOW);
        achieved = raw === undefined ? undefined : normImpact(raw);
      }
      observations.push({ gap: gap.index, startFrame: gap.startFrame, endFrame: gap.endFrame, tail: !gap.endsWithContact,
        axis, target, achieved: achieved ?? null, error: achieved === undefined ? null : Math.abs(achieved - target) });
    }
  }
  return { score: scoreObservations(observations, failures), contacts, offBeat, terminus: det.terminus, observations };
}
