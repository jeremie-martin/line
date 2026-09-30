/** Predeclared unfiltered music review collection. Compile and render are resumable
 * phases; every scheduled outcome remains in the index. Large outputs stay local. */
import assert from 'node:assert/strict';
import {existsSync,mkdirSync,readFileSync,writeFileSync,openSync,closeSync} from 'node:fs';
import {join,resolve,relative} from 'node:path';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {galleryCompilerIdentity,galleryHarnessIdentity,writeGalleryJson} from '../gallery/artifacts.ts';
import {repertoireSongs,validateAutomaticProductionRequest} from '../gallery/repertoire_catalog.ts';
const arg=(k:string,d:string)=>process.argv.find(a=>a.startsWith('--'+k+'='))?.slice(k.length+3)??d;
const out=resolve(arg('out','generated/production-repertoire/library')),phase=arg('phase','compile'),jobs=Number(arg('jobs',phase==='render'?'1':'3'));
if(!['compile','render','index'].includes(phase)||!Number.isSafeInteger(jobs)||jobs<1||jobs>12)throw new Error('invalid phase or jobs');
mkdirSync(out,{recursive:true});
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
const readChecked=(p:string)=>{const bytes=readFileSync(p);assert.equal(createHash('sha256').update(bytes).digest('hex'),readFileSync(p+'.sha256','utf8').trim(),'artifact checksum mismatch');return JSON.parse(bytes.toString());};
const requests=repertoireSongs.flatMap(song=>[101,202,303].map(seed=>({id:song.id+'-'+seed,title:song.title,
 request:validateAutomaticProductionRequest({mode:'production',song:song.id,seed,budget:3000000,referenceBudget:750000,creative:{}})})));
const planPath=join(out,'collection-plan.json');
const compiler=galleryCompilerIdentity(process.cwd()),harness=galleryHarnessIdentity(['scripts/produce/automatic.ts','scripts/produce/music_artifacts.ts','scripts/produce/production_library.ts','scripts/gallery/repertoire_catalog.ts']);
if(phase==='compile'){
 const plan={schema:'line.production-library-plan.v1',compiler,harness,requests};
 if(existsSync(planPath))assert.deepEqual(readChecked(planPath),plan,'library inputs changed; preserve this collection and choose a fresh output directory');else writeGalleryJson(out,'collection-plan.json',plan);
}else if(!existsSync(planPath))throw new Error('compile the predeclared collection first');
const plan=read(planPath),entries=plan.requests.map((r:any)=>({...r,status:'scheduled',manifest:undefined,error:undefined}));
function index(){
 for(const e of entries){const dir=join(out,e.id),manifest=join(dir,'manifest.json'),error=join(dir,'failure.json');
  if(existsSync(manifest)){const m=read(manifest),c=m.cells.find((c:any)=>c.method==='production');e.manifest='/'+relative(process.cwd(),manifest);e.status=c.production.qualified?'Fulfilled':c.valid?'Complete · request misses':'Incomplete';e.score=c.score.score;e.error=undefined;e.video=existsSync(join(dir,c.id+'.video.json'));}
  else if(existsSync(error)){e.status='Failed';e.error=read(error).error;}
 }
 const data={schema:'line.production-library.v1',plan:'/ '+relative(process.cwd(),planPath),entries:entries.map(({request,...e}:any)=>({...e,seed:request.seed,settings:request}))};
 data.plan='/'+relative(process.cwd(),planPath);writeGalleryJson(out,'collection.json',data);writeFileSync('motion-gallery/production-library.json',JSON.stringify(data,null,2)+'\n');
}
index();
async function run(entry:any){const dir=join(out,entry.id);mkdirSync(dir,{recursive:true});
 if(phase==='compile'&&existsSync(join(dir,'manifest.json'))){const manifest=readChecked(join(dir,'manifest.json'));readChecked(join(dir,'plan.json'));for(const cell of manifest.cells){const saved=readChecked(join(dir,cell.path));assert.equal(saved.trackHash,cell.trackHash);assert.equal(saved.planSha256,manifest.planSha256);}return;}
 if(phase==='render'&&!existsSync(join(dir,'manifest.json')))return;
 writeGalleryJson(dir,'request.json',entry.request);
 const args=phase==='compile'?['scripts/produce/automatic.ts','--request='+join(dir,'request.json'),'--out='+dir]:['scripts/produce/render_repertoire.ts','--study='+dir];
 const fd=openSync(join(dir,phase+'.log'),'a');
 try{await new Promise<void>((done,fail)=>{const child=spawn(process.execPath,['--import','tsx',...args],{env:{...process.env,LR_ENGINE:'wasm'},stdio:['ignore',fd,fd]});child.once('error',fail);child.once('exit',(code,signal)=>code===0?done():fail(new Error(`${phase} exited ${code??signal}; see preserved log`)));});
 }catch(e){writeGalleryJson(dir,phase==='compile'?'failure.json':'render-failure.json',{error:String(e)});}
 finally{closeSync(fd);index();console.log(JSON.stringify({id:entry.id,phase,status:entry.status,video:entry.video,error:entry.error}));}
}
if(phase!=='index'){let next=0;await Promise.all(Array.from({length:jobs},async()=>{while(next<entries.length)await run(entries[next++]);}));}
index();
