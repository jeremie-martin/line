import {describe, expect, it} from 'vitest';
import {ALIKE, COLLECTION, DROPS, DROP_ONLY, VARIANTS} from '../scripts/video/collection.js';
import {SCHEMES, DROP_SCHEMES} from '../scripts/video/palettes.js';
import {DARK, GROUPS, LIGHT, SHARES, chooseLook} from '../scripts/video/choose.js';
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
    const runs = Array.from({length: 30000}, (_, i) => chooseLook(`ride-${i}`, {hasDrop: true}));
    const light = runs.filter(r => LIGHT.includes(r.theme)), withDrop = light.filter(r => r.partner);
    expect(Math.abs(light.length / runs.length - SHARES.light)).toBeLessThan(0.03);
    const droppable = light.filter(r => DROPS[r.theme]);
    expect(Math.abs(withDrop.length / droppable.length - SHARES.drop)).toBeLessThan(0.04);
    expect(runs.filter(r => DARK.includes(r.theme)).every(r => !r.partner)).toBe(true);
    for (const r of withDrop) expect(Object.keys(DROPS[r.theme])).toContain(r.partner);
    expect(new Set(runs.map(r => r.theme)).size).toBe(Object.keys(COLLECTION).length);
    expect(Array.from({length: 500}, (_, i) => chooseLook(`x-${i}`, {hasDrop: false})).every(r => !r.partner && r.look.drop === 'off')).toBe(true);
  });
  it('draws themes too alike as one theme, and a theme\'s approved variants a quarter of the time', () => {
    const listed = ALIKE.flat();
    expect(new Set(listed).size).toBe(listed.length);
    for (const list of ALIKE) {
      for (const k of list) expect(COLLECTION[k], k).toBeDefined();
      expect(new Set(list.map(k => LIGHT.includes(k))).size, list[0]).toBe(1); // one ground per list
    }
    expect(GROUPS.light.flat().sort()).toEqual([...LIGHT].sort());
    expect(GROUPS.dark.flat().sort()).toEqual([...DARK].sort());
    const runs = Array.from({length: 30000}, (_, i) => chooseLook(`ride-${i}`, {hasDrop: false}));
    // a list of four comes up as often as a theme alone
    const count = (keys: readonly string[]) => runs.filter(r => keys.includes(r.theme)).length;
    const rothkos = ALIKE.find(l => l.includes('rothko'))!, share = (1 - SHARES.light) / GROUPS.dark.length;
    expect(Math.abs(count(rothkos) / runs.length - share)).toBeLessThan(0.3 * share);
    expect(Math.abs(count(['oldRose']) / runs.length - share)).toBeLessThan(0.3 * share);
    for (const [theme, variants] of Object.entries(VARIANTS)) {
      expect(COLLECTION[theme], theme).toBeDefined();
      for (const v of variants) expect(() => resolveLook(theme, v)).not.toThrow();
    }
    const able = runs.filter(r => VARIANTS[r.theme]), varied = able.filter(r => r.variant);
    expect(Math.abs(varied.length / able.length - SHARES.variant)).toBeLessThan(0.04);
    for (const r of varied) expect(r.look).toMatchObject(r.variant!);
    expect(runs.filter(r => !VARIANTS[r.theme]).every(r => r.variant === null)).toBe(true);
  });
});
