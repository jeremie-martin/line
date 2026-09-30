/** Reconstruct main rails from the saved controls and their actual incoming
 * state. This verifies applied geometry, including a return to ordinary arcs.
 * Validation work is separate from the recorded compilation allowance. */
import assert from 'node:assert/strict';
import {motionArc, type ArcMotionControl} from '../v0/optimizer/arc_geometry.ts';
import type {compileArcMotion,ArcMotionOptions} from '../v0/optimizer/arc_motion.ts';
import {arcRailGroups} from '../v0/optimizer/arc_guidance.ts';
const {LineRiderEngine:Engine,disposeAllWasmEnginesForStudy:dispose}=
  await import(new URL('../lib/native_motion/engine.ts?construction-verification',import.meta.url).href);
export function verifyMainConstruction(track:ReturnType<typeof compileArcMotion>['track'],rows:Array<{frame:number;control:ArcMotionControl}>,
  options:Pick<ArcMotionOptions,'profile'|'profileStrength'|'subdivisions'|'sectionStyles'|'radius'|'channel'>,from=0){
  const groups=arcRailGroups(track.lines);let checked=0;
  for(let i=from;i<rows.length;i++){
    const row=rows[i],prefix=track.lines.filter(l=>Math.floor((l.id-1000)/10000)<i);
    try{
      const base=new Engine().setStart(track.startPosition,track.riders![0].startVelocity),engine=prefix.length?base.addLine(prefix):base;
      const free=engine.getRider(row.frame);engine.prepareCollisionTrace(row.frame);engine.getRider(row.frame);
      const trace=engine.readCollisionTrace()[0],points=['PEG','TAIL','NOSE','STRING'].map(key=>trace[key]);
      const style={...options,...options.sectionStyles?.[i]};
      const expected=arcRailGroups(motionArc(points,free.velocity,row.control,1000+i*10000,false,style.channel,false,style.radius,style.subdivisions,style)).get(i)![0];
      assert.deepEqual(groups.get(i)![0],expected,`main construction differs at support ${i}`);checked++;
    }finally{dispose();}
  }
  return {mainSupportsVerified:checked,exactGeometry:true};
}
