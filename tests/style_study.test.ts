import {describe, expect, test} from 'vitest';
import {contactAccent, contactKick, phraseAt, recentContacts, targetAt} from '../remotion/src/study/signals.ts';
import {STUDY_LOOKS, studyFrame} from '../remotion/src/study/looks.ts';
import {ribbonPaths, sampleSpectrumRow} from '../remotion/src/study/spectrum.ts';
import {LOCKED_FX} from '../scripts/fx_recipe.ts';

const axes = [{axis: 'air', target: [{t: 0, v: .2}, {t: 1, v: .2}, {t: 1.01, v: .9}, {t: 3, v: .9}]}];
describe('style-study signal semantics', () => {
  test('physical accents follow measured onset and ignore missing strength', () => {
    const contacts = [{t: 1, actualTime: 1.2, impactMeasured: .8}, {t: 1.1, impactMeasured: null}];
    expect(contactAccent(1.1, contacts)).toBe(0);
    expect(contactKick(1.1, contacts)).toBe(0);
    expect(contactAccent(1.23, contacts)).toBeGreaterThan(.5);
    expect(recentContacts(1.3, contacts)).toHaveLength(1);
  });
  test('kick phase is local to the contact, not the absolute song timestamp', () => {
    for (const dt of [0, .02, .06, .12, .25, .5]) {
      expect(contactKick(1 + dt, [{t: 1, impactMeasured: .7}])).toBeCloseTo(contactKick(17 + dt, [{t: 17, impactMeasured: .7}]), 10);
    }
  });
  test('dense repetitions remain bounded and do not normalize weak contacts into strong ones', () => {
    const contacts = Array.from({length: 80}, (_, i) => ({t: i * .02, impactMeasured: 1}));
    for (let t = 0; t < 2; t += .01) {
      expect(contactAccent(t, contacts)).toBeLessThanOrEqual(1);
      expect(Math.abs(contactKick(t, contacts))).toBeLessThanOrEqual(1);
    }
    expect(contactAccent(.03, [{t: 0, impactMeasured: .1}])).toBeLessThan(.1);
  });
  test('opposite overlapping kicks cross smoothly instead of switching dominance', () => {
    const contacts = [{t: 0, impactMeasured: 1}, {t: .06, impactMeasured: 1}];
    for (let t = .1; t < .2; t += .0001) {
      expect(Math.abs(contactKick(t + .0001, contacts) - contactKick(t, contacts))).toBeLessThan(.01);
    }
  });
  test('phrase treatment samples authored asks causally, with a slow transition', () => {
    expect(targetAt(axes, 'speed', 0)).toBeNull();
    expect(phraseAt(axes, 'air', .9)).toBeCloseTo(.2);
    expect(phraseAt(axes, 'air', 1.05)).toBeLessThan(.4);
    expect(phraseAt(axes, 'air', 2)).toBeCloseTo(.9);
  });
  test('ribbon paths handle empty and singleton spectra without invalid coordinates', () => {
    expect(ribbonPaths([], 100, 20)).toEqual({crest: '', fill: ''});
    for (const row of [[0], [1], [0, .5, 1]]) {
      const path = ribbonPaths(row, 100, 20);
      expect(path.crest).not.toMatch(/NaN|undefined|Infinity/);
      expect(path.fill).toContain('L 100,20 L 0,20 Z');
    }
  });
  test('Arc light releases its contact edge fully between impacts', () => {
    const data = {axes: [], contacts: [{t: 1, actualTime: 1.2, impactMeasured: .8}]};
    expect(studyFrame('arc-light', 1.1, data)?.surface?.offset).toBe(0);
    expect(studyFrame('arc-light', 1.24, data)?.surface?.offset).toBeGreaterThan(0);
    expect(studyFrame('arc-light', 2, data)?.surface?.offset).toBe(0);
    expect(studyFrame('arc-light', 1.24, {...data, contacts: [{t: 1.2, impactMeasured: null}]})?.surface?.offset).toBe(0);
  });
  test('bright contact gestures settle without inventing motion before a measured onset', () => {
    const data = {axes: [], contacts: [{t: 1, actualTime: 1.2, impactMeasured: 1}]};
    const quiet = studyFrame('registration', 1.1, data)!;
    expect(studyFrame('registration', 1.24, data)!.surface!.offset).toBeLessThan(quiet.surface!.offset!);
    expect(studyFrame('registration', 2, data)!.surface!.offset).toBe(quiet.surface!.offset);
    for (let t = 0; t < 3; t += .01) {
      expect(studyFrame('press-pop', t, data)!.scale).toBeGreaterThanOrEqual(1.012);
      const ink = studyFrame('living-ink', t, data)!.surface!.core.match(/\d+/g)!.map(Number);
      expect(.2126 * ink[0] + .7152 * ink[1] + .0722 * ink[2]).toBeLessThan(90);
      const look = studyFrame('side-glide', t, data)!;
      // Inverse-map the output corners: overscan must cover every corner even
      // at simultaneous maximum side movement and roll around the rider pivot.
      const angle = -(look.rotation ?? 0) * Math.PI / 180;
      for (const x of [0, 1080]) for (const y of [0, 1920]) {
        const dx = x - 540 - (look.x ?? 0), dy = y - 672;
        const sx = 540 + (dx * Math.cos(angle) - dy * Math.sin(angle)) / look.scale;
        const sy = 672 + (dx * Math.sin(angle) + dy * Math.cos(angle)) / look.scale;
        expect(sx).toBeGreaterThanOrEqual(0); expect(sx).toBeLessThanOrEqual(1080);
        expect(sy).toBeGreaterThanOrEqual(0); expect(sy).toBeLessThanOrEqual(1920);
      }
    }
  });
  test('approved treatment stays untouched; experimental recipes are finite and bounded', () => {
    const data = {axes, contacts: [{t: 1, impactMeasured: 1}]};
    expect(studyFrame('approved', 1, data)).toBeNull();
    expect(studyFrame(undefined, 1, data)).toBeNull();
    for (const id of Object.keys(STUDY_LOOKS).filter(id => id !== 'approved')) {
      const look = studyFrame(id, 1.05, data)!;
      expect(look.scale).toBeGreaterThanOrEqual(1);
      expect(look.scale).toBeLessThan(1.06);
      expect(Math.abs(look.y)).toBeLessThan(20);
      if (['cobalt-clear','mint-clear','silver-tuning','iris-terraces','iris-terraces-high','iris-continuous','graphite-mirror','porcelain-mirror','electric-registration','mint-unshaded'].includes(id)) expect(look.fx.vignette).toBeUndefined();
      else expect(look.fx.vignette).toEqual({style: 'soft-base'});
    }
    expect(LOCKED_FX.chroma.maxPx).toBe(14);
    expect(() => studyFrame('typo', 0, data)).toThrow('Unknown');
  });
});

