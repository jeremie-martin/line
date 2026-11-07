/** compare's bookkeeping: rounds take every spec's k-th seed with categories
 * interleaved, and coverage counts rounds that complete out of order. */
import {expect, it} from 'vitest';
import {rounds, coverage, comparableBlocks} from '../tools/eval/compare.ts';

const c = (song: string, variant: string, seed: number, stratum: string) =>
  ({id: `${song}~${variant}~${seed}`, song, variant, seed, perturbation: null, bench: {stratum, pattern: '', windows: []}}) as any;
const cases = [c('a', 'spec', 202, 'G'), c('a', 'spec', 101, 'G'), c('b', 'x', 101, 'P1'), c('b', 'x', 202, 'P1'), c('b', 'x', 303, 'P1'),
  c('d', 'y', 101, 'P1'), c('d', 'y', 202, 'P1'), c('d', 'y', 303, 'P1')];

it('builds rounds from each spec\'s k-th seed, categories in turn', () => {
  const rs = rounds(cases);
  expect(rs.map(r => r.map(x => x.id))).toEqual([
    ['a~spec~101', 'b~x~101', 'd~y~101'], ['a~spec~202', 'b~x~202', 'd~y~202'], ['b~x~303', 'd~y~303']]);
});
it('counts complete rounds even when a later round completes first', () => {
  const both = (ids: string[]) => new Map(ids.map(id => [id, {}]));
  const ids = ['a~spec~101', 'b~x~101', 'd~y~101', 'b~x~303', 'd~y~303'];
  const cov = coverage({cases}, {candidate: both(ids), reference: both(ids)});
  expect(cov.done).toEqual([0, 2]);
  expect(cov.inComplete.sort()).toEqual([...ids].sort());
  expect(cov.outstanding).toEqual({candidate: 3, reference: 3});
});
it('uses as seed blocks only complete rounds that cover every spec', () => {
  // Spec a has two seeds, b and d three: round 3 is complete but covers fewer specs (other weights).
  expect(comparableBlocks(cases, [0, 1, 2])).toEqual([0, 1]);
  expect(comparableBlocks(cases.filter(c => c.song !== 'a'), [0, 1, 2])).toEqual([0, 1, 2]);
});

/** review: a window's change is what the scores count, and passages spread out. */
import {passages, choose} from '../tools/eval/passages.ts';
const ride = (strengths: Array<number | null>, air: number, extras: Array<{onset: number; strength: number; cost: number}> = [], terminus?: number) => ({
  beats: [40, 200, 360, 520].map(frame => ({frame})), complete: terminus === undefined, terminus: {frame: terminus ?? 600, reason: 'crash'},
  impact3: {perBeat: strengths.map((s, j) => ({requested: .8, hit: s === null ? null : {strength: s, offset: 0, timingError: 0}})), extras},
  gaps: [0, 1, 2, 3, 4].map(g => [g, 'air', .5, g === 2 ? air : .5])});
it('ranks the window where a scored quantity changed, with what changed', () => {
  const [best] = passages('x', ride([.8, .8, .4, .8], .5), ride([.8, .8, .8, .8], .5), 600).sort((a, b) => b.change - a.change);
  expect(best.items[0].text).toBe('beat at 9.0 s, asked 0.80: strength 0.40 → 0.80');
  expect(best.change).toBeCloseTo(.16);
  expect(best.error).toEqual([expect.closeTo(.16), 0]);
});
it('counts gaps, unasked hits and a missed beat; opposite changes do not cancel', () => {
  const ps = passages('x', ride([.8, .8, .8, null], .9), ride([.8, .8, .8, .8], .5, [{onset: 380, strength: .5, cost: .25}]), 600);
  expect(ps.at(-1)!.items.map(x => x.text)).toEqual(['beat at 13.0 s, asked 0.80: strength missed → 0.80']);
  const middle = ps[2]; // 7.5–11.5 s: the unasked hit, and the air of gap 2 (5.0–9.0 s) for 60 of its 160 frames
  expect(middle.items.map(x => x.text)).toEqual(['unasked hits none → 0.50', 'air 5.0–9.0 s, asked 0.50: 0.90 → 0.50']);
  expect(middle.change).toBeCloseTo(.25 + .16 * 60 / 160);
});
it('stops at the end of a ride that did not finish', () => {
  const ps = passages('x', ride([.8, .8, .8, .8], .5), ride([.8, .8, null, null], .5, [], 300), 600);
  expect(ps.map(p => p.beat)).toEqual([40, 200, 360]);
  expect(ps[2].items.map(x => x.text)).toContain('after stops at 7.5 s (crash)');
});
it('chooses one passage per spec and ride before repeating', () => {
  const p = (id: string, spec: string, from: number, change: number) => ({id, spec, from, to: from + 160, beat: from, change, error: [0, 0] as [number, number], items: []});
  expect(choose([p('a1', 'a', 0, 3), p('a1', 'a', 100, 2.9), p('a2', 'a', 0, 2), p('b1', 'b', 0, 1), p('a1', 'a', 400, 2.5)], 4).map(x => `${x.id}@${x.from}`))
    .toEqual(['a1@0', 'b1@0', 'a2@0', 'a1@400']);
});
