import {describe, expect, it} from 'vitest';
import {COLLECTION, DROPS, DROP_ONLY} from '../scripts/video/collection.js';
import {SCHEMES, DROP_SCHEMES} from '../scripts/video/palettes.js';
import {DARK, LIGHT, SHARES, chooseLook} from '../scripts/video/choose.js';
import {resolveLook} from '../scripts/video/look.js';
import {createTheme} from '../scripts/video/theme.js';

describe('the look of each video', () => {
  it('pairs only light themes with dark partners, each pairing its own scheme (the light theme keeps its layout, so its sun stays)', () => {
    for (const [light, partners] of Object.entries(DROPS)) {
      expect(LIGHT).toContain(light);
      for (const dark of Object.keys(partners)) {
        const only = DROP_ONLY[dark], darkScheme = only ? `drop-${dark}` : COLLECTION[dark].id;
        if (!only) expect(DARK).toContain(dark);
        const pair = `${COLLECTION[light].id}+${darkScheme}`;
        expect(SCHEMES[pair]).toEqual(SCHEMES[COLLECTION[light].id]);
        expect(SCHEMES[pair]).not.toBe(SCHEMES[COLLECTION[light].id]);
        expect(DROP_SCHEMES[pair]).toBe(darkScheme);
      }
    }
  });
  it('switches to the partner at the drop, keeping the light theme\'s hot note and sun; each pairing its own partner', () => {
    const theme = createTheme([2, 4]);
    for (const dark of ['rothko', 'lilyLeaf', 'jungleMoon']) {
      const look = resolveLook('silverRust', {scheme: `${COLLECTION.silverRust.id}+${COLLECTION[dark].id}`, drop: 'switch', paper: 'plain'});
      const inside = theme(3, 0.5, look), before = theme(1, 0.5, look);
      expect(inside.paper).toBe(SCHEMES[COLLECTION[dark].id].paper);
      expect(inside.accent).toBe(SCHEMES[COLLECTION.silverRust.id].accent);
      expect(before.paper).toBe(SCHEMES[COLLECTION.silverRust.id].paper);
    }
  });
  it('is the same for the same key, follows the shares, and gives a drop only to light themes on songs that have one', () => {
    expect(chooseLook('ride-1', {hasDrop: true})).toEqual(chooseLook('ride-1', {hasDrop: true}));
    const runs = Array.from({length: 4000}, (_, i) => chooseLook(`ride-${i}`, {hasDrop: true}));
    const light = runs.filter(r => LIGHT.includes(r.theme)), withDrop = light.filter(r => r.partner);
    expect(Math.abs(light.length / runs.length - SHARES.light)).toBeLessThan(0.03);
    const droppable = light.filter(r => DROPS[r.theme]);
    expect(Math.abs(withDrop.length / droppable.length - SHARES.drop)).toBeLessThan(0.04);
    expect(runs.filter(r => DARK.includes(r.theme)).every(r => !r.partner)).toBe(true);
    for (const r of withDrop) expect(Object.keys(DROPS[r.theme])).toContain(r.partner);
    expect(new Set(runs.map(r => r.theme)).size).toBe(Object.keys(COLLECTION).length);
    expect(Array.from({length: 500}, (_, i) => chooseLook(`x-${i}`, {hasDrop: false})).every(r => !r.partner && r.look.drop === 'off')).toBe(true);
  });
});
