/** Opt-in browser diagnostics. Import from the local review server, then call
 * installPlaybackProbe({panel: true}). Nothing runs until explicitly installed.
 * Captures timings locally; no network requests or playback controls. */
const stats = values => {
  const a = values.filter(Number.isFinite).sort((x, y) => x - y);
  if (!a.length) return {count: 0};
  return {count: a.length, min: a[0], median: a[Math.floor(a.length / 2)],
    p95: a[Math.floor(a.length * .95)], p99: a[Math.floor(a.length * .99)], max: a.at(-1)};
};

/** Distinguish late animation callbacks, media-clock jumps, and video drops.
 * Video callback gaps alone do not establish dropped presentation frames. */
export function summarizeCapture({frames = [], videoFrames = {}, events = []}) {
  const adjacent = frames.slice(1).map((f, i) => [frames[i], f]).filter(([a, b]) => a.playing && b.playing &&
    a.visible === 'visible' && b.visible === 'visible' && a.rate === b.rate);
  const intervals = adjacent.map(([a, b]) => b.ts - a.ts);
  return {
    callbacks: frames.length, playingCallbacks: frames.filter(f => f.playing).length,
    callbackIntervalMs: stats(intervals), callbackWorkMs: stats(frames.filter(f => f.playing).map(f => f.cost)),
    callbackDelayMs: stats(frames.filter(f => f.playing).map(f => f.entered - f.ts)),
    // Includes explicit seeks/loops; use events and markers to interpret outliers.
    poseStepErrorMs: stats(adjacent.map(([a, b]) => 1000 * (b.pose - a.pose) - (b.ts - a.ts) * b.rate)),
    intervalsOver25ms: intervals.filter(x => x > 25).length,
    videos: Object.fromEntries(Object.entries(videoFrames).map(([id, samples]) => {
      if (!samples.length) return [id, {callbacks: 0}];
      const pairs = samples.slice(1).map((f, i) => [samples[i], f]).filter(([a, b]) => a.source === b.source &&
        b.presentedFrames >= a.presentedFrames && b.dropped >= a.dropped);
      return [id, {callbacks: samples.length,
        presentedBetweenCallbacks: pairs.reduce((n, [a, b]) => n + b.presentedFrames - a.presentedFrames, 0),
        droppedVideoFrames: pairs.reduce((n, [a, b]) => n + b.dropped - a.dropped, 0),
        skippedCallbacks: pairs.reduce((n, [a, b]) => n + Math.max(0, b.presentedFrames - a.presentedFrames - 1), 0),
        displayCallbackIntervalMs: stats(samples.slice(1).map((f, i) => f.expectedDisplayTime - samples[i].expectedDisplayTime))}];
    })),
    mediaEvents: Object.fromEntries([...new Set(events.map(e => e.type))].map(type => [type, events.filter(e => e.type === type).length])),
  };
}

