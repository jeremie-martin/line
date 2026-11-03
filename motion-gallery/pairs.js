/** Blind pairs use one combined video and one media clock. The two sound
 * choices share identical picture packets; only an explicit sound change
 * loads another soundtrack. Original study clips and judgments are unchanged. */
const $ = id => document.getElementById(id);
const study = new URLSearchParams(location.search).get('study') ?? 'slam-2026-10';
const state = {manifest: null, index: 0, choice: null, labeled: new Set(), shownAt: 0, playing: true, rate: 1};
const status = (text, error = false) => {$('status').textContent = text; $('status').classList.toggle('error', error);};
const sides = ['left', 'right'], video = $('pair-video'), narrow = matchMedia('(max-width:700px)');
let media, loading = false, revision = 0, plays = 0, pendingPosition = 0;
const position = () => loading ? pendingPosition : video.currentTime;
const LIT = [-0.05, 0.12];
// The first study (slam-2026-10) predates per-study choices.
const SLAM = [['left', 'A slams more'], ['right', 'B slams more'], ['same', 'About the same'], ['neither', 'Neither feels like a slam']];   // seconds around the judged hit during which the light is on

function drawTimeline(side) {
  const m = state.manifest, clip = m.clips[state.index][side], canvas = $(side + '-timeline'), t = video.currentTime;
  const r = Math.min(2, devicePixelRatio), w = canvas.clientWidth, h = canvas.clientHeight;
  if (canvas.width !== Math.round(w * r)) {canvas.width = Math.round(w * r); canvas.height = Math.round(h * r);}
  const g = canvas.getContext('2d'), pad = 14, x = s => pad + s / m.length * (w - 2 * pad), base = 36;
  g.setTransform(r, 0, 0, r, 0, 0); g.clearRect(0, 0, w, h);
  g.strokeStyle = '#d9e0d5'; g.lineWidth = 2; g.beginPath(); g.moveTo(pad, base); g.lineTo(w - pad, base); g.stroke();
  g.font = '11px system-ui'; g.textAlign = 'center';
  // Beats of the specification (tick size = requested strength); the judged hit
  // is always marked at hitAt, whether or not a beat falls exactly there.
  for (const b of clip.beats) {
    const size = 5 + 11 * (b.impact ?? .5), near = Math.abs(t - b.t) < .06;
    g.strokeStyle = near ? '#162924' : '#9aa8a3'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(x(b.t), base - size); g.lineTo(x(b.t), base + size); g.stroke();
  }
  g.strokeStyle = '#146b55'; g.lineWidth = 4; g.beginPath(); g.moveTo(x(m.hitAt), base - 18); g.lineTo(x(m.hitAt), base + 18); g.stroke();
  g.fillStyle = '#146b55'; g.fillText('this hit', x(m.hitAt), 11);
  g.fillStyle = '#63736e'; g.textAlign = 'left'; g.fillText(`−${m.hitAt.toFixed(1)} s`, 2, h - 3);
  g.fillText(side === 'left' ? 'A' : 'B', 2, 11);
  g.textAlign = 'right'; g.fillText(`+${(m.length - m.hitAt).toFixed(1)} s`, w - 2, h - 3);
  g.strokeStyle = '#d35400'; g.lineWidth = 2; g.beginPath(); g.moveTo(x(t), 4); g.lineTo(x(t), h - 14); g.stroke();
}
function draw() {
  const m = state.manifest; if (!m || loading) return;
  for (const side of sides) {
    const d = video.currentTime - m.hitAt, lit = d >= LIT[0] && d <= LIT[1], stage = document.querySelector(side === 'left' ? '.side-a' : '.side-b');
    stage.querySelector('.led').classList.toggle('on', lit); stage.classList.toggle('hit', lit);
    drawTimeline(side);
  }
}
function tick() {draw(); requestAnimationFrame(tick);}
function seek(t) {if (!loading) video.currentTime = t;}
function setPlaying(on) {
  const playRequest = ++plays; state.playing = on; $('play').textContent = on ? 'Pause' : 'Play';
  if (!on) video.pause();
  else if (!loading) {const n = revision; video.play().catch(() => {if (n !== revision || playRequest !== plays || !state.playing) return; state.playing = false; $('play').textContent = 'Play'; status('Press Play to start.');});}
}
// Source changes are explicit (new pair, soundtrack, layout), never a running
// sync correction. A newer change cancels the pending load and its listeners.
let cancelLoad = () => {};
async function loadPicture(t = 0, prepare = false) {
  const n = ++revision; cancelLoad(); pendingPosition = t; loading = true; video.pause();
  $('picture').classList.add('loading'); $('choices').inert = true; $('next').disabled = true; status('Loading pair…');
  try {
    if (prepare) {
      media = undefined;
      const clip = state.manifest.clips[state.index], layout = narrow.matches ? 'stacked' : 'wide';
      const response = await fetch(`/api/labels/${study}/pair/${encodeURIComponent(clip.id)}?layout=${layout}`);
      const result = await response.json(); if (!response.ok) throw Error(result.error ?? 'Cannot load pair');
      if (n !== revision) return; media = result;
      $('pair').classList.toggle('stacked', layout === 'stacked');
      $('picture').style.aspectRatio = `${media.width} / ${media.height}`;
      $('picture').style.setProperty('--pane', `${100 * (layout === 'wide' ? media.paneWidth / media.width : media.paneHeight / media.height)}%`);
    }
    if (n !== revision) return;
    video.muted = !state.sound || state.sound === 'off';
    const source = media.sources[state.sound === 'right' ? 'right' : 'left'];
    await new Promise((resolve, reject) => {
      const clean = () => {video.removeEventListener('loadedmetadata', ready); video.removeEventListener('error', fail); cancelLoad = () => {};};
      const ready = () => {clean(); resolve();}, fail = () => {clean(); reject(Error('Cannot play this pair.'));};
      cancelLoad = () => {clean(); resolve();};
      video.addEventListener('loadedmetadata', ready); video.addEventListener('error', fail);
      video.src = source;
    });
    if (n !== revision) return;
    video.currentTime = Math.max(0, Math.min(t, state.manifest.length - .001)); video.playbackRate = state.rate;
    loading = false; $('picture').classList.remove('loading'); $('choices').inert = false; $('next').disabled = false;
    status(state.labeled.has(state.manifest.clips[state.index].id) ? 'Already answered; a new answer replaces it.' : '');
    setPlaying(state.playing);
  } catch (error) {
    if (n !== revision) return; loading = false; setPlaying(false); status(error.message, true);
  }
}
narrow.addEventListener('change', () => {if (state.manifest) loadPicture(position(), true);});
for (const side of sides) {
  const canvas = $(side + '-timeline');
  const scrub = e => {
    const rect = canvas.getBoundingClientRect(), pad = 14, f = (e.clientX - rect.left - pad) / (rect.width - 2 * pad);
    setPlaying(false); seek(Math.max(0, Math.min(1, f)) * state.manifest.length);
  };
  canvas.addEventListener('pointerdown', e => {canvas.setPointerCapture(e.pointerId); scrub(e);});
  canvas.addEventListener('pointermove', e => {if (canvas.hasPointerCapture(e.pointerId)) scrub(e);});
}

