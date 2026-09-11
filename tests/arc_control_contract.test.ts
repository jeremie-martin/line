import {expect, it} from 'vitest';
import {motionArc, type ArcMotionControl} from '../scripts/v0/optimizer/arc_geometry.ts';
import {ARC_CONTROL_KEYS, ARC_CORE_KEYS, normalizeArcControl, arcControlMemoKey,
  arcControlValue, arcMethodKeys, arcControlStep} from '../scripts/v0/optimizer/arc_motion_control.ts';

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
  expect(bounded).toEqual({...control, entry: 85, turn: 15, exit: -80, support: 16, bias: 2, offset: -2});
  expect(supplied.support).toBe(100);
  expect(Object.keys(bounded)).toEqual(Object.keys(control));
  expect(normalizeArcControl(supplied, {span: 20, bidirectional: true}).turn).toBe(110);
  expect(normalizeArcControl(supplied, {span: 20, independentExit: true}).exitBias).toBe(2);
  expect(normalizeArcControl(supplied, {span: 20, independentExit: true, exitRefinementOnly: true}).exitBias).toBeUndefined();
});

it('lets explicit search timing represent the inherited long arc exactly', () => {
  const long = {...control, support: 200};
  const points = [{x: 0, y: 0}, {x: 1, y: 0}], velocity = {x: 6, y: 1};
  const explicit = normalizeArcControl({...long, turnFraction: arcControlValue(long, 'turnFraction')},
    {span: 220, preserveTurnTiming: true});
  expect(motionArc(points, velocity, explicit, 1000, false, 12)).toEqual(motionArc(points, velocity, long, 1000, false, 12));
  expect(arcControlValue(control, 'clearance')).toBe(12);
  expect(arcControlValue(control, 'clearance', 0)).toBe(0);
  expect(arcControlValue({...control, bias: -.4}, 'exitBias')).toBe(-.4);
});

it('offers only supported dimensions to each solver and keeps optional shape controls opt-in', () => {
  const basic = arcMethodKeys('response', false), expressive = arcMethodKeys('response', true, true);
  expect(basic).toEqual([...ARC_CORE_KEYS, 'clearance']);
  expect(expressive).toContain('bend'); expect(expressive).toContain('exitBias');
  expect(expressive).not.toContain('guideEnd');
  for (const method of ['response', 'repair'] as const) {
    for (const key of arcMethodKeys(method, true, true)) expect(arcControlStep(key, method, 20)).toBeGreaterThan(0);
  }
  expect(() => arcControlStep('guideEnd', 'response', 20)).toThrow('no response step');
  expect(arcControlStep('support', 'newton', 3)).toBe(1);
  expect(arcControlStep('support', 'response', 3)).toBe(.6);
});
