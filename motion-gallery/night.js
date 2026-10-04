/** Overnight results page: reads generated/report/night/data.json (tools/report/night.ts),
 * the narrative (tools/report/narrative.json, copied beside the data) and optional
 * before/after clips (generated/report/night/clips.json). */
const $ = id => document.getElementById(id);
const fetchJson = async url => {const r = await fetch(url); if (!r.ok) throw new Error(`${url}: ${r.status}`); return r.json();};
const fmt = (v, d = 3) => Number.isFinite(v) ? v.toFixed(d) : '—';
const el = (tag, attrs = {}, ...children) => {const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) k === 'class' ? e.className = v : e.setAttribute(k, v); for (const c of children) e.append(c); return e;};
const COLORS = {evening: '#b0703a', v3: '#6c7fb8', final: '#146b55'};

function verdict(row, s) {
  // Paired change beyond noise in the good direction is green, in the bad direction red.
  if (!Number.isFinite(s.diff) || (s.diffLo <= 0 && s.diffHi >= 0)) return 'flat';
  if (row.better === 'lower') return s.diff < 0 ? 'good' : 'bad';
  if (row.better === 'higher') return s.diff > 0 ? 'good' : 'bad';
  const ref = row.stages[0].value; return Math.abs(s.value) < Math.abs(ref) ? 'good' : 'bad';
}
function scorecard(data, which, panel) {
  const block = (which === 'confirm' ? data.confirm : data.dev)?.find(p => p.panel === panel);
  const stages = which === 'confirm' ? data.confirmStages : data.stages, t = $('scorecard');
  t.replaceChildren();
  if (!block) {t.append(el('tr', {}, el('td', {}, 'No data for this panel.'))); return;}
  const last = stages.length - 1;
  t.append(el('thead', {}, el('tr', {}, el('th', {}, 'Measure'), ...stages.map(s => el('th', {}, labelOf(data, s.key))), el('th', {}, `${labelOf(data, stages[last].key)} − ${labelOf(data, stages[0].key)}`))));
  const body = el('tbody'); let group = '';
  for (const row of block.rows) {
    if (row.group !== group) {group = row.group; body.append(el('tr', {class: 'group'}, el('td', {colspan: String(stages.length + 2)}, group)));}
    const f = row.digits ?? 3, d = row.stages[last];
    body.append(el('tr', {}, el('td', {}, row.label),
      ...row.stages.map(s => el('td', {}, fmt(s.value, f), el('br'), el('span', {class: 'ci'}, `[${fmt(s.lo, f)}, ${fmt(s.hi, f)}]`))),
      el('td', {class: verdict(row, d)}, `${d.diff >= 0 ? '+' : ''}${fmt(d.diff, f)}`, el('br'), el('span', {class: 'ci'}, `[${fmt(d.diffLo, f)}, ${fmt(d.diffHi, f)}]`))));
  }
  t.append(body);
}
const labelOf = (data, key) => data.narrative?.stageLabels?.[key] ?? key;

function curve(data) {
  const c = $('curve'), g = c.getContext('2d'), W = c.width, H = c.height, pad = 46;
  const x = v => pad + v * (W - 2 * pad), y = v => H - pad - v * (H - 2 * pad);
  g.clearRect(0, 0, W, H); g.font = '12px system-ui'; g.fillStyle = '#63736e';
  g.fillStyle = 'rgba(20,107,85,.07)'; g.fillRect(pad, y(.9), W - 2 * pad, y(.06) - y(.9));
  g.strokeStyle = '#d9e0d5'; g.lineWidth = 1;
  for (let v = 0; v <= 1.0001; v += .2) {g.beginPath(); g.moveTo(x(v), y(0)); g.lineTo(x(v), y(1)); g.moveTo(x(0), y(v)); g.lineTo(x(1), y(v)); g.stroke();
    g.fillStyle = '#63736e'; g.fillText(v.toFixed(1), x(v) - 8, H - pad + 16); g.fillText(v.toFixed(1), pad - 30, y(v) + 4);}
  g.fillText('requested strength', W / 2 - 50, H - 8); g.save(); g.translate(14, H / 2 + 40); g.rotate(-Math.PI / 2); g.fillText('achieved strength', 0, 0); g.restore();
  g.setLineDash([4, 4]); g.strokeStyle = '#9aa8a3'; g.beginPath(); g.moveTo(x(0), y(0)); g.lineTo(x(1), y(1)); g.stroke(); g.setLineDash([]);
  const legend = $('curve-legend'); legend.replaceChildren();
  for (const s of data.curves) {
    const col = COLORS[s.key] ?? '#333'; g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 2.5; g.beginPath();
    s.bins.forEach((b, i) => {const px = x((b.from + b.to) / 2), py = y(b.mean); i ? g.lineTo(px, py) : g.moveTo(px, py);}); g.stroke();
    for (const b of s.bins) {const px = x((b.from + b.to) / 2); g.globalAlpha = .25; g.fillRect(px - 3, y(b.p75), 6, y(b.p25) - y(b.p75)); g.globalAlpha = 1;}
    legend.append(el('span', {style: `--c:${col}`}, labelOf(data, s.key)));
  }
}

