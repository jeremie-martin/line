/** Independent fixed-engine collision oracle for the native gallery inspector. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {LineRiderEngine as Engine,disposeAllWasmEnginesForStudy as dispose} from '../lib/_lr_engine_wasm.ts';
import {inspectRailContacts} from './contacts.ts';
const sha=(b:string|Buffer)=>createHash('sha256').update(b).digest('hex');
const args=process.argv.slice(2),out=args.find(a=>a.startsWith('--out='))?.slice(6);
assert.ok(out,'--out=PATH required');
const inputs=args.filter(a=>!a.startsWith('--')),rows:any[]=[],studies:any[]=[];
assert.ok(inputs.length,'Supply gallery manifests');
for(const path of inputs){
 const bytes=readFileSync(path);assert.equal(sha(bytes),readFileSync(path+'.sha256','utf8').trim());
 const manifest=JSON.parse(bytes.toString());studies.push({path,sha256:sha(bytes)});
 for(const cell of manifest.cells){
  const raw=readFileSync(resolve(dirname(path),cell.path));assert.equal(sha(raw),cell.sha256);
  const record=JSON.parse(raw.toString());
  try{
   const engine=new Engine().setStart(record.track.startPosition,record.track.riders[0].startVelocity).addLine(record.track.lines);
   const contacts=record.trace.frames.map((_frame:any,f:number)=>[...new Set<number>(engine.getUpdatesAtFrame(f).filter((u:any)=>u.type==='CollisionUpdate').map((u:any)=>u.id))].sort((a,b)=>a-b));
   const inspection=inspectRailContacts(record,contacts);
   rows.push({id:cell.id,artifactSha256:cell.sha256,frames:contacts.length,contactsSha256:sha(JSON.stringify(contacts)),
    collisionFrames:contacts.filter((ids:number[])=>ids.length).length,firstGuideContactFrame:inspection.guideFrames[0]??null,
    summary:inspection.summary,layout:inspection.layout});
  }finally{dispose();}
 }
}
const body=JSON.stringify({schema:'line.gallery-contact-reference.v1',studies,
 engineSha256:sha(readFileSync('engine-rs/target/wasm32-unknown-unknown/release/lr_engine.wasm')),rows},null,2)+'\n';
mkdirSync(dirname(out),{recursive:true});writeFileSync(out,body);writeFileSync(out+'.sha256',sha(body)+'\n');
console.log(JSON.stringify({runs:rows.length,frames:rows.reduce((s,r)=>s+r.frames,0),guideFramesAvailable:rows.filter(r=>r.firstGuideContactFrame!==null).length}));
