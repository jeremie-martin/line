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
