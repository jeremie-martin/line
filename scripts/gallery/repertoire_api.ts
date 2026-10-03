/** Small local job queue for automatic production requests. Compilers run in isolated
 * child processes; their WASM ownership and work meters never overlap in-server. */
import type {IncomingMessage,ServerResponse} from 'node:http';
import {spawn,execFileSync,type ChildProcess} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {existsSync,mkdirSync,readFileSync,readdirSync,writeFileSync,renameSync,openSync,closeSync} from 'node:fs';
import {join,resolve,relative} from 'node:path';
import {resolveJoltMs} from '../produce/jolt.ts';
import {compilerIdentity} from '../lib/compiler_identity.ts';
import {loadSelect} from '../produce/config.ts';
import {repertoireCatalog,validateGalleryRequest,isAutomatic,requestSong,type GalleryRequest} from './repertoire_catalog.ts';
const hash=(data:string|Buffer)=>createHash('sha256').update(data).digest('hex');
const json=(res:ServerResponse,data:unknown,status=200)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
async function body(req:IncomingMessage){let text='';for await(const chunk of req){text+=chunk;if(Buffer.byteLength(text)>65536)throw new Error('request exceeds 64 KiB');}return JSON.parse(text);}
const read=(path:string)=>JSON.parse(readFileSync(path,'utf8'));
function completeArtifacts(directory:string){
 try{const path=join(directory,'output/manifest.json'),bytes=readFileSync(path);
  if(hash(bytes)!==readFileSync(path+'.sha256','utf8').trim())return false;
  const manifest=JSON.parse(bytes.toString());
  return manifest.cells.every((c:any)=>hash(readFileSync(join(directory,'output',c.path)))===c.sha256);
 }catch{return false;}
}
const save=(path:string,value:unknown)=>{writeFileSync(path+'.tmp',JSON.stringify(value)+'\n');renameSync(path+'.tmp',path);};
type Job={id:string;created:string;updated:string;status:'queued'|'compiling'|'complete'|'error'|'cancelled';request:GalleryRequest;identity:string;
 manifest?:string;valid?:boolean;qualified?:boolean;error?:string;render?:'queued'|'rendering'|'complete'|'error';renderError?:string};