function songs(data) {
  const t = $('songs'), stages = data.stages;
  t.replaceChildren(el('thead', {}, el('tr', {}, el('th', {}, `Song (${stages.map(s => labelOf(data, s.key)).join(' → ')})`),
    ...['Impact loss', 'Strong: strength − request', 'Air rms', 'Speed rms', 'Head-down strong arrivals'].map(h => el('th', {}, h)))));
  const body = el('tbody');
  for (const s of data.songs) body.append(el('tr', {}, el('td', {}, data.narrative?.songTitles?.[s.song] ?? s.song),
    ...['impactLoss', 'strongBias', 'air', 'speed', 'inverted'].map(k => el('td', {}, s.stages.map(x => fmt(x[k], k === 'inverted' ? 2 : 3)).join(' → ')))));
  t.append(body);
}

function experiments(data) {
  const t = $('experiments');
  t.replaceChildren(el('thead', {}, el('tr', {}, ...['Time', 'Area', 'What', 'Verdict', 'Evidence'].map(h => el('th', {}, h)))));
  const body = el('tbody');
  for (const e of data.experiments) body.append(el('tr', {}, el('td', {}, e.time), el('td', {}, e.area), el('td', {style: 'text-align:left;white-space:normal'}, e.title),
    el('td', {}, el('span', {class: `pill ${e.verdict}`}, e.verdict)), el('td', {style: 'text-align:left;white-space:normal;max-width:420px'}, e.detail)));
  t.append(body);
}

function clips(list) {
  const root = $('clips'); root.replaceChildren();
  if (!list?.pairs?.length) {root.append(el('p', {class: 'note'}, 'Clips are generated at the end of the night (tools/report/clips.ts).')); return;}
  const videos = [];
  for (const p of list.pairs) {
    const side = (s, label) => {const v = el('video', {src: s.src, muted: '', loop: '', playsinline: '', autoplay: '', preload: 'auto'}); v.muted = true; videos.push(v);
      return el('div', {class: 'clip'}, v, el('span', {class: 'led'}), el('div', {class: 'cap'}, `${label}: measured ${fmt(s.strength, 2)}`));};
    root.append(el('div', {class: 'clip-pair'}, el('h4', {}, p.title), side(p.before, list.beforeLabel), side(p.after, list.afterLabel)));
  }
  const tick = () => {for (const v of videos) v.parentElement.querySelector('.led').classList.toggle('on', v.currentTime >= list.hitAt - .05 && v.currentTime <= list.hitAt + .12); requestAnimationFrame(tick);};
  requestAnimationFrame(tick);
  $('slow').onclick = e => {const on = e.currentTarget.getAttribute('aria-pressed') !== 'true'; e.currentTarget.setAttribute('aria-pressed', String(on)); for (const v of videos) v.playbackRate = on ? .5 : 1;};
}

function scale(s) {
  const root = $('scale'); root.replaceChildren();
  if (!s?.rows?.length) {root.append(el('p', {class: 'note'}, 'Generated by tools/report/scale_clips.ts.')); return;}
  for (const r of s.rows) {
    const v = el('video', {src: r.src, muted: '', loop: '', playsinline: '', autoplay: '', preload: 'auto'}); v.muted = true;
    root.append(el('div', {class: 'clip'}, v, el('div', {class: 'cap'}, `${r.label}: ${r.strength.toFixed(2)} (${r.normal} px/frame into the floor) · ${r.survived ? 'survives' : 'crashes'}`)));
  }
}

function narrative(data) {
  const n = data.narrative ?? {};
  $('stamp').textContent = `generated ${new Date(data.generated).toLocaleString()}`;
  const s = $('summary'); s.replaceChildren(el('h2', {}, n.title ?? 'Overnight results'));
  for (const p of n.summary ?? []) s.append(el('p', {}, p));
  if (n.cards) s.append(el('div', {class: 'cards'}, ...n.cards.map(c => el('div', {class: 'card'}, el('h3', {}, c.title), el('p', {}, c.text)))));
  const q = $('questions'); q.replaceChildren(el('h2', {}, 'Questions for you'));
  q.append(el('ol', {}, ...(n.questions ?? []).map(x => el('li', {}, x))));
}

try {
  const data = await fetchJson('/generated/report/night/data.json');
  data.narrative = await fetchJson('/generated/report/night/narrative.json').catch(() => ({}));
  narrative(data);
  const controls = $('scorecard-controls'); let which = 'dev', panel = 'authored';
  const button = (label, on) => {const b = el('button', {}, label); b.onclick = () => {on(); render();}; return b;};
  const render = () => {scorecard(data, which, panel); for (const b of controls.children) b.setAttribute('aria-pressed', String(b.dataset.key === which || b.dataset.key === panel));};
  for (const [key, label, fn] of [['dev', 'Main panel', () => which = 'dev'], ['confirm', 'Fresh seeds', () => which = 'confirm'], ['authored', 'Authored specs', () => panel = 'authored'], ['perturbed', 'Perturbed specs', () => panel = 'perturbed']]) {
    const b = button(label, fn); b.dataset.key = key; controls.append(b);
  }
  render(); curve(data); songs(data); experiments(data);
  scale(await fetchJson('/generated/report/night/scale.json').catch(() => null));
  clips(await fetchJson('/generated/report/night/clips.json').catch(() => null));
} catch (e) {document.querySelector('main').prepend(el('p', {class: 'bad'}, `Cannot load the report: ${e.message}`));}
