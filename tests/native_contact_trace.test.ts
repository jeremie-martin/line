import {it,expect} from 'vitest';
import {LineRiderEngine as Engine,disposeAllWasmEnginesForStudy as dispose} from '../scripts/lib/native_motion/engine.ts';
import {getRiderMetered,resetFrameCount,getPhysicsFrameCount,setPhysicsFrameLimit} from '../scripts/lib/detector.ts';
const core:any=await import('../vendor/lr-core/line-rider-engine/index.js');
const Reference=typeof core.default==='function'?core.default:core.default.default;
const createLine=core.createLineFromJson??core.default.createLineFromJson;
const lines=[{id:1,type:0,x1:-50,y1:10,x2:120,y2:10},{id:2,type:0,x1:120,y1:10,x2:200,y2:-10},
 {id:3,type:0,x1:200,y1:-10,x2:280,y2:30},{id:4,type:0,x1:280,y1:30,x2:400,y2:30}];
it('records exact reference collision positions without changing native motion, and charges a repeated observation',()=>{
 const start={position:{x:0,y:-15},velocity:{x:4,y:0}},hits:any[]=[];
 let reference=new Reference().setStart(start.position,start.velocity);
 for(const json of lines){const line=createLine(json),collide=line.collide.bind(line);
  line.collide=(p:any)=>{const next=collide(p);if(next)hits.push({line:json.id,x:next.pos.x,y:next.pos.y});return next;};reference=reference.addLine(line);}
 const engine=new Engine().setStart(start.position,start.velocity).addLine(lines);
 try{
  resetFrameCount();setPhysicsFrameLimit(null);const expected=getRiderMetered(engine,60).ballisticState();
  reference.getRider(60);expect(hits.length).toBeGreaterThan(0);
  const before=getPhysicsFrameCount();engine.prepareContactTrace(1,60);getRiderMetered(engine,60);const actual=engine.endContactTrace();
  expect(actual).toEqual(hits);expect(engine.getRider(60).ballisticState()).toEqual(expected);
  expect(getPhysicsFrameCount()-before).toBe(60);
  engine.prepareContactTrace(1,60);getRiderMetered(engine,60);expect(engine.endContactTrace()).toEqual(actual);
  getRiderMetered(engine,65);expect(engine.endContactTrace()).toEqual(actual);
 }finally{engine.endContactTrace();dispose();setPhysicsFrameLimit(null);}
});
it('ends observation after a budget interruption so later engines cannot append to it',()=>{
 const engine=new Engine().setStart({x:0,y:-15},{x:4,y:0}).addLine(lines);
 resetFrameCount();setPhysicsFrameLimit(2);engine.prepareContactTrace(1,60);
 try{expect(()=>getRiderMetered(engine,60)).toThrow();}finally{engine.endContactTrace();setPhysicsFrameLimit(null);}
 const before=engine.endContactTrace();getRiderMetered(engine,60);expect(engine.endContactTrace()).toEqual(before);dispose();
});
