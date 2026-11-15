import {createMusic, displayTime} from '/shared/playback.js';
import * as N from '/generated/renderer/native.js';
import {createPicture, BODY_POINTS} from '/scripts/video/picture.js';
import {resolveLook, THEMES} from '/scripts/video/look.js';
import {prepareHits} from '/scripts/video/hits.js';
import {strength} from '/scripts/video/intensity.js';
import {MODES, effectsAt, motionAt} from './hit-motion-model.mjs';
import {framingFor} from './hit-motion-camera.mjs';
const $ = id => document.getElementById(id), q = new URLSearchParams(location.search);
const choose = (id, key, allowed) => {const v = q.get(key); if (allowed.includes(v)) $(id).value = v;};
$('theme').replaceChildren(...Object.entries(THEMES).map(([id, theme]) => new Option(theme.name, id)), new Option('Plain', 'plain'));
$('theme').value = 'hokusai';
choose('song', 'song', ['tiki', 'circus']); choose('theme', 'theme', [...Object.keys(THEMES), 'plain']);
choose('camera', 'camera', ['current', 'old-six', 'old-ten', 'old-authored']);
const g = Number(q.get('gain')); if (q.has('gain') && Number.isFinite(g)) $('gain').value = Math.max(0, Math.min(2, g));
$('gainValue').textContent = `×${$('gain').value}`;
if (q.get('colour') === 'off') $('colour').checked = false;
if (q.get('split') === 'off') $('split').checked = false;
choose('rate', 'rate', ['1', '0.5', '0.25']);
choose('view', 'view', ['single', 'pair']);
choose('signal', 'signal', ['dx', 'dy', 'rotation', 'scale']);
let mode = Object.hasOwn(MODES, q.get('effect')) ? q.get('effect') : 'recoil';
let time = Math.max(0, Number(q.get('t')) || 9), home = time, playing = false, ticket = 0, entry, pictures = [];
const music = createMusic(), shown = displayTime(), sheet = N.loadSheet(), cache = new Map();
let hits = [], end = 48;
const gain = () => Number($('gain').value), offset = () => entry.scene.timing.offset;
const look = () => resolveLook($('theme').value, {ends: 'none', hits: 'v1'});
function error(e) {pause(); $('status').textContent = String(e.message ?? e); window.__loadError = String(e);}
function pause() {if (playing) time = Math.max(0, Math.min(end, music.pause())); else music.pause(); playing = false; $('play').textContent = 'Play';}
async function play() {if (!entry) return; $('archive').pause(); playing = true; $('play').textContent = 'Pause'; try {await music.play(time, Number($('rate').value));} catch(e) {error(e);}}
function seek(t) {const resume = playing; pause(); time = Math.max(0, Math.min(end, t)); draw(); if (resume) void play();}
let pictureEntry, pictureCamera, responses = [];
function rebuild() {
  if (!entry) return;
  const {scene, replay, sheet: sprites} = entry;
  responses = ['current', mode].map(m => effectsAt(m, gain(), $('colour').checked, scene.timing.offset, $('split').checked));
  // Keep the renderer's large scratch canvases and prepared ride across effect switches.
  if (!pictures.length || pictureEntry !== entry || pictureCamera !== $('camera').value) {
    pictureEntry = entry; pictureCamera = $('camera').value;
    pictures = ['baseline', 'candidate'].map((id, i) => createPicture($(id), scene, replay, sprites, N.riderPainter(), {
      effectsAt: (...args) => responses[i](...args), framing: framingFor(pictureCamera, replay, scene),
    }));
  }
  $('quickEffect').value=mode;
  $('candidateName').textContent = MODES[mode][0]; $('candidateNote').textContent = MODES[mode][1];
  for (const b of $('variants').children) {b.classList.toggle('on', b.dataset.mode === mode); b.setAttribute('aria-pressed', b.dataset.mode === mode);}
  charts(); draw();
}
function draw() {
  if (!pictures.length) return;
  const l = look(); pictures.forEach((p, i) => {if ($('view').value === 'pair' || i === (showCurrent ? 0 : 1)) p.draw(time, l);});
  $('seek').value = time; $('clock').textContent = `${time.toFixed(3)} s`;
  for (const line of document.querySelectorAll('#curves .cursor')) {
    const width = Number(line.closest('svg').getAttribute('viewBox').split(' ')[2]);
    const x = 54 + (time - home) / Math.min(6, end - home) * (width - 72);
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
    $('provenance').textContent = JSON.stringify({timing: entry.scene.timing, ...entry.scene.provenance}, null, 2);
    moments(); rebuild(); $('play').disabled = false; $('status').textContent = `${hits.length} measured hits · ${end.toFixed(2)} seconds · shared song clock`;
    window.__ready = true;
  } catch(e) {if (n === ticket) error(e);}
}
function moments() {
  const box = $('moments'); box.replaceChildren();
  const selected = [...hits].sort((a,b) => b.strength - a.strength).filter((h, i, a) => a.slice(0,i).every(p => Math.abs(p.time-h.time) > 2)).slice(0,5).sort((a,b)=>a.time-b.time);
  const all = [['Opening', 0], ...selected.map(h => [`Hit ${(h.time-offset()).toFixed(2)} s · ${h.strength.toFixed(2)}`, Math.max(0,h.time-offset()-1)])];
  // The densest strong-hit passage is a reproducible stress case, not a hand-picked success.
  const dense = hits.reduce((best,h) => {const count = hits.filter(p => p.time >= h.time && p.time < h.time+4 && p.strength>.55).length; return count>best.count ? {time:h.time,count} : best;}, {time:1,count:0});
  all.push([`Dense passage · ${dense.count} strong hits / 4 s`, Math.max(0,dense.time-offset()-.5)]);
  for (const [name, t] of all) {const b=document.createElement('button');b.textContent=name;b.onclick=()=>{home=Math.min(t,Math.max(0,end-6));seek(home);charts();};box.append(b);}
}
const svgEl = (tag, attrs={}, text) => {const e=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,v);if(text!==undefined)e.textContent=text;return e;};
const SIGNALS = {
  dx: {unit: 'px', limit: 48, help: 'Horizontal displacement of the ride: positive moves right, negative moves left.'},
  dy: {unit: 'px', limit: 48, help: 'Vertical displacement of the ride: positive moves down, negative moves up.'},
  rotation: {unit: '°', limit: 1, help: 'Rotation around the rider: positive turns clockwise, negative turns counterclockwise.'},
  scale: {unit: '%', limit: 6, help: 'Zoom relative to the camera: 0% is unchanged; positive enlarges the ride around the rider.'},
};
function chart(container, from, duration, rows, synthetic=false) {
  const key = $('signal').value, signal = SIGNALS[key], width = Math.max(320, container.clientWidth), height = 230;
  const svg = svgEl('svg', {viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': `${$('signal').selectedOptions[0].textContent}: current shake versus ${MODES[mode][0]}`});
  const L=54, R=width-18, top=20, bottom=194, max=signal.limit*Math.max(1,gain());
  const x=t=>L+t/duration*(R-L), y=v=>(top+bottom)/2-v/max*(bottom-top)/2;
  for(const v of [-max,-max/2,0,max/2,max]) {
    svg.append(svgEl('line',{x1:L,x2:R,y1:y(v),y2:y(v),stroke:v===0?'#a8b0bb':'#e4e7ec'}));
    svg.append(svgEl('text',{x:L-8,y:y(v)+4,'text-anchor':'end'},`${+v.toFixed(2)}${signal.unit}`));
  }
  for(let i=0;i<=4;i++)svg.append(svgEl('text',{x:x(duration*i/4),y:218,'text-anchor':'middle'},synthetic?`${(duration*i/4*1000).toFixed(0)} ms`:`${(from+duration*i/4).toFixed(1)} s`));
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
function samples(m, hs, start, duration, off = 0) {return Array.from({length:Math.ceil(duration*240)+1},(_,i)=>({t:i/240,v:motionAt(m,hs,start+i/240,gain(),start+i/240-off)}));}
function metrics(rows) {let travel=0,moving=0;for(let i=1;i<rows.length;i++){const a=rows[i-1].v,b=rows[i].v;travel+=Math.hypot(b.dx-a.dx,b.dy-a.dy);if(Math.hypot(b.dx,b.dy)>.5||Math.abs(b.rotation)>.02||Math.abs(b.scale-1)>.001)moving++;}return [Math.max(...rows.map(r=>Math.hypot(r.v.dx,r.v.dy))).toFixed(1),travel.toFixed(1),(moving/240).toFixed(2),Math.max(...rows.map(r=>Math.abs(r.v.rotation))).toFixed(2),(100*Math.max(...rows.map(r=>Math.abs(r.v.scale-1)))).toFixed(2)];}
function charts() {
  if(!entry)return; const duration=Math.min(6,end-home),box=$('curves');box.replaceChildren();
  const rows=['current',mode].map(m=>samples(m,hits,home+offset(),duration,offset()));
  chart(box,home,duration,rows);
  $('legendName').textContent=MODES[mode][0];
  $('signalHelp').textContent=SIGNALS[$('signal').value].help+' This excludes camera following and colour-split enlargement. Pixels refer to the 1080-wide output.';
  $('curveNote').textContent=`${home.toFixed(2)}–${(home+duration).toFixed(2)} s · dotted vertical lines mark hits; the dark cursor follows playback. Click the curve to seek.`;
  $('metrics').innerHTML='<table><tr><th>This passage</th><th>Max displacement · px</th><th>Translation travel · px</th><th>Moving · s</th><th>Max roll · °</th><th>Max zoom · %</th></tr>'+rows.map((r,i)=>`<tr><td>${MODES[i?mode:'current'][0]}</td>${metrics(r).map(v=>`<td>${v}</td>`).join('')}</tr>`).join('')+'</table>';
  single();
}
function single(){const s=Number($('strength').value);$('strengthValue').textContent=s.toFixed(2);$('single').replaceChildren();chart($('single'),0,.4,['current',mode].map(m=>samples(m,[{time:0,strength:s,energy:strength(s),normal:{x:0,y:-1}}],0,.4)),true);}

for(const [key,[name]] of Object.entries(MODES)){const b=document.createElement('button');b.textContent=name;b.dataset.mode=key;b.onclick=()=>{mode=key;showCurrent=false;rebuild();view();};$('variants').append(b);}
$('quickEffect').replaceChildren(...Object.entries(MODES).map(([key,[name]])=>new Option(name,key)));
$('quickEffect').onchange=()=>{mode=$('quickEffect').value;showCurrent=false;rebuild();view();};
$('song').onchange=()=>void load();$('theme').onchange=draw;$('camera').onchange=rebuild;
$('gain').oninput=()=>{$('gainValue').textContent=`×${gain().toFixed(1)}`;rebuild();};$('colour').onchange=rebuild;$('split').onchange=rebuild;$('strength').oninput=single;$('signal').onchange=()=>{charts();draw();};
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
$('share').onclick=async()=>{const u=new URL(location.href);u.search=new URLSearchParams({song:$('song').value,effect:mode,theme:$('theme').value,camera:$('camera').value,t:home.toFixed(3),gain:String(gain()),colour:$('colour').checked?'on':'off',split:$('split').checked?'on':'off',rate:$('rate').value,view:$('view').value,signal:$('signal').value});history.replaceState(null,'',u);try{await navigator.clipboard.writeText(u.href);$('status').textContent='Comparison link copied';}catch{$('status').textContent=u.href;}};
document.addEventListener('keydown',e=>{if(['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName))return;if(e.code==='KeyA' && $('view').value==='single'){e.preventDefault();$('switch').click();}if(e.code==='Space' && e.target.tagName!=='BUTTON'){e.preventDefault();playing?pause():void play();}});
for (const id of ['baseline','candidate']) $(id).onclick=()=>playing?pause():void play();
function tick(ts){try{if(playing&&entry){time=Math.min(end,music.position(shown(ts)));if(time>=($('loop').checked?Math.min(end,home+6):end)){pause();time=$('loop').checked?home:end;if($('loop').checked)void play();}draw();}}catch(e){error(e);}requestAnimationFrame(tick);}
// Browser checks use the same public transport/model, without a second implementation.
window.hitStudy={seek:t=>{pause();seek(t);},select:m=>{mode=m;showCurrent=false;rebuild();view();},state:()=>({time,mode,song:$('song').value,hits,offset:entry?.scene.timing.offset}),draw};
requestAnimationFrame(tick);await load();
