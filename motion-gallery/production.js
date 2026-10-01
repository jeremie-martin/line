import {prepareView} from './replay.js';
const $=id=>document.getElementById(id),audio=$('audio');
const names={arcs:'Arcs',fold:'Folds',serpentine:'S sweeps',scallops:'Ripples',terraces:'Terraces',scattered:'Scattered'};
let catalog,records=[],views=[],seconds=0,playing=false,opening=0,controller,currentJob,manifest,manifestUrl,pendingJob,audioObjectUrl;
const audioCache=new Map();
const fmt=(v,n=2)=>Number.isFinite(v)?v.toFixed(n):'—';
function el(tag,text,cls){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;}
function status(message,error=false){$('status').textContent=message;$('status').classList.toggle('error',error);}
async function api(path,body){const r=await fetch('/api/repertoire/'+path,body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw new Error(d.error??r.statusText);return d;}
async function checked(url,signal,digest){const r=await fetch(url,{signal});if(!r.ok)throw new Error(`Artifact unavailable (${r.status})`);const bytes=await r.arrayBuffer();if(!digest){const sum=await fetch(url+'.sha256',{signal});if(!sum.ok)throw new Error('Missing artifact identity');digest=(await sum.text()).trim();}const actual=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');if(actual!==digest)throw new Error('Artifact checksum mismatch');return JSON.parse(new TextDecoder().decode(bytes));}
async function verifiedAudio(c,signal){
 let blob=audioCache.get(c.audioSha256);
 if(!blob){
  const response=await fetch('/'+c.audioPath,{signal});if(!response.ok)throw new Error('Music unavailable');
  const bytes=await response.arrayBuffer(),digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
  signal.throwIfAborted();if(digest!==c.audioSha256)throw new Error('Music does not match the saved recording');
  blob=new Blob([bytes],{type:'audio/mpeg'});
 }
 signal.throwIfAborted();audioCache.delete(c.audioSha256);audioCache.set(c.audioSha256,blob);
 while(audioCache.size>4)audioCache.delete(audioCache.keys().next().value);
 return blob;
}
function pause(){playing=false;audio.pause();$('play').textContent='Play';}
function draw(){
 $('time').textContent=fmt(seconds)+' s';$('seek').value=seconds;
 views.forEach((entry,i)=>{const canvas=$(i?'reference':'production'),r=records[i],at=Math.max(0,Math.min(seconds*40,r.trace.frames.length-1)),f=Math.floor(at),a=r.trace.frames[f],b=r.trace.frames[Math.min(f+1,r.trace.frames.length-1)],t=at-f;
 if(a&&b)entry.view.draw(canvas,{x:a[0]+(b[0]-a[0])*t,y:a[1]+(b[1]-a[1])*t,w:canvas.clientWidth,h:canvas.clientHeight,z:+$('zoom').value,r:Math.min(2,devicePixelRatio)},at,$('inspect').checked);
 });
}
function seek(t){seconds=Math.max(0,Math.min(+$('seek').max,t));if(audio.readyState>=1)audio.currentTime=seconds;draw();}
function tick(){if(playing){seconds=audio.currentTime;if(seconds>=+$('seek').max)pause();draw();}requestAnimationFrame(tick);}requestAnimationFrame(tick);
$('play').onclick=async()=>{if(playing)return pause();try{if(seconds>=+$('seek').max)seek(0);$('movie').pause();audio.currentTime=seconds;await audio.play();playing=true;$('play').textContent='Pause';}catch(e){status(e.message,true);}};
$('seek').oninput=()=>{pause();$('movie').pause();seek(+$('seek').value);};$('zoom').oninput=draw;$('inspect').onchange=draw;$('rate').onchange=()=>audio.playbackRate=+$('rate').value;
audio.onended=pause;audio.onerror=()=>{pause();if(audio.getAttribute('src'))status('Music unavailable; you can still scrub the saved ride.',true);};window.addEventListener('resize',draw);document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
function clearMovie(){const v=$('movie');v.pause();v.removeAttribute('src');v.load();v.hidden=true;for(const id of ['movie-link','reference-movie-link']){$(id).hidden=true;$(id).removeAttribute('href');}}
async function loadMovie(m,url,signal,token){
 for(const method of ['production','baseline']){
  const c=m.cells.find(c=>c.method===method),recordUrl=new URL(c.id+'.video.json',url);
  const probe=await fetch(recordUrl,{signal});if(!probe.ok)continue;
  const v=await checked(recordUrl.href,signal);if(v.identity.planSha256!==m.planSha256||v.identity.cellSha256!==c.sha256)throw new Error('Video does not match saved ride');
  if(token!==opening)return;
  const src=new URL(v.full.path,url).href,link=$(method==='production'?'movie-link':'reference-movie-link');link.href=src;link.hidden=false;
  if(method==='production'){$('movie').src=src;$('movie').hidden=false;}
 }
}
async function openResult(path,job){
 const token=++opening;controller?.abort();controller=new AbortController();const {signal}=controller;pause();clearMovie();status('');currentJob=job;views=[];records=[];seconds=0;$('result').hidden=false;$('play').disabled=true;$('seek').disabled=true;$('render').hidden=true;$('timeline').replaceChildren();$('observations').replaceChildren();$('result-title').textContent='Loading saved track…';$('result-note').textContent='Verifying artifacts and native rider playback…';$('record-link').removeAttribute('href');
 for(const id of ['production','reference']){const c=$(id);c.getContext('2d').clearRect(0,0,c.width,c.height);}audio.removeAttribute('src');audio.load();if(audioObjectUrl){URL.revokeObjectURL(audioObjectUrl);audioObjectUrl=undefined;}delete audio.dataset.source;delete audio.dataset.sha256;
 try{
  const url=new URL(path,location.href),m=await checked(url.href,signal),cells=['production','baseline'].map(method=>m.cells.find(c=>c.method===method));if(cells.some(c=>!c))throw new Error('Missing production comparison');
  const data=await Promise.all(cells.map(c=>checked(new URL(c.path,url).href,signal,c.sha256)));data.forEach(r=>{if(r.planSha256!==m.planSha256)throw new Error('Mismatched plan identity');});
  const prepared=await Promise.all(data.map((r,i)=>prepareView(r,cells[i].sha256,signal)));if(token!==opening)return;
  records=data;views=prepared;manifest=m;manifestUrl=url;const [ride,base]=cells,p=ride.production;
  $('result-title').textContent=`${m.plan.cases[0].title} · seed ${ride.seed}`;$('result-note').textContent=p.qualified?'Complete ride · every requested construction fulfilled.':ride.valid?'Complete ride · some requested constructions were not fulfilled.':`Incomplete ride · ${ride.failure?.reason??p.constructionFailure??'see saved diagnostics'}`;$('result-note').classList.toggle('error',!p.qualified);
  $('production-metrics').textContent=`Musical score ${fmt(ride.score.score,1)} · ${p.realization.fulfilledSections}/${p.realization.requested} requests · ${fmt(ride.compileMs/1000,1)} s`;
  $('reference-metrics').textContent=`Musical score ${fmt(base.score.score,1)} · ${base.valid?'complete':'incomplete'}`;
  $('seek').max=Math.min(m.plan.cases[0].durationFrames/40,...data.map(r=>(r.trace.frames.length-1)/40));$('seek').disabled=false;
  const real=new Map(p.realization.sections.map(r=>[r.section,r]));
  $('timeline').replaceChildren(...p.plan.phrases.map(phrase=>{const requests=p.plan.requests.slice(phrase.first,phrase.first+phrase.count),ok=requests.every(r=>real.get(r.section)?.fulfilled),b=el('button',`${names[phrase.construction]} · ${fmt(requests[0].frame/40,1)}s`,ok?'':'unfulfilled');b.title=`${phrase.guidance} guidance; ${ok?'fulfilled':'unfulfilled'}`;b.onclick=()=>{pause();$('movie').pause();seek(requests[0].frame/40-.3);};return b;}));
  $('observations').replaceChildren(...p.plan.requests.slice(1).map(r=>{const result=real.get(r.section),tr=el('tr');for(const t of [r.section,fmt(r.frame/40),names[r.construction],r.guidance,result?.fulfilled?'Fulfilled':result?.reasons?.join(', ')??'Not built'])tr.append(el('td',String(t)));return tr;}));
  $('work').textContent=`Automatic compile: ${ride.physicalFrames.toLocaleString()} of ${ride.allowance.toLocaleString()} physics frames. Ordinary reference: ${base.physicalFrames.toLocaleString()} frames, accounted separately. Independent judging and video rendering are separate. ${p.plan.policy}. The physical checks establish functional construction, not an aesthetic rating.`;
  $('record-link').href=new URL(ride.path,url).href;$('render').hidden=!job||!ride.valid;$('render').disabled=['queued','rendering','complete'].includes(job?.render);$('render').textContent=job?.render==='complete'?'Videos ready':job?.render==='rendering'?'Rendering…':'Render finished videos';seek(0);
  try{
   const c=m.plan.cases[0],blob=await verifiedAudio(c,signal);if(token!==opening)return;
   audioObjectUrl=URL.createObjectURL(blob);audio.src=audioObjectUrl;audio.dataset.source=c.audioPath;audio.dataset.sha256=c.audioSha256;audio.load();audio.playbackRate=+$('rate').value;$('play').disabled=false;
  }catch(e){if(signal.aborted||token!==opening)return;status(e.message+'; the saved ride can still be scrubbed.',true);}
  await loadMovie(m,url,signal,token);
 }catch(e){if(signal.aborted||token!==opening)return;$('result-note').textContent='Could not open result: '+e.message;$('result-note').classList.add('error');}
}
$('movie').onplay=pause;
$('render').onclick=async()=>{try{const {job}=await api(`jobs/${currentJob.id}/render`,{});currentJob=job;$('render').disabled=true;$('render').textContent='Rendering queued…';}catch(e){status(e.message,true);}};
function card(title,description){const c=el('article');c.append(el('h3',title),el('p',description));return c;}
async function refreshJobs(){try{const {jobs}=await api('jobs');const automatic=jobs.filter(j=>j.request.mode==='production');$('jobs').replaceChildren(...automatic.map(job=>{const c=card(`${catalog.songs.find(s=>s.id===job.request.song)?.title??job.request.song} · ${job.request.seed}`,`${job.status}${job.status==='complete'?(job.qualified?' · fulfilled':job.valid?' · request misses':' · incomplete'):''}${job.render?' · video '+job.render:''}`),actions=el('div',undefined,'card-actions');if(job.manifest){const b=el('button','Open ride');b.onclick=()=>openResult(job.manifest,job);actions.append(b);}if(['queued','compiling'].includes(job.status)||['queued','rendering'].includes(job.render)){const b=el('button','Cancel');b.onclick=async()=>{await api(`jobs/${job.id}/cancel`,{});await refreshJobs();};actions.append(b);}const log=el('a','Log');log.href=`/generated/repertoire-jobs/${job.id}/${job.render?'render':'compile'}.log`;actions.append(log);c.append(actions);if(job.error||job.renderError)c.append(el('p',job.error??job.renderError,'error'));return c;}));
 const awaited=automatic.find(j=>j.id===pendingJob);if(awaited){status(`Generation ${awaited.status}${awaited.error?': '+awaited.error:''}`,awaited.status==='error');if(['complete','error','cancelled'].includes(awaited.status)){pendingJob=null;if(awaited.manifest)await openResult(awaited.manifest,awaited);}}
 const updated=automatic.find(j=>j.id===currentJob?.id);if(updated?.render==='complete'&&currentJob.render!=='complete'){currentJob=updated;await loadMovie(manifest,manifestUrl,controller.signal,opening);$('render').textContent='Videos ready';}
 }catch(e){status(e.message,true);}}
$('generate').onsubmit=async event=>{event.preventDefault();try{const request={mode:'production',song:$('song').value,seed:+$('seed').value,budget:+$('budget').value,referenceBudget:750000,creative:{variation:+$('variation').value,guidedBalance:+$('balance').value,repertoire:[...$('repertoire').querySelectorAll('input:checked')].map(i=>i.value)}};status('Submitting automatic arrangement…');const {job,reused}=await api('compile',request);pendingJob=job.id;status(reused?'Opening matching saved request…':'Compilation queued…');await refreshJobs();}catch(e){status(e.message,true);}};
async function loadLibrary(){try{const r=await fetch('production-library.json');if(!r.ok)throw new Error('The review collection is being generated.');const data=await r.json();$('library').replaceChildren(...data.entries.map(entry=>{const c=card(`${entry.title} · ${entry.seed}`,entry.error??entry.status??'Saved automatic arrangement');if(entry.manifest){const b=el('button','Open ride');b.onclick=()=>openResult(entry.manifest);c.append(b);}return c;}));const initial=new URLSearchParams(location.search).get('data')??data.entries.find(e=>e.manifest)?.manifest;if(initial)await openResult(initial);}catch(e){$('library').textContent=e.message;}}
try{catalog=await api('catalog');$('song').replaceChildren(...catalog.songs.map(s=>{const o=el('option',s.title);o.value=s.id;return o;}));for(const [key,name]of Object.entries(names)){const label=el('label'),input=el('input');input.type='checkbox';input.value=key;input.checked=true;label.append(input,document.createTextNode(name));$('repertoire').append(label);}await loadLibrary();await refreshJobs();setInterval(refreshJobs,4000);}catch(e){status(e.message,true);}
