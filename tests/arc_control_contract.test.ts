import {expect, it} from 'vitest';
import {motionArc, type ArcMotionControl} from '../scripts/v0/optimizer/arc_geometry.ts';
import {ARC_CONTROL_KEYS, ARC_CORE_KEYS, normalizeArcControl, arcControlMemoKey,
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
  const bounded = normalizeArcControl(supplied, {span: 20});
  expect(bounded).toEqual({...control, entry: 85, turn: 110, exit: -80, support: 16, bias: 2, offset: -2});
  expect(supplied.support).toBe(100);
  expect(Object.keys(bounded)).toEqual(Object.keys(control));
  expect(normalizeArcControl({...supplied, turn: -130}, {span: 20}).turn).toBe(-120);
});

it('lets explicit search timing represent the inherited long arc exactly', () => {
  const long = {...control, support: 200};
  const points = [{x: 0, y: 0}, {x: 1, y: 0}], velocity = {x: 6, y: 1};
  const explicit = normalizeArcControl({...long, turnFraction: arcControlValue(long, 'turnFraction')},
    {span: 220});
  expect(motionArc(points, velocity, explicit, 1000, false, 12)).toEqual(motionArc(points, velocity, long, 1000, false, 12));
  expect(arcControlValue(control, 'clearance')).toBe(12);
  expect(arcControlValue(control, 'clearance', 0)).toBe(0);
  expect(arcControlValue({...control, bias: -.4}, 'foldBias')).toBe(-.4);
});

it('offers response search only active dimensions that have a response step', () => {
  expect(arcResponseKeys()).toEqual([...ARC_CORE_KEYS, 'clearance', 'turnFraction', 'bend', 'guideFlare']);
  const transfer = arcResponseKeys(true, {independentGuide: true, railLayout: 'transfer', observedReceiver: true});
  expect(transfer).toEqual(expect.arrayContaining(['guideTilt', 'mainEnd', 'receiverFlight']));
  for (const key of transfer) expect(arcControlStep(key, 'response', 20)).toBeGreaterThan(0);
  expect(arcResponseKeys(true, {independentGuide: true})).not.toContain('guideStart');
  expect(arcResponseKeys(false, {independentGuide: true})).not.toContain('guideTilt');
  expect(arcControlStep('guideEnd', 'coordinate', 20)).toBeGreaterThan(0);
  expect(() => arcControlStep('guideEnd', 'response', 20)).toThrow('no response step');
  expect(arcControlStep('support', 'response', 3)).toBe(.6);
});
