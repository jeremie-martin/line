import {prepareView} from './replay.js';
import {createGuideChoicePanel} from './guide-choice.js';
const $ = id => document.getElementById(id);
const number = n => n.toLocaleString(undefined, {maximumFractionDigits: 1});
const title = method => manifest?.plan.methodDetails?.[method]?.title ?? ({arcs:'Arcs and guides',segments:'Scattered · original'}[method] ?? method);
const manifestUrl = new URL(new URLSearchParams(location.search).get('data') || '/generated/motion-gallery/20260930-functional-rails/manifest.json', location.href);
let manifest, records = [], seconds = 0, playing = false, previous = 0, generation = 0, activePassage, animation;
let selectionController, paletteInput, loading = false;
let choicePanel;
const cache = new Map();
const hex = bytes => [...new Uint8Array(bytes)].map(x => x.toString(16).padStart(2, '0')).join('');
async function read(url, expected, signal) {
  const response = await fetch(url, {signal}); if (!response.ok) throw new Error(`${response.status}: ${url.pathname}`);
  const bytes = await response.arrayBuffer();
  const digest = hex(await crypto.subtle.digest('SHA-256', bytes));
  if (digest !== expected.trim()) throw new Error(`Checksum mismatch: ${url.pathname}`);
  return JSON.parse(new TextDecoder().decode(bytes));
}
const options = (id, values, label = String) => $(id).replaceChildren(...values.map(v => {
  const option = document.createElement('option'); option.value = String(v); option.textContent = label(v); return option;
}));
function suspend() { cancelAnimationFrame(animation); animation=undefined; }
function updatePlay() {
  $('play').textContent = playing ? 'Pause' : loading ? 'Loading…' : 'Play';
  $('play').disabled = !records.length && !playing;
}
function pause() { suspend(); playing = false; updatePlay(); }
function resume() {
  if (!playing || loading || !records.length) return;
  suspend(); previous=performance.now(); animation=requestAnimationFrame(tick);
}
function fail(error) {
  selectionController?.abort(); loading=false; records=[]; pause();
  $('panels').replaceChildren(); $('panels').dataset.state='error'; $('panels').setAttribute('aria-busy','false');
  $('beats').replaceChildren(); $('seek').disabled=true; $('retry').hidden=false;
  $('status').textContent=`Cannot show this comparison: ${error.message}`;
}
function cellCard(record) {
  const card = document.createElement('article'); card.className = 'card';
  card.innerHTML = '<div class="card-head"><h2></h2><span class="badge"></span></div><canvas aria-label="Recorded track playback"></canvas><div class="contact-inspection" hidden><p class="guide-summary"></p><p class="contact-now"></p><div class="contact-navigation"></div></div><div class="metrics"></div><div class="interval"></div><div class="details"></div>';
  card.querySelector('h2').textContent = record.displayTitle??title(record.method);
  const badge = card.querySelector('.badge'); badge.textContent = record.score.valid ? 'Timing & survival pass' : 'Failed contract';
  badge.classList.toggle('fail', !record.score.valid);
  for (const [label, value] of [['Adherence / 1000', number(record.score.score)], ['Physics frames', number(record.physicalFrames)], ['Compile time', `${(record.compileMs / 1000).toFixed(2)} s`]]) {
    const metric = document.createElement('div'); metric.className = 'metric';
    const name = document.createElement('span'), output = document.createElement('strong'); name.textContent = label; output.textContent = value;
    metric.append(name, output); card.querySelector('.metrics').append(metric);
  }
  const details = card.querySelector('.details');
  if(record.usage){const p=document.createElement('p');p.className='choice-metrics';p.textContent=`${record.usage.guideSections}/${record.usage.supportSections} guided sections · ${record.usage.guideLength.toFixed(1)} world units of guide · target error (RMS) ${record.qualityRms?.toFixed(4)??'unavailable'}.`;details.append(p);}
  const description = document.createElement('p'); description.textContent = manifest.plan.methodDetails?.[record.method]?.description ?? ''; details.append(description);
  if(record.construction){const selection = document.createElement('p'); selection.textContent = record.construction.selected === 'contact-fragments' ? 'Shown: reconstructed contact fragments.' : 'Shown: original feedback result retained after comparison.'; details.append(selection);}
  const text = document.createElement('p'); text.textContent = `${number(record.lines)} normal segments · seed ${record.seed} · ${(100 * record.jitter).toFixed(0)}% target jitter · ${record.attemptAllowance?'this attempt:':'allowance'} ${number(record.attemptAllowance??record.budget)} frames.`; details.append(text);
  if (!record.score.valid) {const failure = document.createElement('p'); failure.className = 'failure'; failure.textContent = record.score.hardFailures.join(' · '); details.append(failure);}
  const link = document.createElement('a'); link.href = new URL(record.path, manifestUrl); link.textContent = 'Track, targets and replay data'; details.append(link);
  record.inspector=card.querySelector('.contact-inspection');
  record.contactNow=card.querySelector('.contact-now');
  const inspection=record.native.view.inspection,{summary,layout}=inspection;
  card.querySelector('.guide-summary').textContent=layout==='connected'?
    (summary.guideSections?`${summary.touchedGuideSections} of ${summary.guideSections} guide rails contacted over this replay · ${summary.supportSections} support sections. Contact does not establish necessity.`:`${summary.supportSections} main-rail sections. No guide rails are present.`):
    layout==='fragments'?'Scattered fragments have no designated guide rail. Actual segment collisions are highlighted.':'Rail roles are unavailable for this archived geometry. Actual segment collisions are highlighted.';
  record.contactButtons=[-1,1].map(direction=>{
    const button=document.createElement('button');button.textContent=direction<0?'Previous guide contact':'Next guide contact';
    button.onclick=()=>{
      const at=Math.floor(seconds*40),frames=inspection.guideFrames;
      const next=direction<0?frames.findLast(f=>f<at):frames.find(f=>f>at);
      if(next!==undefined){pause();seconds=next/40;$('seek').value=String(seconds);draw();}
    };card.querySelector('.contact-navigation').append(button);return button;
  });
  record.canvas = card.querySelector('canvas'); record.interval = card.querySelector('.interval');
  const coords = record.track.lines.flatMap(l => [[l.x1, l.y1], [l.x2, l.y2]]);
  for (const frame of record.trace.frames) coords.push([frame[0], frame[1]]);
  record.bounds = coords.reduce((b, [x,y]) => [Math.min(b[0],x), Math.min(b[1],y), Math.max(b[2],x), Math.max(b[3],y)], [Infinity, Infinity, -Infinity, -Infinity]);
  return card;
}
async function loadCell(cell, signal) {
  signal.throwIfAborted();
  const raw = cache.get(cell.id) ?? await read(new URL(cell.path, manifestUrl), cell.sha256, signal);
  signal.throwIfAborted();
  if (raw.planSha256 !== manifest.planSha256 || raw.id !== cell.id || raw.trackHash !== cell.trackHash) throw new Error('Replay identity mismatch');
  // Failed or cancelled downloads never enter the cache.
  cache.delete(cell.id); cache.set(cell.id,raw);
  while(cache.size>24)cache.delete(cache.keys().next().value);
  const native=await prepareView(raw,cell.sha256,signal);
  return {...raw, path: cell.path, native};
}
async function showPalette(token, load) {
  $('palette-status').textContent='Loading shape previews…';
  try {
    const cells=manifest.plan.methods.map(method=>manifest.cells.find(c=>c.method===method && c.caseId===$('passage').value && c.budget===+$('budget').value && c.seed===+$('seed').value));
    if(cells.some(c=>!c))throw new Error('The shape comparison is incomplete.');
    for (const cell of cells) {
      if ([...$('palette').children].some(button=>button.dataset.method===cell.method)) continue;
      const r=await load(cell);
      if(token!==generation)return;
      const button=document.createElement('button'); button.className='shape-choice';
      button.setAttribute('aria-pressed',String(r.method===$('right-method').value)); button.dataset.method=r.method;
      const label=document.createElement('strong'); label.textContent=title(r.method);
      const preview=document.createElement('canvas'); preview.setAttribute('aria-hidden','true');
      const beat=r.case.contacts[Math.min(1,r.case.contacts.length-1)], at=Math.min(beat.frame+4,r.trace.frames.length-1);
      const [x,y]=r.trace.frames[at];
      // Fixed world framing, native line thickness and Bosh artwork in previews too.
      r.native.view.draw(preview,{w:220,h:140,x:x+45,y,z:1,r:devicePixelRatio||1},at);
      const note=document.createElement('span'); note.textContent=`${r.score.valid?'Pass':'Failed contract'} · ${number(r.score.score)} / 1000`; note.className=r.score.valid?'':'failure';
      button.append(preview,label,note); button.title=manifest.plan.methodDetails?.[r.method]?.description ?? title(r.method);
      button.onclick=()=>{$('right-method').value=r.method;select();};
      $('palette').append(button);
    }
    $('palette-status').textContent='';
  } catch(error) {if(token===generation&&!selectionController.signal.aborted){
    $('palette-status').textContent=`Cannot show all previews: ${error.message} `;
    const retry=document.createElement('button');retry.textContent='Retry previews';retry.onclick=()=>select();$('palette-status').append(retry);
  }}
}
async function select() {
  const input=[$('passage').value,$('budget').value,$('seed').value].join('|');
  const token = ++generation;
  selectionController?.abort(); selectionController=new AbortController();
  const {signal}=selectionController, loads=new Map();
  const load=cell=>{
    if(!loads.has(cell.id))loads.set(cell.id,loadCell(cell,signal));
    return loads.get(cell.id);
  };
  suspend(); loading=true; records=[];
  if(activePassage!==$('passage').value)seconds=0;
  activePassage=$('passage').value;
  $('panels').replaceChildren(); $('panels').dataset.state='loading'; $('panels').setAttribute('aria-busy','true');
  $('beats').replaceChildren(); $('seek').disabled=true; $('retry').hidden=true;
  if(!choicePanel){
    if(paletteInput!==input){$('palette').replaceChildren();paletteInput=input;}
    for(const button of $('palette').children)button.setAttribute('aria-pressed',String(button.dataset.method===$('right-method').value));
    $('palette-status').textContent='Waiting for the selected tracks…';
  }
  updatePlay(); $('status').textContent = 'Checking matching native replays…';
  try {
    const choice=choicePanel?.select($('passage').value,+$('budget').value,+$('seed').value);
    if(choice?.jumpTo!==undefined){seconds=choice.jumpTo/40;pause();}
    $('seek').value=String(seconds); draw();
    const selected=choice?.cells??['left-method','right-method'].map(id => manifest.cells.find(c => c.caseId === $('passage').value && c.budget === +$('budget').value && c.seed === +$('seed').value && c.method === $(id).value));
    if(selected.some(c=>!c))throw new Error('The comparison is incomplete.');
    const loaded = await Promise.all(selected.map(load));
    if (token !== generation) return;
    if (loaded.length !== 2) throw new Error('The comparison is incomplete.');
    records = loaded.map((r,i)=>({...r,displayTitle:choice?.titles[i]})); seconds = Math.min(seconds, records[0].case.durationFrames / 40); $('seek').value = String(seconds); $('seek').max = String(records[0].case.durationFrames / 40);
    $('beats').replaceChildren(...records[0].case.contacts.map((c, i) => {
      const beat = document.createElement('button'); beat.textContent = String(i+1);
      beat.style.left = `${100*c.frame/records[0].case.durationFrames}%`;
      beat.title = `Beat ${i+1}: ${(c.frame/40).toFixed(2)} s`; beat.setAttribute('aria-label', beat.title);
      beat.onclick = () => {seconds=c.frame/40; $('seek').value=String(seconds); draw();}; return beat;
    }));
    $('panels').replaceChildren(...records.map(cellCard)); loading=false; $('seek').disabled=false; updatePlay();
    draw(); $('panels').dataset.state='ready'; $('panels').setAttribute('aria-busy','false');
    $('status').textContent = 'Native Bosh and line rendering · replay verified against saved physics · normal lines only'; resume();
    if(!choicePanel)void showPalette(token,load);
  } catch (error) {if (token === generation) fail(error);}
}
function drawCard(r) {
  const canvas = r.canvas, dpr = devicePixelRatio || 1, w = canvas.clientWidth, h = canvas.clientHeight;
  if (canvas.width !== Math.round(w*dpr) || canvas.height !== Math.round(h*dpr)) {canvas.width = Math.round(w*dpr); canvas.height = Math.round(h*dpr);}
  const at=Math.min(seconds*40,r.trace.frames.length-1), f=Math.floor(at), fraction=at-f;
  const a=r.trace.frames[f],b=r.trace.frames[Math.min(f+1,r.trace.frames.length-1)];
  let scale,x,y;
  if($('view').value==='overview'){
    const bounds=r.bounds;scale=Math.min((w-50)/Math.max(60,bounds[2]-bounds[0]),(h-50)/Math.max(60,bounds[3]-bounds[1]));
    x=(bounds[0]+bounds[2])/2;y=(bounds[1]+bounds[3])/2;
  }else{scale=Math.min(w/250,h/190);x=a[0]*(1-fraction)+b[0]*fraction+40;y=a[1]*(1-fraction)+b[1]*fraction;}
  const inspect=$('inspect').checked;
  r.native.view.draw(canvas,{w,h,x,y,z:scale,r:dpr},at,inspect);
  r.inspector.hidden=!inspect;
  if(inspect){
    const {byFrame,guideFrames,layout}=r.native.view.inspection,contact=byFrame[f];
    const text=contact.all.length?(layout==='connected'?`Colliding segments — guide: ${contact.guides.length}, main: ${contact.all.length-contact.guides.length}.`:`${contact.all.length} segments collided.`):'No segment collisions.';
    r.contactNow.textContent=`${seconds*40>at?'Last recorded frame':'Frame'} ${f}: ${text}`;
    r.contactButtons[0].disabled=!guideFrames.length||f<=guideFrames[0];
    r.contactButtons[1].disabled=!guideFrames.length||f>=guideFrames.at(-1);
  }
  const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#56665c';ctx.font='12px system-ui';
  ctx.fillText(seconds*40>r.trace.frames.length-1?`Replay ended: ${r.terminus.reason}`:`Frame ${Math.floor(seconds*40)}`,14,22);
  const frame = Math.round(seconds*40), observations = r.observations.filter(o => frame >= o.startFrame && frame <= o.endFrame);
  const gap = observations[0]?.gap;
  if (gap !== r.displayedGap) {
    r.displayedGap = gap; r.interval.replaceChildren();
    if (gap !== undefined) {
      const label = document.createElement('p'); label.textContent = `Interval ${gap+1} · measured over the whole interval`; r.interval.append(label);
      const table = document.createElement('table'); table.innerHTML = '<thead><tr><th>Target</th><th>Wanted</th><th>Measured</th></tr></thead>';
      const body = document.createElement('tbody');
      for (const o of observations.filter(o => o.gap === gap)) {const row = document.createElement('tr'); for (const value of [o.axis,o.target.toFixed(3),o.achieved?.toFixed(3) ?? '—']) {const cell = document.createElement('td'); cell.textContent = value; row.append(cell);} body.append(row);}
      table.append(body); r.interval.append(table);
    }
  }
}
function draw() { $('time').textContent = `${seconds.toFixed(2)} s`; records.forEach(drawCard); }
function tick(now) {
  animation=undefined;
  try {
    if (playing) {seconds=Math.min(+$('seek').max,seconds+(now-previous)/1000*(+$('rate').value));$('seek').value=String(seconds);draw();if(seconds>=+$('seek').max)pause();}
    previous=now; if(playing)animation=requestAnimationFrame(tick);
  } catch(error) {fail(error);}
}
$('play').onclick = () => {if (playing) pause(); else if(records.length) {if(seconds >= +$('seek').max)seconds=0;playing=true;updatePlay();resume();}};
$('retry').onclick = () => select();
$('inspect').onchange=()=>{$('contact-legend').hidden=!$('inspect').checked;draw();};
$('seek').oninput = () => {seconds=+$('seek').value; draw();}; $('view').onchange = draw;
for (const id of ['passage','budget','seed','left-method','right-method']) $(id).onchange = select;
window.addEventListener('resize', draw); document.addEventListener('visibilitychange', () => {if(document.hidden)pause();});
try {
  const checksum = await fetch(new URL(manifestUrl.href+'.sha256')); if(!checksum.ok)throw new Error('No local study manifest found.');
  manifest = await read(manifestUrl, await checksum.text());
  if(manifest.schema !== 'line.motion-gallery.v1')throw new Error('Unsupported study format.');
  if(manifest.plan.kind==='guide-choice'){
    choicePanel=await createGuideChoicePanel(manifest,select);
    for(const id of ['left-method','right-method'])$(id).closest('label').hidden=true;
    document.querySelector('.palette-section').hidden=true;
  }
  for(const id of ['left-method','right-method'])options(id,manifest.plan.methods,title);
  if(manifest.plan.methods.includes('single'))$('left-method').value='single';
  $('right-method').value=manifest.plan.methods.includes('paired')?'paired':manifest.plan.methods.includes('scattered')?'scattered':(manifest.plan.methods[1] ?? manifest.plan.methods[0]);
  options('passage', manifest.plan.cases.map(c=>c.id), id=>manifest.plan.cases.find(c=>c.id===id).title);
  options('budget', manifest.plan.budgets, b=>`${number(b)} frames`); $('budget').value=String(manifest.plan.budgets.includes(100000)?100000:manifest.plan.budgets.at(-1)); options('seed',manifest.plan.seeds);
  $('study-note').textContent=choicePanel?.note??manifest.plan.note; $('manifest-link').href=manifestUrl;
  $('identity').textContent=`Compiler ${manifest.plan.compiler.head.slice(0,8)} · ${manifest.cells.length} recorded runs`;
  for(const row of manifest.summary){const tr=document.createElement('tr');for(const value of [title(row.method),number(row.budget),`${row.valid}/${row.runs}`,number(row.meanScore),number(row.totalPhysicalFrames),`${(row.totalCompileMs/1000).toFixed(1)} s`]){const td=document.createElement('td');td.textContent=value;tr.append(td);}$('summary').append(tr);}
  await select();
} catch(error) {$('status').textContent=`Gallery unavailable: ${error.message} Generate the local study using scripts/gallery/build.ts; see docs/motion-repertoire.md.`;}
