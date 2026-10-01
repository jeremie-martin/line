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