describe('cool colour controls and spectral reconstruction', () => {
  test('Press colour controls change only their colours and identity', () => {
    const data = {axes, contacts: [{t: 1, impactMeasured: .8}]};
    const geometry = (frame: NonNullable<ReturnType<typeof studyFrame>>) => {
      const {id, background, backgroundRgb, palette, surface, ...rest} = frame;
      const {core, ...material} = surface!;
      return {...rest, material};
    };
    for (const t of [0, 1.04, 1.2, 2]) {
      const base = studyFrame('press-pop', t, data)!;
      for (const id of ['press-porcelain', 'press-mint', 'press-lilac']) {
        expect(geometry(studyFrame(id, t, data)!)).toEqual(geometry(base));
      }
    }
  });
  test('new contact styles settle and keep an unchanging camera where intended', () => {
    const data = {axes: [], contacts: [{t: 1, impactMeasured: 1}]};
    for (const id of ['cobalt-poster', 'magenta-signal']) {
      expect(studyFrame(id, .5, data)!.surface!.offset).toBe(0);
      expect(studyFrame(id, 1.04, data)!.surface!.offset).toBeGreaterThan(0);
      expect(studyFrame(id, 2, data)!.surface!.offset).toBe(0);
    }
    for (const id of ['mint-relief', 'magenta-signal']) {
      expect(studyFrame(id, 1.04, data)!.scale).toBe(1);
    }
  });
});

test('spectrum sampling interpolates real adjacent rows without inventing pre-roll', () => {
  expect(sampleSpectrumRow([[0, 1], [1, 0]], 10, .025)).toEqual([.25, .75]);
  expect(sampleSpectrumRow([[0], [1]], 10, 5)).toEqual([1]);
  expect(sampleSpectrumRow([[1]], 10, -.01)).toEqual([]);
  expect(sampleSpectrumRow([], 10, 0)).toEqual([]);
  expect(sampleSpectrumRow([[1]], 0, 0)).toEqual([]);
  expect(sampleSpectrumRow([[NaN, 2, -1], [1, Infinity, 1]], 10, .05)).toEqual([.5, .5, .5]);
});

 test('clear treatments settle to a single crisp ink without atmosphere or decorative rings', () => {
   const data = {axes: [], contacts: [{t: 1, impactMeasured: 1}]};
   for (const id of ['cobalt-clear','mint-clear','silver-tuning','iris-terraces','graphite-mirror','porcelain-mirror','electric-registration']) {
     const quiet = studyFrame(id, 2, data)!;
     expect(quiet.surface?.shadow).toBeUndefined();
     expect(quiet.surface?.halo).toBeUndefined();
     expect(quiet.atmosphere).toBeUndefined();
     expect(quiet.ripples).toEqual([]);
     expect(quiet.spectrumLayout!.center).toBeGreaterThan(.7);
     expect(quiet.spectrumLayout!.center + quiet.spectrumLayout!.height).toBeLessThan(1);
   }
   expect(studyFrame('electric-registration', 1.04, data)!.surface!.offset).toBeGreaterThan(0);
 });
 test('diagnostic controls isolate vignette and vertical placement', () => {
   const data = {axes: [], contacts: []};
   const mint = studyFrame('mint-relief', 1, data)!;
   expect(studyFrame('mint-unshaded', 1, data)).toEqual({...mint, id: 'mint-unshaded', fx: {}});
   const iris = studyFrame('iris-terraces', 1, data)!;
   expect(studyFrame('iris-continuous', 1, data)).toEqual({...iris, id: 'iris-continuous', spectrumForm: 'weave'});
   expect(studyFrame('iris-terraces-high', 1, data)).toEqual({...iris, id: 'iris-terraces-high', spectrumLayout: {...iris.spectrumLayout!, center: .73}});
 });