function show() {
  state.choice = null; state.shownAt = performance.now(); $('note').value = '';
  state.rate = $('slow').getAttribute('aria-pressed') === 'true' ? .5 : 1;
  state.playing = true; $('play').textContent = 'Pause'; loadPicture(0, true);
  for (const b of $('choices').children) b.classList.remove('on');
  $('progress').textContent = `Pair ${state.index + 1} of ${state.manifest.clips.length} · ${state.labeled.size} answered`;
  $('back').disabled = state.index === 0;
}

async function save(skipped) {
  const clip = state.manifest.clips[state.index];
  if (!skipped && (loading || $('next').disabled)) return;
  if (!skipped && !state.choice) {status('Choose an answer, or Skip.', true); return;}
  const response = await fetch(`/api/labels/${study}`, {method: 'POST', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({clip: clip.id, skipped, answers: skipped ? null : {[state.manifest.questions[0].id]: state.choice}, note: $('note').value,
      viewMs: Math.round(performance.now() - state.shownAt), at: new Date().toISOString()})});
  if (!response.ok) {status(`Not saved: ${(await response.json()).error ?? response.status}`, true); return;}
  if (!skipped) state.labeled.add(clip.id);
  if (state.index + 1 < state.manifest.clips.length) {state.index++; show();}
  else {$('progress').textContent = `${state.labeled.size} of ${state.manifest.clips.length} answered`; status('Done. Thank you.');}
}
$('choices').onclick = e => {
  const b = e.target.closest('button'); if (!b) return;
  state.choice = b.dataset.v; for (const x of $('choices').children) x.classList.toggle('on', x === b);
};
$('play').onclick = () => setPlaying(!state.playing);
$('slow').onclick = e => {
  const on = e.currentTarget.getAttribute('aria-pressed') !== 'true'; e.currentTarget.setAttribute('aria-pressed', String(on));
  state.rate = on ? .5 : 1;
  video.playbackRate = state.rate;
};
// The two clips are different song moments, so only one soundtrack plays: off → A → B.
const SOUND = ['off', 'left', 'right'];
$('sound').onclick = e => {
  const next = SOUND[(SOUND.indexOf(state.sound ?? 'off') + 1) % SOUND.length]; state.sound = next;
  e.currentTarget.textContent = next === 'off' ? 'Sound' : `Sound: ${next === 'left' ? 'A' : 'B'}`;
  e.currentTarget.setAttribute('aria-pressed', String(next !== 'off'));
  video.muted = next === 'off';
  if (next !== 'off' && media && !video.src.endsWith(media.sources[next === 'right' ? 'right' : 'left'])) loadPicture(position());
  if (next !== 'off' && !state.playing) setPlaying(true);
};
$('next').onclick = () => save(false);
$('skip').onclick = () => save(true);
$('back').onclick = () => {if (state.index > 0) {state.index--; show();}};

try {
  const [manifest, labels] = await Promise.all([
    fetch(`/generated/label-studies/${study}/manifest.json`).then(r => r.json()),
    fetch(`/api/labels/${study}`).then(r => r.json()),
  ]);
  state.manifest = manifest;
  state.labeled = new Set(labels.labeled ?? []);
  $('prompt').textContent = state.manifest.prompt;
  for (const [v, text] of state.manifest.choices ?? SLAM) {
    const b = document.createElement('button'); b.className = 'choice'; b.dataset.v = v; b.textContent = text; $('choices').appendChild(b);
  }
  const ticks = state.manifest.clips.some(c => c.left.beats.length || c.right.beats.length);
  $('instructions').textContent = `The light comes on at the moment you are judging (at ${state.manifest.hitAt} s of a ${state.manifest.length} s loop); it is the green mark on each timeline${ticks ? "; grey ticks are the song's beats (taller = stronger requested hit)" : ''}. Drag a timeline to scrub both clips.`;
  state.index = Math.max(0, state.manifest.clips.findIndex(c => !state.labeled.has(c.id)));
  show(); requestAnimationFrame(tick);
} catch (error) {status(`Cannot load study ${study}: ${error.message}`, true);}
