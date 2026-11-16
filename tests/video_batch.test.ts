import {expect, it} from 'vitest';
import {batchPlan, batchStep} from '../scripts/produce/video_batch.ts';

const known = ['a_song', 'b_song', 'c_song'];

it('plans every chosen song at every seed, a count meaning seeds 1 to N', () => {
  expect(batchPlan('all', '2', known).map(v => v.name)).toEqual(['a_song-1', 'a_song-2', 'b_song-1', 'b_song-2', 'c_song-1', 'c_song-2']);
  expect(batchPlan('c_song,a_song', '101,202,101', known)).toEqual([
    {song: 'c_song', seed: 101, name: 'c_song-101'}, {song: 'c_song', seed: 202, name: 'c_song-202'},
    {song: 'a_song', seed: 101, name: 'a_song-101'}, {song: 'a_song', seed: 202, name: 'a_song-202'}]);
});

it('refuses songs that do not exist and seeds that are not numbers', () => {
  expect(() => batchPlan('a_song,nope', '2', known)).toThrow(/unknown: nope/);
  expect(() => batchPlan('all', '0', known)).toThrow(/--seeds/);
  expect(() => batchPlan('all', '1,x', known)).toThrow(/--seeds/);
});

it('keeps a written video, makes a missing one, and leaves a failed attempt for a person to clear', () => {
  expect(batchStep({video: true, sidecar: true, assets: true})).toBe('done');
  expect(batchStep({video: false, sidecar: false, assets: false})).toBe('make');
  expect(batchStep({video: false, sidecar: false, assets: true})).toBe('failed-earlier');
  expect(batchStep({video: true, sidecar: false, assets: true})).toBe('failed-earlier');
});
