const $ = id => document.getElementById(id);
let data, song = 0, group = 0, mode = 'quiet', generation = 0, running = false, videos = [], raf;
const buttons = (parent, items, selected, choose) => {
  parent.replaceChildren(...items.map((item, i) => {
    const b = document.createElement('button'); b.textContent = item.label;
    b.setAttribute('aria-pressed', String(i === selected)); b.onclick = () => choose(i); return b;
  }));
};
function stop() {
  running = false; generation++; cancelAnimationFrame(raf);
  for (const v of videos) {v.pause(); v.removeAttribute('src'); v.load(); v.remove();}
  videos = []; $('status').textContent = '';
}
function describeMode() {
  for (const b of $('modes').children) {
    b.setAttribute('aria-pressed', String(b.dataset.mode === mode));
    if (b.dataset.mode === 'loop') b.textContent = running ? 'Pause loops' : 'Play loops';
  }
  const p = data.passages[song];
  $('moment').textContent = mode === 'quiet' ? 'Source '+p.quietTime.toFixed(2)+' s · same settled moment in every card'
    : mode === 'impact' ? 'Source '+p.impactTime.toFixed(2)+' s · same contact moment in every card'
    : 'Source '+p.loopStart.toFixed(2)+'–'+(p.loopStart+4).toFixed(2)+' s · synchronized muted loops';
}
function render() {
  stop(); mode = 'quiet'; const p = data.passages[song];
  const available = g => g.variants.filter(id => p.items.some(v => v.id === id)).length >= 2;
  if (!available(data.groups[group])) group = data.groups.findIndex(available);
  const g = data.groups[group];
  buttons($('songs'), data.passages, song, i => {song = i; render();});
  buttons($('groups'), data.groups, group, i => {group = i; render();});
  const comparison = new URL(g.comparison ?? 'video-compare.html?collection=/generated/style-lab-v5/collection.json', location.href);
  comparison.searchParams.set('passage', p.id);
  $('compare').href = comparison.href;
  $('intent').textContent = g.description; $('cards').replaceChildren();
  for (const id of g.variants) {
    const item = p.items.find(v => v.id === id); if (!item) continue;
    const article = document.createElement('article'), picture = document.createElement('div'), img = document.createElement('img');
    picture.className = 'picture'; picture.dataset.id = id;
    img.src = item.quiet; img.alt = item.label+', settled frame'; img.width = 1080; img.height = 1920;
    picture.append(img); const h = document.createElement('h2'); h.textContent = item.label;
    const desc = document.createElement('p'); desc.textContent = item.description;
    const link = document.createElement('a'); link.href = item.quiet; link.target = '_blank'; link.rel = 'noopener'; link.textContent = 'Open full-size frame'; link.className = 'frame-link';
    article.append(picture, h, desc, link); $('cards').append(article);
  }
  for (const [i, b] of [...$('groups').children].entries()) b.disabled = !available(data.groups[i]);
  describeMode();
}
function sync() {
  if (!running) return;
  const lead = videos[0];
  for (const v of videos.slice(1)) {
    if (v.readyState < 2 || v.seeking || lead.seeking) continue;
    let delta = v.currentTime - lead.currentTime;
    if (Math.abs(delta) > 2) delta += delta > 0 ? -4 : 4;
    if (Math.abs(delta) > .06) v.currentTime = lead.currentTime;
  }
  raf = requestAnimationFrame(sync);
}
async function playLoops() {
  if (running) {running = false; cancelAnimationFrame(raf); for (const v of videos) v.pause(); $('status').textContent = ''; describeMode(); return;}
  mode = 'loop'; running = true; const ticket = ++generation;
  const resumeTime = videos[0]?.currentTime ?? 0; cancelAnimationFrame(raf);
  $('status').textContent = 'Preparing synchronized loops…'; describeMode();
  const p = data.passages[song];
  if (!videos.length) videos = [...document.querySelectorAll('.picture')].map(picture => {
    const item = p.items.find(v => v.id === picture.dataset.id), v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.loop = true; v.preload = 'auto'; v.src = item.loop;
    v.setAttribute('aria-label', item.label+' contact loop'); picture.append(v); return v;
  });
  const activeVideos = videos; let timer;
  try {
    // Start all muted players in the click gesture, then align their clocks.
    await Promise.race([
      Promise.all(activeVideos.map(v => v.play())),
      new Promise((_, reject) => {timer = setTimeout(() => reject(new Error('Loading timed out. Tap Play loops to retry.')), 15000);}),
    ]);
    if (ticket !== generation || !running) return;
    for (const v of activeVideos) {v.currentTime = resumeTime; v.classList.add('ready');}
    $('status').textContent = ''; sync();
  } catch (error) {
    // Pausing (or hiding the tab) while the loops were starting rejects their play() with AbortError: that is the viewer's choice,
    // not a failure, and it must not reset the view
    if (ticket !== generation || !running) return;
    render(); $('status').textContent = error.message;
  } finally {clearTimeout(timer);}
}
$('modes').onclick = event => {
  const b = event.target.closest('button'); if (!b || !data) return;
  if (b.dataset.mode === 'loop') {playLoops(); return;}
  stop(); mode = b.dataset.mode; const p = data.passages[song];
  for (const picture of document.querySelectorAll('.picture')) {
    const item = p.items.find(v => v.id === picture.dataset.id), img = picture.querySelector('img');
    img.src = item[mode]; img.alt = item.label+', '+(mode === 'quiet' ? 'settled' : 'contact')+' frame';
    picture.parentElement.querySelector('.frame-link').href = item[mode];
  }
  describeMode();
};
document.addEventListener('visibilitychange', () => {if (document.hidden && running) {running = false; cancelAnimationFrame(raf); for (const v of videos) v.pause(); $('status').textContent = ''; describeMode();}});
try {
  const response = await fetch('/generated/style-lab-v5/catalog.json');
  if (!response.ok) throw new Error('The catalogue is still being prepared. Please try again shortly.');
  data = await response.json();
  if (!data.passages?.length || !data.groups?.length) throw new Error('The catalogue is still being prepared. Please try again shortly.');
  render();
} catch (error) {$('status').textContent = error.message;}
