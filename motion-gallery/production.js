import {playerShortcut} from './player-shortcuts.js';
import {prepareRide,pictureFor} from './ride.js';
import {highlight} from '/generated/renderer/inspect.js';
import {THEMES,resolveLook} from '/scripts/video/look.js';
import {FPS,describeTiming,rideTime,songTimeOfFrame} from '/scripts/video/timing.js';
import {sha256Hex} from './sha256.js';
import {checked} from './artifacts.js';
import {createContactImpactReview} from './contact-impact-review.js';
import {createMusic,displayTime} from '../shared/playback.js';
const $=id=>document.getElementById(id),music=createMusic(),onScreen=displayTime();
// Geometry-family labels by id, from the compiler's catalog.
let names={},catalog,records=[],views=[],seconds=0,playing=false,opening=0,controller,currentJob,manifest,manifestUrl,previousUrl,pendingJob,libraryEntries=[];
const audioCache=new Map();
let scrubPlaying,selectedPath,pointerScrubbing=false;
const playable=()=>libraryEntries.filter(e=>e.manifest);
const samePath=(path,url)=>path&&url&&new URL(path,location.href).href===new URL(url,location.href).href;
function selection(path){
 selectedPath=path;const entries=playable(),index=entries.findIndex(e=>samePath(e.manifest,path));
 $('selection-position').textContent=index<0?'SAVED PRODUCTION':`COLLECTION · ${index+1} OF ${entries.length}`;
 $('previous-ride').disabled=index<=0;$('next-ride').disabled=index<0||index>=entries.length-1;
 for(const card of $('library').children){const active=samePath(card.dataset.manifest,path);card.classList.toggle('selected',!!active);if(active)card.setAttribute('aria-current','true');else card.removeAttribute('aria-current');}
}
function openSelection(path,job){openResult(path,job);$('result').scrollIntoView({block:'start'});$('result').focus({preventScroll:true});}
for(const [id,delta]of [['previous-ride',-1],['next-ride',1]])$(id).onclick=()=>{const entries=playable(),i=entries.findIndex(e=>samePath(e.manifest,selectedPath)),entry=entries[i+delta];if(i>=0&&entry)openSelection(entry.manifest);};
const impactReview=createContactImpactReview({seek:t=>jump(t)});
const scoreName=r=>r.impactContract?'Impact quality ('+r.impactContract+')':'Landing score (previous objective)';
// Range controls serialize with reduced precision. Preserve the policy default
// until the artist actually changes it, including for exact request cache reuse.
let guidedBalance=Number($('balance').defaultValue);
$('balance').oninput=()=>{guidedBalance=Number($('balance').value);};
const fmt=(v,n=2)=>Number.isFinite(v)?v.toFixed(n):'—';
function el(tag,text,cls){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;}
function status(message,error=false){$('status').textContent=message;$('status').classList.toggle('error',error);}
async function api(path,body){const r=await fetch('/api/repertoire/'+path,body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw new Error(d.error??r.statusText);return d;}
async function verifiedAudio(c,signal){
 let blob=audioCache.get(c.audioSha256);
 if(!blob){
  const response=await fetch('/'+c.audioPath,{signal});if(!response.ok)throw new Error('Music unavailable');
  const bytes=await response.arrayBuffer(),digest=await sha256Hex(bytes);
  signal.throwIfAborted();if(digest!==c.audioSha256)throw new Error('Music does not match the saved recording');
  blob=new Blob([bytes],{type:'audio/mpeg'});
 }
 signal.throwIfAborted();audioCache.delete(c.audioSha256);audioCache.set(c.audioSha256,blob);
 while(audioCache.size>4)audioCache.delete(audioCache.keys().next().value);
 return blob;
}
function pause(){const at=music.pause();if(playing)seconds=at;playing=false;$('play').textContent='Play';}
async function start(){$('play').textContent='Pause';try{if(seconds>=+$('seek').max||seconds<+$('seek').min)seek(+$('seek').min);$('movie').pause();await music.play(seconds,+$('rate').querySelector('input:checked').value);if(!music.playing)return;playing=true;}catch(e){playing=false;$('play').textContent='Play';status(e.message,true);}}
function togglePlayback(){music.requested?pause():start();}

// The ride is drawn by the video picture, in the chosen look (plain by default), so it is what a video of it shows.
const looks=new Map([['plain',{name:'Plain',look:resolveLook('plain')}],...Object.entries(THEMES).map(([id,t])=>[id,{name:t.name,look:resolveLook(id)}])]);
$('look').replaceChildren(...[...looks].map(([id,{name}])=>{const o=el('option',name);o.value=id;return o;}));
$('look').value=looks.has(new URLSearchParams(location.search).get('look'))?new URLSearchParams(location.search).get('look'):'plain';
function draw(){
 $('time').textContent=fmt(seconds,2)+' / '+fmt(+$('seek').max,1)+' s';$('seek').value=seconds;
 const look=looks.get($('look').value).look,r=Math.min(2,devicePixelRatio);
 ($('comparison').checked?[0,1]:[0]).forEach(index=>{const view=views[index],record=records[index];if(!view||!record)return;const canvas=$(index?'reference':'production');
  const w=Math.round(canvas.clientWidth*r),h=Math.round(canvas.clientHeight*r);if(!w||!h)return;
  if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
  const world=view.picture.draw(seconds,look);
  // inspection: the lines that guided the ride (blue) and the ones touched at the physics frame shown (orange), with the picture's camera
  if($('inspect').checked){const {guideIds,byFrame}=view.ride.inspection,f=Math.max(0,Math.min(byFrame.length-1,Math.floor(rideTime(seconds,view.ride.scene.timing.offset)*FPS))),c=canvas.getContext('2d');
   highlight(c,world,record,guideIds,'#2468ba',2*r);highlight(c,world,record,byFrame[f].all,'#d35400',2*r);}
 });
 impactReview.draw(seconds);
}
function passageLink(updateHistory=true){if(!manifestUrl)return;const url=new URL(location.href);url.searchParams.set('data',manifestUrl.pathname);url.searchParams.set('t',seconds.toFixed(3));if($('look').value!=='plain')url.searchParams.set('look',$('look').value);else url.searchParams.delete('look');if($('comparison').checked)url.searchParams.set('compare','previous');else url.searchParams.delete('compare');$('passage-link').href=url.href;if(updateHistory)history.replaceState(null,'',url);}
function jump(t){const resume=music.requested;pause();$('movie').pause();seek(t);if(resume&&seconds<+$('seek').max)start();$('result').focus({preventScroll:true});}
function seek(t){seconds=Math.max(+$('seek').min,Math.min(+$('seek').max,t));draw();passageLink();}
async function comparisonChanged(){
 if($('comparison').disabled)return;
 const token=opening,signal=controller?.signal;
 if($('comparison').checked&&previousUrl&&!views[1]){
  // Optional historical playback must neither delay nor prevent the current ride.
  const url=previousUrl,current=records[0],schema=manifest.plan.schema;
  $('comparison').disabled=true;status('Loading previous automatic arrangement…');
  try{
   const pm=await checked(url.href,signal),pc=pm.cells.find(c=>c.method==='production');
   if(!pc)throw new Error('Missing previous automatic arrangement');
   const previous=await checked(new URL(pc.path,url).href,signal,pc.sha256);
   if(previous.planSha256!==pm.planSha256||previous.seed!==current.seed||previous.case.id!==current.case.id||pm.plan.schema!==schema)throw new Error('Previous arrangement has different musical inputs');
   for(const key of ['audioSha256','specSha256','analysisSha256','durationFrames'])if(previous.case[key]!==current.case[key])throw new Error('Previous arrangement has different '+key);
   const ride=await prepareRide(previous,new URL(pc.path,url).href,pc.sha256,signal),picture=await pictureFor($('reference'),ride);
   if(token!==opening)return;
   records[1]=previous;views[1]={ride,picture};status('');
  }catch(e){if(signal.aborted||token!==opening)return;$('comparison').checked=false;status('Previous comparison unavailable: '+e.message,true);}
  finally{if(token===opening)$('comparison').disabled=false;}
 }
 const shown=$('comparison').checked&&!!views[1];
 $('comparison-ride').hidden=!shown;$('rides').classList.toggle('comparing',shown);
 const r=records[1];if(r)$('reference-metrics').textContent=`${scoreName(r)} ${fmt(r.score.score,1)} · ${r.valid?'complete':'incomplete'}`;
 draw();passageLink();
}
$('comparison').onchange=comparisonChanged;
document.querySelector('header a[href="#generation"]').onclick=()=>{$('generation').open=true;};
// Each frame shows the ride at the music position heard when the frame is on screen.
function tick(ts){if(playing){seconds=music.position(onScreen(ts));if(seconds>=+$('seek').max){pause();seek(+$('seek').max);}draw();passageLink(false);}requestAnimationFrame(tick);}requestAnimationFrame(tick);
$('play').onclick=event=>{togglePlayback();if(event.detail)$('result').focus({preventScroll:true});};
function beginScrub(){if(scrubPlaying===undefined)scrubPlaying=music.requested;pause();$('movie').pause();}
function endScrub(){const resume=scrubPlaying;scrubPlaying=undefined;if(resume&&seconds<+$('seek').max)start();}
$('seek').onpointerdown=()=>{pointerScrubbing=true;beginScrub();};
$('seek').oninput=()=>{beginScrub();seek(+$('seek').value);};
$('seek').onchange=()=>{if(!pointerScrubbing)endScrub();};
// Finish after the range control's final input/change events, including Firefox.
for(const type of ['pointerup','pointercancel'])document.addEventListener(type,()=>{if(pointerScrubbing)setTimeout(()=>{pointerScrubbing=false;endScrub();},0);});
for(const id of ['production','reference'])$(id).onclick=()=>{if(!$('play').disabled){togglePlayback();$('result').focus({preventScroll:true});}};
document.addEventListener('keydown',event=>{if($('result').hidden||$('play').disabled)return;const action=playerShortcut(event);if(!action)return;event.preventDefault();if(action.type==='toggle')togglePlayback();else if(action.type==='seek')jump(seconds+action.delta);});
$('look').onchange=()=>{draw();passageLink();};$('inspect').onchange=draw;$('rate').onchange=()=>{if(music.requested){pause();start();}};
window.addEventListener('resize',draw);document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
function clearMovie(){const v=$('movie');v.pause();v.removeAttribute('src');v.load();v.hidden=true;$('movie-link').hidden=true;$('movie-link').removeAttribute('href');}
async function loadMovie(m,url,signal,token){
  const c=m.cells.find(c=>c.method==='production'),recordUrl=new URL(c.id+'.video.json',url);
  const probe=await fetch(recordUrl,{signal});if(!probe.ok)return;
  const v=await checked(recordUrl.href,signal,undefined,probe),of=v.inputs;if(of.planSha256!==m.planSha256||of.cellSha256!==c.sha256)throw new Error('Video does not match saved ride');
  if(token!==opening)return;
  const src=new URL(v.full.path,url).href;$('movie-link').href=src;$('movie-link').hidden=false;
  $('movie').src=src;$('movie').hidden=false;
}
async function openResult(path,job,initialTime=0){
 impactReview.clear();
 scrubPlaying=undefined;pointerScrubbing=false;selection(path);$('result-context').textContent='';
 const token=++opening;controller?.abort();controller=new AbortController();const {signal}=controller;pause();clearMovie();status('');currentJob=job;views=[];records=[];manifestUrl=undefined;seconds=0;$('result').hidden=false;$('play').disabled=true;$('seek').disabled=true;$('render').hidden=true;$('timeline').replaceChildren();$('observations').replaceChildren();$('review-moments').replaceChildren();$('motion-summary').textContent='';$('result-title').textContent='Loading saved track…';$('result-note').textContent='Verifying artifacts and native rider playback…';$('record-link').removeAttribute('href');
 previousUrl=undefined;$('comparison-control').hidden=true;$('comparison').disabled=true;$('comparison-ride').hidden=true;$('rides').classList.remove('comparing');
 for(const id of ['production','reference']){const c=$(id);c.getContext('2d').clearRect(0,0,c.width,c.height);}music.clear();delete $('play').dataset.source;delete $('play').dataset.sha256;
 try{
  const url=new URL(path,location.href),m=await checked(url.href,signal),cells=[m.cells.find(c=>c.method==='production')];if(!cells[0])throw new Error('Missing automatic arrangement');
  // Download and verify music while the ride is loaded and replayed. Observe
  // rejection immediately; audio failure must leave the saved ride scrubbable.
  const audio=verifiedAudio(m.plan.cases[0],signal).then(blob=>({blob}),error=>({error}));
  const data=await Promise.all(cells.map(c=>checked(new URL(c.path,url).href,signal,c.sha256)));data.forEach(r=>{if(r.planSha256!==m.planSha256)throw new Error('Mismatched plan identity');});
  const libraryEntry=libraryEntries.find(e=>new URL(e.manifest??'',location.href).href===url.href),prior=libraryEntry?.priorManifest;
  previousUrl=prior?new URL(prior,location.href):undefined;
  $('comparison-control').hidden=!prior;if(!prior)$('comparison').checked=false;
  const rides=await Promise.all(data.map((r,i)=>prepareRide(r,new URL(cells[i].path,url).href,cells[i].sha256,signal)));
  const prepared=await Promise.all(rides.map(async(ride,i)=>({ride,picture:await pictureFor($(i?'reference':'production'),ride)})));if(token!==opening)return;
  records=data;views=prepared;manifest=m;manifestUrl=url;const [ride]=cells,p=ride.production;
  $('comparison').disabled=false;
  $('result-title').textContent=libraryEntry?.title??m.plan.cases[0].title;
  $('result-context').textContent=[m.plan.cases[0].title,`Seed ${ride.seed}`,`${fmt(rides[0].scene.span[1],1)} s`,...new Set(rides.map(r=>describeTiming(r.scene.timing))),libraryEntry?.description].filter(Boolean).join(' · ');
  document.title=`${libraryEntry?.title??m.plan.cases[0].title} · Line`;
  $('result-note').textContent=p.qualified?'Complete ride · every requested construction fulfilled.':ride.valid?'Complete ride · some requested constructions were not fulfilled.':`Incomplete ride · ${ride.failure?.reason??p.constructionFailure??'see saved diagnostics'}`;$('result-note').classList.toggle('error',!p.qualified);
  $('production-metrics').textContent=`${scoreName(ride)} ${fmt(ride.score.score,1)} · ${p.realization.fulfilledSections}/${p.realization.requested} constructions fulfilled · compiled in ${fmt(ride.compileMs/1000,1)} s`;
  if(!ride.impactContract)$('result-note').textContent='Previous landing objective, kept for comparison. '+$('result-note').textContent;
  impactReview.bind(data[0],rides[0].scene);
  $('seek').min=0;
  // the song the rides cover (scene.ts), and the song time of a compiled frame through the ride's timing (timing.js)
  const {offset}=rides[0].scene.timing,at=frame=>songTimeOfFrame(frame,offset);
  $('seek').max=Math.min(...rides.map(r=>r.scene.span[1]));$('seek').disabled=false;
  const real=new Map(p.realization.sections.map(r=>[r.section,r]));
  $('timeline').replaceChildren(...p.plan.phrases.map(phrase=>{const requests=p.plan.requests.slice(phrase.first,phrase.first+phrase.count),ok=requests.every(r=>real.get(r.section)?.fulfilled),b=el('button',`${names[phrase.construction]} · ${fmt(at(requests[0].frame),1)}s`,ok?'':'unfulfilled');b.title=`${phrase.guidance} guidance; ${phrase.railLayout??'paired'} layout; ${ok?'fulfilled':'unfulfilled'}`;b.onclick=()=>jump(at(requests[0].frame)-.3);return b;}));
  $('observations').replaceChildren(...p.plan.requests.slice(1).map(r=>{const result=real.get(r.section),tr=el('tr');for(const t of [r.section,fmt(at(r.frame)),names[r.construction],`${r.guidance} / ${r.railLayout??'paired'}`,result?.fulfilled?'Fulfilled':result?.reasons?.join(', ')??'Not built'])tr.append(el('td',String(t)));return tr;}));
  $('work').textContent=`Automatic compile: ${ride.physicalFrames.toLocaleString()} of ${ride.allowance.toLocaleString()} physics frames. Independent judging and video rendering are separate. ${p.plan.policy}. The physical checks establish functional construction, not an aesthetic rating.`;
  $('record-link').href=new URL(ride.path,url).href;$('render').hidden=!job||!ride.valid;$('render').disabled=['queued','rendering','complete'].includes(job?.render);$('render').textContent=job?.render==='complete'?'Video ready':job?.render==='rendering'?'Rendering…':'Render finished video';
  const motion=p.motion?.full;$('motion-detail').hidden=!motion;
  if(motion)$('motion-summary').textContent=motion.bursts.map(b=>`${b.frames*25} ms: ${b.episodes} above-band episodes; largest excess ${fmt(b.maxExcess)} px/frame`).join(' · ')+'. These measurements separate extra speed gain from gravity. They describe motion; they do not rate its artistic quality.';
  const song=data[0].case.id,moments=[];
  if(['luna_bala_44s','tiki_tiki_48s'].includes(song))moments.push(['Calm opening',0]);
  if(song==='amour_de_ma_vie_44s'&&ride.seed===303)moments.push(['Reported acceleration · 9.4s',8.7]);
  if(song==='amour_de_ma_vie_44s'&&ride.seed===101)moments.push(['Reported acceleration · 5.95s',5.3]);
  if(song==='tiki_tiki_48s'&&ride.seed===101)moments.push(['Reported acceleration · 15.32s',14.7]);
  const reviewMoments=libraryEntry?.moments??moments.map(([title,at])=>({title,at}));
  $('review-moments').replaceChildren(...reviewMoments.map(({title,at,reason})=>{const b=el('button',title);b.title=reason??'';b.onclick=()=>jump(at);return b;}));
  seek(initialTime);
  let audioFailure;
  const media=await Promise.allSettled([
   (async()=>{try{
    const c=m.plan.cases[0],ready=await audio;if(token!==opening)return;
    if('error' in ready)throw ready.error;
    const bytes=await ready.blob.arrayBuffer();if(token!==opening)return;
    await music.load(bytes);if(token!==opening)return;
    $('play').dataset.source=c.audioPath;$('play').dataset.sha256=c.audioSha256;$('play').disabled=false;
   }catch(e){if(signal.aborted||token!==opening)return;audioFailure=e.message+'; the saved ride can still be scrubbed.';status(audioFailure,true);}})(),
   loadMovie(m,url,signal,token),
  ]);
  for(const result of media)if(result.status==='rejected')throw result.reason;
  if(token===opening&&$('comparison').checked)await comparisonChanged();
  if(token===opening&&audioFailure)status(audioFailure,true);
 }catch(e){if(signal.aborted||token!==opening)return;$('result-note').textContent='Could not open result: '+e.message;$('result-note').classList.add('error');}
}
$('movie').onplay=pause;
for(const id of ['record-link','movie-link'])$(id).onclick=()=>$('result').focus({preventScroll:true});
$('render').onclick=async()=>{try{const {job}=await api(`jobs/${currentJob.id}/render`,{});currentJob=job;$('render').disabled=true;$('render').textContent='Rendering queued…';}catch(e){status(e.message,true);}};
function card(title,description){const c=el('article');c.append(el('h3',title),el('p',description));return c;}
async function refreshJobs(){try{const {jobs}=await api('jobs');const automatic=jobs.filter(j=>j.request.mode==='production');$('jobs').parentElement.hidden=automatic.length===0;$('jobs').replaceChildren(...automatic.map(job=>{const c=card(`${catalog.songs.find(s=>s.id===job.request.song)?.title??job.request.song} · ${job.request.seed}`,`${job.status}${job.status==='complete'?(job.qualified?' · fulfilled':job.valid?' · request misses':' · incomplete'):''}${job.render?' · video '+job.render:''}`),actions=el('div',undefined,'card-actions');if(job.manifest){const b=el('button','Open ride');b.onclick=()=>openSelection(job.manifest,job);actions.append(b);}if(['queued','compiling'].includes(job.status)||['queued','rendering'].includes(job.render)){const b=el('button','Cancel');b.onclick=async()=>{await api(`jobs/${job.id}/cancel`,{});await refreshJobs();};actions.append(b);}const log=el('a','Log');log.href=`/generated/repertoire-jobs/${job.id}/${job.render?'render':'compile'}.log`;actions.append(log);c.append(actions);if(job.error||job.renderError)c.append(el('p',job.error??job.renderError,'error'));return c;}));
 const awaited=automatic.find(j=>j.id===pendingJob);if(awaited){status(`Generation ${awaited.status}${awaited.error?': '+awaited.error:''}`,awaited.status==='error');if(['complete','error','cancelled'].includes(awaited.status)){pendingJob=null;if(awaited.manifest)await openResult(awaited.manifest,awaited);}}
 const updated=automatic.find(j=>j.id===currentJob?.id);if(updated?.render==='complete'&&currentJob.render!=='complete'){currentJob=updated;await loadMovie(manifest,manifestUrl,controller.signal,opening);$('render').textContent='Video ready';}
 }catch(e){status(e.message,true);}}
$('generate').onsubmit=async event=>{event.preventDefault();try{const request={mode:'production',song:$('song').value,seed:+$('seed').value,...($('budget').value?{budget:+$('budget').value}:{}),creative:{variation:+$('variation').value,guidedBalance,repertoire:[...$('repertoire').querySelectorAll('input:checked')].map(i=>i.value)}};status('Submitting automatic arrangement…');const {job,reused}=await api('compile',request);pendingJob=job.id;status(reused?'Opening matching saved request…':'Compilation queued…');await refreshJobs();}catch(e){status(e.message,true);}};
async function loadLibrary(){try{
 const params=new URLSearchParams(location.search),collection=new URL(params.get('collection')??'production-library.json',location.href);
 if(collection.origin!==location.origin)throw new Error('Review collections must be served from this gallery.');
 let data;
 if(params.has('collection'))data=await checked(collection.href);
 else{const response=await fetch(collection.href);if(!response.ok)throw new Error('The review collection is being generated.');data=await response.json();}
 libraryEntries=data.entries;
 $('default-collection-note').hidden=params.has('collection');
 let collectionNote=$('collection-note');
 if(!collectionNote){collectionNote=el('p');collectionNote.id='collection-note';$('library').before(collectionNote);}
 collectionNote.textContent=data.description??'';collectionNote.hidden=!data.description;
 $('generate').querySelector('button[type=submit]').textContent='Generate a track';
 $('library').replaceChildren(...data.entries.map(entry=>{
  const c=card(entry.title,[entry.seed!==undefined?`Seed ${entry.seed}`:null,entry.error??entry.status??'Saved arrangement'].filter(Boolean).join(' · '));
  c.dataset.manifest=entry.manifest??'';if(entry.description)c.append(el('p',entry.description));
  if(entry.manifest){const b=el('button','Open ride');b.onclick=()=>openSelection(entry.manifest);c.append(b);}return c;
 }));
 const filter=()=>{const query=$('filter-rides').value.trim().toLocaleLowerCase();let shown=0;for(const c of $('library').children){c.hidden=!c.textContent.toLocaleLowerCase().includes(query);if(!c.hidden)shown++;}$('collection-count').textContent=`${shown} of ${data.entries.length} rides${shown?'':' · No matching rides'}`;};
 $('filter-rides').oninput=filter;filter();
 const initial=params.get('data')??data.entries.find(e=>e.manifest)?.manifest;
 if(initial){const at=Math.max(0,Number(params.get('t'))||0);$('comparison').checked=params.get('compare')==='previous';await openResult(initial,undefined,at);}
 }catch(e){$('library').textContent=e.message;}}
try{catalog=await api('catalog');names=Object.fromEntries(catalog.constructions.map(c=>[c.id,c.label]));$('song').replaceChildren(...catalog.songs.map(s=>{const o=el('option',s.title);o.value=s.id;return o;}));for(const {id,label:name}of catalog.constructions){const label=el('label'),input=el('input');input.type='checkbox';input.value=id;input.checked=true;label.append(input,document.createTextNode(name));$('repertoire').append(label);}await Promise.all([loadLibrary(),refreshJobs()]);setInterval(refreshJobs,4000);}catch(e){status(e.message,true);}
