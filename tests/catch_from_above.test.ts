import {describe, it, expect} from 'vitest';
import {planIntentionalRepertoire} from '../scripts/v0/optimizer/intentional_repertoire.ts';
import {mayCatchFromAbove, planRepertoire, validateProductionPlan} from '../scripts/v0/optimizer/repertoire_policy.ts';
import {inspectLayout} from '../scripts/v0/optimizer/repertoire_layout.ts';
import {motionArc} from '../scripts/v0/optimizer/arc_geometry.ts';
import {explicitPlan} from '../tools/eval/compile.ts';

// A shaped section may be caught from above instead of drawing its shape, where the automatic plan allows it
// (REWORK.md, November 15).
const spec = {duration: 12, contacts: Array.from({length: 12}, (_, i) => ({t: .7 + i * .9, impact: .8})), axes: {speed: () => .5}};

describe('the plan grants it', () => {
  it('on every shaped request of an automatic plan, and nowhere else', () => {
    const requests = Array.from({length: 20}, (_, seed) => planIntentionalRepertoire(spec, seed).requests).flat();
    expect(requests.some(r => r.catchFromAbove)).toBe(true);
    for (const r of requests) expect(r.catchFromAbove === true).toBe(mayCatchFromAbove(r));
  });
  it('is refused where the shape is not the planner\'s to give up', () => {
    const plan = planIntentionalRepertoire(spec, 3), i = plan.requests.findIndex(r => r.catchFromAbove);
    const forged = (change: (r: any) => void) => {const p = structuredClone(plan); change(p.requests[i]); return p;};
    expect(() => validateProductionPlan(spec, forged(r => {r.guidance = 'required';}))).toThrow('invalid construction request');
    expect(() => validateProductionPlan(spec, forged(r => {r.catchFromAbove = false;}))).toThrow('invalid construction request');
    const arcs = plan.requests.findIndex(r => r.construction === 'arcs' && r.section > 0);
    const onArcs = structuredClone(plan); (onArcs.requests[arcs] as any).catchFromAbove = true;
    expect(() => validateProductionPlan(spec, onArcs)).toThrow('invalid construction request');
    // The frozen first policy has no such permission.
    const legacy = planRepertoire(spec, 3), phrase = legacy.phrases.find(p => p.construction !== 'arcs' && p.construction !== 'scattered')!;
    phrase.guidance = 'optional';
    for (let k = phrase.first; k < phrase.first + phrase.count; k++) legacy.requests[k].guidance = 'optional';
    expect(validateProductionPlan(spec, legacy)).toEqual(legacy);
    (legacy.requests[phrase.first] as any).catchFromAbove = true;
    expect(() => validateProductionPlan(spec, legacy)).toThrow('invalid construction request');
  });
  it('honors a supplied permission without granting it to an explicit shaped request', () => {
    const supplied = planIntentionalRepertoire(spec, 3);
    expect(validateProductionPlan(spec, supplied)).toEqual(supplied);
    const explicit = structuredClone(supplied);
    for (const request of explicit.requests) delete request.catchFromAbove;
    const checked = validateProductionPlan(spec, explicit);
    expect(checked.requests.some(r => r.construction === 'scallops' || r.construction === 'serpentine')).toBe(true);
    expect(checked.requests.every(r => r.catchFromAbove === undefined)).toBe(true);
  });
  it('does not carry over to an explicit construction window', async () => {
    const boundaries = [0], windows = [{from: 2, to: 6, family: 'scallops', rail: 'offered'}] as any;
    const plan = await explicitPlan('.', spec, 3, {}, boundaries, windows);
    const inside = plan.requests.filter((r: any) => r.section > 0 && r.frame >= 80 && r.frame < 240);
    expect(inside.length).toBeGreaterThan(0);
    expect(inside.every((r: any) => r.construction === 'scallops' && !r.catchFromAbove)).toBe(true);
    expect(plan.requests.filter((r: any) => !inside.includes(r)).every((r: any) => (r.catchFromAbove === true) === mayCatchFromAbove(r))).toBe(true);
  });
});

describe('the drawing and the realization', () => {
  const points = [{x: 0, y: 0}, {x: 8, y: 0}], v = {x: 6, y: 2}, c = {entry: 0, turn: 5, exit: 30, support: 18, bias: 0, offset: 0};
  const scallops = {profile: 'scallops' as const, profileStart: 0, profileStrength: 1, rippleCycles: 1, guides: true};
  it('draws a receiver met from above as a plain line with no rail, in every family', () => {
    const above = {...c, contactSide: -1};
    expect(motionArc(points, v, above, 1000, 12, 0, 4, scallops)).toEqual(motionArc(points, v, above, 1000, 12, 0, 4, {guides: false}));
    // a floor support keeps its shape and its rail
    expect(motionArc(points, v, c, 1000, 12, 0, 4, scallops)).not.toEqual(motionArc(points, v, c, 1000, 12, 0, 4, {guides: false}));
  });
  it('accepts the plain catch for the shape only where the plan allows it', () => {
    const lines = motionArc(points, v, {...c, contactSide: -1}, 1000, 12, 0, 4, {guides: false});
    const touched = lines.map(l => [l.id]);
    const request = {section: 0, frame: 1, next: 30, construction: 'scallops' as const, guidance: 'optional' as const};
    const granted = inspectLayout({...request, catchFromAbove: true}, lines, new Set(), touched, undefined, true);
    expect(granted).toMatchObject({fulfilled: true, construction: 'scallops', caughtFromAbove: true});
    // without the permission, or caught on a floor, the section must show its shape
    expect(inspectLayout(request, lines, new Set(), touched, undefined, true).fulfilled).toBe(false);
    expect(inspectLayout({...request, catchFromAbove: true}, lines, new Set(), touched).fulfilled).toBe(false);
  });
});
