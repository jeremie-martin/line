import { expect, it } from 'vitest';
import { compileArcMotion, motionArc } from '../scripts/v0/optimizer/arc_motion.ts';
import { arcTrajectoryLoss } from '../scripts/v0/optimizer/arc_refinement.ts';
import type { Spec, TrackLine } from '../scripts/v0/types.ts';

const spec: Spec = {duration: 4, preroll: 5, jitter: 0,
  contacts: [.6, 1.2, 1.8, 2.4, 3, 3.6].map(t => ({t, impact: .4})),
  axes: {air: () => .5, speed: () => .5}};
const base = {budget: 200000, samples: 100, channel: 12, radius: 24, bidirectional: true,
  impactWeight: 1, amplitudeWeight: 1 / 3, arrivalMode: 'speed', arrivalWeight: .3,
  headingWeight: .3, qualityRetries: 2, guidance: 'clearance' as const, guidanceSamples: 24,
  pruneGuidance: true};

it('retains a valid complete incumbent while charging every refinement proposal', () => {
  const initial = compileArcMotion(spec, 17, base);
  const options = {...base, refineAttempts: 8, refineSamples: 36, refineWidth: 4};
  const result = compileArcMotion(spec, 17, options);
  expect(result.refinementStats.counts.proposals).toBeGreaterThan(0);
  expect(result.refinementStats.frames).toBeGreaterThan(0);
  expect(result.stats.sim_frames).toBeGreaterThan(initial.stats.sim_frames);
  expect(result.stats.sim_frames).toBeLessThanOrEqual(base.budget);
  expect(Number.isFinite(arcTrajectoryLoss(result.report))).toBe(true);
  expect(arcTrajectoryLoss(result.report)).toBeLessThanOrEqual(arcTrajectoryLoss(initial.report));
  expect(result.refinementStats.finalLoss).toBeCloseTo(arcTrajectoryLoss(result.report), 12);
  const repeated = compileArcMotion(spec, 17, options);
  expect(result.track).toEqual(repeated.track); expect(result.stats).toEqual(repeated.stats);
});

it('reconstructs a continuation with the original curve controls and preserves the incumbent', () => {
  const result = compileArcMotion(spec, 18, {...base, refineAttempts: 4, refineMode: 'reflow', refineWidth: 3});
  expect(result.refinementStats.counts.proposals).toBeGreaterThan(0);
  expect(result.refinementStats.finalLoss).toBeLessThanOrEqual(result.refinementStats.initialLoss);
  expect(Number.isFinite(arcTrajectoryLoss(result.report))).toBe(true);
  expect(result.stats.sim_frames).toBeLessThanOrEqual(base.budget);
});

it('expresses additional curvature and guide separation as connected normal curves', () => {
  const control = {entry: 5, turn: 50, exit: 15, support: 18, bias: 0, offset: .1};
  const points = [{x: 0, y: 0}, {x: 10, y: 0}], velocity = {x: 8, y: 1};
  const ordinary = motionArc(points, velocity, control, 1000, false, 12, false, 24);
  const expressive = motionArc(points, velocity, {...control, turnFraction: .6, bend: -25, guideFlare: 8}, 1000, false, 12, false, 24);
  expect(expressive).not.toEqual(ordinary);
  const chains: TrackLine[][] = [[]];
  for (const line of expressive) {
    expect(line.type).toBe(0);
    const previous = chains.at(-1)!.at(-1);
    if (previous && (previous.x2 !== line.x1 || previous.y2 !== line.y1)) chains.push([]);
    chains.at(-1)!.push(line);
  }
  expect(chains).toHaveLength(2);
  for (const chain of chains) {
    expect(chain.length).toBeGreaterThan(3);
    expect(chain.reduce((s, l) => s + Math.hypot(l.x2 - l.x1, l.y2 - l.y1), 0)).toBeGreaterThan(24);
  }
});

it('allocates longer planning from measured construction work within the same hard meter', () => {
  const result = compileArcMotion(spec, 19, {...base, adaptivePlanning: true,
    lookaheadWidth: 3, lookaheadSamples: 24, lookaheadObjective: 'terminal',
    strictHorizon: true, reuseContinuations: true});
  expect(result.planningDecisions.some(d => d.depth === 2)).toBe(true);
  expect(result.planningDecisions.every(d => d.observedConstructionRate > 0)).toBe(true);
  expect(result.lookaheadStats.physicsFrames).toBeGreaterThan(0);
  expect(Number.isFinite(arcTrajectoryLoss(result.report))).toBe(true);
  expect(result.stats.sim_frames).toBeLessThanOrEqual(base.budget);
});

it('offers direct expressive revisions with a fully evaluated continuation', () => {
  const result = compileArcMotion(spec, 20, {...base, refineAttempts: 5,
    refineDirect: true, expressive: true, refineMode: 'reflow', refineRebuildSamples: 24});
  expect(result.refinementStats.counts.proposals).toBeGreaterThan(0);
  expect(result.refinementStats.finalLoss).toBeLessThanOrEqual(result.refinementStats.initialLoss);
  expect(Number.isFinite(arcTrajectoryLoss(result.report))).toBe(true);
  expect(result.stats.sim_frames).toBeLessThanOrEqual(base.budget);
});

it('fits joint responses for expressive curves and validates proposals in the real engine', () => {
  const result = compileArcMotion(spec, 21, {...base, expressive: true,
    guidanceSamples: 96, guidanceJoint: true, responseSamples: 70});
  expect(Number.isFinite(arcTrajectoryLoss(result.report))).toBe(true);
  expect(result.stats.viable_candidate_samples).toBeGreaterThan(0);
  expect(result.stats.sim_frames).toBeLessThanOrEqual(base.budget);
  expect(result.track.lines.every(l => l.type === 0)).toBe(true);
});

it('reuses measured alternatives and adapts the following arcs without losing the complete track', () => {
  const result = compileArcMotion(spec, 22, {...base, refineAttempts: 4,
    refineUseAlternatives: true, refineMode: 'reflow', refineFollowSamples: 12,
    refineRebuildSamples: 24, lookaheadWidth: 3, lookaheadSamples: 24,
    reuseContinuations: true, lookaheadObjective: 'terminal'});
  expect(result.refinementStats.counts.proposals).toBeGreaterThan(0);
  expect(result.refinementStats.finalLoss).toBeLessThanOrEqual(result.refinementStats.initialLoss);
  expect(Number.isFinite(arcTrajectoryLoss(result.report))).toBe(true);
  expect(result.stats.sim_frames).toBeLessThanOrEqual(base.budget);
});
