import {createMusic, displayTime} from '/shared/playback.js';
import * as N from '/generated/renderer/native.js';
import {createPicture, BODY_POINTS, riderAt} from '/scripts/video/picture.js';
import {resolveLook, THEMES} from '/scripts/video/look.js';
import {prepareHits} from '/scripts/video/hits.js';
import {rideSignals} from '/scripts/video/camera.js';
import {riderOnScreen, screenMetrics, NO_MOTION, unpunchedCamera} from './hit-motion-screen.mjs';
import {punchSettings, punchAmplitude} from './hit-motion-realized.mjs';
import {strength, rideIntensity} from '/scripts/video/intensity.js';
import {MODES, effectsAt, motionAt} from './hit-motion-model.mjs';
import {cameraZoomAt} from './hit-motion-zoom.mjs';
import {framingFor} from './hit-motion-camera.mjs';
const $ = id => document.getElementById(id), q = new URLSearchParams(location.search);
const choose = (id, key, allowed) => {const v = q.get(key); if (allowed.includes(v)) $(id).value = v;};
$('theme').replaceChildren(...Object.entries(THEMES).map(([id, theme]) => new Option(theme.name, id)), new Option('Plain', 'plain'));
$('theme').value = 'hokusai';
choose('song', 'song', ['tiki', 'circus']); choose('theme', 'theme', [...Object.keys(THEMES), 'plain']);
choose('camera', 'camera', ['current', 'old-six', 'old-ten', 'old-authored', 'old-zoom', 'old-punch', 'old-punch-locked', 'measured-punch', 'measured-locked', 'measured-current']);
const g = Number(q.get('gain')); if (q.has('gain') && Number.isFinite(g)) $('gain').value = Math.max(0, Math.min(2, g));
$('gainValue').textContent = `×${$('gain').value}`;
if (q.get('colour') === 'off') $('colour').checked = false;
if (q.get('split') === 'off') $('split').checked = false;
choose('rate', 'rate', ['1', '0.5', '0.25']);
choose('view', 'view', ['single', 'pair']);
let mode = Object.hasOwn(MODES, q.get('effect')) ? q.get('effect') : 'recoil';
let time = Math.max(0, Number(q.get('t')) || 9), home = time, playing = false, ticket = 0, entry, pictures = [];
const music = createMusic(), shown = displayTime(), sheet = N.loadSheet(), cache = new Map();
let hits = [], end = 48;
for(const [id,key,min,max] of [['punchThreshold','threshold',.2,.8],['punchPeak','punch',0,30]]) {const v=Number(q.get(key));if(q.has(key)&&Number.isFinite(v))$(id).value=Math.max(min,Math.min(max,v));}
const settings = () => punchSettings({threshold:Number($('punchThreshold').value),peak:Number($('punchPeak').value)/100});
const gain = () => Number($('gain').value), offset = () => entry.scene.timing.offset;
const look = () => resolveLook($('theme').value, {ends: 'none', hits: 'v1'});
function error(e) {pause(); $('status').textContent = String(e.message ?? e); window.__loadError = String(e);}
function pause() {if (playing) time = Math.max(0, Math.min(end, music.pause())); else music.pause(); playing = false; $('play').textContent = 'Play';}
async function play() {if (!entry) return; $('archive').pause(); playing = true; $('play').textContent = 'Pause'; try {await music.play(time, Number($('rate').value));} catch(e) {error(e);}}
function seek(t) {const resume = playing; pause(); time = Math.max(0, Math.min(end, t)); draw(); if (resume) void play();}
let pictureEntry, pictureCamera, pictureSettings, responses = [];
function rebuild() {
  if (!entry) return;
  const {scene, replay, sheet: sprites} = entry, responseSettings=settings(), settingsKey=JSON.stringify(responseSettings);
  $('thresholdValue').textContent=responseSettings.threshold.toFixed(2);$('peakValue').textContent=`${Math.round(responseSettings.peak*100)}%`;
  responses = ['current', mode].map(m => effectsAt(m, gain(), $('colour').checked, scene.timing.offset, $('split').checked));
  // Keep the renderer's large scratch canvases and prepared ride across effect switches.
  if (!pictures.length || pictureEntry !== entry || pictureCamera !== $('camera').value || pictureSettings !== settingsKey) {
    pictureEntry = entry; pictureCamera = $('camera').value;pictureSettings=settingsKey;
    pictures = ['baseline', 'candidate'].map((id, i) => createPicture($(id), scene, replay, sprites, N.riderPainter(), {
      effectsAt: (...args) => responses[i](...args), framing: framingFor(pictureCamera, replay, scene, responseSettings),
    }));
  }
  $('quickEffect').value=mode;
  $('candidateName').textContent = mode==='still' ? ([...PUNCH_COMPARISONS,...REALIZED_COMPARISONS].find(c=>c[0]===pictureCamera)?.[1] ?? MODES[mode][0]) : MODES[mode][0]; $('candidateNote').textContent = MODES[mode][1];
  for (const b of $('variants').children) {b.classList.toggle('on', b.dataset.mode === mode); b.setAttribute('aria-pressed', b.dataset.mode === mode);}
  for(const b of $('punchComparisons').children)b.classList.toggle('on',b.dataset.camera===pictureCamera&&mode==='still');
  for(const b of $('realizedComparisons').children)b.classList.toggle('on',b.dataset.camera===pictureCamera&&mode==='still');
  $('punchNote').textContent=PUNCH_COMPARISONS.find(c=>c[0]===pictureCamera)?.[2] ?? 'Choose a comparison to isolate the older punch.';
  charts(); draw();
}
function draw() {
  if (!pictures.length) return;
  const l = look(); pictures.forEach((p, i) => {if ($('view').value === 'pair' || i === (showCurrent ? 0 : 1)) p.draw(time, l);});
  $('seek').value = time; $('clock').textContent = `${time.toFixed(3)} s`;
  for (const line of document.querySelectorAll('#curves .cursor, #cameraCurves .cursor, #screenCurves .cursor')) {
    const width = Number(line.closest('svg').getAttribute('viewBox').split(' ')[2]);
    const x = 64 + (time - home) / Math.min(6, end - home) * (width - 82);
    line.setAttribute('x1', x); line.setAttribute('x2', x); line.style.display = time >= home && time <= home + 6 ? '' : 'none';
  }
}
async function load() {
  const n = ++ticket, key = $('song').value; pause(); music.clear(); entry = null; pictures = []; $('play').disabled = true; window.__ready = false;
  $('status').textContent = `Loading ${key === 'tiki' ? 'Tiki Tiki' : 'Circus Minimus'}…`;
  try {
    if (!cache.has(key)) cache.set(key, (async () => {
      const r = await fetch(`/generated/hit-effects/data/${key}.json`); if (!r.ok) throw new Error(`Scene HTTP ${r.status}; run hit-motion-prepare.mjs`);
      const scene = await r.json(), [replay, sprites] = await Promise.all([N.replay(scene.track, scene.trace), sheet]);
      return {scene, replay, sheet: sprites};
    })().catch(e => {cache.delete(key); throw e;}));
    const next = await cache.get(key); if (n !== ticket) return;
    await music.load('/' + next.scene.audio); if (n !== ticket) return;
    entry = next; end = entry.scene.span[1]; time = Math.min(time, end); home = Math.min(home, Math.max(0, end - 6)); $('seek').max = end;
    const centres = entry.replay.frames.map(f => {
      const p = f.points.filter(p => BODY_POINTS.includes(p.name));
      return {x: p.reduce((s, p) => s + p.pos.x, 0) / p.length, y: p.reduce((s, p) => s + p.pos.y, 0) / p.length};
    });
    hits = prepareHits(entry.scene.account, entry.replay.contacts, centres, new Map(entry.scene.track.lines.map(l => [l.id, l])));
    entry.motion=rideSignals(centres);entry.level=rideIntensity(entry.motion.velocity.map(v=>v.speed),hits,entry.scene.track.duration/40);entry.hits=hits;
    $('provenance').textContent = JSON.stringify({timing: entry.scene.timing, ...entry.scene.provenance}, null, 2);
    moments(); rebuild(); $('play').disabled = false; $('status').textContent = `${hits.length} measured hits · ${end.toFixed(2)} seconds · shared song clock`;
    window.__ready = true;
  } catch(e) {if (n === ticket) error(e);}
}
function moments() {
  const box = $('moments'); box.replaceChildren();
  const selected = [...hits].sort((a,b) => b.strength - a.strength).filter((h, i, a) => a.slice(0,i).every(p => Math.abs(p.time-h.time) > 2)).slice(0,5).sort((a,b)=>a.time-b.time);
  const all = [['Opening', 0], ...($('song').value==='tiki'?[['Inspect the hit near 13.95 s',13]]:[]), ...selected.map(h => [`Hit ${(h.time-offset()).toFixed(2)} s · ${h.strength.toFixed(2)}`, Math.max(0,h.time-offset()-1)])];
  // The densest strong-hit passage is a reproducible stress case, not a hand-picked success.
  const dense = hits.reduce((best,h) => {const count = hits.filter(p => p.time >= h.time && p.time < h.time+4 && p.strength>.55).length; return count>best.count ? {time:h.time,count} : best;}, {time:1,count:0});
  all.push([`Dense passage · ${dense.count} strong hits / 4 s`, Math.max(0,dense.time-offset()-.5)]);
  for (const [name, t] of all) {const b=document.createElement('button');b.textContent=name;b.onclick=()=>{home=Math.min(t,Math.max(0,end-6));seek(home);charts();};box.append(b);}
}
const svgEl = (tag, attrs={}, text) => {const e=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,v);if(text!==undefined)e.textContent=text;return e;};
const SIGNALS = {
  screenDX:{name:'Added horizontal displacement',unit:'px',limit:48,auto:true},
  screenDY:{name:'Added vertical displacement',unit:'px',limit:48,auto:true},
  screenSize:{name:'Added apparent size',unit:'%',limit:35,auto:true},
  screenSpeed:{name:'Actual screen speed',unit:' px/s',limit:600,auto:true,positive:true},
  punch: {name: 'Short punch', unit: '%', limit: 35},
  cameraZoom: {name: 'Camera zoom', unit: '%', limit: 100},
  dx: {name: 'Horizontal movement', unit: 'px', limit: 48, help: 'Horizontal displacement of the ride: positive moves right, negative moves left.'},
  dy: {name: 'Vertical movement', unit: 'px', limit: 48, help: 'Vertical displacement of the ride: positive moves down, negative moves up.'},
  rotation: {name: 'Rotation', unit: '°', limit: 1, help: 'Rotation around the rider: positive turns clockwise, negative turns counterclockwise.'},
  scale: {name: 'Zoom', unit: '%', limit: 6, help: 'Zoom relative to the camera: 0% is unchanged; positive enlarges the ride around the rider.'},
};
function chart(container, from, duration, rows, key, synthetic=false) {
  const signal = SIGNALS[key], width = Math.max(300, container.clientWidth), height = 190;
  const svg = svgEl('svg', {viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': `${signal.name} (${signal.unit}) comparison`});
  const L=64, R=width-18, top=16, bottom=154;
  const max=signal.auto ? Math.max(signal.limit, ...rows.flatMap(r=>r.map(p=>Math.ceil(Math.abs(p.v[key])/signal.limit)*signal.limit))) : signal.limit*(key==='punch'||key==='cameraZoom'?1:Math.max(1,gain()));
  const x=t=>L+t/duration*(R-L), y=v=>signal.positive?bottom-v/max*(bottom-top):(top+bottom)/2-v/max*(bottom-top)/2;
  for(const v of signal.positive?[0,max/4,max/2,3*max/4,max]:[-max,-max/2,0,max/2,max]) {
    svg.append(svgEl('line',{x1:L,x2:R,y1:y(v),y2:y(v),stroke:v===0?'#a8b0bb':'#e4e7ec'}));
    svg.append(svgEl('text',{x:L-8,y:y(v)+4,'text-anchor':'end'},`${+v.toFixed(2)}${signal.unit}`));
  }
  for(let i=0;i<=4;i++)svg.append(svgEl('text',{x:x(duration*i/4),y:180,'text-anchor':'middle'},synthetic?`${(duration*i/4*1000).toFixed(0)} ms`:`${(from+duration*i/4).toFixed(1)} s`));
  if(!synthetic)for(const h of hits){const t=h.time-offset()-from;if(t>=0&&t<=duration)svg.append(svgEl('line',{x1:x(t),x2:x(t),y1:top,y2:bottom,stroke:'#d4d9e0','stroke-dasharray':'2 4'}));}
  rows.forEach((values,i)=>{
    const value=v=>key==='scale'?(v.scale-1)*100:v[key];
    const d=values.map((r,j)=>`${j?'L':'M'}${x(r.t).toFixed(2)} ${y(value(r.v)).toFixed(2)}`).join(' ');
    svg.append(svgEl('path',{d,fill:'none',stroke:i?'#236cba':'#6d7580','stroke-width':i?2.5:2,'stroke-dasharray':i?'none':'6 4'}));
  });
  if(!synthetic) {
    svg.append(svgEl('line',{class:'cursor',x1:L,x2:L,y1:top,y2:bottom,stroke:'#1b1f25','stroke-width':1.5}));
    svg.addEventListener('pointerdown',e=>{const rect=svg.getBoundingClientRect(),t=from+Math.max(0,Math.min(1,((e.clientX-rect.left)*width/rect.width-L)/(R-L)))*duration;seek(t);});
  }
  container.append(svg);
}
function movementCharts(container, from, duration, rows, synthetic=false) {
  for (const key of ['dy', 'dx', 'rotation', 'scale']) {
    const panel=document.createElement('section'), title=document.createElement('h3'), help=document.createElement('p'), plot=document.createElement('div');
    title.textContent=SIGNALS[key].name; help.className='help';
    help.textContent={dy:'Pixels · positive down, negative up',dx:'Pixels · positive right, negative left',rotation:'Degrees · positive clockwise',scale:'Percent · positive enlarges the ride'}[key];
    panel.append(title,help,plot); container.append(panel); chart(plot,from,duration,rows,key,synthetic);
  }
}

function samples(m, hs, start, duration, off = 0) {return Array.from({length:Math.ceil(duration*240)+1},(_,i)=>({t:i/240,v:motionAt(m,hs,start+i/240,gain(),start+i/240-off)}));}
function metrics(rows) {let travel=0,moving=0;for(let i=1;i<rows.length;i++){const a=rows[i-1].v,b=rows[i].v;travel+=Math.hypot(b.dx-a.dx,b.dy-a.dy);if(Math.hypot(b.dx,b.dy)>.5||Math.abs(b.rotation)>.02||Math.abs(b.scale-1)>.001)moving++;}return [Math.max(...rows.map(r=>Math.hypot(r.v.dx,r.v.dy))).toFixed(1),travel.toFixed(1),(moving/240).toFixed(2),Math.max(...rows.map(r=>Math.abs(r.v.rotation))).toFixed(2),(100*Math.max(...rows.map(r=>Math.abs(r.v.scale-1)))).toFixed(2)];}
function charts() {
  if(!entry)return; const duration=Math.min(6,end-home),box=$('curves');box.replaceChildren();
  const rows=['current',mode].map(m=>samples(m,hits,home+offset(),duration,offset()));
  movementCharts(box,home,duration,rows);
  $('legendName').textContent=MODES[mode][0];

  $('curveNote').textContent=`${home.toFixed(2)}–${(home+duration).toFixed(2)} s · dotted vertical lines mark hits; the dark cursor follows playback. Click any chart to seek. All four show added hit movement only; camera following and colour split are excluded.`;
  $('metrics').innerHTML='<table><tr><th>This passage</th><th>Max displacement · px</th><th>Translation travel · px</th><th>Moving · s</th><th>Max roll · °</th><th>Max zoom · %</th></tr>'+rows.map((r,i)=>`<tr><td>${MODES[i?mode:'current'][0]}</td>${metrics(r).map(v=>`<td>${v}</td>`).join('')}</tr>`).join('')+'</table>';
  cameraCharts(duration);
  screenCharts(duration);
  responsePlot();
  single();
}
function cameraCharts(duration) {
  const box=$('cameraCurves'), camera=$('camera').value; box.replaceChildren();
  $('cameraAnalysis').hidden=!['old-authored','old-zoom','old-punch','old-punch-locked','measured-punch','measured-locked','measured-current'].includes(camera);
  if($('cameraAnalysis').hidden)return;
  const rows=[[],[]];
  const start=home+offset(), times=new Set([0,duration]);
  for(let i=0;i/240<duration;i++)times.add(i/240);
  // Include every physics-frame vertex: a uniform plot grid can miss the pulse peak.
  for(let f=Math.ceil(start*40);f<=(start+duration)*40;f++)times.add(f/40-start);
  for(const t of [...times].sort((a,b)=>a-b)) {
    const z=cameraZoomAt(camera,entry.scene,(start+t)*40,settings());
    rows[0].push({t,v:{punch:0,cameraZoom:100*(z.base/6.2-1)}});
    rows[1].push({t,v:{punch:z.punch,cameraZoom:100*(z.zoom/6.2-1)}});
  }
  for(const [key,title,description] of [
    ['punch','The short punch','Extra zoom from the beat pulse; 0% means no punch.'],
    ['cameraZoom','The overall camera zoom','Relative to today’s steady zoom. Positive is closer; negative is farther away.'],
  ]) {
    const panel=document.createElement('section'), h=document.createElement('h3'), p=document.createElement('p'), plot=document.createElement('div');
    h.textContent=title;p.className='help';p.textContent=description;panel.append(h,p,plot);box.append(panel);chart(plot,home,duration,rows,key);
  }
  const max=Math.max(...rows[1].map(r=>r.v.punch));
  $('cameraReadout').textContent=`This passage reaches +${max.toFixed(1)}% punch. ${camera.startsWith('measured-') ? 'The pulse follows measured peaks and realized strength, with no ranking or percentile. Its 25 ms rise leads into the measured peak.' : 'Historical rule: authored beats and requested strengths, not measured impacts. The new realized-strength comparisons remove this gate.'}`;
}
const PUNCH_COMPARISONS = [
  ['old-six','No zoom or punch','The old follower at a fixed zoom, with no added shake.'],
  ['old-zoom','Song zoom keyframes only','The authored zoom lane, without its short beat punches.'],
  ['old-authored','Song zoom keyframes + punch','The combination you liked: the authored lane and its fast punches, with the old follower responding.'],
  ['old-punch','Historical punch only','Keep a fixed base zoom; retain the beat pulse and the follower’s response to it.'],
  ['old-punch-locked','Historical punch · steady rider','Exactly the same zoom pulse, but keep the no-punch rider screen position. This isolates the follower/position interaction.'],
];
const REALIZED_COMPARISONS = [
  ['measured-punch','Realized punch · follower responds'],
  ['measured-locked','Realized punch · steady rider'],
  ['measured-current','Realized punch · current camera'],
];
for(const [list,id] of [[PUNCH_COMPARISONS,'punchComparisons'],[REALIZED_COMPARISONS,'realizedComparisons']])
  for(const [camera,label] of list){const b=document.createElement('button');b.textContent=label;b.dataset.camera=camera;b.onclick=()=>{mode='still';$('camera').value=camera;showCurrent=false;rebuild();view();};$(id).append(b);}
for(const id of ['punchThreshold','punchPeak']) {
  $(id).oninput=()=>{$('thresholdValue').textContent=Number($('punchThreshold').value).toFixed(2);$('peakValue').textContent=$('punchPeak').value+'%';};
  $(id).onchange=()=>{if(!$('camera').value.startsWith('measured-')){$('camera').value=$('camera').value.endsWith('-locked')?'measured-locked':$('camera').value==='current'?'measured-current':'measured-punch';mode='still';}showCurrent=false;rebuild();view();};
}
for(const [id,value] of [['standardPunch',13],['largerPunch',26]])$(id).onclick=()=>{$('punchPeak').value=value;if(!$('camera').value.startsWith('measured-')){$('camera').value='measured-locked';mode='still';}showCurrent=false;rebuild();view();};
$('punchResponse').closest('details').addEventListener('toggle',e=>{if(e.target.open)responsePlot();});
$('screenComparison').addEventListener('toggle',e=>{if(e.target.open)screenTable();});


function observer(camera) {
  const key=JSON.stringify(settings());
  if(entry.observerKey!==key){entry.observerKey=key;entry.observers=new Map();}
  if(!entry.observers.has(camera))entry.observers.set(camera,framingFor(camera,entry.replay,entry.scene,settings())(
    entry.motion,entry.level,hits.map(h=>({t:h.time-offset(),s:h.strength})),end));
  return entry.observers.get(camera);
}
function screenSamples(camera, effectMode, duration) {
  const frame=observer(camera), base=observer(unpunchedCamera(camera)), effect=effectsAt(effectMode,gain(),false,offset()), l=look(), result=[];
  let previous;
  for(let i=-1;i<=Math.round(duration*60);i++) {
    const t=i/60, song=home+t, ride=song+offset(), at=Math.max(0,Math.min(ride*40,entry.replay.frames.length-1)),pose=riderAt(entry.replay.frames,at);
    const a=riderOnScreen(frame(song,at,l),effect(hits,ride),pose), b=riderOnScreen(base(song,at,l),NO_MOTION,pose);
    const dx=a.x-b.x,dy=a.y-b.y,size=b.radius?100*(a.radius/b.radius-1):0,prior=previous;
    const speed=prior?Math.hypot(a.x-prior.x,a.y-prior.y)*60:0;previous=a;
    if(i<0)continue;
    result.push({t,...a,dx,dy,size,v:{screenDX:dx,screenDY:dy,screenSize:size,screenSpeed:speed}});
  }
  return result;
}
function screenCharts(duration) {
  const box=$('screenCurves');box.replaceChildren();
  const rows=['current',mode].map(m=>screenSamples($('camera').value,m,duration));
  for(const [key,help] of [['screenDY','Pixels · positive down, relative to no punch/shake'],['screenDX','Pixels · positive right, relative to no punch/shake'],['screenSize','Percent · radius change, relative to the same body pose'],['screenSpeed','Pixels per second · includes normal camera following']]){
    const panel=document.createElement('section'),h=document.createElement('h3'),p=document.createElement('p'),plot=document.createElement('div');h.textContent=SIGNALS[key].name;p.className='help';p.textContent=help;panel.append(h,p,plot);box.append(panel);chart(plot,home,duration,rows,key);
  }
  const m=screenMetrics(rows[1]);$('screenReadout').textContent=`Selected version: up to ${m.maxShift.toFixed(1)} px added centre displacement, +${m.maxSize.toFixed(1)}% apparent size; ${m.travel.toFixed(1)} px total centre travel in this passage. Peak screen speed ${m.maxSpeed.toFixed(0)} px/s at 60 fps. These are geometric diagnostics, not a score of how strong or good the hit feels.`;
  if($('screenComparison').open)screenTable();
}
function screenTable() {
  const cameras=[['current','Current direction follower'],['old-ten','Historical follower · ten points'],...PUNCH_COMPARISONS,...REALIZED_COMPARISONS];
  $('screenTable').innerHTML='<table><tr><th>Camera · same selected effect</th><th>Max added shift · px</th><th>Max added size · %</th><th>Centre travel · px</th><th>Peak speed · px/s</th></tr>'+cameras.map(([camera,label])=>{const m=screenMetrics(screenSamples(camera,mode,Math.min(6,end-home)));return `<tr><td>${label}</td><td>${m.maxShift.toFixed(1)}</td><td>${m.maxSize.toFixed(1)}</td><td>${m.travel.toFixed(1)}</td><td>${m.maxSpeed.toFixed(0)}</td></tr>`;}).join('')+'</table>';
}
function responsePlot() {
  const box=$('punchResponse');box.replaceChildren();if(!box.closest('details').open)return;
  const width=Math.max(300,box.clientWidth),svg=svgEl('svg',{viewBox:`0 0 ${width} 190`,role:'img','aria-label':'Realized strength to punch amplitude'}),L=45,R=width-15,x=s=>L+s/1.2*(R-L),y=v=>155-v/.35*125,p=settings();
  for(const v of [0,.13,.26,.35]){svg.append(svgEl('line',{x1:L,x2:R,y1:y(v),y2:y(v),stroke:'#e4e7ec'}));svg.append(svgEl('text',{x:2,y:y(v)+4},`${Math.round(v*100)}%`));}
  for(const s of [0,.3,.6,.9,1.2])svg.append(svgEl('text',{x:x(s),y:176,'text-anchor':'middle'},s.toFixed(1)));
  for(const s of [p.threshold,p.reference])svg.append(svgEl('line',{x1:x(s),x2:x(s),y1:20,y2:155,stroke:'#a8b0bb','stroke-dasharray':'3 3'}));
  let d='';for(let i=0;i<=240;i++){const s=i/200;d+=`${i?'L':'M'}${x(s)} ${y(punchAmplitude(s,p))} `;}
  svg.append(svgEl('path',{d,fill:'none',stroke:'#236cba','stroke-width':2.5}));box.append(svg);
}

function single(){const s=Number($('strength').value);$('strengthValue').textContent=s.toFixed(2);$('single').replaceChildren();movementCharts($('single'),0,.4,['current',mode].map(m=>samples(m,[{time:0,strength:s,energy:strength(s),normal:{x:0,y:-1}}],0,.4)),true);}

for(const [key,[name]] of Object.entries(MODES)){const b=document.createElement('button');b.textContent=name;b.dataset.mode=key;b.onclick=()=>{mode=key;showCurrent=false;rebuild();view();};$('variants').append(b);}
$('quickEffect').replaceChildren(...Object.entries(MODES).map(([key,[name]])=>new Option(name,key)));
$('quickEffect').onchange=()=>{mode=$('quickEffect').value;showCurrent=false;rebuild();view();};
$('song').onchange=()=>void load();$('theme').onchange=()=>{charts();draw();};$('camera').onchange=rebuild;
$('gain').oninput=()=>{$('gainValue').textContent=`×${gain().toFixed(1)}`;rebuild();};$('colour').onchange=rebuild;$('split').onchange=rebuild;$('strength').oninput=single;
$('single').closest('details').addEventListener('toggle', e=>{if(e.target.open)single();});
$('play').onclick=()=>playing?pause():void play();$('rate').onchange=()=>{if(playing){pause();void play();}};
$('seek').oninput=()=>{seek(Number($('seek').value));};$('seek').onchange=()=>{home=Math.min(time,Math.max(0,end-6));charts();};
$('back').onclick=()=>{pause();seek(time-1/60);};$('forward').onclick=()=>{pause();seek(time+1/60);};
$('archive').onplay=pause;
let showCurrent = false;
function view() {const single=$('view').value==='single';document.querySelector('.pair').classList.toggle('single',single);const panels=document.querySelectorAll('.screen');panels[0].classList.toggle('hidden',single&&!showCurrent);panels[1].classList.toggle('hidden',single&&showCurrent);$('switch').hidden=!single;$('switch').textContent=showCurrent?'Show '+MODES[mode][0]:'Show current shake';draw();}
$('view').onchange=view;$('switch').onclick=()=>{showCurrent=!showCurrent;view();};
view();
new ResizeObserver(()=>{if(entry){charts();draw();}}).observe($('curves'));
$('share').onclick=async()=>{const u=new URL(location.href);u.search=new URLSearchParams({song:$('song').value,effect:mode,theme:$('theme').value,camera:$('camera').value,t:home.toFixed(3),gain:String(gain()),colour:$('colour').checked?'on':'off',split:$('split').checked?'on':'off',rate:$('rate').value,view:$('view').value,threshold:$('punchThreshold').value,punch:$('punchPeak').value});history.replaceState(null,'',u);try{await navigator.clipboard.writeText(u.href);$('status').textContent='Comparison link copied';}catch{$('status').textContent=u.href;}};
document.addEventListener('keydown',e=>{if(['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName))return;if(e.code==='KeyA' && $('view').value==='single'){e.preventDefault();$('switch').click();}if(e.code==='Space' && e.target.tagName!=='BUTTON'){e.preventDefault();playing?pause():void play();}});
for (const id of ['baseline','candidate']) $(id).onclick=()=>playing?pause():void play();
function tick(ts){try{if(playing&&entry){time=Math.min(end,music.position(shown(ts)));if(time>=($('loop').checked?Math.min(end,home+6):end)){pause();time=$('loop').checked?home:end;if($('loop').checked)void play();}draw();}}catch(e){error(e);}requestAnimationFrame(tick);}
// Browser checks use the same public transport/model, without a second implementation.
window.hitStudy={seek:t=>{pause();seek(t);},select:m=>{mode=m;showCurrent=false;rebuild();view();},state:()=>({time,mode,song:$('song').value,hits,offset:entry?.scene.timing.offset}),draw};
requestAnimationFrame(tick);await load();
