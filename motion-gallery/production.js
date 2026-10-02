import {prepareView} from './replay.js';
const $=id=>document.getElementById(id),audio=$('audio');
const names={arcs:'Arcs',fold:'Folds',serpentine:'S sweeps',scallops:'Ripples',terraces:'Terraces',scattered:'Scattered'};
let catalog,records=[],views=[],seconds=0,playing=false,opening=0,controller,currentJob,manifest,manifestUrl,previousUrl,pendingJob,audioObjectUrl,libraryEntries=[],interactionReview;
const audioCache=new Map();
// Range controls serialize with reduced precision. Preserve the policy default
// until the artist actually changes it, including for exact request cache reuse.
let guidedBalance=Number($('balance').defaultValue);
$('balance').oninput=()=>{guidedBalance=Number($('balance').value);};
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
 $('time').textContent=fmt(seconds,interactionReview?3:2)+' s';$('seek').value=seconds;
 ($('comparison').checked?[0,1]:[0]).forEach(index=>{const entry=views[index],r=records[index];if(!entry||!r)return;const canvas=$(index?'reference':'production'),at=Math.max(0,Math.min(seconds*40,r.trace.frames.length-1)),f=Math.floor(at),a=r.trace.frames[f],b=r.trace.frames[Math.min(f+1,r.trace.frames.length-1)],t=at-f;
 if(a&&b)entry.view.draw(canvas,{x:a[0]+(b[0]-a[0])*t,y:a[1]+(b[1]-a[1])*t,w:canvas.clientWidth,h:canvas.clientHeight,z:+$('zoom').value,r:Math.min(2,devicePixelRatio)},at,$('inspect').checked);
 });
 interactionReview?.draw(seconds);
}
function passageLink(updateHistory=true){if(!manifestUrl)return;const url=new URL(location.href);url.searchParams.set('data',manifestUrl.pathname);url.searchParams.set('t',seconds.toFixed(3));if($('comparison').checked)url.searchParams.set('compare','previous');else url.searchParams.delete('compare');$('passage-link').href=url.href;if(updateHistory)history.replaceState(null,'',url);}
function seek(t){seconds=Math.max(+$('seek').min,Math.min(+$('seek').max,t));if(audio.readyState>=1)audio.currentTime=seconds;draw();passageLink();}
async function comparisonChanged(){
 if($('comparison').disabled)return;
 const token=opening,signal=controller?.signal;
 if($('comparison').checked&&previousUrl&&!views[1]){
  // Optional historical playback must neither delay nor prevent the current ride.
  const url=previousUrl,current=records[0],jolt=manifest.plan.jolt;
  $('comparison').disabled=true;status('Loading previous automatic arrangement…');
  try{
   const pm=await checked(url.href,signal),pc=pm.cells.find(c=>c.method==='production');
   if(!pc)throw new Error('Missing previous automatic arrangement');
   const previous=await checked(new URL(pc.path,url).href,signal,pc.sha256);
   if(previous.planSha256!==pm.planSha256||previous.seed!==current.seed||previous.case.id!==current.case.id||pm.plan.jolt!==jolt)throw new Error('Previous arrangement has different musical inputs');
   for(const key of ['audioSha256','specSha256','analysisSha256','durationFrames'])if(previous.case[key]!==current.case[key])throw new Error('Previous arrangement has different '+key);
   const prepared=await prepareView(previous,pc.sha256,signal);
   if(token!==opening)return;
   records[1]=previous;views[1]=prepared;status('');
  }catch(e){if(signal.aborted||token!==opening)return;$('comparison').checked=false;status('Previous comparison unavailable: '+e.message,true);}
  finally{if(token===opening)$('comparison').disabled=false;}
 }
 const shown=$('comparison').checked&&!!views[1];
 $('comparison-ride').hidden=!shown;$('rides').classList.toggle('comparing',shown);
 const r=records[1];if(r)$('reference-metrics').textContent=`Musical score ${fmt(r.score.score,1)} · ${r.valid?'complete':'incomplete'}`;
 draw();passageLink();
}
$('comparison').onchange=comparisonChanged;
function tick(){if(playing){seconds=audio.currentTime;if(seconds>=+$('seek').max)pause();draw();passageLink(false);}requestAnimationFrame(tick);}requestAnimationFrame(tick);
$('play').onclick=async()=>{if(playing)return pause();try{if(seconds>=+$('seek').max||seconds<+$('seek').min)seek(+$('seek').min);$('movie').pause();audio.currentTime=seconds;await audio.play();playing=true;$('play').textContent='Pause';}catch(e){status(e.message,true);}};
$('seek').oninput=()=>{pause();$('movie').pause();seek(+$('seek').value);};$('zoom').oninput=draw;$('inspect').onchange=draw;$('rate').onchange=()=>audio.playbackRate=+$('rate').value;
audio.onended=pause;audio.onerror=()=>{pause();if(audio.getAttribute('src'))status('Music unavailable; you can still scrub the saved ride.',true);};window.addEventListener('resize',draw);document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
function clearMovie(){const v=$('movie');v.pause();v.removeAttribute('src');v.load();v.hidden=true;$('movie-link').hidden=true;$('movie-link').removeAttribute('href');}
async function loadMovie(m,url,signal,token){
  const c=m.cells.find(c=>c.method==='production'),recordUrl=new URL(c.id+'.video.json',url);
  const probe=await fetch(recordUrl,{signal});if(!probe.ok)return;
  const v=await checked(recordUrl.href,signal);if(v.identity.planSha256!==m.planSha256||v.identity.cellSha256!==c.sha256)throw new Error('Video does not match saved ride');
  if(token!==opening)return;
  const src=new URL(v.full.path,url).href;$('movie-link').href=src;$('movie-link').hidden=false;
  $('movie').src=src;$('movie').hidden=false;
}
async function openResult(path,job,initialTime=0){
 interactionReview?.clear();
 const token=++opening;controller?.abort();controller=new AbortController();const {signal}=controller;pause();clearMovie();status('');currentJob=job;views=[];records=[];manifestUrl=undefined;seconds=0;$('result').hidden=false;$('play').disabled=true;$('seek').disabled=true;$('render').hidden=true;$('timeline').replaceChildren();$('observations').replaceChildren();$('review-moments').replaceChildren();$('motion-summary').textContent='';$('result-title').textContent='Loading saved track…';$('result-note').textContent='Verifying artifacts and native rider playback…';$('record-link').removeAttribute('href');
 previousUrl=undefined;$('comparison-control').hidden=true;$('comparison').disabled=true;$('comparison-ride').hidden=true;$('rides').classList.remove('comparing');
 for(const id of ['production','reference']){const c=$(id);c.getContext('2d').clearRect(0,0,c.width,c.height);}audio.removeAttribute('src');audio.load();if(audioObjectUrl){URL.revokeObjectURL(audioObjectUrl);audioObjectUrl=undefined;}delete audio.dataset.source;delete audio.dataset.sha256;
 try{
  const url=new URL(path,location.href),m=await checked(url.href,signal),cells=[m.cells.find(c=>c.method==='production')];if(!cells[0])throw new Error('Missing automatic arrangement');
  const data=await Promise.all(cells.map(c=>checked(new URL(c.path,url).href,signal,c.sha256)));data.forEach(r=>{if(r.planSha256!==m.planSha256)throw new Error('Mismatched plan identity');});
  const prior=libraryEntries.find(e=>new URL(e.manifest??'',location.href).href===url.href)?.priorManifest;
  previousUrl=prior?new URL(prior,location.href):undefined;
  $('comparison-control').hidden=!prior;if(!prior)$('comparison').checked=false;
  const prepared=await Promise.all(data.map((r,i)=>prepareView(r,cells[i].sha256,signal)));if(token!==opening)return;
  records=data;views=prepared;manifest=m;manifestUrl=url;const [ride]=cells,p=ride.production;
  $('comparison').disabled=false;
  $('result-title').textContent=`${m.plan.cases[0].title} · seed ${ride.seed}`;$('result-note').textContent=p.qualified?'Complete ride · every requested construction fulfilled.':ride.valid?'Complete ride · some requested constructions were not fulfilled.':`Incomplete ride · ${ride.failure?.reason??p.constructionFailure??'see saved diagnostics'}`;$('result-note').classList.toggle('error',!p.qualified);
  $('production-metrics').textContent=`Musical score ${fmt(ride.score.score,1)} · ${p.realization.fulfilledSections}/${p.realization.requested} requests · ${fmt(ride.compileMs/1000,1)} s`;
  interactionReview?.bind(data[0],cells[0].sha256,url);
  $('seek').min=interactionReview?.range?.[0]??0;
  $('seek').max=interactionReview?.range?.[1]??Math.min(m.plan.cases[0].durationFrames/40,...data.map(r=>(r.trace.frames.length-1)/40));$('seek').disabled=false;
  const real=new Map(p.realization.sections.map(r=>[r.section,r]));
  $('timeline').replaceChildren(...p.plan.phrases.map(phrase=>{const requests=p.plan.requests.slice(phrase.first,phrase.first+phrase.count),ok=requests.every(r=>real.get(r.section)?.fulfilled),b=el('button',`${names[phrase.construction]} · ${fmt(requests[0].frame/40,1)}s`,ok?'':'unfulfilled');b.title=`${phrase.guidance} guidance; ${phrase.railLayout??'paired'} layout; ${ok?'fulfilled':'unfulfilled'}`;b.onclick=()=>{pause();$('movie').pause();seek(requests[0].frame/40-.3);};return b;}));
  $('observations').replaceChildren(...p.plan.requests.slice(1).map(r=>{const result=real.get(r.section),tr=el('tr');for(const t of [r.section,fmt(r.frame/40),names[r.construction],`${r.guidance} / ${r.railLayout??'paired'}`,result?.fulfilled?'Fulfilled':result?.reasons?.join(', ')??'Not built'])tr.append(el('td',String(t)));return tr;}));
  $('work').textContent=`Automatic compile: ${ride.physicalFrames.toLocaleString()} of ${ride.allowance.toLocaleString()} physics frames. Independent judging and video rendering are separate. ${p.plan.policy}. The physical checks establish functional construction, not an aesthetic rating.`;
  $('record-link').href=new URL(ride.path,url).href;$('render').hidden=!job||!ride.valid;$('render').disabled=['queued','rendering','complete'].includes(job?.render);$('render').textContent=job?.render==='complete'?'Video ready':job?.render==='rendering'?'Rendering…':'Render finished video';
  const motion=p.motion?.full;$('motion-detail').hidden=!motion;
  if(motion)$('motion-summary').textContent=motion.bursts.map(b=>`${b.frames*25} ms: ${b.episodes} above-band episodes; largest excess ${fmt(b.maxExcess)} px/frame`).join(' · ')+'. These measurements separate extra speed gain from gravity. They describe motion; they do not rate its artistic quality.';
  const song=data[0].case.id,moments=[];
  if(['luna_bala_44s','tiki_tiki_48s'].includes(song))moments.push(['Calm opening',0]);
  if(song==='amour_de_ma_vie_44s'&&ride.seed===303)moments.push(['Reported acceleration · 9.4s',8.7]);
  if(song==='amour_de_ma_vie_44s'&&ride.seed===101)moments.push(['Reported acceleration · 5.95s',5.3]);
  if(song==='tiki_tiki_48s'&&ride.seed===101)moments.push(['Reported acceleration · 15.32s',14.7]);
  $('review-moments').replaceChildren(...moments.map(([label,t])=>{const b=el('button',label);b.onclick=()=>{pause();seek(t);};return b;}));
  seek(initialTime);
  try{
   const c=m.plan.cases[0],blob=await verifiedAudio(c,signal);if(token!==opening)return;
   audioObjectUrl=URL.createObjectURL(blob);audio.src=audioObjectUrl;audio.dataset.source=c.audioPath;audio.dataset.sha256=c.audioSha256;audio.load();audio.onloadedmetadata=()=>{if(token===opening)audio.currentTime=seconds;};audio.playbackRate=+$('rate').value;$('play').disabled=false;
  }catch(e){if(signal.aborted||token!==opening)return;status(e.message+'; the saved ride can still be scrubbed.',true);}
  await loadMovie(m,url,signal,token);
  if(token===opening&&$('comparison').checked)await comparisonChanged();
 }catch(e){if(signal.aborted||token!==opening)return;$('result-note').textContent='Could not open result: '+e.message;$('result-note').classList.add('error');}
}
$('movie').onplay=pause;
$('render').onclick=async()=>{try{const {job}=await api(`jobs/${currentJob.id}/render`,{});currentJob=job;$('render').disabled=true;$('render').textContent='Rendering queued…';}catch(e){status(e.message,true);}};
function card(title,description){const c=el('article');c.append(el('h3',title),el('p',description));return c;}
async function refreshJobs(){try{const {jobs}=await api('jobs');const automatic=jobs.filter(j=>j.request.mode==='production');$('jobs').replaceChildren(...automatic.map(job=>{const c=card(`${catalog.songs.find(s=>s.id===job.request.song)?.title??job.request.song} · ${job.request.seed}`,`${job.status}${job.status==='complete'?(job.qualified?' · fulfilled':job.valid?' · request misses':' · incomplete'):''}${job.render?' · video '+job.render:''}`),actions=el('div',undefined,'card-actions');if(job.manifest){const b=el('button','Open ride');b.onclick=()=>openResult(job.manifest,job);actions.append(b);}if(['queued','compiling'].includes(job.status)||['queued','rendering'].includes(job.render)){const b=el('button','Cancel');b.onclick=async()=>{await api(`jobs/${job.id}/cancel`,{});await refreshJobs();};actions.append(b);}const log=el('a','Log');log.href=`/generated/repertoire-jobs/${job.id}/${job.render?'render':'compile'}.log`;actions.append(log);c.append(actions);if(job.error||job.renderError)c.append(el('p',job.error??job.renderError,'error'));return c;}));
 const awaited=automatic.find(j=>j.id===pendingJob);if(awaited){status(`Generation ${awaited.status}${awaited.error?': '+awaited.error:''}`,awaited.status==='error');if(['complete','error','cancelled'].includes(awaited.status)){pendingJob=null;if(awaited.manifest)await openResult(awaited.manifest,awaited);}}
 const updated=automatic.find(j=>j.id===currentJob?.id);if(updated?.render==='complete'&&currentJob.render!=='complete'){currentJob=updated;await loadMovie(manifest,manifestUrl,controller.signal,opening);$('render').textContent='Video ready';}
 }catch(e){status(e.message,true);}}
