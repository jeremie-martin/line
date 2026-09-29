/** Reconstruct measured collision footprints with ordinary, disconnected normal lines.
* A validated arc ride supplies a reference trajectory; it is not emitted as fallback.
* The JS engine is observed per collision, then both reference and output are checked
* with the unchanged WASM judge. No state injection or acceleration material is used. */
import { createHash } from 'node:crypto';
import { compileArcMotion } from './arc_motion.ts';
import { compileNormalMotion } from './normal_motion.ts';
import { arcTrajectoryLoss } from './arc_refinement.ts';
import { connectedArcOptions } from './connected_arcs.ts';
import { normalizeCompilerTimeline } from './compiler_input.ts';
import { sliceTimeline, effectiveAxes, buildDriftReport, validateSpec } from '../core/substrate.ts';
import { detect, extractRawTrajectory, getPhysicsFrameCount, setPhysicsFrameLimit, type RawTrajectory } from '../../lib/detector.ts';
import type { Spec, TrackLine, DriftReport } from '../types.ts';
const core = await import(new URL('../../../vendor/lr-core/line-rider-engine/index.js', import.meta.url).href);
const Observer = typeof core.default === 'function' ? core.default : core.default.default;
const createLine = core.createLineFromJson ?? core.default.createLineFromJson;
const { LineRiderEngine: Judge, disposeAllWasmEnginesForStudy: dispose } = await import(new URL('../../lib/_lr_engine_wasm.ts?normal-contact-replay', import.meta.url).href);
type Probe = {
  width: number;
  lines: number;
  maximumDifference: number | null;
  loss: number | null;
};
type Candidate = {
  lines: TrackLine[];
  raw: RawTrajectory;
  width: number;
  difference: number;
  report: DriftReport;
  loss: number;
};
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
/** Intervals on each observed collision plane. Merging overlaps prevents duplicate
* coincident planes; disconnected footprints never get silently joined into an arc. */
export function contactFragments(source: TrackLine[], footprints: Map<number, number[]>, width: number): TrackLine[] {
  if (!Number.isFinite(width) || width <= 0)
    throw new Error('positive fragment width required');
  const byId = new Map(source.map(l => [l.id, l])), lines: TrackLine[] = [];
  if (byId.size !== source.length)
    throw new Error('duplicate source line id');
  for (const [id, values] of footprints) {
    const line = byId.get(id);
    if (!line || line.type !== 0)
      throw new Error('normal source line required');
    const dx = line.x2 - line.x1, dy = line.y2 - line.y1, length = Math.hypot(dx, dy);
    if (!(length > 0) || !Number.isFinite(length))
      throw new Error('degenerate source line');
    const half = width / (2 * length), spans: Array<[number, number]> = [];
    for (const t of values.slice().sort((a, b) => a - b)) {
      if (!Number.isFinite(t))
        throw new Error('nonfinite contact location');
      const a = t - half, b = t + half, last = spans.at(-1);
      if (last && a <= last[1] + 1e-8)
        last[1] = Math.max(last[1], b);
      else
        spans.push([a, b]);
    }
    for (const [a, b] of spans)
      lines.push({ ...line, id: lines.length + 1,
        x1: line.x1 + dx * a, y1: line.y1 + dy * a, x2: line.x1 + dx * b, y2: line.y1 + dy * b,
        leftExtended: false, rightExtended: false });
  }
  return lines;
}
function trajectoryDifference(reference: RawTrajectory, candidate: RawTrajectory) {
  if (reference.frames.length !== candidate.frames.length)
    return Infinity;
  let maximum = 0;
  for (let i = 0; i < reference.frames.length; i++) {
    const a = reference.frames[i], b = candidate.frames[i];
    if (a.riderEjected !== b.riderEjected || a.sledBroken !== b.sledBroken ||
      Boolean(a.sledContacts.length) !== Boolean(b.sledContacts.length))
      return Infinity;
    maximum = Math.max(maximum, Math.hypot(a.position.x - b.position.x, a.position.y - b.position.y), Math.hypot(a.velocity.x - b.velocity.x, a.velocity.y - b.velocity.y));
  }
  return maximum;
}
export function compileContactFragments(input: Spec, seed: number, options: {
  budget: number;
}) {
  const spec = normalizeCompilerTimeline(input);
  validateSpec(spec);
  if (Object.keys(spec.axes).some(axis => !['air', 'speed', 'amplitude'].includes(axis)))
    throw new Error('contact fragments support air, speed, amplitude and contact impact only');
  const budget = options.budget, end = Math.round(spec.duration * 40) + 20, replay = end + 1;
  // Five numeric-width attempts, the observed reference, independent reference
  // verification, and one final replay. This work is reserved before planning.
  const widths = [.0003, .001, .0001, .003, .00003], sourceBudget = budget - (widths.length + 3) * replay;
  if (!Number.isSafeInteger(budget) || sourceBudget <= 2 * replay)
    throw new Error('contact-fragment budget cannot cover planning and validation');
  const source = compileArcMotion(spec, seed, connectedArcOptions(spec, sourceBudget));
  const sourceFrames = getPhysicsFrameCount(), footprints = new Map<number, number[]>();
  if (source.track.lines.some(l => l.type !== 0))
    throw new Error('reference contains non-normal lines');
  setPhysicsFrameLimit(budget);
  try {
    let observer = new Observer().setStart(source.track.startPosition, source.track.riders[0].startVelocity);
    for (const l of source.track.lines) {
      const line = createLine(l), collide = line.collide.bind(line);
      // Instrument only this line instance. Observe the immediate post-collision
      // position before later constraint sweeps mutate the point again.
      line.collide = (point: any) => {
        const next = collide(point);
        if (next) {
          const dx = l.x2 - l.x1, dy = l.y2 - l.y1;
          const t = ((next.pos.x - l.x1) * dx + (next.pos.y - l.y1) * dy) / (dx * dx + dy * dy);
          const values = footprints.get(l.id) ?? [];
          values.push(t);
          footprints.set(l.id, values);
        }
        return next;
      };
      observer = observer.addLine(line);
    }
    const reference = extractRawTrajectory(observer, end);
    const replayTrack = (lines: TrackLine[]) => {
      try {
        const base = new Judge().setStart(source.track.startPosition, source.track.riders[0].startVelocity);
        return extractRawTrajectory(lines.length ? base.addLine(lines) : base, end);
      }
      finally {
        dispose();
      }
    };
    if (JSON.stringify(reference) !== JSON.stringify(replayTrack(source.track.lines)))
      throw new Error('observed reference disagrees with fixed judge');
    const duration = Math.round(spec.duration * 40), contacts = spec.contacts.map(c => Math.round(c.t * 40));
    const gaps = sliceTimeline(contacts, duration);
    for (const g of gaps) {
      g.targets = effectiveAxes(g, spec);
      if (g.endsWithContact && spec.contacts[g.index].impact !== undefined)
        g.targets.impact = spec.contacts[g.index].impact;
    }
    const reportFor = (raw: RawTrajectory) => buildDriftReport(detect(raw), spec, gaps, contacts, duration, [], gaps.map(() => ({ lines: [] })) as any, gaps.map(g => g.targets));
    const observedFrames = getPhysicsFrameCount() - sourceFrames, probes: Probe[] = [];
    let chosen: Candidate | undefined;
    for (const width of widths) {
      const lines = contactFragments(source.track.lines, footprints, width), raw = replayTrack(lines);
      const difference = trajectoryDifference(reference, raw), report = reportFor(raw), loss = arcTrajectoryLoss(report);
      probes.push({ width, lines: lines.length, maximumDifference: Number.isFinite(difference) ? difference : null, loss: Number.isFinite(loss) ? loss : null });
      if (!chosen || loss < chosen.loss || (loss === chosen.loss && difference < chosen.difference))
        chosen = { lines, raw, width, difference, report, loss };
      if (difference <= .001 && Number.isFinite(loss))
        break;
    }
    // A failed reconstruction remains fragmented; the caller can retain its
    // independently validated feedback candidate instead. No arcs are emitted.
    if (!chosen)
      throw new Error('no reconstruction candidates');
    const confirmed = replayTrack(chosen.lines);
    if (JSON.stringify(confirmed) !== JSON.stringify(chosen.raw))
      throw new Error('contact reconstruction is not deterministic');
    const report = chosen.report;
    const reconstructed = chosen.difference <= .001;
    return { budget, track: { ...source.track, lines: chosen.lines }, report,
      stats: { ...source.stats, sim_frames: getPhysicsFrameCount(), gap_commits: report.contacts.filter(c => c.status === 'hit').length }, rows: [], attempts: [],
      failure: reconstructed ? source.failure : { reason: 'contact_reconstruction', probes },
      contactConstruction: { method: 'measured-contact-fragments', referenceTrackHash: hash(source.track),
        referenceBudget: sourceBudget, referenceFrames: sourceFrames, observationFrames: observedFrames,
        reconstructionFrames: getPhysicsFrameCount() - sourceFrames - observedFrames,
        referenceComplete: source.report.terminus.reason === 'endOfSpec' && !source.report.off_beat_landings.length && source.report.contacts.every(c => c.status === 'hit'),
        reconstructed, width: chosen.width, maximumDifference: Number.isFinite(chosen.difference) ? chosen.difference : null, probes,
        sourceLines: source.track.lines.length, contactedSourceLines: footprints.size } };
  }
  finally {
    dispose();
    setPhysicsFrameLimit(null);
  }
}
/** Keep the original scattered ride as an incumbent, then use unspent work to
* reconstruct a measured arc plan. Both emitted alternatives contain scattered
* type-0 segments. Select by the existing measured compiler objective, never a
* benchmark identity. Each compiler owns a local meter; charge their sum. */
export function compileScatteredMotion(spec: Spec, seed: number, options: {
  budget: number;
}) {
  if (Object.keys(spec.axes).some(axis => !['air', 'speed', 'amplitude'].includes(axis)))
    throw new Error('scattered research supports air, speed, amplitude and contact impact only');
  const baseline = compileNormalMotion(spec, seed, options);
  const baselineFrames = baseline.stats.sim_frames;
  const remaining = options.budget - baselineFrames, replay = Math.round(spec.duration * 40) + 21;
  const candidate = remaining > 10 * replay ? compileContactFragments(spec, seed, { budget: remaining }) : null;
  const candidateFrames = candidate?.stats.sim_frames ?? 0;
  const baselineLoss = arcTrajectoryLoss(baseline.report), candidateLoss = candidate ? arcTrajectoryLoss(candidate.report) : Infinity;
  const useCandidate = candidate !== null && candidateLoss < baselineLoss;
  const chosen = useCandidate ? candidate! : baseline;
  const total = baselineFrames + candidateFrames;
  if (total > options.budget)
    throw new Error('scattered compilation exceeded its allowance');
  return { budget: options.budget, track: chosen.track, report: chosen.report,
    stats: { sim_frames: total, gap_commits: chosen.report.contacts.filter(c => c.status === 'hit').length },
    work: { feedback: baselineFrames, reconstruction: candidateFrames, total, lastMeter: getPhysicsFrameCount() },
    construction: { selected: useCandidate ? 'contact-fragments' : 'feedback',
      feedbackLoss: Number.isFinite(baselineLoss) ? baselineLoss : null,
      fragmentLoss: Number.isFinite(candidateLoss) ? candidateLoss : null,
      reconstruction: candidate?.contactConstruction ?? null },
    failure: useCandidate ? candidate!.failure : Number.isFinite(baselineLoss) ? null : { reason: 'feedback_contract' } };
}
