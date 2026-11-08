const $ = id => document.getElementById(id);
const stage = $('stage'), status = $('status');
let videos = [], entries = [], active = -1, wanted = -1, playing = false, muted = false, pending = null;
let groups = [], passages = [], groupIndex = 0, passageIndex = -1, styleId = null, collectionUrl;
let savedRate = 1, savedVolume = 1;
const frameHold = $('transition-frame');
const visibleIndexes = () => groups.length ? groups[groupIndex].variants.map(id => entries.findIndex(e => e.id === id)).filter(i => i >= 0) : entries.map((_, i) => i);
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
// Hidden/occluded videos may decode without a compositor callback (notably on
// mobile). seeked + HAVE_CURRENT_DATA is the media readiness contract; prefer a
// presented frame, but never make visibility depend on a hidden presentation.
function painted(video, signal) {
  if (signal.aborted) return Promise.reject(abortError());
  return new Promise((resolve, reject) => {
    let frame, poll;
    const finish = error => {
      clearTimeout(timer); clearInterval(poll);
      if (frame !== undefined) video.cancelVideoFrameCallback(frame);
      signal.removeEventListener('abort', aborted);
      error ? reject(error) : resolve();
    };
    const aborted = () => finish(abortError());
    const timer = setTimeout(() => finish(new Error('Could not prepare a video frame.')), 5000);
    signal.addEventListener('abort', aborted);
    frame = video.requestVideoFrameCallback?.(() => finish());
    poll = setInterval(() => {if (!video.seeking && video.readyState >= 2) finish();}, 100);
  });
}
function release(video) {
  video.pause(); video.muted = true;
  if (video.hasAttribute('src')) {video.removeAttribute('src'); video.load();}
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
  [...$('versions').children].forEach(b => {const i = Number(b.dataset.index); b.setAttribute('aria-pressed', String(i === active)); b.classList.toggle('pending', i === wanted && wanted !== active);});
  [...$('groups').children].forEach((b, i) => {b.setAttribute('aria-pressed', String(i === groupIndex)); b.disabled = !entries.some(e => groups[i].variants.includes(e.id));});
  [...$('passages').children].forEach((b, i) => b.setAttribute('aria-pressed', String(i === passageIndex)));
}
function versionButtons() {
  $('versions').replaceChildren();
  for (const index of visibleIndexes()) {
    const entry = entries[index], button = document.createElement('button');
    button.dataset.index = String(index); button.textContent = entry.label;
    if (entry.recommended) {const pick = document.createElement('span'); pick.className = 'pick'; pick.textContent = 'pick'; button.append(pick);}
    button.onclick = () => select(index); $('versions').append(button);
  }
  controls();
}
function describe(entry) {
  $('description').textContent = entry?.description ?? '';
  $('recipe').hidden = !entry?.recipe;
  $('recipe-text').textContent = entry?.recipe ?? '';
}
async function select(index) {
  if (!entries[index]) return;
  pending?.abort();
  for (let i = 0; i < videos.length; i++) if (i !== active && i !== index) release(videos[i]);
  wanted = index; styleId = entries[index].id; controls();
  if (index === active) {status.textContent = ''; return;}
  const controller = new AbortController(); pending = controller;
  const signal = controller.signal, next = videos[index];
  status.textContent = `Preparing ${entries[index].label}…`;
  try {
    next.muted = true;
    if (!next.hasAttribute('src')) next.src = new URL(entries[index].src, collectionUrl).href;
    else if (next.error) next.load();
    // Keep this call in the user's click/keyboard gesture. Waiting for metadata
    // first loses per-element playback permission in mobile browsers.
    if (playing) next.play().catch(() => {});

    await waitFor(next, () => next.readyState >= 2, ['loadeddata', 'canplay'], signal);
    if (signal.aborted) throw abortError();
    const previous = active >= 0 ? videos[active] : null;
    next.playbackRate = previous?.playbackRate ?? savedRate;
    next.volume = previous?.volume ?? savedVolume;
    // Keep the outgoing video visible and audible while preparing the next one.
    // Only a decoded frame at the matching time is allowed to replace it.
    let shorter = false, needsPlay = false;
    // A fifth attempt exists only for a pause during the fourth: it re-seeks the paused picture exactly (see the break below).
    for (let attempt = 0; attempt < 5; attempt++) {
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
        try {await Promise.all([frame, next.play()]);}
        catch (error) {
          if (error.name !== 'NotAllowedError') throw error;
          next.pause(); playing = false; needsPlay = true; break;
        }
        // Seeking takes time while the outgoing clock keeps moving. Catch up
        // silently before the handoff instead of repeatedly seeking behind it.
        const deadline = performance.now() + 2000;
        while (previous && playing && Math.abs(clockDifference(previous, next)) > .04 && performance.now() < deadline) {
          next.playbackRate = previous.playbackRate * (clockDifference(previous, next) > 0 ? 1.5 : .75);
          await painted(next, signal);
        }
        next.playbackRate = previous?.playbackRate ?? savedRate;
      }
      // Paused while catching up: not aligned yet, so the next attempt seeks the paused incoming video to the outgoing one's frame
      // (breaking on !playing used to hand off at a different moment from the paused picture).
      if (!previous || shorter || Math.abs(clockDifference(previous, next)) < .05) break;
      if (attempt >= 3 && playing) throw new Error('Could not align the videos yet. Try again.');
    }
    if (signal.aborted) throw abortError();
    if (!playing || shorter) next.pause();
    if (previous) {previous.muted = true; previous.pause(); previous.classList.remove('active');}
    next.classList.add('active'); active = index; frameHold.hidden = true;
    next.muted = muted;
    if (previous) release(previous);
    // Some mobile policies pause on unmute. Never leave a false 'Pause' button
    // or a dead end: the prepared picture stays visible and Play can recover.
    if (playing && !shorter) {
      try {await next.play();} catch (error) {
        if (signal.aborted) return;
        playing = false; needsPlay = true;
      }
    }
    if (signal.aborted) return;
    if (shorter) playing = false;
    stage.style.aspectRatio = `${next.videoWidth} / ${next.videoHeight}`;
    describe(entries[index]);
    $('play').disabled = false; $('seek').disabled = false;
    status.textContent = shorter ? 'This version ends earlier; showing its final moment.' : needsPlay ? 'Ready. Tap Play to continue.' : '';
    controls();
  } catch (error) {
    if (signal.aborted) return;
    next.pause(); next.muted = true; wanted = active >= 0 ? active : index;
    // nothing replaced the previous passage's still picture: drop it rather than show the old song under the new controls
    if (active < 0) {playing = false; frameHold.hidden = true;}
    styleId = entries[wanted]?.id ?? styleId; controls();
    status.textContent = error.message;
  } finally {
    if (pending === controller) pending = null;
  }
}
async function changeGroup(index) {
  if (index === groupIndex) return;
  const available = groups[index].variants.map(id => entries.findIndex(e => e.id === id)).filter(i => i >= 0);
  if (!available.length) return;
  groupIndex = index; $('intent').textContent = groups[index].description ?? '';
  versionButtons();
  const preserved = available.find(i => entries[i].id === (entries[active]?.id ?? styleId));
  await select(preserved ?? available[0]);
}
async function changePassage(index) {
  if (index === passageIndex) return;
  pending?.abort();
  const previous = videos[active];
  if (previous) {
    savedRate = previous.playbackRate; savedVolume = previous.volume;
    // Keep a still picture during passage loading, without retaining its media
    // elements or sound. Different music deliberately starts a fresh clock.
    if (previous.readyState >= 2) {
      frameHold.width = previous.videoWidth; frameHold.height = previous.videoHeight;
      frameHold.getContext('2d').drawImage(previous, 0, 0); frameHold.hidden = false;
    }
  }
  for (const video of videos) {release(video); video.remove();}
  passageIndex = index; entries = passages[index].videos; active = -1; wanted = -1;
  // Preload is only a hint on mobile. Keep a user-gesture path to load/play
  // even before the first frame arrives (including after a failed preload).
  $('play').disabled = false; $('seek').disabled = true; $('seek').value = '0'; $('time').textContent = '0:00'; describe(null);
  $('passage-description').textContent = passages[index].description ?? '';
  if (groups.length && !entries.some(e => groups[groupIndex].variants.includes(e.id)))
    groupIndex = groups.findIndex(g => entries.some(e => g.variants.includes(e.id)));
  if (groups.length) $('intent').textContent = groups[groupIndex].description ?? '';
  videos = entries.map(() => {
    const video = document.createElement('video');
    video.preload = 'auto'; video.playsInline = true; video.loop = true; video.muted = true;
    video.setAttribute('aria-hidden', 'true');
    video.addEventListener('pause', () => {
      if (videos[active] === video && !pending && video.paused) {playing = false; controls();}
    });
    stage.append(video); return video;
  });
  versionButtons();
  const available = visibleIndexes(), preserved = available.find(i => entries[i].id === styleId);
  await select(preserved ?? available[0]);
}
async function togglePlay() {
  if (active < 0) {
    if (wanted < 0) return;
    playing = !playing; controls();
    if (playing) await select(wanted);
    else videos[wanted].pause();
    return;
  }
  const video = videos[active];
  playing = !playing;
  if (playing) {
    try {await video.play(); if (video === videos[active] && !pending) status.textContent = '';}
    catch (error) {if (video === videos[active]) {playing = false; status.textContent = error.message;}}
  } else {video.pause();}
  controls();
}
$('play').onclick = togglePlay;
$('sound').onclick = () => {muted = !muted; if (active >= 0) videos[active].muted = muted; controls();};
$('fullscreen').onclick = async () => {
  try {
    if (stage.requestFullscreen) await stage.requestFullscreen();
    else if (active >= 0 && videos[active].webkitEnterFullscreen) videos[active].webkitEnterFullscreen();
    else status.textContent = 'Fullscreen is unavailable in this browser.';
  } catch (error) {status.textContent = error.message;}
};
$('seek').oninput = () => {
  if (active < 0) return;
  // Seeking abandons a pending switch: the shown version is the selection again, and the abandoned one stops loading (it used to
  // stay the remembered style, so the next passage opened it, and its source kept buffering beside the active one).
  pending?.abort(); wanted = active; styleId = entries[active].id;
  videos.forEach((v, i) => {if (i !== active) release(v);});
  videos[active].currentTime = Number($('seek').value); status.textContent = ''; controls();
};
document.addEventListener('keydown', event => {
  if (event.target.closest('input,textarea,select,[contenteditable]') || event.altKey || event.ctrlKey || event.metaKey) return;
  if (event.code === 'Space') {event.preventDefault(); togglePlay();}
  if (videos.length && (event.code === 'ArrowLeft' || event.code === 'ArrowRight')) {
    event.preventDefault(); const visible = visibleIndexes(), position = Math.max(0, visible.indexOf(wanted));
    select(visible[(position + (event.code === 'ArrowRight' ? 1 : -1) + visible.length) % visible.length]);
  }
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
  const data = await response.json(); collectionUrl = url;
  const validVideos = list => Array.isArray(list) && list.length && list.every(e => e && typeof e.src === 'string' && typeof e.label === 'string');
  if (data.passages !== undefined) {
    passages = data.passages; groups = data.groups;
    if (!Array.isArray(passages) || !passages.length || passages.some(p => typeof p.id !== 'string' || typeof p.label !== 'string' || !validVideos(p.videos) || p.videos.some(v => typeof v.id !== 'string') || new Set(p.videos.map(v => v.id)).size !== p.videos.length))
      throw new Error('Each passage needs an id, label and videos with unique style ids.');
    if (!Array.isArray(groups) || !groups.length || groups.some(g => typeof g.id !== 'string' || typeof g.label !== 'string' || !Array.isArray(g.variants) || g.variants.length < 1 || g.variants.some(id => typeof id !== 'string') || new Set(g.variants).size !== g.variants.length))
      throw new Error('Each comparison group needs distinct style ids.');
    if (passages.some(p => !p.videos.some(v => groups.some(g => g.variants.includes(v.id)))))
      throw new Error('Every passage needs a video available in a comparison group.');
    $('study-controls').hidden = false;
    $('comparison-groups').hidden = groups.length === 1;
    groups.forEach((group, index) => {const b = document.createElement('button'); b.textContent = group.label; b.onclick = () => changeGroup(index); $('groups').append(b);});
    passages.forEach((passage, index) => {const b = document.createElement('button'); b.textContent = passage.label; b.onclick = () => changePassage(index); $('passages').append(b);});
  } else {
    if (!validVideos(data.videos)) throw new Error('Comparison needs a videos list with label and src for each version.');
    passages = [{id: 'default', label: '', videos: data.videos.map((entry, i) => ({...entry, id: entry.id ?? String(i)}))}];
  }
  $('title').textContent = data.title ?? 'Video comparison';
  if (data.description) $('intro').textContent = data.description;
  for (const link of data.links ?? []) {
    const target = new URL(link.href, url);
    if (!['http:', 'https:'].includes(target.protocol)) continue;
    const a = document.createElement('a'); a.href = target.href; a.textContent = link.label; $('related').append(a);
  }
  $('related').hidden = !$('related').children.length;
  const requestedPassage = new URLSearchParams(location.search).get('passage');
  const initialPassage = passages.findIndex(p => p.id === requestedPassage);
  await changePassage(Math.max(0, initialPassage)); tick();
} catch (error) {status.textContent = error.message;}
