import {expect, it} from 'vitest';
import {compileHandoff} from '../scripts/v0/optimizer/handoff.ts';
import {verifyMainConstruction} from '../scripts/gallery/verify_construction.ts';

it('verifies current catch placement and still rejects altered geometry', () => {
  const checkpoint = compileHandoff({duration: 2, preroll: 2,
    contacts: [{t: .6, impact: .4}, {t: 1.3, impact: .5}], axes: {air: () => .5, speed: () => .5}},
  101, {budget: 60000, creative: {repertoire: ['arcs']}});
  const r = checkpoint.repertoire!, {track, rows} = r.result;
  expect(rows.length).toBeGreaterThan(0);
  const options = {radius: 24, channel: 12, sectionStyles: r.styles, fragmentSections: r.fragmentSections};
  expect(verifyMainConstruction(track, rows, options).mainSupportsVerified).toBe(rows.length);
  const damaged = structuredClone(track);
  damaged.lines[0].x1 += .01;
  expect(() => verifyMainConstruction(damaged, rows, options)).toThrow('main construction differs');
});
