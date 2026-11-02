import {describe, expect, test} from 'vitest';
import {contactAccent, contactKick, phraseAt, recentContacts, targetAt} from '../remotion/src/study/signals.ts';
import {STUDY_LOOKS, studyFrame} from '../remotion/src/study/looks.ts';
import {ribbonPaths} from '../remotion/src/study/spectrum.ts';
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
  test('approved treatment stays untouched; experimental recipes are finite and bounded', () => {
    const data = {axes, contacts: [{t: 1, impactMeasured: 1}]};
    expect(studyFrame('approved', 1, data)).toBeNull();
    expect(studyFrame(undefined, 1, data)).toBeNull();
    for (const id of Object.keys(STUDY_LOOKS).filter(id => id !== 'approved')) {
      const look = studyFrame(id, 1.05, data)!;
      expect(look.scale).toBeGreaterThanOrEqual(1);
      expect(look.scale).toBeLessThan(1.06);
      expect(Math.abs(look.y)).toBeLessThan(20);
      expect(look.fx.vignette).toEqual({style: 'soft-base'});
    }
    expect(LOCKED_FX.chroma.maxPx).toBe(14);
    expect(() => studyFrame('typo', 0, data)).toThrow('Unknown');
  });
});
