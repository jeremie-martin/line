import {expect, it} from 'vitest';
import {motionArc, type ArcMotionControl} from '../scripts/v0/optimizer/arc_geometry.ts';
import {ARC_CONTROL_KEYS, ARC_CORE_KEYS, arcControlNormalizer, arcControlMemoKey,
  arcControlValue, arcResponseKeys, arcControlStep} from '../scripts/v0/optimizer/arc_motion_control.ts';

const control: ArcMotionControl = {entry: 5, turn: -20, exit: -10, support: 12, bias: 0, offset: .1};

it('keeps every authored dimension, omitted topology and signed zero in evaluation identity', () => {
  const key = arcControlMemoKey(control, 12);
  for (const field of ARC_CONTROL_KEYS) {
    expect(arcControlMemoKey({...control, [field]: 123}, 12), field).not.toBe(key);
  }
  expect(arcControlMemoKey({...control, clearance: 12}, 12)).toBe(key);
  expect(arcControlMemoKey({...control, guideEnd: 1}, 12)).not.toBe(key);
  expect(arcControlMemoKey({...control, bias: -0}, 12)).not.toBe(key);
  expect(arcControlMemoKey(control)).not.toBe(key);
  expect(arcControlMemoKey({...control, bend: NaN})).not.toBe(arcControlMemoKey({...control, bend: Infinity}));
});

it('normalizes against the actual interval without mutating or materializing optional geometry', () => {
  const supplied = {...control, entry: 100, turn: 110, exit: -100, support: 100, bias: 4, offset: -5};
  const bounded = arcControlNormalizer({span: 20})(supplied);
  expect(bounded).toEqual({...control, entry: 85, turn: 110, exit: -80, support: 16, bias: 2, offset: -2});
  expect(supplied.support).toBe(100);
  expect(Object.keys(bounded)).toEqual(Object.keys(control));
  expect(arcControlNormalizer({span: 20})({...supplied, turn: -130}).turn).toBe(-120);
});

it('reuses a fixed interval while preserving each candidate’s omissions and dependent timing', () => {
  const context = {span: 220, releaseReserveFrames: 20, guides: false,
    profile: 'fold', profileStart: 0, independentGuide: true, foldAngle: 40};
  const normalize = arcControlNormalizer(context);
  context.span = 10;
  context.guides = true;
  context.foldAngle = -40;
  const supplied = {...control, support: 250, turnFraction: .001, clearance: 20, bend: 30, bias: -0};
  const first = normalize(supplied);
  expect(first).toEqual({...control, support: 200, turnFraction: .025, bias: -0, foldBend: 40});
  first.foldBend = -60;
  const second = normalize({...control, foldBend: undefined});
  expect(second).toEqual({...control, foldBend: 40});
  expect(Object.hasOwn(second, 'turnFraction')).toBe(false);
  expect(supplied.clearance).toBe(20);
});

it('lets explicit search timing represent the inherited long arc exactly', () => {
  const long = {...control, support: 200};
  const points = [{x: 0, y: 0}, {x: 1, y: 0}], velocity = {x: 6, y: 1};
  const explicit = arcControlNormalizer({span: 220})({...long, turnFraction: arcControlValue(long, 'turnFraction')});
  expect(motionArc(points, velocity, explicit, 1000, 12)).toEqual(motionArc(points, velocity, long, 1000, 12));
  expect(arcControlValue(control, 'clearance')).toBe(12);
  expect(arcControlValue(control, 'clearance', 0)).toBe(0);
  expect(arcControlValue({...control, bias: -.4}, 'foldBias')).toBe(-.4);
});

it('offers response search only active dimensions that have a response step', () => {
  expect(arcResponseKeys()).toEqual([...ARC_CORE_KEYS, 'clearance', 'turnFraction', 'bend', 'hold', 'guideFlare']);
  expect(arcResponseKeys(true, {profile: 'fold'})).not.toContain('hold');
  const transfer = arcResponseKeys(true, {independentGuide: true, railLayout: 'transfer', observedReceiver: true});
  expect(transfer).toEqual(expect.arrayContaining(['guideTilt', 'mainEnd', 'receiverFlight']));
  for (const key of transfer) expect(arcControlStep(key, 'response', 20)).toBeGreaterThan(0);
  expect(arcResponseKeys(true, {independentGuide: true})).not.toContain('guideStart');
  expect(arcResponseKeys(false, {independentGuide: true})).not.toContain('guideTilt');
  expect(arcControlStep('guideEnd', 'coordinate', 20)).toBeGreaterThan(0);
  expect(() => arcControlStep('guideEnd', 'response', 20)).toThrow('no response step');
  expect(arcControlStep('support', 'response', 3)).toBe(.6);
});

it('keeps memo equivalence for every numeric field, including nonfinite values',()=>{
  const oldKey=(c:ArcMotionControl,channel?:number)=>JSON.stringify(ARC_CONTROL_KEYS.map(key=>{
    const value=key==='clearance'?c.clearance??channel??0:c[key];
    return value===undefined?'absent':Object.is(value,-0)?'-0':Number.isFinite(value)?value:String(value);
  }));
  const oldToNew=new Map<string,string>(),newToOld=new Map<string,string>();
  const values=[undefined,-Infinity,-Number.MAX_VALUE,-1e-200,-1,-0,0,1,1e-200,Number.MAX_VALUE,Infinity,NaN];
  for(const key of ARC_CONTROL_KEYS)for(const value of values)for(const channel of [undefined,-0,0,12,NaN]){
    const c={...control,[key]:value},before=oldKey(c,channel),after=arcControlMemoKey(c,channel);
    if(oldToNew.has(before))expect(after).toBe(oldToNew.get(before));
    if(newToOld.has(after))expect(before).toBe(newToOld.get(after));
    oldToNew.set(before,after);newToOld.set(after,before);
  }
});
