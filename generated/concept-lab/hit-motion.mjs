import {createMusic, displayTime} from '/shared/playback.js';
import * as N from '/generated/renderer/native.js';
import {createPicture, BODY_POINTS} from '/scripts/video/picture.js';
import {resolveLook} from '/scripts/video/look.js';
import {prepareHits} from '/scripts/video/hits.js';
import {strength} from '/scripts/video/intensity.js';
import {MODES, effectsAt, motionAt} from './hit-motion-model.mjs';
import {framingFor} from './hit-motion-camera.mjs';
const $ = id => document.getElementById(id), q = new URLSearchParams(location.search);
const choose = (id, key, allowed) => {const v = q.get(key); if (allowed.includes(v)) $(id).value = v;};
choose('song', 'song', ['tiki', 'circus']); choose('theme', 'theme', ['hokusai', 'rothko', 'plain']);
choose('camera', 'camera', ['current', 'old-six', 'old-ten', 'old-authored']);
const g = Number(q.get('gain')); if (q.has('gain') && Number.isFinite(g)) $('gain').value = Math.max(0, Math.min(2, g));
$('gainValue').textContent = `×${$('gain').value}`;
if (q.get('colour') === 'off') $('colour').checked = false;
if (q.get('split') === 'off') $('split').checked = false;
choose('rate', 'rate', ['1', '0.5', '0.25']);
let mode = Object.hasOwn(MODES, q.get('effect')) ? q.get('effect') : 'recoil';
let time = Math.max(0, Number(q.get('t')) || 9), home = time, playing = false, ticket = 0, entry, pictures = [];
const music = createMusic(), shown = displayTime(), sheet = N.loadSheet(), cache = new Map();
let hits = [], end = 48;
const gain = () => Number($('gain').value), offset = () => entry.scene.timing.offset;
const look = () => resolveLook($('theme').value, {ends: 'none', hits: 'v1'});
function error(e) {pause(); $('status').textContent = String(e.message ?? e); window.__loadError = String(e);}
function pause() {if (playing) time = Math.max(0, Math.min(end, music.pause())); else music.pause(); playing = false; $('play').textContent = 'Play';}
async function play() {if (!entry) return; playing = true; $('play').textContent = 'Pause'; try {await music.play(time, Number($('rate').value));} catch(e) {error(e);}}
function seek(t) {const resume = playing; pause(); time = Math.max(0, Math.min(end, t)); draw(); if (resume) void play();}
function rebuild() {
  if (!entry) return;
  const {scene, replay, sheet: sprites} = entry;
  pictures = ['current', mode].map((m, i) => createPicture($(i ? 'candidate' : 'baseline'), scene, replay, sprites, N.riderPainter(), {
    effectsAt: effectsAt(m, gain(), $('colour').checked, scene.timing.offset, $('split').checked), framing: framingFor($('camera').value, replay, scene),
  }));
  $('candidateName').textContent = MODES[mode][0]; $('candidateNote').textContent = MODES[mode][1];
  for (const b of $('variants').children) b.classList.toggle('on', b.dataset.mode === mode);
  charts(); draw();
}
function draw() {
  if (!pictures.length) return;
  const l = look(); for (const p of pictures) p.draw(time, l);
  $('seek').value = time; $('clock').textContent = `${time.toFixed(3)} s`;
  const x = 68 + (time - home) / Math.min(6, end - home) * 872;
  for (const line of document.querySelectorAll('#curves .cursor')) {line.setAttribute('x1', x); line.setAttribute('x2', x); line.style.display = time >= home && time <= home + 6 ? '' : 'none';}
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
function chart(container, from, duration, values, synthetic=false) {
  const svg=svgEl('svg',{viewBox:'0 0 980 400',role:'img','aria-label':'Translation in pixels, rotation in degrees, and zoom in percent over time'}), L=68,R=940;
  const x=t=>L+t/duration*(R-L), multiplier=Math.max(1,gain());
  const axes=[{name:'Translation · design pixels',keys:[['dx','x','#f1b96d'],['dy','y','#65b4d9']],mid:95,half:56,max:48*multiplier},
    {name:'Rotation · degrees',keys:[['rotation','roll','#c9a3e7']],mid:215,half:34,max:multiplier},
    {name:'Zoom · percent',keys:[['scale','zoom','#8ad5a0']],mid:320,half:34,max:6*multiplier}];
  for(const axis of axes){
    const y=v=>axis.mid-v/axis.max*axis.half;
    svg.append(svgEl('text',{x:L,y:axis.mid-axis.half-14},axis.name));
    for(const v of [-axis.max,0,axis.max]){svg.append(svgEl('line',{x1:L,x2:R,y1:y(v),y2:y(v),stroke:'#353e47'}));svg.append(svgEl('text',{x:8,y:y(v)+4},v.toFixed(axis.max<3?1:0)));}
    for(const [key,label,col] of axis.keys){const val=v=>key==='scale'?(v.scale-1)*100:v[key];const d=values.map((r,i)=>`${i?'L':'M'}${x(r.t).toFixed(2)} ${y(val(r.v)).toFixed(2)}`).join(' ');svg.append(svgEl('path',{d,fill:'none',stroke:col,'stroke-width':1.8}));svg.append(svgEl('text',{x:R-120+axis.keys.findIndex(k=>k[0]===key)*55,y:axis.mid-axis.half-14,style:`fill:${col}`},label));}
  }
  for(let i=0;i<=6;i++)svg.append(svgEl('text',{x:x(duration*i/6),y:390,'text-anchor':'middle'},synthetic?`${(duration*i/6*1000).toFixed(0)} ms`:`${(from+duration*i/6).toFixed(1)} s`));
  if(!synthetic)for(const h of hits){const t=h.time-offset()-from;if(t>=0&&t<=duration)svg.append(svgEl('line',{x1:x(t),x2:x(t),y1:32,y2:365,stroke:'#ffffff',opacity:.15}));}
  if(!synthetic)svg.append(svgEl('line',{class:'cursor',x1:L,x2:L,y1:32,y2:365,stroke:'#fff','stroke-dasharray':'3 3'}));
  container.append(svg);
}
function samples(m, hs, start, duration, off = 0) {return Array.from({length:Math.ceil(duration*240)+1},(_,i)=>({t:i/240,v:motionAt(m,hs,start+i/240,gain(),start+i/240-off)}));}
function metrics(rows) {let travel=0,moving=0;for(let i=1;i<rows.length;i++){const a=rows[i-1].v,b=rows[i].v;travel+=Math.hypot(b.dx-a.dx,b.dy-a.dy);if(Math.hypot(b.dx,b.dy)>.5||Math.abs(b.rotation)>.02||Math.abs(b.scale-1)>.001)moving++;}return [Math.max(...rows.map(r=>Math.hypot(r.v.dx,r.v.dy))).toFixed(1),travel.toFixed(1),(moving/240).toFixed(2),Math.max(...rows.map(r=>Math.abs(r.v.rotation))).toFixed(2),(100*Math.max(...rows.map(r=>Math.abs(r.v.scale-1)))).toFixed(2)];}
function charts() {
  if(!entry)return; const duration=Math.min(6,end-home),box=$('curves');box.replaceChildren();
  const rows=['current',mode].map(m=>samples(m,hits,home+offset(),duration,offset()));
  for(let i=0;i<2;i++){const p=document.createElement('p');p.textContent=MODES[i?mode:'current'][0];box.append(p);chart(box,home,duration,rows[i]);}
  $('curveNote').textContent=`${home.toFixed(2)}–${(home+duration).toFixed(2)} s of the song. Vertical marks are measured hit peaks. Motion only; camera following and colour split are excluded. Curves sampled at 240 Hz; playback uses the same continuous functions.`;
  $('metrics').innerHTML='<table><tr><th>This passage</th><th>Max displacement · px</th><th>Translation travel · px</th><th>Moving · s</th><th>Max roll · °</th><th>Max zoom · %</th></tr>'+rows.map((r,i)=>`<tr><td>${MODES[i?mode:'current'][0]}</td>${metrics(r).map(v=>`<td>${v}</td>`).join('')}</tr>`).join('')+'</table>';
  single();
}
function single(){const s=Number($('strength').value);$('strengthValue').textContent=s.toFixed(2);$('single').replaceChildren();for(const m of ['current',mode]){const p=document.createElement('p');p.textContent=MODES[m][0];$('single').append(p);chart($('single'),0,.4,samples(m,[{time:0,strength:s,energy:strength(s),normal:{x:0,y:-1}}],0,.4),true);}}
for(const [key,[name]] of Object.entries(MODES)){const b=document.createElement('button');b.textContent=name;b.dataset.mode=key;b.onclick=()=>{mode=key;rebuild();};$('variants').append(b);}
$('song').onchange=()=>void load();$('theme').onchange=draw;$('camera').onchange=rebuild;
$('gain').oninput=()=>{$('gainValue').textContent=`×${gain().toFixed(1)}`;rebuild();};$('colour').onchange=rebuild;$('split').onchange=rebuild;$('strength').oninput=single;
$('play').onclick=()=>playing?pause():void play();$('rate').onchange=()=>{if(playing){pause();void play();}};
$('seek').oninput=()=>{seek(Number($('seek').value));};$('seek').onchange=()=>{home=Math.min(time,Math.max(0,end-6));charts();};
$('back').onclick=()=>{pause();seek(time-1/60);};$('forward').onclick=()=>{pause();seek(time+1/60);};
$('archive').onplay=pause;
let showCurrent = false;
function view() {const single=$('view').value==='single';document.querySelector('.pair').classList.toggle('single',single);const panels=document.querySelectorAll('.screen');panels[0].classList.toggle('hidden',single&&!showCurrent);panels[1].classList.toggle('hidden',single&&showCurrent);$('switch').hidden=!single;$('switch').textContent=showCurrent?'Show candidate':'Show current shake';}
$('view').onchange=view;$('switch').onclick=()=>{showCurrent=!showCurrent;view();};
if(matchMedia('(max-width:650px)').matches){$('view').value='single';view();}
$('share').onclick=async()=>{const u=new URL(location.href);u.search=new URLSearchParams({song:$('song').value,effect:mode,theme:$('theme').value,camera:$('camera').value,t:home.toFixed(3),gain:String(gain()),colour:$('colour').checked?'on':'off',split:$('split').checked?'on':'off',rate:$('rate').value});history.replaceState(null,'',u);try{await navigator.clipboard.writeText(u.href);$('status').textContent='Comparison link copied';}catch{$('status').textContent=u.href;}};
document.addEventListener('keydown',e=>{if(['INPUT','SELECT','BUTTON'].includes(e.target.tagName))return;if(e.code==='Space'){e.preventDefault();playing?pause():void play();}});
function tick(ts){try{if(playing&&entry){time=Math.min(end,music.position(shown(ts)));if(time>=($('loop').checked?Math.min(end,home+6):end)){pause();time=$('loop').checked?home:end;if($('loop').checked)void play();}draw();}}catch(e){error(e);}requestAnimationFrame(tick);}
// Browser checks use the same public transport/model, without a second implementation.
window.hitStudy={seek:t=>{pause();seek(t);},select:m=>{mode=m;rebuild();},state:()=>({time,mode,song:$('song').value,hits,offset:entry?.scene.timing.offset}),draw};
requestAnimationFrame(tick);await load();