export function installPlaybackProbe({panel = false, maxFrames = 18000} = {}) {
  const w = window;
  if (w.linePlaybackProbe) return w.linePlaybackProbe;
  if (!Number.isInteger(maxFrames) || maxFrames < 1) throw new Error('maxFrames must be a positive integer');
  let active = false, disposed = false, pose, audio, capture, controls;
  const cleanup = [], now = () => w.performance.now();
  const listen = (target, type, fn) => {target.addEventListener(type, fn); cleanup.push(() => target.removeEventListener(type, fn));};
  const reset = () => {capture = {schema: 'line.playback-profile.v1', page: w.location.pathname + w.location.search,
    startedAt: new Date().toISOString(), started: now(), environment: {userAgent: w.navigator.userAgent,
      pixelRatio: w.devicePixelRatio, viewport: [w.innerWidth, w.innerHeight], windowPosition: [w.screenX, w.screenY]},
    frames: [], videoFrames: {}, events: [], longTasks: [], longFrames: [], markers: [], visibility: []};};
  reset();
  const ui = () => {if (controls) controls.state.textContent = active ? 'Recording locally' : 'Stopped';};
  const api = {
    start() {if (disposed) throw new Error('Probe was disposed'); reset(); active = true;
      if (controls) controls.mark.textContent = 'Mark stutter'; ui();},
    stop() {active = false; capture.ended = now(); ui(); return api.snapshot();},
    mark(label = 'Visible stutter') {if (active) capture.markers.push({at: now(), pose, label});
      if (controls) controls.mark.textContent = `Mark stutter (${capture.markers.length})`;},
    snapshot() {return {...capture, summary: summarizeCapture(capture)};},
    download() {
      const url = w.URL.createObjectURL(new Blob([JSON.stringify(api.snapshot())], {type: 'application/json'}));
      const a = w.document.createElement('a'); a.href = url; a.download = 'line-playback-profile.json'; a.click();
      w.setTimeout(() => w.URL.revokeObjectURL(url), 1000);
    },
    dispose() {active = false; disposed = true; for (const fn of cleanup.reverse()) fn(); controls?.root.remove(); delete w.linePlaybackProbe;},
  };
  w.linePlaybackProbe = api;

  // Capture the exact value before the production slider rounds it. Do not
  // change the player's audio clock or interpolate its recorded measurements.
  const input = w.HTMLInputElement.prototype, value = Object.getOwnPropertyDescriptor(input, 'value');
  const setter = function (v) {if (this.id === 'seek') pose = Number(v); value.set.call(this, v);};
  Object.defineProperty(input, 'value', {...value, set: setter});
  cleanup.push(() => {if (Object.getOwnPropertyDescriptor(input, 'value').set === setter) Object.defineProperty(input, 'value', value);});
  const context = w.AudioContext?.prototype, output = context?.getOutputTimestamp;
  if (output) {
    const read = function () {const t = output.call(this); if (active) audio = {...t, readAt: now(), rendered: this.currentTime,
      baseLatency: this.baseLatency, outputLatency: this.outputLatency, state: this.state}; return t;};
    context.getOutputTimestamp = read;
    cleanup.push(() => {if (context.getOutputTimestamp === read) context.getOutputTimestamp = output;});
  }
  const raf = w.requestAnimationFrame;
  const wrapped = callback => raf.call(w, ts => {
    const entered = now(), playing = w.document.getElementById('play')?.textContent === 'Pause';
    callback(ts);
    if (!active || callback.name !== 'tick') return;
    capture.frames.push({ts, entered, cost: now() - entered, playing, pose, audio, visible: w.document.visibilityState,
      rate: Number(w.document.getElementById('rate')?.value ?? 1)});
    if (capture.frames.length >= maxFrames) {capture.limitReached = true; api.stop();}
  });
  w.requestAnimationFrame = wrapped;
  cleanup.push(() => {if (w.requestAnimationFrame === wrapped) w.requestAnimationFrame = raf;});
  for (const type of ['longtask', 'long-animation-frame']) if (w.PerformanceObserver?.supportedEntryTypes.includes(type)) {
    const observer = new w.PerformanceObserver(list => {if (active) for (const e of list.getEntries())
      (type === 'longtask' ? capture.longTasks : capture.longFrames).push(e.toJSON());});
    observer.observe({type}); cleanup.push(() => observer.disconnect());
  }
  listen(w.document, 'visibilitychange', () => {if (active) capture.visibility.push({at: now(), state: w.document.visibilityState});});
  for (const id of ['left', 'right']) {
    const video = w.document.getElementById(id);
    if (!video?.requestVideoFrameCallback) continue;
    let request;
    const frame = (at, meta) => {
      if (disposed) return;
      if (active) {
        const samples = capture.videoFrames[id] ??= [];
        samples.push({at, ...meta, source: video.currentSrc, rate: video.playbackRate,
          dropped: video.getVideoPlaybackQuality().droppedVideoFrames});
        if (samples.length >= maxFrames) {capture.limitReached = true; api.stop();}
      }
      request = video.requestVideoFrameCallback(frame);
    };
    request = video.requestVideoFrameCallback(frame); cleanup.push(() => video.cancelVideoFrameCallback(request));
    for (const type of ['seeking', 'seeked', 'waiting', 'playing', 'pause', 'ratechange', 'emptied']) listen(video, type, () => {
      if (active) capture.events.push({at: now(), id, type, time: video.currentTime, rate: video.playbackRate});
    });
  }
  // This panel exists only in an explicitly instrumented tab. It does not
  // start/stop the ride, alter sound, or send captured data anywhere.
  if (panel) {
    const root = w.document.createElement('aside');
    root.setAttribute('aria-label', 'Playback diagnostics');
    root.style.cssText = 'position:fixed;bottom:12px;right:12px;z-index:9999;padding:10px;background:#fff;color:#172d27;border:1px solid #789;border-radius:8px;box-shadow:0 2px 12px #0002;font:13px system-ui;display:flex;gap:8px;align-items:center';
    const state = w.document.createElement('span'); root.append(state);
    const button = (label, action) => {const b = w.document.createElement('button'); b.textContent = label; b.onclick = action; root.append(b); return b;};
    button('Record', api.start); const mark = button('Mark stutter', () => api.mark()); button('Stop', api.stop);
    button('Save JSON', api.download); button('Close', api.dispose);
    controls = {root, state, mark}; w.document.body.append(root); ui();
  }
  return api;
}
