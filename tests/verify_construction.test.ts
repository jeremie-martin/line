import {expect, it} from 'vitest';
import {compileHandoff} from '../scripts/v0/optimizer/handoff.ts';
import {verifyMainConstruction} from '../scripts/gallery/verify_construction.ts';
import {arcRailGroups} from '../scripts/v0/optimizer/arc_guidance.ts';
import {LineRiderEngine as Engine, disposeEngines} from '../scripts/lib/native_motion/engine.ts';

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

  const main=arcRailGroups(track.lines).get(0)![0];
  expect(main.length).toBeGreaterThan(2);
  const hole=structuredClone(track);
  hole.lines=hole.lines.filter(l=>l.id!==main[1].id);
  expect(()=>verifyMainConstruction(hole,rows,options)).toThrow();

  // A contiguous subset alone is insufficient: reject a removed end that the rider uses.
  const used=new Set<number>();
  try {
    const engine=new Engine().setStart(track.startPosition,track.riders[0].startVelocity).addLine(track.lines);
    for(let f=1;f<=track.duration;f++){
      engine.getRider(f);
      for(const id of engine.getAllContactLineIdsAtFrame(f))used.add(id);
    }
  } finally {disposeEngines();}
  const index=main.findIndex(l=>used.has(l.id));
  expect(index).toBeGreaterThanOrEqual(0);
  expect(index).toBeLessThan(main.length-1);
  const cut=new Set(main.slice(0,index+1).map(l=>l.id)),damagedEnd=structuredClone(track);
  damagedEnd.lines=damagedEnd.lines.filter(l=>!cut.has(l.id));
  expect(()=>verifyMainConstruction(damagedEnd,rows,options)).toThrow(/main construction/);
});