$('generate').onsubmit=async event=>{event.preventDefault();try{const request={mode:'production',song:$('song').value,seed:+$('seed').value,budget:+$('budget').value,creative:{variation:+$('variation').value,guidedBalance,repertoire:[...$('repertoire').querySelectorAll('input:checked')].map(i=>i.value)}};status('Submitting automatic arrangement…');const {job,reused}=await api('compile',request);pendingJob=job.id;status(reused?'Opening matching saved request…':'Compilation queued…');await refreshJobs();}catch(e){status(e.message,true);}};
async function loadLibrary(){try{
 const params=new URLSearchParams(location.search),collection=new URL(params.get('collection')??'production-library.json',location.href);
 if(collection.origin!==location.origin)throw new Error('Review collections must be served from this gallery.');
 let data;
 if(params.has('collection'))data=await checked(collection.href);
 else{const response=await fetch(collection.href);if(!response.ok)throw new Error('The review collection is being generated.');data=await response.json();}
 libraryEntries=data.entries;
 $('library').replaceChildren(...data.entries.map(entry=>{const c=card(`${entry.title} · ${entry.seed}`,entry.error??entry.status??'Saved automatic arrangement');if(entry.manifest){const b=el('button','Open ride');b.onclick=()=>openResult(entry.manifest);c.append(b);}return c;}));
 if(params.has('review')){
  const {createInteractionReview}=await import('./interaction-review.js');
  interactionReview=await createInteractionReview({url:params.get('review'),checked,open:openResult,seek:t=>{pause();seek(Math.round(t*40)/40);},time:()=>seconds});
 }
 const initial=interactionReview?.initial.manifest??params.get('data')??data.entries.find(e=>e.manifest)?.manifest;
 if(initial){const at=Math.max(0,Number(params.get('t'))||interactionReview?.initial.range[0]||0);$('comparison').checked=!interactionReview&&params.get('compare')==='previous';await openResult(initial,undefined,interactionReview?Math.round(at*40)/40:at);}
 }catch(e){$('library').textContent=e.message;}}
try{catalog=await api('catalog');$('song').replaceChildren(...catalog.songs.map(s=>{const o=el('option',s.title);o.value=s.id;return o;}));for(const [key,name]of Object.entries(names)){const label=el('label'),input=el('input');input.type='checkbox';input.value=key;input.checked=true;label.append(input,document.createTextNode(name));$('repertoire').append(label);}await loadLibrary();await refreshJobs();setInterval(refreshJobs,4000);}catch(e){status(e.message,true);}
