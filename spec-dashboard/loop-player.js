/** "Watch the loop" in the spec dashboard: the finished film played as a platform that loops cleanly plays it, gapless.
 *
 * A `<video loop>` restarts its decoders at the end: in Chromium the sound drops out for 8–30 ms (digital silence) and the
 * picture holds for two to four frames, at the very join the loop system shapes. So here the sound is the film's own sound
 * track, decoded once and looped by Web Audio to the sample; it is the clock. The picture is two muted `<video>` elements of
 * the same film: one plays, the other waits on the first frame; on the frame the sound wraps they swap, so the first frame
 * is on screen at once, and the one that ran out goes back to the start to wait. Each frame keeps the playing one on the
 * sound's clock (a slight speed change; a seek only when far off). */
import { outputClock } from "../shared/playback.js";

const sounds = new Map(), START_AHEAD = 0.033;
/** The film's sound track, decoded once per film (url). */
function sound(context, url) {
  if (!sounds.has(url)) {
    sounds.set(url, fetch(url).then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.arrayBuffer();
    }).then((bytes) => context.decodeAudioData(bytes)));
    sounds.get(url).catch(() => sounds.delete(url));
  }
  return sounds.get(url);
}

/** A player on `primary` (the dashboard's video element) and `twin` (a second, hidden one), with sound on `context`. */
export function createLoopPlayer({ primary, twin, context: getContext }) {
  let context, buffer, length = 0, output, source, clock, run = null, stopped = 0, playing = false, ticket = 0, url = null, volume = 1;
  let active = primary, standby = twin, lap = 0;
  const wrap = (t) => ((t % length) + length) % length;
  /** Seconds into the loop (unwrapped) heard at performance time `ms`. */
  const elapsed = (ms) => {
    if (!run) return stopped;
    clock.read(context.getOutputTimestamp());
    const contextTime = clock.at(ms) ?? context.currentTime - (context.outputLatency || 0);
    return run.from + Math.max(0, contextTime - run.startedAt);
  };
  const stopSound = () => {
    if (source) {source.onended = null; source.stop(); source.disconnect();}
    source = undefined; run = null;
  };
  const startSound = (at) => {
    stopSound();
    if (!output) {output = context.createGain(); output.connect(context.destination);}
    output.gain.value = volume;
    source = context.createBufferSource();
    source.buffer = buffer; source.loop = true; source.loopStart = 0; source.loopEnd = length;
    source.connect(output);
    const startedAt = context.currentTime + 0.03;
    source.start(startedAt, at);
    run = { from: at, startedAt }; clock = outputClock();
  };
  /** Puts the picture at loop time `at`: the playing element there, the other one waiting on the first frame. */
  const place = (at) => {
    for (const v of [active, standby]) {v.muted = true; v.loop = false;}
    active.hidden = false; standby.hidden = true;
    if (Math.abs(active.currentTime - at) > 0.01) active.currentTime = at;
    standby.pause(); if (standby.currentTime !== 0) standby.currentTime = 0;
    active.playbackRate = 1;
  };
  const player = {
    get paused() {return !playing;},
    /** Loop time (s, 0 to the film's length) heard at performance time `ms` (now by default). */
    position(ms = performance.now()) {return length ? wrap(elapsed(ms)) : 0;},
    /** Starts the film `src` at `at` s (clamped into it); resolves once it plays. Must come from a user gesture. */
    async start(src, at) {
      const n = ++ticket;
      stopped = Math.max(0, at);
      context ??= getContext();
      const resumed = context.resume();
      if (url !== src) {
        url = src; buffer = undefined;
        if (twin.getAttribute("src") !== src) twin.src = src;
        twin.preload = "auto";
      }
      buffer = await sound(context, src);
      await resumed;
      if (n !== ticket) return;
      // the sound track as long as the picture: a decoder that keeps the codec's padding gives a few ms more
      length = Math.min(buffer.duration, primary.duration || buffer.duration);
      at = Math.max(0, Math.min(at, length - 0.05));
      place(at);
      playing = true; startSound(at); lap = 0;
      await active.play().catch(() => {});
    },
    /** Pauses on the moment heard, or plays on from it. */
    toggle() {
      if (!url || !buffer) return;
      if (playing) {
        stopped = wrap(elapsed(performance.now())); stopSound(); playing = false;
        active.pause(); active.currentTime = stopped;
      } else {
        playing = true; place(stopped); startSound(stopped); lap = 0;
        void context.resume(); active.play().catch(() => {});
      }
    },
    /** Moves to loop time `at`, playing on if playing. */
    seek(at) {
      if (!url || !buffer) return;
      at = Math.max(0, Math.min(at, length - 0.05)); stopped = at; place(at);
      if (playing) {startSound(at); lap = 0; active.play().catch(() => {});}
    },
    set volume(value) {volume = value; if (output) output.gain.value = value;},
    /** Ends the loop: the sound stops, the dashboard's element is shown at the moment heard (returned), muted and paused. */
    stop() {
      ticket++;
      const at = !url ? primary.currentTime : run ? wrap(elapsed(performance.now())) : stopped;
      stopSound(); playing = false; url = null;
      twin.pause(); twin.hidden = true;
      if (active !== primary) {[active, standby] = [primary, twin];}
      primary.pause(); primary.hidden = false;
      if (Number.isFinite(at)) primary.currentTime = at;
      return at;
    },
    /** Each animation frame: `shown` the performance time this frame reaches the screen. Swaps the elements on the frame
     * the sound wraps, and keeps the playing one on the sound's clock. */
    frame(shown) {
      if (!url || !playing || !run || !length) return;
      // half a video frame early: the frame on screen is the one nearest the sound heard
      const t = elapsed(shown) + 1 / 120, n = Math.floor(t / length), at = t - n * length;
      if (n !== lap && standby.readyState < 2) {
        // the waiting element is not ready (still loading): the playing one goes back to the start itself
        lap = n; active.currentTime = at;
        return;
      }
      if (n !== lap) {
        lap = n;
        // the waiting element is on the first frame: show it and play it; the other goes back to wait
        [active, standby] = [standby, active];
        if (at > 0.25) active.currentTime = at;
        active.hidden = false; active.playbackRate = 1;
        active.play().catch(() => {});
        standby.hidden = true; standby.pause(); standby.currentTime = 0;
        return;
      }
      // a starting element takes a few frames to move: the waiting one starts, hidden, just before the join
      if (length - at < START_AHEAD && standby.paused && standby.readyState >= 2) standby.play().catch(() => {});
      if (active.paused || active.seeking || active.readyState < 2) return;
      const off = at - active.currentTime;
      if (Math.abs(off) > 0.25) active.currentTime = at;
      else active.playbackRate = Math.abs(off) < 0.015 ? 1 : 1 + Math.max(-0.08, Math.min(0.08, off * 2));
    },
  };
  return player;
}
