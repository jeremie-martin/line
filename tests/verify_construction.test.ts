import {expect, it} from 'vitest';
import {compileHandoff} from '../scripts/v0/optimizer/handoff.ts';
import {verifyMainConstruction} from '../scripts/gallery/verify_construction.ts';
import {arcRailGroups} from '../scripts/v0/optimizer/arc_guidance.ts';

it('verifies current catch placement, accepts main lines shortened at an untouched end, and rejects altered, broken or over-trimmed geometry', () => {
  const checkpoint = compileHandoff({duration: 2, preroll: 2,
    contacts: [{t: .6, impact: .4}, {t: 1.3, impact: .5}], axes: {air: () => .5, speed: () => .5}},
  101, {budget: 60000, creative: {repertoire: ['arcs']}});
  const r = checkpoint.repertoire!, {track, rows} = r.result;
  expect(rows.length).toBeGreaterThan(0);
  const options = {radius: 24, channel: 12, sectionStyles: r.styles, fragmentSections: r.fragmentSections};
  const verified = verifyMainConstruction(track, rows, options);
  expect(verified.mainSupportsVerified).toBe(rows.length);
  const damaged = structuredClone(track);
  damaged.lines[0].x1 += .01;
  expect(() => verifyMainConstruction(damaged, rows, options)).toThrow('main construction differs');
  // The cleanups (unused support ends, gone-through) shorten main lines at an end the rider never touches: accepted.
  expect(Object.keys(verified.shortened).length).toBeGreaterThan(0);
  const main = arcRailGroups(track.lines).get(0)![0];
  const broken = structuredClone(track);
  broken.lines = broken.lines.filter(l => l.id !== main[2].id);
  expect(() => verifyMainConstruction(broken, rows, options)).toThrow('main construction differs');
  // A contiguous run alone is not enough: removing an end the rider uses is refused (a trimmed support ends on a touched piece).
  const usedEnd = structuredClone(track);
  usedEnd.lines = usedEnd.lines.filter(l => l.id !== main.at(-1)!.id);
  expect(() => verifyMainConstruction(usedEnd, rows, options)).toThrow(/main construction/);
});
