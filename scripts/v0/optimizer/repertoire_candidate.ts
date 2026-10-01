/** Search and final evaluation use the same authored construction window even
 * when contact scheduling uses the musical judge's one-frame timing tolerance.
 * `frames` is a complete trajectory indexed from frame zero. */
import {inspectLayout} from './repertoire_layout.ts';
import type {ConstructionRequest} from './repertoire_policy.ts';
import type {TrackLine} from '../types.ts';
export function inspectConstructionWindow(request:ConstructionRequest,lines:TrackLine[],guideIds:ReadonlySet<number>,frames:readonly {contactLineIds:number[]}[]){
 return inspectLayout(request,lines,guideIds,frames.slice(request.frame,request.next).map(f=>f.contactLineIds));
}
