import {describe, expect, it} from 'vitest';
import {prepareTrack} from '../scripts/video/track.js';
import {W, H, rideSignals, followCamera, createFraming} from '../scripts/video/camera.js';
import {FS, strength, rawSignals, intensity, intensityAt, rideIntensity} from '../scripts/video/intensity.js';
import {spectrumAt, accentedBands} from '../scripts/video/music.js';
import {createTheme, dropSpan} from '../scripts/video/theme.js';
import {SCHEMES, DROP_SCHEMES} from '../scripts/video/palettes.js';
import {GRADES, COLOUR_RESPONSES, gradeScheme} from '../scripts/video/grade.js';
import {resolveLook} from '../scripts/video/look.js';
import {COLLECTION} from '../scripts/video/collection.js';

const line = (id: number, x1: number, x2: number, y = 0) => ({id, x1, y1: y, x2, y2: y});

describe('track preparation', () => {
  it('inks connected rails as the rider passes, fills skipped contacts, and leaves unused rails pencil', () => {
    const source = [line(1, 0, 10), line(2, 10, 20), line(3, 24, 34), line(4, 0, 34, 100)];
    const saved = structuredClone(source), centres = [0, 10, 20, 30, 40].map(x => ({x, y: -5}));
    const {lines} = prepareTrack(source, [[], [], [2], [], []], centres);
    expect(lines.map(l => l.inkFrame)).toEqual([1, 2, 4, Infinity]);
    expect(lines.map(l => l.railFrame)).toEqual([1, 1, 1, Infinity]);
    expect(lines.map(l => l.touchFrame)).toEqual([Infinity, 2, Infinity, Infinity]);
    expect(source).toEqual(saved);
  });
  it('proximity can establish a used rail, but crossings and gaps of six units do not connect rails', () => {
    const source = [line(1, 0, 10), line(2, 16, 26), {id: 3, x1: 5, y1: -50, x2: 5, y2: 50}];
    const {lines} = prepareTrack(source, [[1], []], [{x: 0, y: -30}, {x: 10, y: -30}]);
    expect(lines[0].inkFrame).toBe(0);
    expect(lines[1].railFrame).toBe(Infinity); // beyond the ride, despite nearby geometry
    expect(lines[2].railFrame).toBe(1); // proximity at frame 1, not inherited contact at frame 0
    const near = prepareTrack([line(1, 0, 10)], [[], []], [{x: 0, y: -5}, {x: 10, y: -5}]);
    expect(near.lines[0].inkFrame).toBe(1);
  });
  it('visibility is deterministic, deduplicates grid-spanning lines and excludes distant cells', () => {
    const track = prepareTrack([line(1, -1000, 1000), line(2, 9000, 9100)], [], [{x: 0, y: 0}]);
    const here = {z: 6.2, ax: W / 2, ay: H / 2, x: 0, y: 0};
    expect(track.visibleAt(here).map(l => l.id)).toEqual([1]);
    expect(track.visibleAt({...here, x: 9050}).map(l => l.id)).toEqual([2]);
    expect(track.visibleAt(here).map(l => l.id)).toEqual([1]);
  });
});

describe('intensity and music signals', () => {
  it('uses absolute measured strength and sums impacts only at their peaks', () => {
    const raw = rawSignals({speed: [400], hits: [{t: 0.2, s: 0.85}, {t: 0.2, s: 0.6}, {t: 1, s: 1}], duration: 1});
    expect([...raw.speed]).toEqual(new Array(10).fill(400));
    expect(raw.power[2]).toBeCloseTo((strength(0.85) + strength(0.6)) * FS, 12);
    expect([...raw.power].filter(x => x > 0)).toHaveLength(1); // out-of-range peaks never enter
    const none = intensity(rawSignals({speed: [0], hits: [], duration: 10}));
    expect([...none]).toEqual(new Array(100).fill(0));
  });
  it('samples the physics speed on the metric grid, interpolates for drawing, and limits change per second', () => {
    const speed = Array.from({length: 801}, (_, f) => f < 400 ? 0 : 500);
    const samples = rideIntensity(speed, [], 20);
    expect(samples).toEqual(intensity(rawSignals({speed: speed.filter((_, f) => f % 4 === 0), hits: [], duration: 20})));
    for (let f = 1; f < samples.length; f++) expect(Math.abs(samples[f] - samples[f - 1])).toBeLessThanOrEqual(0.3 / FS + 1e-12);
    expect(intensityAt([0.2, 0.8], -1)).toBe(0.2);
    expect(intensityAt([0.2, 0.8], 0.05)).toBeCloseTo(0.5);
    expect(intensityAt([0.2, 0.8], 10)).toBe(0.8);
    expect(intensityAt([0.4], 10)).toBe(0.4);
  });
  it('interpolates spectrum on song time and selects the same hot bands for every shape', () => {
    const sp = {fps: 2, frames: [[0, 0.5, 1], [1, 0.5, 0]]};
    expect(spectrumAt(sp, 0.25)).toEqual([0.5, 0.5, 0.5]);
    expect(spectrumAt(sp, -1)).toEqual(sp.frames[0]); expect(spectrumAt(sp, 10)).toEqual(sp.frames[1]);
    expect([...accentedBands([0.8, 0.25, 0.6, 0.6], 'loud', 0)]).toEqual([0, 2, 3]);
    expect([...accentedBands([0.1, 0.2, 0.3, 0.4], 'heat', 0)]).toEqual([]);
    expect([...accentedBands([0.1, 0.2, 0.3, 0.4], 'heat', 0.5)]).toEqual([3, 2]);
  });
});