export function createRepertoireApi(root=process.cwd()){
 const storage=join(root,'generated/repertoire-jobs'),jobs=new Map<string,Job>(),queue:Array<{id:string;render:boolean}>=[];
 const active=new Map<boolean,{id:string;render:boolean;child:ChildProcess}>();let loaded=false,closed=false;
 const directory=(id:string)=>join(storage,id),persist=(job:Job)=>{job.updated=new Date().toISOString();save(join(directory(job.id),'job.json'),job);};
 const load=()=>{if(loaded)return;loaded=true;mkdirSync(storage,{recursive:true});for(const id of readdirSync(storage)){
  if(!/^[a-f0-9-]{36}$/.test(id))continue;
  try{const job:Job=read(join(directory(id),'job.json'));if(job.id!==id)continue;
   if(['queued','compiling'].includes(job.status)){job.status='error';job.error='Compilation interrupted when the server stopped.';persist(job);}
   if(['queued','rendering'].includes(job.render??'')){job.render='error';job.renderError='Rendering interrupted when the server stopped.';persist(job);}jobs.set(id,job);
  }catch{/* A partial job record is never treated as a completed output. */}
 }};
 function identity(request:GalleryRequest){
  // Includes untracked compiler sources and engine bytes, plus the authored inputs,
  // jolt environment and all of the shared artifact harness. Never cache by title.
  const compiler=compilerIdentity(root).candidateFingerprint;
  const paths=['scripts/produce/automatic.ts','scripts/produce/music_artifacts.ts','scripts/gallery/repertoire_catalog.ts',
   'scripts/gallery/artifacts.ts','scripts/gallery/contacts.ts','scripts/gallery/verify_construction.ts','scripts/produce/jolt.ts','scripts/produce/config.ts','scripts/produce/measure.ts',
   ...readdirSync(join(root,'productions',requestSong(request))).filter(p=>/\.(ts|json)$/.test(p)).map(p=>`productions/${requestSong(request)}/${p}`)];
  const cfg=loadSelect(join(root,'productions',requestSong(request)));
  return hash(JSON.stringify({request,compiler,jolt:resolveJoltMs(),spec:hash(readFileSync(cfg.spec)),audio:hash(readFileSync(cfg.audio)),render:cfg.render,files:paths.map(p=>[p,hash(readFileSync(join(root,p)))])}));
 }
 function pump(){
  if(closed)return;
  // One compiler and one renderer may run independently: a long video must
  // not block the next inexpensive composition. Each owns its own process.
  const next=queue.findIndex(item=>!active.has(item.render));if(next<0)return;const [item]=queue.splice(next,1);
  const job=jobs.get(item.id)!;if(job.status==='cancelled'){pump();return;}
  const dir=directory(job.id);
  try{let args:string[];
  if(item.render){
   args=['--import','tsx','scripts/produce/render_repertoire.ts',`--study=${join(dir,'output')}`];job.render='rendering';job.renderError=undefined;
  }else{job.identity=identity(job.request);args=['--import','tsx','scripts/produce/automatic.ts',`--request=${join(dir,'request.json')}`,`--out=${join(dir,'output')}`];job.status='compiling';}
  persist(job);const fd=openSync(join(dir,item.render?'render.log':'compile.log'),'a');
  const child=spawn(process.execPath,args,{cwd:root,env:{...process.env,LR_ENGINE:'wasm'},stdio:['ignore',fd,fd],detached:true});closeSync(fd);
  active.set(item.render,{...item,child});let finished=false;
  const finish=(error?:string)=>{if(finished)return;finished=true;
   if(job.status!=='cancelled'){
    try{if(error)throw new Error(error);
     if(item.render){const m=read(join(dir,'output/manifest.json'));for(const c of m.cells.filter((c:any)=>c.valid))if(!existsSync(join(dir,'output',c.id+'.video.json')))throw new Error('missing completed video');job.render='complete';}
     else{if(identity(job.request)!==job.identity)throw new Error('Inputs changed during compilation; start a new request');const m=read(join(dir,'output/manifest.json'));job.status='complete';const cell=m.cells.find((c:any)=>c.method===(isAutomatic(job.request)?'production':'composition'));job.valid=cell?.valid===true;job.qualified=cell?.production?.qualified;job.manifest='/'+relative(root,join(dir,'output/manifest.json'));}
    }catch(e){if(item.render){job.render='error';job.renderError=String(e);}else{job.status='error';job.error=String(e);}}
   }
   persist(job);active.delete(item.render);pump();
  };
  child.once('error',e=>finish(e.message));child.once('exit',(code,signal)=>finish(code===0?undefined:`${item.render?'Render':'Compile'} exited ${code??signal}. Open its preserved log for details.`));
  pump();
  }catch(e){if(item.render){job.render='error';job.renderError=String(e);}else{job.status='error';job.error=String(e);}persist(job);active.delete(item.render);queueMicrotask(pump);}
 }
 const handle=async function handle(req:IncomingMessage,res:ServerResponse,url:URL):Promise<boolean>{
  if(!url.pathname.startsWith('/api/repertoire/'))return false;load();
  try{
   if(!['GET','POST'].includes(req.method??'')){json(res,{error:'method not allowed'},405);return true;}
   if(req.method==='POST'&&req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host){json(res,{error:'same-origin requests required'},403);return true;}
   const action=url.pathname.slice('/api/repertoire/'.length);
   if(req.method==='GET'&&action==='catalog'){json(res,repertoireCatalog);return true;}
   if(req.method==='GET'&&action==='jobs'){json(res,{jobs:[...jobs.values()].sort((a,b)=>b.created.localeCompare(a.created))});return true;}
   if(req.method==='POST'&&action==='validate'){json(res,{request:validateGalleryRequest(await body(req))});return true;}
   if(req.method==='POST'&&action==='compile'){
    const request=validateGalleryRequest(await body(req));if(!isAutomatic(request))throw new Error('only automatic arrangements are supported');const key=identity(request);
    const existing=[...jobs.values()].find(j=>j.identity===key&&['queued','compiling','complete'].includes(j.status)&&
     (j.status!=='complete'||completeArtifacts(directory(j.id))));
    if(existing){json(res,{job:existing,reused:true});return true;}
    if(queue.length>=8){json(res,{error:'The queue is full; wait for a compilation to finish.'},429);return true;}
    const id=randomUUID(),now=new Date().toISOString(),job:Job={id,created:now,updated:now,status:'queued',request,identity:key};mkdirSync(directory(id),{recursive:true});
    save(join(directory(id),'request.json'),request);jobs.set(id,job);persist(job);queue.push({id,render:false});pump();json(res,{job,reused:false},202);return true;
   }
   const match=/^jobs\/([a-f0-9-]{36})(?:\/(render|cancel))?$/.exec(action),job=match?jobs.get(match[1]):undefined;
   if(!job){json(res,{error:'unknown workspace route or job'},404);return true;}
   if(req.method==='GET'&&!match![2]){json(res,{job});return true;}
   if(req.method==='POST'&&match![2]==='render'){
    if(job.status!=='complete'||!job.valid)throw new Error('Only complete validated rides can be rendered');
    if(!['queued','rendering','complete'].includes(job.render??'')){job.render='queued';persist(job);queue.push({id:job.id,render:true});pump();}json(res,{job},202);return true;
   }
   if(req.method==='POST'&&match![2]==='cancel'){
    if(job.status!=='complete'){job.status='cancelled';persist(job);}
    for(const running of active.values())if(running.id===job.id){if(running.render){job.render='error';job.renderError='Rendering cancelled.';persist(job);}if(running.child.pid)try{process.kill(-running.child.pid,'SIGTERM');}catch{}}
    for(let i=queue.length-1;i>=0;i--)if(queue[i].id===job.id){if(queue[i].render){job.render='error';job.renderError='Rendering cancelled.';persist(job);}queue.splice(i,1);}
    json(res,{job});return true;
   }
   json(res,{error:'method not allowed'},405);
  }catch(e){json(res,{error:e instanceof Error?e.message:String(e)},400);}
  return true;
 };
 return Object.assign(handle,{close(){
  closed=true;queue.length=0;
  for(const job of jobs.values()){
   let changed=false;
   if(['queued','compiling'].includes(job.status)){job.status='error';job.error='Compilation interrupted by server shutdown.';changed=true;}
   if(['queued','rendering'].includes(job.render??'')){job.render='error';job.renderError='Rendering interrupted by server shutdown.';changed=true;}
   if(changed)persist(job);
  }
  for(const running of active.values())if(running.child.pid)try{process.kill(-running.child.pid,'SIGTERM');}catch{}
 }});
}
