import {expect, it} from 'vitest';
// @ts-ignore browser module
import {sourceEvents, vocalFrame} from '../spec-dashboard/music-evidence.js';

it('retains a quieter vocal source at its own timestamp when a drum dominates the merged event', () => {
  const events = [{t: 1, sources: {drums: {t: 1, rise: .8, peak: .9}, vocals: {t: 1.025, rise: .1, peak: .3}}}];
  const rows = sourceEvents(events);
  expect(rows).toHaveLength(2);
  expect(rows[0].source).toBe('drums');
  expect(rows[1]).toMatchObject({source: 'vocals', strength: .1, peak: .3, mergedTime: 1});
  expect(rows[1].t).toBe(1.025);
  expect(events[0].sources.vocals.t).toBe(1.025);
});

it('preserves coincident sources rather than choosing a winner', () => {
  expect(sourceEvents([{t: 2, sources: {vocals: {t: 2, rise: 0, peak: .5}, other: {t: 2, rise: 1, peak: 1}}}])).toHaveLength(2);
});

it('reads the closest centered window and preserves unavailable spectral evidence', () => {
  const evidence = {sampleRate: 100, hopSamples: 1, duration: .03, rms: [.1, .2, .3], spectralChange: [null, .5, 0]};
  expect(vocalFrame(evidence, .004)).toEqual({t: 0, rms: .1, change: null});
  expect(vocalFrame(evidence, .014)).toEqual({t: .01, rms: .2, change: .5});
  expect(vocalFrame(evidence, -.001)).toBeNull();
  expect(vocalFrame(evidence, .03)).toBeNull();
});


it('exposes each band at the same frame without inventing an initial difference', () => {
  const evidence = {sampleRate: 100, hopSamples: 1, duration: .02, rms: [0, .2], spectralChange: [null, .5],
    bandFlux: [{name: 'low', filterCenterHz: [80, 1000], values: [null, 2.5]}]};
  expect(vocalFrame(evidence, 0).bandFlux[0].value).toBeNull();
  expect(vocalFrame(evidence, .014).bandFlux).toEqual([{name: 'low', filterCenterHz: [80, 1000], value: 2.5}]);
});
