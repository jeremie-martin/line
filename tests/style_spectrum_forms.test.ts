import {createRequire} from 'node:module';
import {describe, expect, test} from 'vitest';
import {SpectrumForms, type SpectrumForm, type SpectrumFormsProps} from '../remotion/src/study/SpectrumForms.tsx';

const require = createRequire(new URL('../remotion/package.json', import.meta.url));
const {createElement} = require('react');
const {renderToStaticMarkup} = require('react-dom/server');
const modes: SpectrumForm[] = ['contours', 'memory', 'stems', 'blocks', 'dots', 'fan', 'rails'];
const defaults: SpectrumFormsProps = {
  mode: 'contours', row: [.2, .8, .4], history: [], width: 300, height: 100,
  palette: ['#126', '#f84'], accent: .5, dark: false,
};
const markup = (props: Partial<SpectrumFormsProps>): string => renderToStaticMarkup(createElement(SpectrumForms, {...defaults, ...props}));

describe('transparent experimental spectrum forms', () => {
  test('empty data and silent bands do not invent visible marks', () => {
    for (const mode of modes) {
      expect(markup({mode, row: []})).toBe('');
      expect(markup({mode, row: [0, 0, 0]})).not.toMatch(/<(path|line|rect|circle)\b/);
      expect(markup({mode, width: 0})).toBe('');
    }
  });
  test('invalid and out-of-range inputs are bounded rather than leaking invalid SVG coordinates', () => {
    for (const mode of modes) {
      const invalid = markup({mode, row: [-1, NaN, Infinity, 2], accent: Infinity, palette: []});
      const clamped = markup({mode, row: [0, 0, 0, 1], accent: 0, palette: []});
      expect(invalid).toBe(clamped);
      expect(invalid).not.toMatch(/NaN|Infinity|undefined/);
    }
  });
  test('contours and memory have no filled area and history uses actual past rows', () => {
    const contours = markup({mode: 'contours'});
    expect(contours.match(/<path /g)).toHaveLength(4);
    expect(contours).toContain('fill="none"');
    const memory = markup({mode: 'memory', history: [[.9, .1, .9], [.1, .1, .1]]});
    expect(memory.match(/<path /g)).toHaveLength(3);
    expect(memory).toContain('fill="none"');
    expect(memory).not.toBe(markup({mode: 'memory', history: [[.1, .9, .1], [.1, .1, .1]]}));
    expect(markup({mode: 'memory', history: Array.from({length: 10}, () => [.5])}).match(/<path /g)).toHaveLength(4);
  });
  test('contact accents change stem caps without moving the band outside the viewport', () => {
    const quiet = markup({mode: 'stems', row: [1], accent: 0});
    const hit = markup({mode: 'stems', row: [1], accent: 1});
    expect(hit).not.toBe(quiet);
    for (const source of [quiet, hit]) {
      const radius = Number(source.match(/ r="([^"]+)"/)?.[1]);
      const top = Number(source.match(/ cy="([^"]+)"/)?.[1]);
      expect(radius).toBeGreaterThan(0);
      expect(top - radius).toBeGreaterThanOrEqual(0);
      expect(top + radius).toBeLessThanOrEqual(defaults.height);
    }
  });
  test('print blocks leave lateral gaps, stay in bounds, and remain translucent', () => {
    const source = markup({mode: 'blocks', row: [1, 0, 1], accent: 1});
    expect(source.match(/<rect /g)).toHaveLength(2);
    expect(Number(source.match(/ width="([^"]+)"/)?.[1])).toBeCloseTo(58);
    expect(source).toContain('y="0"');
    expect(source).toContain('height="100"');
    expect(source).toContain('opacity="0.85"');
  });
  test('dots represent occupied frequency levels with no arbitrary particles', () => {
    expect(markup({mode: 'dots', row: [.5]}).match(/<circle /g)).toHaveLength(6);
    expect(markup({mode: 'dots', row: [1]}).match(/<circle /g)).toHaveLength(12);
  });
  test('dot boundaries and their moving bright crest stay continuous across frequency levels', () => {
    const opacities = (value: number): number[] => {
      const source = markup({mode: 'dots', row: [value], accent: 1});
      const values = [...source.matchAll(/ opacity="([^"]+)"/g)].map(match => Number(match[1]));
      return Array.from({length: 12}, (_, i) => values[i] ?? 0);
    };
    for (let level = 1; level < 12; level++) {
      const before = opacities(level / 12 - .00001), after = opacities(level / 12 + .00001);
      for (let i = 0; i < 12; i++) expect(Math.abs(after[i] - before[i])).toBeLessThan(.001);
    }
    const partial = opacities(6.5 / 12);
    expect(partial[6]).toBeGreaterThan(0);
    expect(partial[6]).toBeLessThan(partial[5]);
    expect(partial[7]).toBe(0);
  });
  test('fan preserves band order and stays within the declared spectrum area', () => {
    const source = markup({mode: 'fan', row: [1, .5, 1]});
    expect(source.match(/<line /g)).toHaveLength(3);
    for (const match of source.matchAll(/ [xy][12]="([^"]+)"/g)) {
      const value = Number(match[1]);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(match[0].startsWith(' x') ? defaults.width : defaults.height);
    }
    const peaks = [...source.matchAll(/ x2="([^"]+)"/g)].map(match => Number(match[1]));
    expect(peaks[0]).toBeLessThan(peaks[1]);
    expect(peaks[1]).toBeLessThan(peaks[2]);
    expect(peaks[2] - peaks[0]).toBeGreaterThan(defaults.width * .75);
  });
  test('mirrored side rails preserve the central picture and omit silent bands', () => {
    const source = markup({mode: 'rails', row: [1, 0, .5]});
    expect(source.match(/<line /g)).toHaveLength(4);
    const ends = [...source.matchAll(/ x2="([^"]+)"/g)].map(match => Number(match[1]));
    expect(ends[0]).toBeLessThan(defaults.width * .12);
    expect(ends[1]).toBeGreaterThan(defaults.width * .88);
    expect(ends[2]).toBeLessThan(ends[0]);
    expect(ends[3]).toBeGreaterThan(ends[1]);
    expect(ends[0] + ends[1]).toBeCloseTo(defaults.width);
    expect(ends[2] + ends[3]).toBeCloseTo(defaults.width);
  });
});
