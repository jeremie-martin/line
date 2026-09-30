import {it,expect} from 'vitest';
import {inspectRailContacts} from '../scripts/gallery/contacts.ts';
import {makeSolidLine} from '../scripts/v0/arc.ts';
const lines=[makeSolidLine(1000,0,0,10,0),makeSolidLine(1001,10,0,20,0),
  makeSolidLine(1002,20,-12,10,-12),makeSolidLine(1003,10,-12,0,-12),makeSolidLine(11000,30,0,40,0)];
it('separates rail presence, recorded guide touches and main-rail contacts',()=>{
 const r=inspectRailContacts({method:'paired',track:{lines}},[[],[1003],[1000,1001],[1002,1003,1003]]);
 expect(r.summary).toEqual({supportSections:2,guideSections:1,touchedGuideSections:1,guideSegments:2,touchedGuideSegments:2});
 expect(r.guideFrames).toEqual([1,3]);expect(r.byFrame[2]).toEqual({all:[1000,1001],guides:[]});expect(r.byFrame[3].guides).toEqual([1002,1003]);
 const unused=inspectRailContacts({method:'paired',track:{lines}},[[],[1000]]);
 expect(unused.summary.guideSections).toBe(1);expect(unused.summary.touchedGuideSections).toBe(0);
});
it('does not infer guide rails for fragments, contours or unknown methods',()=>{
 for(const method of ['scattered','ribbon','unregistered']){
  const r=inspectRailContacts({method,track:{lines}},[[],[1003]]);
  expect(r.summary.supportSections).toBeNull();expect(r.guideFrames).toEqual([]);expect(r.byFrame[1].all).toEqual([1003]);
 }
});
it('uses explicit source roles for mixed scattered and connected tracks',()=>{
 const r=inspectRailContacts({method:'mixed',railLayout:'mixed',railGuides:{0:[1003],1:[]},track:{lines}},[[1000,1003]]);
 expect(r.guideFrames).toEqual([0]);expect(r.byFrame[0].guides).toEqual([1003]);expect(r.summary.supportSections).toBe(2);
 expect(()=>inspectRailContacts({method:'mixed',railLayout:'mixed',track:{lines}},[[]])).toThrow('explicit rail roles');
 expect(()=>inspectRailContacts({method:'mixed',railLayout:'mixed',railGuides:{1:[1003]},track:{lines}},[[]])).toThrow('invalid recorded');
});
it('rejects collision IDs outside the recorded track and malformed connected geometry',()=>{
 expect(()=>inspectRailContacts({method:'paired',track:{lines}},[[999]])).toThrow('missing track segment');
 expect(()=>inspectRailContacts({method:'arcs',track:{lines:[...lines,makeSolidLine(1004,7,8,9,8)]}},[[]])).toThrow('at most two');
});
