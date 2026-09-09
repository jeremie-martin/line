/** Improve complete physical arc tracks; every offered continuation is simulated. */
import { LineRiderEngine as Engine } from '../../lib/native_motion/engine.ts';
import { getPhysicsFrameCount, getRiderMetered, extractRawTrajectory, PhysicsFrameLimitExceeded, detect } from '../../lib/detector.ts';
import type { DriftReport, TrackLine, Gap } from '../types.ts';
import { measureGapAxes } from '../core/measure.ts';
import { createArcEngine } from './arc_engine.ts';

export function arcTrajectoryLoss(report: DriftReport, amplitudeWeight = 1 / 3): number {
  if (report.terminus.reason !== 'endOfSpec' || report.off_beat_landings.length ||
      report.contacts.some(c => c.status !== 'hit')) return Infinity;
  let loss = 0, weight = 0;
  for (const axis of ['air', 'speed', 'impact', 'amplitude'] as const) {
    const values = report.gaps.flatMap(g => g.axes[axis] ? [g.axes[axis]!.error] : []);
    if (!values.length) continue;
    if (values.some(v => !Number.isFinite(v))) return Infinity;
    const w = axis === 'amplitude' ? amplitudeWeight : 1;
    loss += w * values.reduce((s, v) => s + v * v, 0) / values.length; weight += w;
  }
  return weight ? loss / weight : 0;
}

/** Compiler objective over the whole authored timeline. Span axes represent
 * time; impacts represent events. No benchmark IDs or benchmark code are used. */
export function arcWholeTrajectoryObjective(raw:any, report:DriftReport, gaps:Gap[], amplitudeWeight=1/3) {
  const regrets=Array(gaps.length+1).fill(0);
  if(report.terminus.reason!=='endOfSpec'||report.off_beat_landings.length||report.contacts.some(c=>c.status!=='hit'))return {loss:Infinity,regrets};
  const det=detect(raw),measured=gaps.map(g=>measureGapAxes(det,g,[],g.endFrame));
  let loss=0,normalizer=0;
  for(const axis of ['air','speed','amplitude','impact'] as const){
    const targeted=gaps.filter(g=>g.targets[axis]!==undefined);
    if(!targeted.length)continue;
    const importance=axis==='amplitude'?amplitudeWeight:1;
    const mass=targeted.reduce((s,g)=>s+(axis==='impact'?1:g.endFrame-g.startFrame),0);
    normalizer+=importance;
    for(const g of targeted){
      const value=measured[g.index][axis];if(value===undefined||!Number.isFinite(value))return {loss:Infinity,regrets};
      const contribution=importance*(axis==='impact'?1:g.endFrame-g.startFrame)*(value-g.targets[axis]!)**2/mass;
      loss+=contribution;regrets[axis==='impact'?g.index+1:g.index]+=contribution;
    }
  }
  return {loss:normalizer?loss/normalizer:0,regrets:regrets.map(v=>normalizer?v/normalizer:0)};
}

export type ArcRefinementInput = {
  engine: Engine; lines: TrackLine[]; rows: any[]; alternatives?: any[][];
  contacts: Array<{frame: number; gap: number}>; end: number;
  start: {position: {x: number; y: number}; velocity: {x: number; y: number}};
  budget: number; options: any;
  search: (engine: Engine, index: number, overrides: any, protectedEngines: Engine[]) => any;
  report: (raw: any, lines: TrackLine[]) => DriftReport;
  objective?: (raw:any, report:DriftReport) => {loss:number;regrets:number[]};
};

