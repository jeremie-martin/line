/** Revisiting neighbouring intervals before committing one: transition
 * revision re-searches the current interval from each retained alternative
 * of the previous one, and coupled pair refinement adjusts the current and
 * next controls jointly. Both are measured natively on the shared meter. */
import { LineRiderEngine as Engine } from '../../lib/native_motion/engine.ts';
import { getPhysicsFrameCount, PhysicsFrameLimitExceeded } from '../../lib/detector.ts';
import type { ArcMotionControl } from './arc_geometry.ts';
import { arcControlValue, arcControlStep, arcMethodKeys } from './arc_motion_control.ts';
import { refineArcPair, type PairMeasurement } from './arc_pair_response.ts';
import { searchInterval, type IntervalResult } from './arc_interval.ts';
import { transitionRevisionSettings } from './arc_options.ts';
import type { ArcCompileContext } from './arc_compile_context.ts';
import type { ArcSequence } from './arc_sequence.ts';

/** When interval `i` misses its targets by more than the error threshold and
 * the remaining work allows, re-search it from each retained alternative of
 * interval i-1 and adopt the pair with the lowest combined cost. Returns the
 * (possibly revised) interval; an accepted revision rewrites interval i-1. */
export function reviseTransition(ctx: ArcCompileContext, seq: ArcSequence, i: number, interval: IntervalResult) {
  const {options, gaps, end, budget, work} = ctx;
  const revision = transitionRevisionSettings(options);
  const previous = seq.steps[i - 1];
  if (!(revision && revision.width > 0 && i > 0 && interval.best && previous?.selected && previous.choices.length)) return interval;
  const measured = interval.best, target = interval.targets;
  const errors = ['air', 'speed', 'amplitude'].flatMap(key => target[key as keyof typeof target] === undefined ? [] :
    [measured.achieved[key] - target[key as keyof typeof target]!]);
  const impact = interval.gap >= 0 ? gaps[interval.gap].targets.impact : undefined;
  if (impact !== undefined && measured.actualImpact !== undefined) errors.push(measured.actualImpact - impact);
  const error = Math.sqrt(errors.reduce((n, v) => n + v * v, 0) / Math.max(1, errors.length));
  const reserve = (end - interval.frame) * Math.max((options.samples ?? 160) + (options.guidanceSamples ?? 0), work.observedConstructionRate);
  const estimate = interval.frame + (interval.next - interval.frame) * (revision.samples + revision.guidanceSamples + 96);
  if (!(error > revision.errorThreshold && getPhysicsFrameCount() + estimate + reserve < budget - 2 * (end + 1))) return interval;

  const began = getPhysicsFrameCount(), original = interval, base = ctx.lineage.rebuild(seq.lines.slice(0, previous.lineStart));
  const before = previous.selected.measurement.localCost + measured.cost;
  const record = {index: i, error, proposals: 0, viable: 0, accepted: false, before, after: before, physicsFrames: 0};
  let winner: {previous: any; interval: IntervalResult; value: number} | null = null;
  try {
    for (const choice of previous.choices.slice(0, revision.width)) {
      if (getPhysicsFrameCount() + estimate + reserve >= budget - 2 * (end + 1)) break;
      record.proposals++;
      const branch = ctx.lineage.add(base, choice.lines);
      const trial = searchInterval(ctx, branch, i, {samples: revision.samples, guidanceSamples: revision.guidanceSamples,
        responseSamples: revision.responseSamples, initialRecoverySamples: Math.min(64, options.initialRecoverySamples ?? 0),
        warmStart: measured.c, warmIncoming: original.incoming}, [seq.engine, measured.child, base]);
      if (trial?.best) {
        record.viable++;
        const value = choice.measurement.localCost + trial.best.cost;
        if (value < (winner?.value ?? before) - 1e-12) winner = {previous: choice, interval: trial, value};
      }
      // Keep only engine-free measurements of alternatives. A winner is
      // rebuilt below; all repeat simulation remains on the shared meter.
      Engine.retainOnly([seq.engine, measured.child, base]);
    }
  } catch (interruption) {
    if (!(interruption instanceof PhysicsFrameLimitExceeded)) throw interruption;
    work.searchBudgetExhausted = true;
    work.budgetInterruptions.push({phase: 'revision', index: i, frame: interval.frame, viable: record.viable, retained: true});
  }
  if (winner) {
    const selected = winner.previous, branch = ctx.lineage.add(base, selected.lines), revised = winner.interval;
    revised.best = {...revised.best, child: ctx.lineage.add(branch, revised.best.lines)};
    seq.lines.splice(previous.lineStart, seq.lines.length - previous.lineStart, ...selected.lines);
    seq.rows[i - 1] = {...seq.rows[i - 1], control: selected.c, cost: selected.cost, ...selected.meta, lookahead: null};
    previous.choices = [previous.selected, ...previous.choices.filter((c: any) => c !== selected)];
    previous.selected = selected;
    seq.engine = branch;
    interval = revised;
    record.accepted = true;
    record.after = winner.value;
  }
  Engine.retainOnly([seq.engine, interval.best.child]);
  record.physicsFrames = getPhysicsFrameCount() - began;
  work.transitionRevisionWork.push(record);
  return interval;
}

