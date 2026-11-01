const $ = id => document.getElementById(id);
const stage = $('stage'), status = $('status');
let videos = [], entries = [], active = -1, wanted = -1, playing = false, muted = false, pending = null;
const abortError = () => new DOMException('Superseded', 'AbortError');

function waitFor(video, ready, events, signal) {
  if (signal.aborted) return Promise.reject(abortError());
  if (video.error) return Promise.reject(new Error('Could not load this video.'));
  if (ready()) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const finish = error => {clearTimeout(timer); for (const event of events) video.removeEventListener(event, check); video.removeEventListener('error', failed); signal.removeEventListener('abort', aborted); error ? reject(error) : resolve();};
    const check = () => {if (ready()) finish();}, failed = () => finish(new Error('Could not load this video.')), aborted = () => finish(abortError());
    const timer = setTimeout(() => finish(new Error('Video is taking too long to load. Try again.')), 15000);
    for (const event of events) video.addEventListener(event, check);
    video.addEventListener('error', failed); signal.addEventListener('abort', aborted);
  });
}
function painted(video, signal) {
  if (signal.aborted) return Promise.reject(abortError());
  if (!video.requestVideoFrameCallback) return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  return new Promise((resolve, reject) => {
    let frame;
    const finish = error => {clearTimeout(timer); video.cancelVideoFrameCallback(frame); signal.removeEventListener('abort', aborted); error ? reject(error) : resolve();};
    const aborted = () => finish(abortError());
    const timer = setTimeout(() => finish(new Error('Could not prepare a video frame.')), 5000);
    signal.addEventListener('abort', aborted);
    frame = video.requestVideoFrameCallback(() => finish());
  });
}
function clockDifference(reference, candidate) {
  let delta = reference.currentTime - candidate.currentTime;
  if (Math.abs(reference.duration - candidate.duration) < .05 && Math.abs(delta) > reference.duration / 2)
    delta += delta > 0 ? -reference.duration : reference.duration;
  return delta;
}
const formatTime = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
function controls() {
  $('play').textContent = playing ? 'Pause' : 'Play';
  $('sound').textContent = muted ? 'Sound off' : 'Sound on';
  $('sound').setAttribute('aria-pressed', String(!muted));
  [...$('versions').children].forEach((b, i) => {b.setAttribute('aria-pressed', String(i === active)); b.classList.toggle('pending', i === wanted && wanted !== active);});
}
async function select(index) {
  pending?.abort();
  for (let i = 0; i < videos.length; i++) if (i !== active) {videos[i].pause(); videos[i].muted = true;}
  wanted = index; controls();
  if (index === active) {status.textContent = ''; return;}
  const controller = new AbortController(); pending = controller;
  const signal = controller.signal, next = videos[index];
  status.textContent = `Preparing ${entries[index].label}…`;
  try {
    if (next.error || next.networkState === HTMLMediaElement.NETWORK_EMPTY) next.load();
    await waitFor(next, () => next.readyState >= 2, ['loadeddata', 'canplay'], signal);
    const previous = active >= 0 ? videos[active] : null;
    next.playbackRate = previous?.playbackRate ?? 1;
    next.volume = previous?.volume ?? 1;
    // Keep the outgoing video visible and audible while preparing the next one.
    // Only a decoded frame at the matching time is allowed to replace it.
    let shorter = false;
    for (let attempt = 0; attempt < 4; attempt++) {
      if (signal.aborted) throw abortError();
      const time = previous?.currentTime ?? 0;
      shorter = time >= next.duration;
      const target = Math.min(time, Math.max(0, next.duration - .04));
      next.pause();
      if (Math.abs(next.currentTime - target) > .008) {
        const frame = painted(next, signal);
        next.currentTime = target;
        await Promise.all([frame, waitFor(next, () => !next.seeking && next.readyState >= 2, ['seeked', 'canplay'], signal)]);
      }
      if (playing && !shorter) {
        const frame = painted(next, signal);
        await Promise.all([frame, next.play()]);
        // Seeking takes time while the outgoing clock keeps moving. Catch up
        // silently before the handoff instead of repeatedly seeking behind it.
        const deadline = performance.now() + 2000;
        while (previous && playing && Math.abs(clockDifference(previous, next)) > .04 && performance.now() < deadline) {
          next.playbackRate = previous.playbackRate * (clockDifference(previous, next) > 0 ? 1.5 : .75);
          await painted(next, signal);
        }
        next.playbackRate = previous?.playbackRate ?? 1;
      }
      if (!previous || !playing || shorter || Math.abs(clockDifference(previous, next)) < .05) break;
      if (attempt === 3) throw new Error('Could not align the videos yet. Try again.');
    }
    if (signal.aborted) throw abortError();
    if (!playing || shorter) next.pause();
    if (previous) {previous.muted = true; previous.pause(); previous.classList.remove('active');}
    next.muted = muted; next.classList.add('active'); active = index;
    if (shorter) playing = false;
    stage.style.aspectRatio = `${next.videoWidth} / ${next.videoHeight}`;
    $('description').textContent = entries[index].description ?? '';
    $('play').disabled = false; $('seek').disabled = false;
    status.textContent = shorter ? 'This version ends earlier; showing its final moment.' : '';
    controls();
  } catch (error) {
    if (signal.aborted) return;
    next.pause(); next.muted = true; wanted = active; controls();
    status.textContent = error.message;
  }
}
async function togglePlay() {
  if (active < 0) return;
  playing = !playing;
  if (playing) {try {await videos[active].play();} catch (error) {playing = false; status.textContent = error.message;}}
  else {videos[active].pause();}
  controls();
}
$('play').onclick = togglePlay;
$('sound').onclick = () => {muted = !muted; if (active >= 0) videos[active].muted = muted; controls();};
$('fullscreen').onclick = () => {stage.requestFullscreen?.().catch(error => {status.textContent = error.message;});};
$('seek').oninput = () => {
  if (active < 0) return;
  pending?.abort(); wanted = active;
  videos.forEach((v, i) => {if (i !== active) {v.pause(); v.muted = true;}});
  videos[active].currentTime = Number($('seek').value); status.textContent = ''; controls();
};
document.addEventListener('keydown', event => {
  if (event.target.closest('input,textarea,select,[contenteditable]') || event.altKey || event.ctrlKey || event.metaKey) return;
  if (event.code === 'Space') {event.preventDefault(); togglePlay();}
  if (videos.length && (event.code === 'ArrowLeft' || event.code === 'ArrowRight')) {event.preventDefault(); select((Math.max(0, wanted) + (event.code === 'ArrowRight' ? 1 : -1) + videos.length) % videos.length);}
});
function tick() {
  if (active >= 0) {const v = videos[active]; $('seek').max = String(v.duration || 1); $('seek').value = String(v.currentTime); $('time').textContent = `${formatTime(v.currentTime)} / ${formatTime(v.duration || 0)}`;}
  requestAnimationFrame(tick);
}
try {
  const path = new URLSearchParams(location.search).get('collection');
  if (!path) throw new Error('Open this page with ?collection=/path/to/comparison.json');
  const url = new URL(path, location.href), response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load comparison (${response.status}).`);
  const data = await response.json(); entries = data.videos;
  if (!Array.isArray(entries) || !entries.length || entries.some(e => typeof e.src !== 'string' || typeof e.label !== 'string')) throw new Error('Comparison needs a videos list with label and src for each version.');
  $('title').textContent = data.title ?? 'Video comparison';
  if (data.description) $('intro').textContent = data.description;
  videos = entries.map((entry, index) => {
    const video = document.createElement('video'); video.src = new URL(entry.src, url).href; video.preload = 'auto'; video.playsInline = true; video.loop = true; video.muted = true; video.setAttribute('aria-hidden', 'true'); stage.append(video);
    const button = document.createElement('button'); button.textContent = entry.label; button.onclick = () => select(index); button.setAttribute('aria-pressed', 'false'); $('versions').append(button); return video;
  });
  await select(0); tick();
} catch (error) {status.textContent = error.message;}
