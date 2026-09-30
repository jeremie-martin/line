import {prepareView} from './replay.js';
const $=id=>document.getElementById(id),audio=$('audio');
let catalog,plan,manifest,manifestUrl,records=[],views=[],seconds=0,playing=false,opening=0,controller,currentJob,pendingJob,loadedPlan;
const storageKey='line.repertoire.draft.v1';
const fmt=(v,n=3)=>Number.isFinite(v)?v.toFixed(n):'—';
function el(tag,text,cls){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;}
function status(text,error=false){$('status').textContent=text;$('status').classList.toggle('error',error);}
async function api(path,body){const r=await fetch('/api/repertoire/'+path,body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await r.json();if(!r.ok)throw new Error(data.error??r.statusText);return data;}
async function checked(url,signal,digest){
 const r=await fetch(url,{signal});if(!r.ok)throw new Error(`Artifact unavailable (${r.status})`);const bytes=await r.arrayBuffer();
 if(!digest){const sum=await fetch(url+'.sha256',{signal});if(!sum.ok)throw new Error('Artifact checksum unavailable');digest=(await sum.text()).trim();}
 const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
 if(hash!==digest)throw new Error('Artifact checksum mismatch');return JSON.parse(new TextDecoder().decode(bytes));
}
function options(select,items){select.replaceChildren(...items.map(([value,title])=>{const o=el('option',title);o.value=value;return o;}));}
function persist(){try{localStorage.setItem(storageKey,JSON.stringify(plan));}catch{}updateDraft();}
function updateDraft(){if(!loadedPlan)return;$('result-note').textContent=JSON.stringify(loadedPlan)===JSON.stringify(plan)?'This is the exact recorded result of the arrangement in the editor.':`The editor contains a different arrangement. Playback still shows “${loadedPlan.title}”.`;}
const labels={profileStrength:'Strength',profileStart:'Shape begins (0–0.85)',rippleCycles:'Waves',faces:'Faces',foldAngle:'Middle angle (°)',fragmentWidth:'Fragment margin'};
const bounds={profileStrength:[0,2,.1,1],profileStart:[0,.85,.05,undefined],rippleCycles:[1,3,1,2],faces:[2,24,1,undefined],foldAngle:[-75,75,5,30],fragmentWidth:[.0001,1,.001,.003]};
function field(label,input){const l=el('label',label);l.append(input);return l;}
function renderEditor(){
 $('title').value=plan.title;$('song').value=plan.song;
 $('phrases').replaceChildren(...plan.phrases.map((p,i)=>{
  const card=el('section',undefined,'phrase'),top=el('div',undefined,'row'),title=el('h3',`Passage ${i+1}`),remove=el('button','Remove');
  remove.onclick=()=>{plan.phrases.splice(i,1);renderEditor();persist();};top.append(title,remove);card.append(top);
  const name=el('input');name.value=p.title;name.maxLength=120;name.setAttribute('aria-label',`Passage ${i+1} title`);name.oninput=()=>{p.title=name.value;persist();};card.append(name);
  const interval=el('div',undefined,'row');for(const key of ['start','end']){const input=el('input');input.type='number';input.min=0;input.max=catalog.songs.find(s=>s.id===plan.song).duration;input.step=.1;input.value=p[key];input.onchange=()=>{p[key]=+input.value;persist();};interval.append(field(key==='start'?'From (s)':'Until (s)',input));}card.append(interval);
  const recipe=el('select');options(recipe,catalog.recipes.map(r=>[r.id,r.title]));recipe.value=p.recipe;recipe.onchange=()=>{p.recipe=recipe.value;delete p.controls;delete p.fragmentWidth;renderEditor();persist();};card.append(field('Construction',recipe));
  const entry=catalog.recipes.find(r=>r.id===p.recipe),controls=el('div',undefined,'controls');
  for(const key of entry.controls){
   if(key==='guides'){const select=el('select');options(select,[['auto','Allow when useful'],['off','Forbid guides']]);select.value=p.controls?.guides===false?'off':'auto';select.onchange=()=>{p.controls??={};if(select.value==='off')p.controls.guides=false;else delete p.controls.guides;persist();};controls.append(field('Control rails',select));continue;}
   const [min,max,step,fallback]=bounds[key],input=el('input');input.type='number';input.min=min;input.max=max;input.step=step;
   const value=key==='fragmentWidth'?p.fragmentWidth:p.controls?.[key];input.value=value??entry.defaults[key]??fallback??'';input.placeholder='Automatic';
   input.onchange=()=>{const value=input.value===''?undefined:+input.value;if(key==='fragmentWidth')p.fragmentWidth=value;else{p.controls??={};if(value===undefined)delete p.controls[key];else p.controls[key]=value;}persist();};controls.append(field(labels[key],input));
  }
  card.append(controls);if(p.recipe==='scattered')card.append(el('p','Uses measured contacts from the realized source motion; the return is searched again.'));
  if(p.recipe==='single')card.append(el('p','Guides are forbidden throughout these supports. Musical targets remain unchanged.'));
  return card;
 }));updateDraft();
}
function setPlan(next){plan=structuredClone(next);renderEditor();persist();}
function pause(){playing=false;audio.pause();$('play').textContent='Play';}
function seek(t){seconds=Math.max(0,Math.min(+$('seek').max,t));if(audio.readyState>=1)audio.currentTime=seconds;$('seek').value=seconds;draw();}
function draw(){
 $('time').textContent=fmt(seconds,2)+' s';$('seek').value=seconds;
 views.forEach((entry,i)=>{const canvas=$(i?'alternative':'base'),record=records[i],at=Math.min(seconds*40,record.trace.frames.length-1),f=Math.floor(at),a=record.trace.frames[f],b=record.trace.frames[Math.min(f+1,record.trace.frames.length-1)],t=at-f;
  const camera={x:a[0]+(b[0]-a[0])*t,y:a[1]+(b[1]-a[1])*t,w:canvas.clientWidth,h:canvas.clientHeight,z:+$('zoom').value,r:Math.min(2,devicePixelRatio)};
  entry.view.draw(canvas,camera,at,$('inspect').checked);
 });
}
function tick(){if(playing){seconds=audio.currentTime;if(seconds>=+$('seek').max)pause();draw();}requestAnimationFrame(tick);}requestAnimationFrame(tick);
$('play').onclick=async()=>{if(playing){pause();return;}try{if(seconds>=+$('seek').max)seek(0);audio.currentTime=seconds;await audio.play();playing=true;$('play').textContent='Pause';}catch(e){$('playback-status').textContent='Audio could not start: '+e.message;}};
audio.onended=pause;audio.onerror=()=>{$('playback-status').textContent='Music could not load. The saved ride can still be scrubbed.';pause();};
$('seek').oninput=()=>{pause();seek(+$('seek').value);};$('zoom').oninput=draw;$('inspect').onchange=draw;$('rate').onchange=()=>{audio.playbackRate=+$('rate').value;};window.addEventListener('resize',draw);document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
function link(id,url){$(id).hidden=!url;if(url)$(id).href=url;else $(id).removeAttribute('href');}
async function openResult(path,job){
 const token=++opening;controller?.abort();controller=new AbortController();const {signal}=controller;pause();currentJob=job;
 $('play').disabled=true;$('seek').disabled=true;$('use-result').disabled=true;$('playback-status').textContent='Checking the saved track and replaying the native rider…';
 views=[];records=[];for(const id of ['base','alternative']){const c=$(id);c.getContext('2d').clearRect(0,0,c.width,c.height);}for(const id of ['inspect-link','record-link','movie-link'])link(id,null);$('render').hidden=true;
 audio.removeAttribute('src');audio.load();
 try{
  const url=new URL(path,location.href),m=await checked(url.href,signal);if(m.plan.kind!=='musical-direction')throw new Error('Unsupported saved study');
  const cells=['baseline','composition'].map(method=>m.cells.find(c=>c.method===method));if(cells.some(c=>!c))throw new Error('Incomplete comparison artifacts');
  const data=await Promise.all(cells.map(c=>checked(new URL(c.path,url).href,signal,c.sha256)));
  data.forEach(r=>{if(r.planSha256!==m.planSha256)throw new Error('Track and plan identities differ');});
  const prepared=await Promise.all(data.map((r,i)=>prepareView(r,cells[i].sha256,signal)));if(token!==opening)return;
  manifest=m;manifestUrl=url;records=data;views=prepared;loadedPlan=m.plan.composition;
  const [base,alt]=cells;$('result-title').textContent=m.plan.methodDetails.composition.title;$('alt-caption').textContent=m.plan.methodDetails.composition.title;
  $('base-metrics').textContent=`${base.valid?'Complete':'Incomplete'} · target error ${fmt(base.qualityRms,4)} RMS`;
  $('alt-metrics').textContent=`${alt.valid?'Complete':'Incomplete'} · target error ${alt.valid?fmt(alt.qualityRms,4):'—'} RMS · ${fmt(alt.compileMs/1000,1)} s compilation`;
  $('playback-status').textContent=alt.valid?'Native Line Rider geometry and rider; every recorded body point matches replay.':`Incomplete ride${alt.failure?.frame===undefined?'':` at ${fmt(alt.failure.frame/40,2)} s`}. Inspection stops at the recorded failure. This is not a completed musical example.`;
  $('playback-status').classList.toggle('error',!alt.valid);
  $('seek').max=Math.min(m.plan.cases[0].durationFrames/40,...data.map(r=>(r.trace.frames.length-1)/40));$('seek').disabled=false;$('play').disabled=false;$('use-result').disabled=!loadedPlan;
  audio.src='/'+m.plan.cases[0].audioPath;audio.load();audio.playbackRate=+$('rate').value;
  $('moments').replaceChildren(...(alt.construction.phrases??[]).map(p=>{const b=el('button',`${p.title} · ${fmt(p.actualStart??p.window[0],1)} s`);b.onclick=()=>{pause();seek((p.actualStart??p.window[0])-.5);};return b;}));
  $('observations').replaceChildren(...(alt.construction.phrases??[]).map(p=>{const rows=alt.sections.filter(s=>(p.sections??alt.construction.changedSections).includes(s.section)&&s.start>=p.window[0]&&s.start<p.window[1]);const tr=el('tr');for(const text of [p.title,rows.length?`${fmt(rows[0].start,2)}–${fmt(rows.at(-1).end,2)} s`:'Not built',rows.reduce((n,r)=>n+r.mainContactFrames,0),rows.reduce((n,r)=>n+r.guideContactFrames,0),`${rows.filter(r=>r.guideSegments>0).length}/${rows.length}`])tr.append(el('td',String(text)));return tr;}));
  $('work').textContent=`Composition: ${alt.physicalFrames.toLocaleString()} simulated frames of ${alt.allowance.toLocaleString()} allowed, across ${alt.construction.stages?.length??1} stages. Source: ${base.physicalFrames.toLocaleString()} frames${m.sets[0]?.sourceReused?' (reused)':''}. Saved seed ${alt.seed}; authored jitter ${alt.jitter}. Validation and rendering are separate.`;
  link('inspect-link',`/motion-gallery/?data=${encodeURIComponent(url.pathname)}&passage=${alt.caseId}&seed=${alt.seed}&left=baseline&right=composition`);link('record-link',new URL(alt.path,url).href);
  $('render').hidden=!job||!alt.valid;$('render').textContent=job?.render==='complete'?'Videos ready':job?.render==='rendering'?'Rendering…':'Render production videos';$('render').disabled=['queued','rendering','complete'].includes(job?.render);
  seek(Math.max(0,(alt.construction.phrases?.[0]?.actualStart??alt.construction.phrases?.[0]?.window[0]??0)+.15));updateDraft();
  try{const response=await fetch(new URL(alt.id+'.video.json',url),{signal});if(response.ok){const v=await checked(new URL(alt.id+'.video.json',url).href,signal);if(v.identity.cellSha256!==alt.sha256||v.identity.planSha256!==m.planSha256)throw new Error('Video identity mismatch');link('movie-link',new URL(v.full.path,url).href);}}catch(e){if(!signal.aborted)$('playback-status').textContent+=' Video unavailable: '+e.message;}
 }catch(e){if(signal.aborted)return;$('playback-status').textContent='Cannot open this result: '+e.message;$('playback-status').classList.add('error');}
}
$('use-result').onclick=()=>{if(loadedPlan)setPlan(loadedPlan);};
$('render').onclick=async()=>{try{const {job}=await api(`jobs/${currentJob.id}/render`,{});currentJob=job;$('render').disabled=true;$('render').textContent='Rendering queued…';await refreshJobs();}catch(e){status(e.message,true);}};
function card(title,description){const d=el('article',undefined,'card');d.append(el('h3',title),el('p',description));return d;}
async function refreshJobs(){
 try{const {jobs}=await api('jobs');$('jobs').replaceChildren(...jobs.map(job=>{
  const c=card(job.request.composition.title,`${job.request.composition.song} · ${new Date(job.created).toLocaleString()}`),s=el('p',`${job.status}${job.status==='complete'?(job.valid?' · valid ride':' · incomplete ride'):''}${job.render?' · video '+job.render:''}`,'state');c.append(s);
  const controls=el('div',undefined,'row'),edit=el('button','Edit');edit.onclick=()=>setPlan(job.request.composition);controls.append(edit);
  if(job.manifest){const open=el('button','Inspect');open.onclick=()=>openResult(job.manifest,job);controls.append(open);}
  if(['queued','compiling'].includes(job.status)||['queued','rendering'].includes(job.render)){const cancel=el('button','Cancel');cancel.onclick=async()=>{try{await api(`jobs/${job.id}/cancel`,{});await refreshJobs();}catch(e){status(e.message,true);}};controls.append(cancel);}
  const log=el('a','Log');log.href=`/generated/repertoire-jobs/${job.id}/${job.render?'render':'compile'}.log`;controls.append(log);c.append(controls);if(job.error||job.renderError)c.append(el('p',job.error??job.renderError,'error'));return c;
 }));
 const awaited=jobs.find(j=>j.id===pendingJob);if(awaited){status(`Arrangement ${awaited.status}${awaited.error?': '+awaited.error:''}`,awaited.status==='error');if(['complete','error','cancelled'].includes(awaited.status)){pendingJob=undefined;if(awaited.manifest)await openResult(awaited.manifest,awaited);}}
 const updated=jobs.find(j=>j.id===currentJob?.id);
 if(updated?.render==='complete'&&currentJob.render!=='complete'){
  const id=updated.id,url=manifestUrl,cell=manifest.cells.find(c=>c.method==='composition');
  const video=await checked(new URL(cell.id+'.video.json',url).href);
  if(currentJob?.id===id&&manifestUrl===url){
   if(video.identity.cellSha256!==cell.sha256||video.identity.planSha256!==manifest.planSha256)throw new Error('Video identity mismatch');
   currentJob=updated;link('movie-link',new URL(video.full.path,url).href);$('render').disabled=true;$('render').textContent='Videos ready';
  }
 }
 }catch(e){status('Workspace queue unavailable: '+e.message,true);}
}
$('compile').onclick=async()=>{const button=$('compile');button.disabled=true;try{
 const request={composition:plan,seed:+$('seed').value,baselineBudget:1000000,compositionBudget:+$('budget').value};const {job,reused}=await api('compile',request);pendingJob=job.id;status(reused?'Reusing the identical saved request.':'Arrangement queued; the current recording remains available.');await refreshJobs();
 }catch(e){status(e.message,true);}finally{button.disabled=false;}};
$('title').oninput=()=>{plan.title=$('title').value;persist();};$('song').onchange=()=>{plan.song=$('song').value;renderEditor();persist();};
$('add').onclick=()=>{const duration=catalog.songs.find(s=>s.id===plan.song).duration,start=plan.phrases.at(-1)?.end??0;if(start>=duration){status('The last passage reaches the end of the music.',true);return;}plan.phrases.push({title:'New passage',start,end:Math.min(duration,start+2),recipe:'fold'});renderEditor();persist();};
$('blank').onclick=()=>setPlan({schema:'line.repertoire-plan.v1',title:'New arrangement',song:$('song').value,phrases:[]});
$('load-preset').onclick=()=>setPlan(catalog.presets[+$('preset').value]);
$('export').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(plan,null,2)+'\n'],{type:'application/json'})),a=el('a');a.href=url;a.download='line-arrangement.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
$('import').onchange=async()=>{try{const file=$('import').files[0];if(!file)return;if(file.size>65536)throw new Error('Arrangement exceeds 64 KiB');const p=JSON.parse(await file.text());if(p.schema!=='line.repertoire-plan.v1'||!Array.isArray(p.phrases)||!catalog.songs.some(s=>s.id===p.song)||p.phrases.some(p=>!catalog.recipes.some(r=>r.id===p.recipe)))throw new Error('Unsupported arrangement');const verified=await api('validate',{composition:p,seed:+$('seed').value,baselineBudget:1000000,compositionBudget:+$('budget').value});setPlan(verified.request.composition);status('Arrangement opened. Compilation validates its controls and phrase windows.');}catch(e){status(e.message,true);}finally{$('import').value='';}};
try{
 catalog=await api('catalog');options($('song'),catalog.songs.map(s=>[s.id,s.title]));options($('preset'),catalog.presets.map((p,i)=>[i,`${p.title} · ${catalog.songs.find(s=>s.id===p.song).title}`]));
 $('catalog').replaceChildren(...catalog.recipes.map(r=>{const d=el('div');d.append(el('h3',r.title),el('p',r.description));return d;}));
 let draft;try{draft=JSON.parse(localStorage.getItem(storageKey));}catch{}if(draft?.schema!=='line.repertoire-plan.v1'||!catalog.songs.some(s=>s.id===draft.song)||!Array.isArray(draft.phrases)||draft.phrases.some(p=>!catalog.recipes.some(r=>r.id===p.recipe)))draft=null;
 if(draft){try{draft=(await api('validate',{composition:draft,seed:401,baselineBudget:1000000,compositionBudget:2000000})).request.composition;}catch{draft=null;}}
 setPlan(draft??catalog.presets[0]);status('Choose passages, save the arrangement, or compile a new ride.');
 const response=await fetch('repertoire-examples.json');const examples=response.ok?await response.json():[];
 $('examples').replaceChildren(...examples.map(example=>{const c=card(example.title,example.description),button=el('button','Inspect arrangement');button.onclick=()=>openResult(example.manifest);c.append(button);return c;}));
 const controlResponse=await fetch('repertoire-controls.json');const controlExamples=controlResponse.ok?await controlResponse.json():[];
 options($('control-example'),controlExamples.map((e,i)=>[i,e.title]));$('open-control').disabled=!controlExamples.length;
 $('open-control').onclick=()=>openResult(controlExamples[+$('control-example').value].manifest);
 const data=new URLSearchParams(location.search).get('data')??examples[0]?.manifest;if(data)await openResult(data);await refreshJobs();setInterval(refreshJobs,3000);
}catch(e){status('Cannot load the workspace: '+e.message,true);}