export function refineArcTrack(input: ArcRefinementInput) {
  const {contacts, end, start, options, search, report} = input;
  const began = getPhysicsFrameCount(), ceiling = input.budget - 2 * (end + 1);
  let incumbent = input.engine, lines = input.lines.slice(), rows = input.rows.slice();
  const initialRaw=extractRawTrajectory(incumbent,end);
  let incumbentReport = report(initialRaw, lines);
  let objective=input.objective?.(initialRaw,incumbentReport);
  let loss = objective?.loss??arcTrajectoryLoss(incumbentReport, options.amplitudeWeight);
  const observationContract = (r: DriftReport) => JSON.stringify(r.gaps.map(g => Object.entries(g.axes).map(([axis, value]) => [axis, value?.target])));
  const expectedObservations = observationContract(incumbentReport);
  const initialLoss = loss, tries = contacts.map(() => 0), records: any[] = [];
  const counts: Record<string, number> = {proposals: 0, complete: 0, accepted: 0, prefixChanged: 0, failedContinuation: 0};
  const indexOf = (line: TrackLine) => Math.floor((line.id - 1000) / 10000);
  if (!Number.isFinite(loss)) return {lines, rows, engine: incumbent, stats: {initialLoss, finalLoss: loss, frames: getPhysicsFrameCount() - began, counts, records}};
  try {
    for (let attempt = 0; attempt < (options.refineAttempts ?? 32); attempt++) {
      const width = options.refineWidth ?? 4, samples = options.refineSamples ?? 48;
      const regret = contacts.map((contact, i) => {
        let error = objective?.regrets[i]??0;
        if(!objective)for (const gap of incumbentReport.gaps) for (const [axis, value] of Object.entries(gap.axes)) {
          if (!value) continue;
          const belongs = axis === 'impact' ? gap.gap_index === contact.gap : gap.gap_index === i;
          if (belongs) error += value.error ** 2 * (axis === 'amplitude' ? (options.amplitudeWeight ?? 1 / 3) : 1);
        }
        const span = (contacts[i + 1]?.frame ?? end + 1) - contact.frame;
        const estimate = contact.frame + span * (samples + (options.refineGuidanceSamples??24) + 8) + (end - contact.frame + 1) * width * (1 + (options.refineFollowSamples ?? 0) * 1.25);
        const priority = error / (1 + tries[i]) / (options.refineSelection === 'rate' ? estimate : 1);
        return {index: i, error, estimate, priority};
      }).filter(x => x.error > 0 && getPhysicsFrameCount() + x.estimate <= ceiling)
        .sort((a, b) => b.priority - a.priority || a.index - b.index);
      if (!regret.length) break;
      const selected = regret[0], i = selected.index, frame = contacts[i].frame;
      const horizon = (contacts[i + 1]?.frame ?? end + 1) - 1;
      tries[i]++;
      const spent = getPhysicsFrameCount(), lossBefore = loss;
      const sourceLines = lines, sourceRows = rows;
      const prefix = sourceLines.filter(l => indexOf(l) < i);
      const base = createArcEngine(start, prefix);
      const before = JSON.stringify(getRiderMetered(base, frame - 1).ballisticState());
      const boundary = getRiderMetered(incumbent, horizon);
      const reference = {position: boundary.position, velocity: boundary.velocity, state: boundary.ballisticState()};
      const control = sourceRows[i].control;
      const directSteps: Record<string, number> = {entry: 1, turn: 3, exit: 3, support: Math.max(.5, control.support * .06), bias: .2, offset: .1, clearance: 1};
      if(options.expressive||options.refineExpressive)Object.assign(directSteps,{turnFraction: .06, bend: 5, guideFlare: 2});
      const scale = Math.pow(.5, Math.floor((tries[i] - 1) / 2));
      const directControls = Object.entries(directSteps).flatMap(([key, step]) => [-1, 1].map(sign => ({...control,
        [key]: (control[key] ?? (key === 'clearance' ? options.channel ?? 12 : key === 'turnFraction' ? Math.min(5, control.support * .5) / control.support : 0)) + sign * step * scale})));
      const retainedControls = options.refineUseAlternatives ? input.alternatives?.[i]?.map(a => a.c) : undefined;
      const searchResult = search(base, i, {directControls: retainedControls?.length ? retainedControls : options.refineDirect ? directControls : undefined, warmStart: sourceRows[i].control, localOnly: true,
        samples, guidanceSamples: options.refineGuidanceSamples ?? 24,
        arrivalWeight: 0, headingWeight: 0, arrivalReference: input.objective&&i+1===contacts.length?undefined:reference,
        independentExit:options.refineIndependentExit??options.independentExit,
        exitRefinementOnly:options.refineIndependentExit?true:options.exitRefinementOnly,
        minExitSupport:options.refineIndependentExit?12:options.minExitSupport,
        completeGuidanceBudget:input.objective?true:options.completeGuidanceBudget,
        boundaryWeight: options.refineBoundaryWeight ?? 1}, [incumbent]);
      if (!searchResult) {Engine.retainOnly([incumbent]); continue;}
      const candidates = searchResult.candidates.slice().sort((a: any, b: any) => a.cost - b.cost);
      const offered = new Set<string>(); let evaluated = 0;
      for (const candidate of candidates) {
        const key = JSON.stringify(candidate.c);
        if (offered.has(key) || key === JSON.stringify(sourceRows[i].control)) continue;
        offered.add(key);
        if (evaluated >= width || getPhysicsFrameCount() + 2 * (end + 1) > ceiling) break;
        evaluated++; counts.proposals++;
        let child = base.addLine(candidate.lines), proposed = [...prefix, ...candidate.lines];
        const proposedRows = sourceRows.slice();
        proposedRows[i] = {...sourceRows[i], control: candidate.c, cost: candidate.cost,
          ...candidate.meta, lookahead: null, spent: getPhysicsFrameCount()};
        let completed = true;
        if (options.refineMode === 'reflow') {
          for (let j = i + 1; j < contacts.length; j++) {
            const planned = j === i + 1 ? input.alternatives?.[i]?.find(a => JSON.stringify(a.c) === JSON.stringify(candidate.c))?.futureControl : undefined;
            let next = search(child, j, {samples: options.refineFollowSamples ?? 0, localOnly: true, guidance: undefined, warmStart: planned ?? sourceRows[j].control}, [incumbent, base]);
            if(!next?.best&&(options.refineRebuildSamples??0)>0)next=search(child,j,{samples:options.refineRebuildSamples,guidanceSamples:12,warmStart:sourceRows[j].control},[incumbent,base]);
            if (!next?.best) {completed = false; break;}
            proposed.push(...next.best.lines); child = next.best.child.detach();
            proposedRows[j] = {...sourceRows[j], control: next.best.c, cost: next.best.cost,
              achieved: next.best.achieved, impact: next.best.actualImpact,
              release: next.best.release, lines: next.best.lines.length,
              failures: next.failures, lookahead: null, spent: getPhysicsFrameCount()};
            Engine.retainOnly([incumbent, base, child]);
          }
        } else {
          const arrival = getRiderMetered(child, horizon).position;
          const dx = arrival.x - reference.position.x, dy = arrival.y - reference.position.y;
          const suffix = sourceLines.filter(l => indexOf(l) > i).map(l => ({...l, x1: l.x1 + dx, x2: l.x2 + dx, y1: l.y1 + dy, y2: l.y2 + dy}));
          proposed.push(...suffix); child = child.addLine(suffix);
        }
        if (!completed) {counts.failedContinuation++; Engine.retainOnly([incumbent, base]); continue;}
        if (JSON.stringify(getRiderMetered(child, frame - 1).ballisticState()) !== before) {
          counts.prefixChanged++; Engine.retainOnly([incumbent, base]); continue;
        }
        const candidateRaw=extractRawTrajectory(child,end),candidateReport = report(candidateRaw, proposed);
        const candidateObjective=input.objective?.(candidateRaw,candidateReport);
        const candidateLoss = observationContract(candidateReport) === expectedObservations ? candidateObjective?.loss??arcTrajectoryLoss(candidateReport, options.amplitudeWeight) : Infinity;
        if (Number.isFinite(candidateLoss)) counts.complete++;
        if (candidateLoss + 1e-12 < loss) {
          incumbent = child.detach(); lines = proposed; rows = proposedRows;
          incumbentReport = candidateReport;objective=candidateObjective; loss = candidateLoss; counts.accepted++;
        }
        Engine.retainOnly([incumbent, base]);
      }
      records.push({attempt, anchor: i, selectedRegret: selected.error, estimate: selected.estimate,
        frames: getPhysicsFrameCount() - spent, evaluated, lossBefore, lossAfter: loss});
      Engine.retainOnly([incumbent]);
    }
  } catch (error) {if (!(error instanceof PhysicsFrameLimitExceeded)) throw error;}
  Engine.retainOnly([incumbent]);
  return {lines, rows, engine: incumbent, stats: {initialLoss, finalLoss: loss, frames: getPhysicsFrameCount() - began, counts, records}};
}
