const $ = id => document.getElementById(id);
const number = n => n.toLocaleString(undefined, {maximumFractionDigits: 1});
const title = method => manifest?.plan.methodDetails?.[method]?.title ?? ({arcs:'Arcs and guides',segments:'Scattered · original'}[method] ?? method);
const manifestUrl = new URL(new URLSearchParams(location.search).get('data') || '/generated/motion-gallery/20260929-repertoire/manifest.json', location.href);
let manifest, records = [], seconds = 0, playing = false, previous = 0, generation = 0;
const cache = new Map();
const hex = bytes => [...new Uint8Array(bytes)].map(x => x.toString(16).padStart(2, '0')).join('');
async function read(url, expected) {
  const response = await fetch(url); if (!response.ok) throw new Error(`${response.status}: ${url.pathname}`);
  const bytes = await response.arrayBuffer();
  const digest = hex(await crypto.subtle.digest('SHA-256', bytes));
  if (digest !== expected.trim()) throw new Error(`Checksum mismatch: ${url.pathname}`);
  return JSON.parse(new TextDecoder().decode(bytes));
}
const options = (id, values, label = String) => $(id).replaceChildren(...values.map(v => {
  const option = document.createElement('option'); option.value = String(v); option.textContent = label(v); return option;
}));
function pause() { playing = false; $('play').textContent = 'Play'; }
function cellCard(record) {
  const card = document.createElement('article'); card.className = 'card';
  card.innerHTML = '<div class="card-head"><h2></h2><span class="badge"></span></div><canvas aria-label="Recorded track playback"></canvas><div class="metrics"></div><div class="interval"></div><div class="details"></div>';
  card.querySelector('h2').textContent = title(record.method);
  const badge = card.querySelector('.badge'); badge.textContent = record.score.valid ? 'Timing & survival pass' : 'Failed contract';
  badge.classList.toggle('fail', !record.score.valid);
  for (const [label, value] of [['Adherence / 1000', number(record.score.score)], ['Physics frames', number(record.physicalFrames)], ['Compile time', `${(record.compileMs / 1000).toFixed(2)} s`]]) {
    const metric = document.createElement('div'); metric.className = 'metric';
    const name = document.createElement('span'), output = document.createElement('strong'); name.textContent = label; output.textContent = value;
    metric.append(name, output); card.querySelector('.metrics').append(metric);
  }
  const details = card.querySelector('.details');
  const description = document.createElement('p'); description.textContent = manifest.plan.methodDetails?.[record.method]?.description ?? ''; details.append(description);
  if(record.construction){const selection = document.createElement('p'); selection.textContent = record.construction.selected === 'contact-fragments' ? 'Shown: reconstructed contact fragments.' : 'Shown: original feedback result retained after comparison.'; details.append(selection);}
  const text = document.createElement('p'); text.textContent = `${number(record.lines)} normal segments · seed ${record.seed} · ${(100 * record.jitter).toFixed(0)}% target jitter · allowance ${number(record.budget)} frames.`; details.append(text);
  if (!record.score.valid) {const failure = document.createElement('p'); failure.className = 'failure'; failure.textContent = record.score.hardFailures.join(' · '); details.append(failure);}
  const link = document.createElement('a'); link.href = new URL(record.path, manifestUrl); link.textContent = 'Track, targets and replay data'; details.append(link);
  record.canvas = card.querySelector('canvas'); record.interval = card.querySelector('.interval');
  const coords = record.track.lines.flatMap(l => [[l.x1, l.y1], [l.x2, l.y2]]);
  for (const frame of record.trace.frames) coords.push([frame[0], frame[1]]);
  record.bounds = coords.reduce((b, [x,y]) => [Math.min(b[0],x), Math.min(b[1],y), Math.max(b[2],x), Math.max(b[3],y)], [Infinity, Infinity, -Infinity, -Infinity]);
  return card;
}
async function select() {
  const token = ++generation; pause(); $('play').disabled = true; $('status').textContent = 'Loading matching replays…';
  const selected = ['left-method','right-method'].map(id => manifest.cells.find(c => c.caseId === $('passage').value && c.budget === +$('budget').value && c.seed === +$('seed').value && c.method === $(id).value));
  try {
    if(selected.some(c=>!c))throw new Error('The comparison is incomplete.');
    const loaded = await Promise.all(selected.map(async cell => {
      if (!cache.has(cell.id)) cache.set(cell.id, read(new URL(cell.path, manifestUrl), cell.sha256));
      const raw = await cache.get(cell.id);
      if (raw.planSha256 !== manifest.planSha256 || raw.id !== cell.id || raw.trackHash !== cell.trackHash) throw new Error('Replay identity mismatch');
      return {...raw, path: cell.path};
    }));
    if (token !== generation) return;
    if (loaded.length !== 2) throw new Error('The comparison is incomplete.');
    records = loaded; seconds = 0; $('seek').value = '0'; $('seek').max = String(records[0].case.durationFrames / 40);
    $('beats').replaceChildren(...records[0].case.contacts.map((c, i) => {
      const beat = document.createElement('button'); beat.textContent = String(i+1);
      beat.style.left = `${100*c.frame/records[0].case.durationFrames}%`;
      beat.title = `Beat ${i+1}: ${(c.frame/40).toFixed(2)} s`; beat.setAttribute('aria-label', beat.title);
      beat.onclick = () => {seconds=c.frame/40; $('seek').value=String(seconds); draw();}; return beat;
    }));
    $('panels').replaceChildren(...records.map(cellCard)); $('play').disabled = false;
    $('status').textContent = 'Matched inputs · synchronized playback · all emitted geometry uses normal lines'; draw();
  } catch (error) {if (token === generation) {records = []; $('panels').replaceChildren(); $('status').textContent = `Cannot show this comparison: ${error.message}`;}}
}
const bones = [['TAIL','NOSE'],['NOSE','STRING'],['STRING','PEG'],['PEG','TAIL'],['BUTT','SHOULDER'],['SHOULDER','RHAND'],['SHOULDER','LHAND'],['BUTT','LFOOT'],['BUTT','RFOOT']];
function drawCard(r) {
  const canvas = r.canvas, dpr = devicePixelRatio || 1, w = canvas.clientWidth, h = canvas.clientHeight;
  if (canvas.width !== Math.round(w*dpr) || canvas.height !== Math.round(h*dpr)) {canvas.width = Math.round(w*dpr); canvas.height = Math.round(h*dpr);}
  const ctx = canvas.getContext('2d'); ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,w,h);
  const at = Math.min(seconds * 40, r.trace.frames.length - 1), f = Math.floor(at), fraction = at-f;
  const a = r.trace.frames[f], b = r.trace.frames[Math.min(f+1,r.trace.frames.length-1)];
  const points = Object.fromEntries(r.trace.pointIds.map((id,i) => [id, [a[i*2]*(1-fraction)+b[i*2]*fraction, a[i*2+1]*(1-fraction)+b[i*2+1]*fraction]]));
  let scale, x, y;
  if ($('view').value === 'overview') {const bounds = r.bounds; scale = Math.min((w-50)/Math.max(60,bounds[2]-bounds[0]),(h-50)/Math.max(60,bounds[3]-bounds[1])); x=(bounds[0]+bounds[2])/2; y=(bounds[1]+bounds[3])/2;}
  else {scale = Math.min(w/250,h/190); [x,y] = points.PEG; x += 40;}
  ctx.translate(w/2,h/2); ctx.scale(scale,scale); ctx.translate(-x,-y);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#38473f'; ctx.lineWidth = 1.35/scale; ctx.beginPath();
  for (const l of r.track.lines) {ctx.moveTo(l.x1,l.y1); ctx.lineTo(l.x2,l.y2);} ctx.stroke();
  ctx.strokeStyle = '#19261f'; ctx.lineWidth = Math.max(1.5,1.6/scale); ctx.beginPath();
  for (const [a,b] of bones) {ctx.moveTo(...points[a]); ctx.lineTo(...points[b]);} ctx.stroke();
  const [sx,sy]=points.SHOULDER,[bx,by]=points.BUTT, length=Math.hypot(sx-bx,sy-by)||1;
  ctx.beginPath(); ctx.arc(sx+3*(sx-bx)/length,sy+3*(sy-by)/length,3.2,0,2*Math.PI); ctx.fillStyle='#19261f'; ctx.fill();
  if (r.contacts.some(c => c.actualFrame !== null && Math.abs(c.actualFrame-seconds*40)<2)) {
    ctx.beginPath(); ctx.arc(...points.PEG,14,0,2*Math.PI); ctx.lineWidth=1.5/scale; ctx.strokeStyle='#389a70'; ctx.stroke();
  }
  ctx.setTransform(dpr,0,0,dpr,0,0); ctx.fillStyle = '#56665c'; ctx.font = '12px system-ui';
  ctx.fillText(seconds*40 > r.trace.frames.length-1 ? `Replay ended: ${r.terminus.reason}` : `Frame ${Math.floor(seconds*40)}`,14,22);
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
function tick(now) {if (playing) {seconds = Math.min(+$('seek').max, seconds + (now-previous)/1000*(+$('rate').value)); $('seek').value=String(seconds); draw(); if (seconds >= +$('seek').max) pause();} previous=now; requestAnimationFrame(tick);}
$('play').onclick = () => {if (playing) pause(); else {if(seconds >= +$('seek').max)seconds=0; playing=true; $('play').textContent='Pause';}};
$('seek').oninput = () => {seconds=+$('seek').value; draw();}; $('view').onchange = draw;
for (const id of ['passage','budget','seed','left-method','right-method']) $(id).onchange = select;
window.addEventListener('resize', draw); document.addEventListener('visibilitychange', () => {if(document.hidden)pause();});
try {
  const checksum = await fetch(new URL(manifestUrl.href+'.sha256')); if(!checksum.ok)throw new Error('No local study manifest found.');
  manifest = await read(manifestUrl, await checksum.text());
  if(manifest.schema !== 'line.motion-gallery.v1')throw new Error('Unsupported study format.');
  for(const id of ['left-method','right-method'])options(id,manifest.plan.methods,title);
  $('right-method').value=manifest.plan.methods.includes('scattered')?'scattered':(manifest.plan.methods[1] ?? manifest.plan.methods[0]);
  options('passage', manifest.plan.cases.map(c=>c.id), id=>manifest.plan.cases.find(c=>c.id===id).title);
  options('budget', manifest.plan.budgets, b=>`${number(b)} frames`); $('budget').value=String(manifest.plan.budgets.at(-1)); options('seed',manifest.plan.seeds);
  $('study-note').textContent=manifest.plan.note; $('manifest-link').href=manifestUrl;
  $('identity').textContent=`Compiler ${manifest.plan.compiler.head.slice(0,8)} · ${manifest.cells.length} recorded runs`;
  for(const row of manifest.summary){const tr=document.createElement('tr');for(const value of [title(row.method),number(row.budget),`${row.valid}/${row.runs}`,number(row.meanScore),number(row.totalPhysicalFrames),`${(row.totalCompileMs/1000).toFixed(1)} s`]){const td=document.createElement('td');td.textContent=value;tr.append(td);}$('summary').append(tr);}
  await select();
} catch(error) {$('status').textContent=`Gallery unavailable: ${error.message} Generate the local study using scripts/gallery/build.ts; see docs/motion-repertoire.md.`;}
requestAnimationFrame(tick);
