import {it, expect} from 'vitest';
import {compileHandoff} from '../scripts/v0/optimizer/handoff.ts';
import {impactAccount} from '../scripts/v0/optimizer/impact_accounts.ts';
import {STRIKE_CONTRACT, STRIKE_V2_CONTRACT} from '../scripts/lib/strike_impact.ts';
import {createArcEngine} from '../scripts/v0/optimizer/arc_engine.ts';
import {extractRawTrajectory} from '../scripts/lib/detector.ts';
import {motionChanges} from '../tools/measure/motion_change.ts';
import {POINTS} from '../tools/measure/observe.ts';
import type {Spec} from '../scripts/v0/types.ts';

const spec: Spec = {duration: 3, preroll: 5, jitter: 0, contacts: [.6, 1.2, 1.8, 2.4, 3].map(t => ({t, impact: .4})), axes: {air: () => .5, speed: () => .5}};

it('v2 sees nothing in free flight', () => {
  const engine = createArcEngine({position: {x: 0, y: 0}, velocity: {x: 5, y: -4}}, []), raw = extractRawTrajectory(engine, 30);
  const v2 = impactAccount(STRIKE_V2_CONTRACT.id), observed = v2.observe(engine, raw.frames) as any[];
  expect(v2.evaluate(observed, [], 30, true).events).toEqual([]);
  for (const f of observed) expect(Math.hypot(...f.impulse as [number, number, number])).toBeLessThan(.3);
});

it('v2 strengths equal the research measure the owner judged, with v1 events and timing', () => {
  const track = compileHandoff(spec, 101, {budget: 180000, creative: {}, impactContract: STRIKE_V2_CONTRACT.id}).track;
  const engine = createArcEngine({position: track.startPosition, velocity: track.riders[0].startVelocity}, track.lines);
  const raw = extractRawTrajectory(engine, 140);
  const v1 = impactAccount(STRIKE_CONTRACT.id), v2 = impactAccount(STRIKE_V2_CONTRACT.id);
  const e1 = v1.evaluate(v1.observe(engine, raw.frames), [], 140, true).events, e2 = v2.evaluate(v2.observe(engine, raw.frames), [], 140, true).events;
  expect(e2.length).toBeGreaterThan(2);
  expect(e2.map(e => [e.onset, e.end, e.peakFrame])).toEqual(e1.map(e => [e.onset, e.end, e.peakFrame]));
  // The research tool reads the same rider states as recorded observations.
  const frames = raw.frames.map(f => ({points: POINTS.map(id => {const p = (engine.getRider(f.frame).ballisticState().points as any)[id]; return [p.x, p.y, p.prevX, p.prevY];})}));
  const research = motionChanges({frames, observed: raw.frames.map(f => [engine.hasContactAtFrame(f.frame) ? 1 : 0])});
  expect(research.map(r => r.onset)).toEqual(e2.map(e => e.onset));
  for (const [i, r] of research.entries()) expect(e2[i].strength).toBeCloseTo(Math.min(1, r.strength), 9);
});
