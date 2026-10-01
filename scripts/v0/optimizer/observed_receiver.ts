/** Place a connected receiving curve from the native free-flight pose.
 * This only proposes geometry. Full interval, motion and construction checks
 * remain the caller's responsibility; every observation is metered physics. */
import type {LineRiderEngine} from '../../lib/native_motion/engine.ts';
import {getRiderMetered} from '../../lib/detector.ts';
import {motionArc,type ArcMotionControl,type ArcGeometryStyle} from './arc_geometry.ts';
import {makeSolidLine} from '../arc.ts';
import type {TrackLine} from '../types.ts';

export function observedReceiver(engine:LineRiderEngine,main:TrackLine[],frame:number,horizon:number,
 control:ArcMotionControl,id:number,style:ArcGeometryStyle&{radius?:number;subdivisions?:number},terminal=false){
 const own=new Set(main.map(l=>l.id)),flight=Math.round(control.receiverFlight??2);
 const last=horizon-(terminal?3:9);
 let contacted=false,free=0,at=-1;
 for(let f=frame;f<=last;f++){
  const state=getRiderMetered(engine,f).ballisticState();
  if(!state.riderMounted||!state.sledIntact)return null;
  const collisions=engine.getAllContactLineIdsAtFrame(f);
  if(collisions.some(id=>own.has(id)))contacted=true;
  free=contacted&&!collisions.length?free+1:0;
  // Preserve at least the requested number of wholly free frames before the
  // proposed receiving contact, which itself must pass native replay.
  if(free>flight){at=f;break;}
 }
 if(at<0)return null;
 engine.prepareCollisionTrace(at);const rider=getRiderMetered(engine,at);
 const trace=engine.readCollisionTrace()[0],velocity=rider.velocity;
 const incoming=Math.atan2(velocity.y,velocity.x)*180/Math.PI,entry=incoming+(control.receiverEntry??8);
 const angle=entry*Math.PI/180,normal={x:Math.sin(angle),y:-Math.cos(angle)};
 const points=Object.values(trace),top=points.reduce((a,b)=>a.x*normal.x+a.y*normal.y>b.x*normal.x+b.y*normal.y?a:b);
 const available=horizon-at-(terminal?0:6),support=Math.max(2,available*(control.receiverDuration??.65));
 const c:ArcMotionControl={entry,turn:style.profile==='fold'?0:control.receiverTurn??15,
  exit:incoming+(control.receiverExit??35),support,bias:control.bias,offset:control.offset,
  turnFraction:control.turnFraction,
  // The receiving fold bends independently of the lower support. Reusing its
  // signed corner forces both surfaces to turn in the same direction even
  // though their active contact sides are opposite.
  foldBend:style.profile==='fold'?(control.receiverTurn??-(control.foldBend??30)):control.foldBend,foldTiming:control.foldTiming};
 const forward=motionArc([top],velocity,c,0,false,0,false,style.radius,style.subdivisions,
  {...style,guides:false,railLayout:'paired',alignedFoldEntry:true});
 const guide=forward.reverse().map(l=>makeSolidLine(id++,l.x2,l.y2,l.x1,l.y1));
 return {guide,frame:at};
}
