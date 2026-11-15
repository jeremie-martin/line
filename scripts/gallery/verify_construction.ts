/** Reconstruct main rails from the saved controls and their actual incoming
 * state. This verifies applied geometry, including a return to ordinary arcs.
 * The gone-through cleanup (arc_gone_through.ts) may shorten a main line at
 * either end after the ride is built, never break or move it: the saved line
 * must be one unbroken run of the drawn one, piece for piece. `shortened`
 * counts the pieces it lost, by support.
 * Validation work is separate from the recorded compilation allowance. */
import assert from 'node:assert/strict';
import {catchReceivers, receiverPoints, motionArc, type ArcMotionControl, type ArcSectionStyle} from '../v0/optimizer/arc_geometry.ts';
import type {compileArcMotion} from '../v0/optimizer/arc_motion.ts';
import {arcRailGroups} from '../v0/optimizer/arc_guidance.ts';
const {LineRiderEngine:Engine,disposeEngines:dispose}=
  await import(new URL('../lib/native_motion/engine.ts?construction-verification',import.meta.url).href);
export function verifyMainConstruction(track:ReturnType<typeof compileArcMotion>['track'],rows:Array<{frame:number;control:ArcMotionControl}>,
  options:Pick<ArcSectionStyle,'profile'|'profileStrength'|'profileStart'|'rippleCycles'|'foldAngle'|'subdivisions'|'faces'>&
  {sectionStyles?:Record<number,ArcSectionStyle>;radius?:number;channel?:number;fragmentSections?:number[]},from=0){
  const fragments=new Set(options.fragmentSections??[]);
  const groups=arcRailGroups(track.lines.filter(l=>!fragments.has(Math.floor((l.id-1000)/10000))));let checked=0;
  const shortened:Record<number,number>={};
  for(let i=from;i<rows.length;i++){
    if(fragments.has(i))continue;
    const row=rows[i],prefix=track.lines.filter(l=>Math.floor((l.id-1000)/10000)<i);
    try{
      const base=new Engine().setStart(track.startPosition,track.riders![0].startVelocity),engine=prefix.length?base.addLine(prefix):base;
      const free=engine.getRider(row.frame);engine.prepareCollisionTrace(row.frame);engine.getRider(row.frame);
      // The same receivers the compiler built the rail from (half a frame past the collision pass).
      const points=receiverPoints(catchReceivers(engine.readCollisionTrace()[0]),row.control);
      const style={...options,...options.sectionStyles?.[i]};
      const expected=arcRailGroups(motionArc(points,free.velocity,row.control,1000+i*10000,style.channel,style.radius,style.subdivisions,style)).get(i)![0];
      const [main=[],rail=[]]=groups.get(i)??[],at=expected.findIndex(l=>l.id===main[0]?.id),drawn=new Set(expected.map(l=>l.id));
      assert.ok(at>=0&&!rail.some(l=>drawn.has(l.id)),`main construction differs at support ${i}`);
      assert.deepEqual(main,expected.slice(at,at+main.length),`main construction differs at support ${i}`);
      if(main.length<expected.length)shortened[i]=expected.length-main.length;
      checked++;
    }finally{dispose();}
  }
  return {mainSupportsVerified:checked,exactGeometry:true,shortened};
}
