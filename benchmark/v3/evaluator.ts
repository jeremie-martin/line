/** Independent cold judge. Reuses V2 physics/measurements, changes only declared V3 aggregation. */
import { LineRiderEngine, createLineFromJson } from '../../scripts/lib/_lr_engine.ts';
import { detect, extractRawTrajectory, type Detection } from '../../scripts/lib/detector.ts';
import { AXIS_MEASURE } from '../../scripts/v0/core/measure.ts';
import { contactRedirArcPxAtLanding, findAuthoredContactNearFrame, offBeatLandingEvents } from '../../scripts/v0/core/substrate.ts';
import { IMPACT_WINDOW, normImpact } from '../../scripts/v0/types.ts';
import type { TrackJson } from '../../scripts/lib/primitive.ts';
import { shiftedGeometricMean } from '../../scripts/v0/score.ts';
import { caseGaps, targets, type Case, type Axis } from './model.ts';
import { policy } from './policy.ts';

export type Observation = { gap: number; startFrame: number; endFrame: number; tail: boolean; axis: Axis; target: number; achieved: number | null; error: number | null };
export type Score = { score: number; valid: boolean; hardFailures: string[]; weightedAxisRms: number | null;
  components: Partial<Record<Axis, { observations: number; weightSum: number; rmsError: number; weight: number }>> };
export type Row = { sourceId: string; seed: number; score: Score; trackHash: string };
const round = (v: number) => Math.round(v * 10000) / 10000;
export function scoreObservations(observations: Observation[], failures: string[], mode: 'whole_time' | 'contact_time' | 'contact_equal' = 'whole_time'): Score {
  const rows = mode === 'whole_time' ? observations : observations.filter(o => !o.tail);
  const hardFailures = [...failures];
  for (const o of rows) if (o.achieved === null || o.error === null || !Number.isFinite(o.error)) hardFailures.push(`missing_measurement:${o.gap}:${o.axis}`);
  if (!rows.length) hardFailures.push('no_authored_measurements');
  const active = [...new Set(rows.map(o => o.axis))];
  const denominator = active.reduce((s, a) => s + policy.axisWeights[a], 0);
  const components: Score['components'] = {};
  let loss = 0;
  for (const axis of active) {
    const values = rows.filter(o => o.axis === axis);
    if (values.some(o => o.error === null || !Number.isFinite(o.error))) continue;
    const weight = (o: Observation) => axis === 'impact' || mode === 'contact_equal' ? 1 : o.endFrame - o.startFrame;
    const weightSum = values.reduce((s, o) => s + weight(o), 0);
    const mse = values.reduce((s, o) => s + weight(o) * o.error! ** 2, 0) / weightSum;
    const axisWeight = policy.axisWeights[axis] / denominator;
    loss += axisWeight * mse;
    components[axis] = { observations: values.length, weightSum, rmsError: Math.sqrt(mse), weight: axisWeight };
  }
  const rms = Math.sqrt(loss), valid = hardFailures.length === 0;
  return { score: valid ? round(1000 * Math.exp(-rms / policy.tolerance)) : 0, valid, hardFailures,
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
  return { score: scoreObservations(observations, failures), contacts, offBeat, terminus: det.terminus, observations,
    diagnostics: { contactEqual: scoreObservations(observations, failures, 'contact_equal').score,
      contactTime: scoreObservations(observations, failures, 'contact_time').score,
      note: 'Scoring views on these V3 inputs and this one track. Neither is the original V2 benchmark headline.' } };
}
export function evaluateTrack(c: Case, track: TrackJson) {
  let engine = new LineRiderEngine().setStart(track.startPosition, track.riders[0].startVelocity);
  for (const line of track.lines) engine = engine.addLine(createLineFromJson(line));
  // Judge the declared specification plus the same half-second survival grace
  // as V2; do not trust a compiler-supplied shortened track duration or report.
  const det = detect(extractRawTrajectory(engine, c.durationFrames + 20));
  const materialFailures = track.lines.some(l => l.type !== 0) ? ['non_normal_line'] : [];
  return { ...evaluateDetection(c, det, materialFailures), judgeFrameSamples: det.measurements.airborne.length };
}
export function summarize(rows: Row[], cases: Case[], seeds: number[]) {
  if (new Set(seeds).size !== seeds.length || !seeds.length) throw new Error('invalid seed plan');
  if (rows.length !== cases.length * seeds.length) throw new Error('incomplete or duplicate result panel');
  const specifications = cases.map(c => {
    const selected = rows.filter(r => r.sourceId === c.id);
    if (selected.length !== seeds.length || seeds.some(seed => selected.filter(r => r.seed === seed).length !== 1)) throw new Error(`missing/duplicate seed for ${c.id}`);
    return { id: c.id, score: round(shiftedGeometricMean(selected.map(r => r.score.score))),
      valid: selected.filter(r => r.score.valid).length, runs: selected.length, distinctTracks: new Set(selected.map(r => r.trackHash)).size };
  });
  const parents = [...new Set(cases.map(c => c.parentId))].map(id => {
    const members = cases.filter(c => c.parentId === id);
    if (new Set(members.map(c => c.group)).size !== 1) throw new Error('parent spans groups');
    return { id, group: members[0].group, score: round(shiftedGeometricMean(members.map(c => specifications.find(s => s.id === c.id)!.score))), members: members.map(c => c.id) };
  });
  const groups = policy.strata.flatMap(s => s.groups.map(g => {
    const members = parents.filter(p => p.group === g.id);
    if (!members.length) throw new Error(`empty group ${g.id}`);
    return { id: g.id, stratum: s.id, weight: g.weight, score: round(shiftedGeometricMean(members.map(p => p.score))), parents: members.map(p => p.id) };
  }));
  const strata = policy.strata.map(s => ({ id: s.id, weight: s.weight, score: round(groups.filter(g => g.stratum === s.id).reduce((sum, g) => sum + g.weight * g.score, 0)) }));
  return { headline: round(strata.reduce((sum, s) => sum + s.weight * s.score, 0)), valid: rows.filter(r => r.score.valid).length,
    runs: rows.length, distinctTracks: new Set(rows.map(r => r.trackHash)).size, seeds, specifications, parents, groups, strata };
}