describe('camera and framing', () => {
  const centres = Array.from({length: 801}, (_, f) => ({x: f * 8, y: f < 400 ? f * 4 : 1600}));
  const motion = rideSignals(centres);
  it('shares finite differences, holds steady zoom exactly and limits quiet zoom change', () => {
    expect(motion.velocity[0]).toEqual({x: 320, y: 160, speed: Math.hypot(8, 4) * 40});
    const steady = followCamera(motion, {base: 6.2, zoom: 'steady', level: () => {throw new Error('steady needs no intensity');}});
    expect(steady.every(c => c.z === 6.2)).toBe(true);
    const quiet = followCamera(motion, {base: 6.2, zoom: 'quiet', level: f => f < 400 ? 0 : 1});
    expect(quiet[0].z).toBeCloseTo(6.2 * Math.exp(-0.12)); expect(quiet.at(-1).z).toBeCloseTo(6.2);
    for (let f = 1; f < quiet.length; f++) expect(Math.abs(Math.log(quiet[f].z / quiet[f - 1].z))).toBeLessThanOrEqual(0.025 / 40 + 1e-12);
    // While descending, the rider never climbs faster than the approved 45 design px/s.
    for (let f = 1; f < 400; f++) expect(steady[f].ay - steady[f - 1].ay).toBeGreaterThanOrEqual(-45 / 40 - 1e-9);
  });
  it('uses the same rider/world transform through bookends and handles seek, zoom and layout changes independently', () => {
    const level = new Float64Array(200).fill(0.5), times = [{t: 1.8, s: 0.8}];
    const frame = createFraming(motion, level, times, 20), look = resolveLook();
    const overview = frame(0, 0, look), riding = frame(4, 160, look);
    expect(overview.over).toBe(1); expect(overview.z).toBeLessThan(riding.z);
    expect(riding).toMatchObject({x: centres[160].x, y: centres[160].y, z: 6.2, over: 0, ending: false});
    expect(frame(20, 800, look)).toMatchObject({over: 1, ending: true});
    const lower = frame(4, 160, resolveLook(null, {top: 'sun'}));
    expect(lower.ay - riding.ay).toBe(32);
    for (const t of [0, 0.7, 1.8, 10, 18, 20]) for (const zoom of ['quiet', 'steady']) {
      const options = {...look, zoom};
      const c = frame(t, t * 40, options);
      expect(c.ax).toBeGreaterThan(0); expect(c.ax).toBeLessThan(W);
      expect(c.ay).toBeGreaterThan(0); expect(c.ay).toBeLessThan(H);
      expect(c).toEqual(createFraming(motion, level, times, 20)(t, t * 40, options));
    }
    expect(frame(0, 0, {...look, ends: 'none'})).toMatchObject({over: 0, z: 6.2});
  });
});

describe('drop and colour resolution', () => {
  // Hokusai: a production theme with its own judged drop partner
  const hokusai = COLLECTION.hokusai.id, scheme = SCHEMES[hokusai], partner = SCHEMES[DROP_SCHEMES[hokusai]];
  it('snaps authored cues on song time and uses a half-open drop interval', () => {
    expect(dropSpan(null, [])).toBeNull();
    expect(dropSpan([2, 4], [])).toEqual([2, 4]);
    expect(dropSpan([2, 4], [{t: 1.8, s: 0.9}, {t: 2.1, s: 0.9}, {t: 3.5, s: 0.4}])).toEqual([1.8, 3.5]);
    const theme = createTheme([2, 4]), look = resolveLook(null, {scheme: hokusai, paper: 'plain', drop: 'switch'});
    expect(theme(1.999, 0.5, look)).toMatchObject({paper: scheme.paper, irisLight: false});
    expect(theme(2, 0.5, look)).toMatchObject({paper: partner.paper, ink: partner.ink, band: partner.mass, accent: scheme.accent, sun: scheme.accent, irisLight: true});
    expect(theme(4, 0.5, look).paper).toBe(scheme.paper);
    expect(createTheme(null)(2, 0.5, look).paper).toBe(scheme.paper);
  });
  it('switches before grading, carries the accent and sun, and never mutates a palette', () => {
    const original = structuredClone(scheme), look = resolveLook(null, {scheme: hokusai, drop: 'switch'});
    const expected = gradeScheme({...partner, accent: original.accent, sun: original.sun ?? original.accent}, look.paper, 0.7);
    const theme = createTheme([2, 4]);
    expect(theme(3, 0.7, look).scheme).toEqual(expected);
    theme(5, 0.2, look); theme(1, 0.9, look);
    expect(theme(3, 0.7, look).scheme).toEqual(expected);
    expect(scheme).toEqual(original);
  });
  it('has one definition per colour response; plain draws the scheme as it is', () => {
    expect(Object.keys(COLOUR_RESPONSES)).toEqual(['plain', ...Object.keys(GRADES)]);
    for (const [key, value] of Object.entries(GRADES)) expect(COLOUR_RESPONSES[key]).toBe(value.label);
    const theme = createTheme(null), look = resolveLook(null, {scheme: hokusai, paper: 'plain'});
    expect(theme(0, 0.9, look).scheme).toBe(scheme);
    expect(theme(0, 0.9, {...look, paper: 'vibranceSoftHalfPaper'}).ink).not.toBe(scheme.ink);
  });
});
