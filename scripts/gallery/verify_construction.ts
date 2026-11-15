/** Reconstruct main rails from the saved controls and their actual incoming
 * state. Final curves may retain an unchanged contiguous span of the original.
 * Restoring removed ends must add no contact and change no physical state.
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
  const restored = new Map<number, typeof track.lines>(), removed = new Set<number>();
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
      const actual = groups.get(i)?.[0] ?? [], offset = expected.findIndex(l => l.id === actual[0]?.id);
      assert.ok(actual.length && offset >= 0, `main construction differs at support ${i}`);
      assert.deepEqual(actual, expected.slice(offset, offset + actual.length), `main construction differs at support ${i}`);
      if (actual.length !== expected.length) {
        restored.set(actual[0].id, expected);
        const kept = new Set(actual.map(l => l.id));
        for (const line of expected) if (!kept.has(line.id)) removed.add(line.id);
      }
      checked++;
    }finally{dispose();}
  }
  if (removed.size) {
    const replaced = new Set([...restored.values()].flatMap(lines => lines.map(l => l.id)));
    const original = track.lines.flatMap(l => restored.get(l.id) ?? (replaced.has(l.id) ? [] : [l]));
    try {
      const make = (lines: typeof track.lines) => new Engine().setStart(track.startPosition, track.riders![0].startVelocity).addLine(lines);
      const before = make(original), after = make(track.lines);
      for (let frame = 0; frame <= track.duration; frame++) {
        assert.deepEqual(after.getRider(frame).ballisticState(), before.getRider(frame).ballisticState(), `main construction trimming changes motion at frame ${frame}`);
        assert.ok(!before.getAllContactLineIdsAtFrame(frame).some((id: number) => removed.has(id)), `main construction removed a contacted segment at frame ${frame}`);
      }
    } finally {dispose();}
  }
  return {mainSupportsVerified:checked,exactGeometry:true};
}
