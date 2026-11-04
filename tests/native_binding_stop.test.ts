import {it,expect} from 'vitest';
import {LineRiderEngine as Engine,disposeEngines as dispose} from '../scripts/lib/native_motion/engine.ts';
import {boundThroughMetered,resetFrameCount,getPhysicsFrameCount,setPhysicsFrameLimit} from '../scripts/lib/detector.ts';

// At 8 px/frame the rider hits the wall and comes unbound at frame 11.
const floor={id:1,type:0,x1:-50,y1:10,x2:400,y2:10},wall={id:2,type:0,x1:100,y1:30,x2:100,y2:-60};
const HORIZON=80;
const start=(lines:any[])=>new Engine().setStart({x:0,y:-15},{x:8,y:0}).addLine(lines);
it('stops at the first unbound frame and charges only the frames simulated',()=>{
 resetFrameCount();setPhysicsFrameLimit(null);
 try{
  const child=start([floor,wall]);
  expect(boundThroughMetered(child,HORIZON)).toBe(false);
  expect(child.getLastFrameIndex()).toBe(11);expect(getPhysicsFrameCount()).toBe(11);
  const reference=start([floor,wall]);
  expect(reference.isBoundAtFrame(10)).toBe(true);
  expect(reference.isBoundAtFrame(11)).toBe(false);expect(reference.isBoundAtFrame(HORIZON)).toBe(false);
  const intact=start([floor]);resetFrameCount();
  expect(boundThroughMetered(intact,HORIZON)).toBe(true);expect(getPhysicsFrameCount()).toBe(HORIZON);
 }finally{dispose();}
});
it('checks the allowance before each simulated frame',()=>{
 resetFrameCount();setPhysicsFrameLimit(5);
 try{
  const child=start([floor,wall]);
  expect(()=>boundThroughMetered(child,HORIZON)).toThrow('hard limit');
  expect(getPhysicsFrameCount()).toBe(5);expect(child.getLastFrameIndex()).toBe(5);
  resetFrameCount();setPhysicsFrameLimit(50);
  expect(boundThroughMetered(start([floor,wall]),HORIZON)).toBe(false);expect(getPhysicsFrameCount()).toBe(11);
 }finally{setPhysicsFrameLimit(null);dispose();}
});

it('batch and scalar replays agree on cached prefixes, budgets, fractional horizons and failures', () => {
 const run = (batch: boolean, prefix: number, target: number, limit: number | null, broken: boolean) => {
  resetFrameCount(); setPhysicsFrameLimit(limit);
  const engine = start(broken ? [floor, wall] : [floor]);
  engine.getRider(prefix);
  const scalar = {getLastFrameIndex: () => engine.getLastFrameIndex(), isBoundAtFrame: (f: number) => engine.isBoundAtFrame(f)};
  let result: unknown;
  try { result = boundThroughMetered(batch ? engine : scalar, target); }
  catch (e: any) { result = {message: e.message, attempted: e.attempted}; }
  const last = engine.getLastFrameIndex(), work = getPhysicsFrameCount();
  return {result, last, work, state: engine.getRider(last).ballisticState()};
 };
 try {
  for (const prefix of [0, 5, 10, 11, 20, 80]) for (const target of [0, 5, 10, 10.5, 11, 12, 80, 80.5])
   for (const limit of [null, 5, 11]) for (const broken of [false, true]) {
    expect(run(true, prefix, target, limit, broken)).toEqual(run(false, prefix, target, limit, broken));
    dispose();
   }
 } finally { setPhysicsFrameLimit(null); dispose(); }
});

it('batch replay preserves a pending trace after sibling cache reuse', () => {
 const run = (batch: boolean) => {
  resetFrameCount(); setPhysicsFrameLimit(null);
  const engine = start([floor]);
  engine.getRider(20); engine.prepareCollisionTrace(8);
  const sibling = engine.addLine({id: 30, type: 0, x1: 1000, y1: 1000, x2: 1010, y2: 1000});
  sibling.getRider(40);
  const scalar = {getLastFrameIndex: () => engine.getLastFrameIndex(), isBoundAtFrame: (f: number) => engine.isBoundAtFrame(f)};
  const bound = boundThroughMetered(batch ? engine : scalar, 80);
  return {bound, work: getPhysicsFrameCount(), trace: engine.readCollisionTrace(), state: engine.getRider(80).ballisticState()};
 };
 try { expect(run(true)).toEqual(run(false)); } finally { dispose(); }
});
