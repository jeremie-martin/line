import {it,expect} from 'vitest';
import fixture from './fixtures/repertoire_authored_window.json';
import {inspectConstruction} from '../scripts/v0/optimizer/repertoire_realization.ts';
import {inspectConstructionWindow} from '../scripts/v0/optimizer/repertoire_candidate.ts';
import type {ConstructionRequest} from '../scripts/v0/optimizer/repertoire_policy.ts';
import type {TrackLine} from '../scripts/v0/types.ts';
import transfer from './fixtures/transfer_body_contacts.json';
it('does not substitute a scheduled window for the independently checked authored window',()=>{
 const request=fixture.request as ConstructionRequest,lines=fixture.lines as TrackLine[],guides=new Set(fixture.guideIds);
 const frames=Array.from({length:request.next},(_,frame)=>({contactLineIds:fixture.collisions[frame-fixture.frame0]??[]}));
 // Captured from the complete native replay, not invented contact IDs. The
 // one-frame-early catch passes in its scheduled window but misses the authored one.
 expect(inspectConstruction(request,lines,guides,fixture.collisions).fulfilled).toBe(true);
 expect(inspectConstructionWindow(request,lines,guides,frames).reasons).toContain('bypassed-shape');
 expect(inspectConstructionWindow({...request,frame:fixture.frame0},lines,guides,frames).fulfilled).toBe(true);
});
it('does not mistake a sled-only contact gap for a body-free transfer',()=>{
 const request=transfer.request as ConstructionRequest,lines=transfer.lines as TrackLine[],guides=new Set(transfer.guideIds);
 const frames=Array.from({length:request.next},(_,f)=>({contactLineIds:transfer.sled[f-request.frame]??[],position:transfer.positions[f-request.frame]}));
 expect(inspectConstructionWindow(request,lines,guides,frames).fulfilled).toBe(true);
 const checked=inspectConstructionWindow(request,lines,guides,frames,f=>transfer.all[f-request.frame]);
 expect(checked.reasons).toContain('missing-separated-transfer');
});

it('counts contacted frames once and permits every traversal stage within the same frame',()=>{
 const lines=Array.from({length:4},(_,i)=>({id:i,type:0,x1:(i-1)*10,y1:0,x2:i*10,y2:0})) as TrackLine[];
 lines.push({id:4,type:0,x1:30,y1:-10,x2:0,y2:-10} as TrackLine);
 const result=inspectConstruction({section:0,construction:'arcs',guidance:'required'} as ConstructionRequest,
  lines,new Set([4]),[[3,2,1,1,999],[],[4,4]]);
 expect(result.mainContactFrames).toBe(1);expect(result.guideContactFrames).toBe(1);
 expect(result.contactedMainSegments).toBe(3);expect(result.orderedTraversal).toEqual([0,0,0]);
 expect(result.fulfilled).toBe(true);
});
