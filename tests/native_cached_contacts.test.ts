import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {LineRiderEngine as Engine,disposeAllWasmEnginesForStudy as dispose} from '../scripts/lib/native_motion/engine.ts';
import {getRiderMetered,resetFrameCount,getPhysicsFrameCount,setPhysicsFrameLimit} from '../scripts/lib/detector.ts';
const core:any=await import('../vendor/lr-core/line-rider-engine/index.js');
const Reference=typeof core.default==='function'?core.default:core.default.default;
const createLine=core.createLineFromJson??core.default.createLineFromJson;
const lines=[{id:1,type:0,x1:-50,y1:10,x2:120,y2:10},{id:2,type:0,x1:120,y1:10,x2:200,y2:-10},
 {id:3,type:0,x1:200,y1:-10,x2:280,y2:30},{id:4,type:0,x1:280,y1:30,x2:400,y2:30}];
it('reads exact reference collision positions from the original simulation without more work',()=>{
 const start={position:{x:0,y:-15},velocity:{x:4,y:0}},hits:number[]=[];
 let reference=new Reference().setStart(start.position,start.velocity);
 for(const json of lines){const line=createLine(json),collide=line.collide.bind(line);
  line.collide=(p:any)=>{const next=collide(p);if(next)hits.push(json.id,next.pos.x,next.pos.y);return next;};reference=reference.addLine(line);}
 const engine=new Engine().setStart(start.position,start.velocity).addLine(lines);
 try{
  resetFrameCount();setPhysicsFrameLimit(null);
  expect(()=>engine.getCachedContactPositions(1,60)).toThrow('already be simulated');
  expect(getPhysicsFrameCount()).toBe(0);expect(engine.getLastFrameIndex()).toBe(0);
  getRiderMetered(engine,60);reference.getRider(60);expect(hits.length).toBeGreaterThan(0);
  const before=getPhysicsFrameCount(),actual=engine.getCachedContactPositions(1,60);
  expect([...actual]).toEqual(hits);expect(getPhysicsFrameCount()).toBe(before);
  expect(engine.getCachedContactPositions(1,60)).toEqual(actual);
  engine.getCachedContactPositions(0,0);expect([...actual]).toEqual(hits);
  const branch=engine.addLine({id:5,type:0,x1:-50,y1:0,x2:400,y2:0});
  expect(()=>branch.getCachedContactPositions(1,60)).toThrow('already be simulated');
  expect(getPhysicsFrameCount()).toBe(before);
 }finally{dispose();setPhysicsFrameLimit(null);}
});
it('rejects an incomplete observation after a budget interruption',()=>{
 const engine=new Engine().setStart({x:0,y:-15},{x:4,y:0}).addLine(lines);
 resetFrameCount();setPhysicsFrameLimit(2);
 try{expect(()=>getRiderMetered(engine,60)).toThrow();expect(()=>engine.getCachedContactPositions(1,60)).toThrow('already be simulated');}
 finally{setPhysicsFrameLimit(null);dispose();}
});

it('binds the packaged native sources and WASM to their recorded manifest',()=>{
 const root=new URL('../scripts/lib/native_motion/',import.meta.url);
 const manifest=JSON.parse(readFileSync(new URL('manifest.json',root),'utf8'));
 for(const [name,expected]of Object.entries(manifest.generated))
  expect(createHash('sha256').update(readFileSync(new URL(name,root))).digest('hex'),name).toBe(expected);
});