/** When lookahead fixed the next interval's warm start, refine both controls
 * jointly: each pair is replayed natively (interval i, then i+1 from its
 * end) and a pair that lowers the combined cost replaces `best` and the
 * next warm start. Returns the (possibly replaced) best candidate. */
export function refineCoupledPair(ctx: ArcCompileContext, seq: ArcSequence, i: number, interval: IntervalResult, best: any) {
  const {options, contacts, end, budget, work} = ctx;
  if (!(best && seq.pendingControl?.index === i + 1 && (options.coupledIntervalSamples ?? 0) > 0)) return best;
  const {frame, candidates} = interval;
  const original = best, initialNext = seq.pendingControl.control;
  const remaining = Math.max(1, end - frame);
  const reserve = remaining * Math.max((options.samples ?? 160) + (options.guidanceSamples ?? 0), work.observedConstructionRate);
  const estimated = (options.coupledIntervalSamples! + 1) * Math.max(1, (contacts[i + 2]?.frame ?? end + 1) - frame);
  if (!(getPhysicsFrameCount() + reserve + estimated < budget - 2 * (end + 1))) return best;

  const styles = [i, i + 1].map(index => ({...options, ...options.sectionStyles?.[index]}));
  const initialControls = [original.c, initialNext] as ArcMotionControl[];
  const dimensions = initialControls.flatMap((c, which) => arcMethodKeys('response', true, false, styles[which].guides,
    {...styles[which], observedReceiver: !!options.observedReceiver && c.receiverFlight !== undefined}).map(key => ({which, key})));
  const coordinates = (controls: ArcMotionControl[]) => dimensions.map(({which, key}) => arcControlValue(controls[which], key, options.channel));
  const scales = dimensions.map(({which, key}) => arcControlStep(key, 'response', initialControls[which].support));
  const began = getPhysicsFrameCount();
  let winner: any = null;
  const record = {index: i, proposals: 0, viable: 0, accepted: 0, physicsFrames: 0, before: Infinity, after: Infinity};
  const measure = (values: number[], unchanged?: ArcMotionControl[]): PairMeasurement<any> | null => {
    record.proposals++;
    const controls = unchanged ?? initialControls.map(c => ({...c}));
    if (!unchanged) dimensions.forEach(({which, key}, d) => controls[which][key] = values[d]);
    try {
      const a = searchInterval(ctx, seq.engine, i, {directControls: [controls[0]]}, [seq.engine, original.child]);
      if (!a?.best) return null;
      const b = searchInterval(ctx, a.best.child, i + 1, {directControls: [controls[1]]}, [seq.engine, original.child, a.best.child]);
      if (!b?.best) return null;
      // The second interval replaces the first interval's incomplete
      // outgoing span. Keep impact, previous-boundary and motion terms;
      // include only the final interval's arrival prior.
      const residuals = [...a.best.localResiduals.slice(3), ...b.best.localResiduals, ...b.best.arrivalResiduals];
      const measured = {coordinates: coordinates([a.best.c, b.best.c]), residuals, value: a.best.localCost + b.best.cost,
        payload: {root: a.best, candidate: a.candidates.find(c => JSON.stringify(c.c) === JSON.stringify(a.best.c)), next: b.best.c}};
      record.viable++;
      if (!winner || measured.value < winner.value - 1e-12) {
        winner = measured;
        record.accepted++;
      }
      return measured;
    } finally {
      Engine.retainOnly([seq.engine, original.child]);
    }
  };
  try {
    const initial = measure(coordinates(initialControls), initialControls);
    if (initial) {
      record.before = initial.value;
      record.accepted = 0;
      refineArcPair(initial, scales, options.coupledIntervalSamples!, measure);
      record.after = winner.value;
      if (winner.value < initial.value - 1e-12) {
        const {root, candidate, next} = winner.payload;
        candidates.push(candidate);
        best = {...root, child: ctx.lineage.add(seq.engine, root.lines)};
        seq.pendingControl = {index: i + 1, control: next};
      }
    }
  } catch (error) {
    if (!(error instanceof PhysicsFrameLimitExceeded)) throw error;
    work.searchBudgetExhausted = true;
    Engine.retainOnly([seq.engine, original.child]);
  } finally {
    record.physicsFrames = getPhysicsFrameCount() - began;
    work.coupledIntervalWork.push(record);
  }
  return best;
}
