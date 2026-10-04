/** Blind pair study: two looping clips side by side, one choice per pair.
 * Sides are assigned by the study key, which the page never sees. Answers are
 * stored server-side (POST /api/labels/<study>) so a session can resume. */
const $ = id => document.getElementById(id);
const study = new URLSearchParams(location.search).get('study') ?? 'slam-2026-10';
const state = {manifest: null, index: 0, choice: null, labeled: new Set(), shownAt: 0};
const status = (text, error = false) => {$('status').textContent = text; $('status').classList.toggle('error', error);};
const videos = [$('left'), $('right')];

function show() {
  const clip = state.manifest.clips[state.index];
  state.choice = null; state.shownAt = performance.now(); $('note').value = '';
  $('left').src = clip.left; $('right').src = clip.right;
  for (const v of videos) {v.playbackRate = $('slow').getAttribute('aria-pressed') === 'true' ? .5 : 1; v.play().catch(() => {});}
  for (const b of $('choices').children) b.classList.remove('on');
  $('progress').textContent = `Pair ${state.index + 1} of ${state.manifest.clips.length} · ${state.labeled.size} answered`;
  $('back').disabled = state.index === 0;
  status(state.labeled.has(clip.id) ? 'Already answered; a new answer replaces it.' : '');
}
async function save(skipped) {
  const clip = state.manifest.clips[state.index];
  if (!skipped && !state.choice) {status('Choose an answer, or Skip.', true); return;}
  const response = await fetch(`/api/labels/${study}`, {method: 'POST', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({clip: clip.id, skipped, answers: skipped ? null : {slam: state.choice}, note: $('note').value,
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
$('slow').onclick = e => {
  const on = e.currentTarget.getAttribute('aria-pressed') !== 'true'; e.currentTarget.setAttribute('aria-pressed', String(on));
  for (const v of videos) v.playbackRate = on ? .5 : 1;
};
$('sound').onclick = e => {
  const on = e.currentTarget.getAttribute('aria-pressed') !== 'true'; e.currentTarget.setAttribute('aria-pressed', String(on));
  for (const v of videos) {v.muted = !on; v.currentTime = 0; v.play().catch(() => {});}
};
$('next').onclick = () => save(false);
$('skip').onclick = () => save(true);
$('back').onclick = () => {if (state.index > 0) {state.index--; show();}};

try {
  state.manifest = await (await fetch(`/generated/label-studies/${study}/manifest.json`)).json();
  state.labeled = new Set((await (await fetch(`/api/labels/${study}`)).json()).labeled ?? []);
  $('prompt').textContent = state.manifest.prompt;
  $('instructions').textContent = `Clips are ${state.manifest.length} s and loop; the hit lands at ${state.manifest.hitAt} s. Sound and half speed apply to both clips.`;
  state.index = Math.max(0, state.manifest.clips.findIndex(c => !state.labeled.has(c.id)));
  show();
} catch (error) {status(`Cannot load study ${study}: ${error.message}`, true);}
