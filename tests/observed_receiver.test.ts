import {it,expect} from 'vitest';
import {LineRiderEngine,disposeAllWasmEnginesForStudy} from '../scripts/lib/native_motion/engine.ts';
import {getRiderMetered,resetFrameCount,setPhysicsFrameLimit,getPhysicsFrameCount} from '../scripts/lib/detector.ts';
import {motionArc} from '../scripts/v0/optimizer/arc_geometry.ts';
import {observedReceiver} from '../scripts/v0/optimizer/observed_receiver.ts';

it('observes real release before proposing a connected normal receiving rail',()=>{
 resetFrameCount();setPhysicsFrameLimit(5000);
 try{
  const base=new LineRiderEngine().setStart({x:0,y:0},{x:9,y:1});
  base.prepareCollisionTrace(1);const free=getRiderMetered(base,1),trace=base.readCollisionTrace()[0];
  const points=['PEG','TAIL','NOSE','STRING'].map(k=>trace[k]);
  const control={entry:0,turn:0,exit:0,support:4,bias:0,offset:0,receiverFlight:2,receiverEntry:8,receiverDuration:.5};
  const main=motionArc(points,free.velocity,control,1000,false,0,false,24,4,{guides:false});
  const source=base.addLine(main),receiver=observedReceiver(source,main,1,80,control,2000,{radius:24},false);
  expect(receiver).not.toBeNull();
  const {guide,frame}=receiver!;
  expect(frame).toBeGreaterThan(3);expect(guide.length).toBeGreaterThan(2);
  expect(guide.every(l=>l.type===0&&l.id>=2000)).toBe(true);
  for(let i=1;i<guide.length;i++)expect([guide[i].x1,guide[i].y1]).toEqual([guide[i-1].x2,guide[i-1].y2]);
  expect(source.getAllContactLineIdsAtFrame(frame-1)).toEqual([]);
  expect(source.getAllContactLineIdsAtFrame(frame-2)).toEqual([]);
  const child=source.addLine(guide);
  expect(getRiderMetered(child,frame-1).ballisticState()).toEqual(getRiderMetered(source,frame-1).ballisticState());
  getRiderMetered(child,frame+2);
  expect([frame,frame+1,frame+2].some(f=>child.getAllContactLineIdsAtFrame(f).some(id=>id>=2000))).toBe(true);
  expect(getPhysicsFrameCount()).toBeLessThan(5000);
 }finally{disposeAllWasmEnginesForStudy();setPhysicsFrameLimit(null);}
});
