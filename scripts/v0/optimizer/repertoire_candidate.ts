/** Search and final evaluation use the same authored construction window even
 * when contact scheduling uses the musical judge's one-frame timing tolerance.
 * `frames` is a complete trajectory indexed from frame zero. */
import {inspectLayout} from './repertoire_layout.ts';
import type {ConstructionRequest} from './repertoire_policy.ts';
import type {TrackLine} from '../types.ts';
export function inspectConstructionWindow(request:ConstructionRequest,lines:TrackLine[],guideIds:ReadonlySet<number>,frames:readonly {contactLineIds:number[];position?:{x:number;y:number}}[],allContacts?:(frame:number)=>number[]){
 const count=Math.max(0,Math.min(request.next,frames.length)-request.frame);
 return inspectLayout(request,lines,guideIds,Array.from({length:count},(_,offset)=>
  allContacts?allContacts(request.frame+offset):frames[request.frame+offset].contactLineIds),frames.slice(request.frame,request.next).map(f=>f.position));
}
