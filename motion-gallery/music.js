const $=id=>document.getElementById(id),query=new URLSearchParams(location.search);
const manifestUrl=new URL(query.get('data')||'/generated/musical-direction-20260930/confirmation/manifest.json',location.href);
const videos=[$('baseline'),$('alternative')];
let manifest,selected,baseline,caseInfo,moment,seconds=0,playing=false,loading=true,generation=0,controller,stopAt=Infinity;
const format=(n,d=3)=>Number.isFinite(n)?n.toFixed(d):'—';
const hash=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');
async function checked(url,signal){
  const [body,sum]=await Promise.all([fetch(url,{signal}),fetch(url+'.sha256',{signal})]);
  if(!body.ok||!sum.ok)throw new Error(`Saved artifact unavailable (${body.status}/${sum.status})`);
  const bytes=await body.arrayBuffer();if(await hash(bytes)!==(await sum.text()).trim())throw new Error('Saved artifact checksum mismatch');
  return JSON.parse(new TextDecoder().decode(bytes));
}
function choices(id,items,label=v=>v){$(id).replaceChildren(...items.map(v=>{const o=document.createElement('option');o.value=v;o.textContent=label(v);return o;}));}
function pause(){const synchronize=!loading&&videos[0].readyState>=1;playing=false;videos.forEach(v=>v.pause());if(synchronize)seek(videos[0].currentTime);$('play').textContent='Play';$('play').disabled=loading;}
function updateInspectorTime(){const url=new URL($('inspect').href);url.searchParams.set('time',seconds.toFixed(3));$('inspect').href=url;}
function seek(t){seconds=Math.max(0,Math.min(caseInfo.durationFrames/40,t));for(const v of videos)if(v.readyState>=1)v.currentTime=seconds;$('seek').value=seconds;$('time').textContent=`${seconds.toFixed(2)} s`;updateInspectorTime();}
async function play(){
  if(loading)return;const token=generation;playing=true;$('play').textContent='Pause';
  try{await Promise.all(videos.map(v=>v.play()));if(token===generation&&playing)videos[1].currentTime=videos[0].currentTime;}catch(e){if(token!==generation)return;pause();$('status').textContent=`Playback could not start: ${e.message}`;}
}
function showMoment(m){
  moment=m;$('moment-label').textContent=`${m.title}, ${format(m.from,2)}–${format(m.to,2)} s.`;$('targets').replaceChildren();
  for(const button of $('moments').children)button.setAttribute('aria-pressed',String(button.dataset.time===String(m.time)));
  const other=new Map(selected.observations.map(o=>[`${o.gap}:${o.axis}`,o]));
  for(const o of baseline.observations.filter(o=>o.endFrame>=m.from*40&&o.startFrame<=m.to*40)){
    const tr=document.createElement('tr'),b=other.get(`${o.gap}:${o.axis}`);
    for(const value of [`${format(o.startFrame/40,2)}–${format(o.endFrame/40,2)} s`,o.axis,format(o.target),format(o.achieved),format(b?.achieved)]){const td=document.createElement('td');td.textContent=value;tr.append(td);}
    $('targets').append(tr);
  }
}
function metadata(v,url,signal){return new Promise((resolve,reject)=>{
  const clear=()=>{v.removeEventListener('loadedmetadata',ready);v.removeEventListener('error',failed);signal.removeEventListener('abort',cancel);};
  const ready=()=>{clear();resolve();},failed=()=>{clear();reject(new Error('Video download failed'));},cancel=()=>{clear();reject(new DOMException('Aborted','AbortError'));};
  signal.addEventListener('abort',cancel,{once:true});v.addEventListener('loadedmetadata',ready,{once:true});v.addEventListener('error',failed,{once:true});v.src=url;v.load();
});}
async function select(){
  const token=++generation,oldSong=caseInfo?.id;controller?.abort();controller=new AbortController();const {signal}=controller;
  if(!loading&&videos[0].readyState>=1)seconds=videos[0].currentTime;
  videos.forEach(v=>v.pause());loading=true;$('retry').hidden=true;$('play').disabled=!playing;$('excerpt').disabled=true;$('seek').disabled=true;
  const song=$('song').value,seed=+$('seed').value;
  if(oldSong!==song)pause();
  caseInfo=manifest.plan.cases.find(c=>c.id===song);
  baseline=manifest.cells.find(c=>c.caseId===song&&c.seed===seed&&c.method==='baseline');
  selected=manifest.cells.find(c=>c.caseId===song&&c.seed===seed&&c.method===$('variant').value);
  if(!baseline||!selected){$('status').textContent='This recorded comparison is missing.';return;}
  const focus=selected.method==='mixed'?caseInfo.mixed[0]:selected.method==='guidance'?caseInfo.guidance[0]:caseInfo.moments[0].time;
  const defaultMoment=caseInfo.moments.reduce((best,m)=>Math.abs(m.time-focus)<Math.abs(best.time-focus)?m:best);
  if(oldSong!==song){seconds=defaultMoment.time;stopAt=caseInfo.durationFrames/40;}
  $('intent').textContent=caseInfo.intent;$('alternative-title').textContent=manifest.plan.methodDetails[selected.method].title;
  $('baseline-metrics').textContent=`Whole-ride target error ${format(baseline.qualityRms,4)} RMS · ${format(baseline.compileMs/1000,2)} s compilation`;
  $('alternative-metrics').textContent=`Whole-ride target error ${format(selected.qualityRms,4)} RMS · ${format(selected.compileMs/1000,2)} s compilation`;
  const changed=selected.construction.changedSections.map(i=>selected.sections.find(s=>s.section===i));
  const interval=changed.length?`${format(changed[0].start,2)}–${format(changed.at(-1).end,2)} s`:null;
  $('decision').textContent=selected.method==='mixed'?`${manifest.plan.methodDetails[selected.method].title}: changed supports at ${interval}, followed by smooth construction.`:
    selected.method==='guidance'?`Guide-free supports at ${interval}; guidance is permitted again afterwards.`:
    `${manifest.plan.methodDetails[selected.method].title}: an independently searched complete ride.`;
  $('construction').textContent=selected.construction.boundaryFrame===null?'This independent comparison can change the whole ride.':
    `Earlier geometry and every rider point match the baseline through ${format(selected.construction.boundaryFrame/40,3)} s. The complete later ride is rebuilt. ${selected.construction.changedMotionFrames} recorded frames differ in rider position. These checks establish a physical change, not an aesthetic improvement.`;
  $('work').textContent=`Baseline: ${baseline.physicalFrames.toLocaleString()} simulated frames. Alternative: ${selected.physicalFrames.toLocaleString()}, including prefix preparation. Each has a ${selected.budget.toLocaleString()} frame ceiling. Independent validation and video rendering are additional work. Target jitter: ${caseInfo.jitter}; different seeds can produce identical tracks.`;
  const inspect=new URL('/motion-gallery/',location.href);inspect.searchParams.set('data',manifestUrl.pathname);inspect.searchParams.set('passage',song);inspect.searchParams.set('seed',seed);inspect.searchParams.set('left','baseline');inspect.searchParams.set('right',selected.method);inspect.searchParams.set('time',seconds);
  $('inspect').href=inspect;$('record').href=new URL(selected.path,manifestUrl);
  $('moments').replaceChildren(...caseInfo.moments.map(m=>{const b=document.createElement('button');b.textContent=m.title;b.dataset.time=m.time;b.onclick=()=>{pause();seek(m.time);showMoment(m);};return b;}));
  showMoment((oldSong===song&&caseInfo.moments.find(m=>m.title===moment?.title))||defaultMoment);$('seek').max=caseInfo.durationFrames/40;$('status').textContent='Loading the preserved production videos…';
  for(const v of videos){v.removeAttribute('src');v.load();}
  for(const id of ['full-video','clip-video']){$(id).removeAttribute('href');$(id).hidden=true;}
  try{
    const saved=await Promise.all([baseline,selected].map(c=>checked(new URL(c.id+'.video.json',manifestUrl).href,signal)));
    if(token!==generation||signal.aborted)return;
    saved.forEach((r,i)=>{if(r.identity.planSha256!==manifest.planSha256||r.identity.cellSha256!==[baseline,selected][i].sha256)throw new Error('Video and track identity mismatch');});
    await Promise.all(videos.map((v,i)=>metadata(v,new URL(saved[i].full.path,manifestUrl).href,signal)));
    if(token!==generation)return;
    loading=false;videos.forEach(v=>v.playbackRate=+$('rate').value);seek(seconds);stopAt=Math.min(stopAt,caseInfo.durationFrames/40);
    for(const id of ['play','excerpt','seek'])$(id).disabled=false;
    $('full-video').href=new URL(saved[1].full.path,manifestUrl);$('clip-video').href=new URL(saved[1].excerpt.path,manifestUrl);
    for(const id of ['full-video','clip-video'])$(id).hidden=false;
    $('status').textContent='Same preserved tracks as the inspector · normal lines · full production rendering · experimental construction';
    if(playing)await play();
  }catch(e){if(token!==generation||signal.aborted)return;loading=false;pause();$('play').disabled=true;$('retry').hidden=false;$('status').textContent=`Videos are not available for this selection yet. Native track inspection is available. ${e.message}`;}
}
videos[0].addEventListener('timeupdate',()=>{
  if(loading||!playing)return;seconds=videos[0].currentTime;$('seek').value=seconds;$('time').textContent=`${seconds.toFixed(2)} s`;updateInspectorTime();
  if(Math.abs(videos[1].currentTime-seconds)>.08)videos[1].currentTime=seconds;
  if(seconds>=stopAt)pause();
});
for(const v of videos){v.addEventListener('ended',pause);v.addEventListener('error',()=>{if(!loading&&v.hasAttribute('src')){pause();$('status').textContent='Video playback failed. Retry this comparison.';$('retry').hidden=false;}});}
$('play').onclick=()=>playing?pause():play();$('excerpt').onclick=()=>{seek(caseInfo.excerpt[0]);stopAt=caseInfo.excerpt[1];play();};
$('seek').oninput=()=>{seek(+$('seek').value);stopAt=caseInfo.durationFrames/40;};$('rate').onchange=()=>videos.forEach(v=>v.playbackRate=+$('rate').value);
$('retry').onclick=select;for(const id of ['song','seed','variant'])$(id).onchange=select;
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
try{
  manifest=await checked(manifestUrl.href);
  if(manifest.plan.kind!=='musical-direction')throw new Error('Not a musical direction study');
  choices('song',manifest.plan.cases.map(c=>c.id),id=>manifest.plan.cases.find(c=>c.id===id).title);
  choices('seed',manifest.plan.seeds);choices('variant',manifest.plan.methods.filter(m=>m!=='baseline'),id=>manifest.plan.methodDetails[id].title);$('variant').value='mixed';
  await select();
}catch(e){$('status').textContent=`Cannot open this comparison: ${e.message}`;}
