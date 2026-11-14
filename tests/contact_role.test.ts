import {expect, it} from 'vitest';
import {pushSide, contactKind, hitKind, idRanges, guideIds, type Line} from '../tools/measure/contact_role.ts';
import {motionArc} from '../scripts/v0/optimizer/arc_geometry.ts';
import {characterOfCell} from '../tools/eval/summary.ts';

const line = (id: number, x1: number, y1: number, x2: number, y2: number, flipped = false): Line => ({id, x1, y1, x2, y2, flipped});

it('reads which way a line pushes the rider (screen y down)', () => {
  expect(pushSide(line(1, 0, 0, 10, 0))).toBe('up');          // a plain floor drawn left to right holds the rider up
  expect(pushSide(line(1, 0, 0, 10, 0, true))).toBe('down');   // flipped: it pushes down
  expect(pushSide(line(1, 10, 0, 0, 0))).toBe('down');         // drawn right to left: its other side collides
  expect(pushSide(line(1, 0, 0, 1, 10))).toBe('wall');         // near vertical
});

it('agrees with the compiler: a receiver built for a catch from above pushes down, an ordinary one up', () => {
  const points = [{x: 0, y: 0}], velocity = {x: 9, y: 4}, control = {entry: 20, turn: -15, exit: 10, support: 16, bias: 0, offset: 0};
  const sides = (contactSide: number) => motionArc(points, velocity, {...control, contactSide}, 1000, 12, 24, 4, {guides: false})
    .map(l => pushSide(l));
  expect(sides(1).filter(s => s === 'up').length).toBeGreaterThan(sides(1).length * .9);
  expect(sides(-1).filter(s => s === 'down').length).toBeGreaterThan(sides(-1).length * .9);
});

it('classifies a hit by line role and push, whichever rider points touch', () => {
  const lines = new Map([line(1, 0, 0, 10, 0), line(2, 0, -20, 10, -20, true), line(3, 0, -12, 10, -12, true), line(4, 0, 0, 0, 10)].map(l => [l.id, l]));
  const guides = new Set([3]);
  expect(contactKind([1], lines, guides)).toBe('floor');
  expect(contactKind([1, 3], lines, guides)).toBe('floor+rail');
  expect(contactKind([2], lines, guides)).toBe('upper');
  expect(contactKind([2, 3], lines, guides)).toBe('upper+rail');
  expect(contactKind([3], lines, guides)).toBe('rail');
  expect(contactKind([4], lines, guides)).toBe('other');
  // Three frames from the contact start: a rail touched in the fourth frame does not count.
  const frames = [[], [[2, 4]], [], [], [[3, 5]]];
  expect(hitKind(frames, 1, lines, guides)).toBe('upper');
  expect(hitKind(frames, 2, lines, guides)).toBe('rail');
});

it('keeps guide ids as compact ranges', () => {
  expect(idRanges([5, 3, 4, 9, 10, 12])).toEqual([[3, 5], [9, 10], [12, 12]]);
  expect([...guideIds([{guides: [[3, 5]]}, {guides: [[9, 9]]}, {}])].sort((a, b) => a - b)).toEqual([3, 4, 5, 9]);
});

it('reports a ride\'s character from its sections and hits', () => {
  const cell = {geometry: {sections: [{family: 'arcs', frames: 20}, {family: 'arcs', frames: 20}, {family: 'fold', frames: 40}, {family: 'scattered', frames: 20}]},
    character: {railDrawn: [false, true, true, false], guideContact: 3, upperContact: 1, bodyContact: 9},
    impact3: {perBeat: [{requested: .8, hit: {contact: 'upper'}}, {requested: .7, hit: {contact: 'floor+rail'}}, {requested: .9, hit: null}, {requested: .2, hit: {contact: 'upper'}}]}};
  const ch = characterOfCell(cell);
  expect(ch['rails, share of ride time']).toBeCloseTo(.6);
  expect(ch['open arcs, share of ride time']).toBeCloseTo(.2);
  expect(ch['shapes, share of ride time']).toBeCloseTo(.4);
  expect(ch['longest railed stretch s']).toBeCloseTo(60 / 40);
  expect(ch['clean upper hits, share of strong beats']).toBeCloseTo(1 / 3);   // an unmatched strong beat counts as not clean
  expect(ch['clean upper hits, share of beats']).toBeCloseTo(.5);
  expect(characterOfCell({geometry: cell.geometry})['rails, share of ride time']).toBeNaN();
});
