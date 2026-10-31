/** Playback for the review pages (docs/research/playback-20261031.md).
 *
 * A production ride plays its music through Web Audio, whose output timestamp
 * says which sample the speakers play at a given performance.now(), so each
 * animation frame draws the ride at the music position heard when that frame
 * reaches the screen. Pair clips are videos with their own sound: the sounding
 * clip keeps the browser's audio–video sync and leads, and the other shows the
 * same frame (compared from requestVideoFrameCallback) by waiting or catching
 * up through its playback rate, never by seeking while playing, which stalls a
 * video. */

/** Music position (s) heard at audio context time `contextTime` from a source
 * started at context time `startedAt` at position `from` and `rate`. Until its
 * first sample is heard, `from`. */
export function heard({from, startedAt, rate}, contextTime) {
  return from + Math.max(0, contextTime - startedAt) * rate;
}

/** Audio context time being heard at performance time `ms`, from the context's
 * output timestamps. A timestamp can pair the start of the audio block being
 * played with the moment it was read (Firefox: blocks of 10–20 ms), so it
 * lags by up to a block; the context clock never jumps, so the freshest pairing
 * over the last second is the clock. */
export function outputClock() {
  const readings = [];
  return {
    read({contextTime, performanceTime}) {
      if (!performanceTime) return;  // not playing out yet
      readings.push([performanceTime, contextTime - performanceTime / 1000]);
      while (performanceTime - readings[0][0] > 1000) readings.shift();
    },
    at(ms) {
      if (!readings.length) return undefined;
      let offset = -Infinity;
      for (const [, x] of readings) offset = Math.max(offset, x);
      return offset + ms / 1000;
    },
  };
}

/** Decoded music on the audio hardware clock. */
export function createMusic() {
  let context, buffer, source, clock, loads = 0, run = {from: 0, startedAt: 0, rate: 1};
  const stop = () => {if (source) {source.onended = null; source.stop(); source = undefined;}};
  const music = {
    async load(bytes) {
      const n = ++loads; stop(); buffer = undefined;
      context ??= new AudioContext();
      const decoded = await context.decodeAudioData(bytes);
      if (n === loads) buffer = decoded;
    },
    clear() {loads++; stop(); buffer = undefined;},
    /** Plays from position `from` (s); the first call must come from a user gesture. */
    async play(from, rate, onended) {
      stop();
      const resumed = context.resume();
      source = context.createBufferSource(); source.buffer = buffer; source.playbackRate.value = rate;
      source.connect(context.destination); source.onended = onended;
      await resumed;
      run = {from, startedAt: context.currentTime, rate}; clock = outputClock(); source.start(0, from);
    },
    /** Stops and returns the position heard now. */
    pause() {const at = music.position(performance.now()); stop(); run = {from: at, startedAt: 0, rate: 1}; return at;},
    /** Position heard at performance time `ms`. */
    position(ms) {
      if (!source) return run.from;
      clock.read(context.getOutputTimestamp());
      const contextTime = clock.at(ms);
      return contextTime === undefined ? run.from : Math.min(buffer.duration, heard(run, contextTime));
    },
  };
  return music;
}

/** Performance time at which a frame drawn in the animation frame at `ts` is on
 * screen: the next refresh (the shortest recent interval between frames). */
export function displayTime() {
  const gaps = []; let previous;
  return ts => {
    if (previous !== undefined && ts > previous) {gaps.push(ts - previous); if (gaps.length > 30) gaps.shift();}
    previous = ts;
    return ts + (gaps.length ? Math.min(...gaps) : 1000 / 60);
  };
}

/** The frame a video presented last (requestVideoFrameCallback metadata), or
 * undefined since it was paused, seeked or emptied. */
export function lastFrame(video) {
  let frame;
  for (const type of ['seeking', 'pause', 'emptied']) video.addEventListener(type, () => {frame = undefined;});
  const watch = (_, presented) => {frame = presented; video.requestVideoFrameCallback(watch);};
  video.requestVideoFrameCallback?.(watch);
  return () => frame;
}

/** Leader − follower (s) as seen on screen at performance time `now`. Each
 * clip shows its last presented frame while that frame is current (shown
 * within 50 ms); a paused clip, or one whose first frame is waiting for its
 * sound to start, is at its currentTime. */
export function shownGap(leader, follower, now) {
  const shown = ({frame, time, paused}) => !paused && frame && now - frame.expectedDisplayTime < 50 ? frame.mediaTime : time;
  return shown(leader) - shown(follower);
}

/** What a muted follower does to show the leader's frame: 'play' at the base
 * rate, 'wait' (rate 0: held, and resumed on the next frame, unlike pause and
 * play), 'catch' up 5 % faster, or 'seek'. `gap` is leader − follower as shown
 * (s) and `mode` what the follower is doing now. Shown frames can differ by one
 * for a refresh (a late frame under load), so it acts only on a gap of more
 * than a frame and a half (25 ms) and then keeps going until level: ahead (the
 * leader's sound starting after a loop or an unmute), it waits for the leader;
 * behind, it catches up. More than 0.25 s apart (a clip still loading), it seeks. */
export function follow(gap, mode) {
  if (Math.abs(gap) > 0.25) return 'seek';
  if (mode === 'wait' ? gap < 0 : gap < -0.025) return 'wait';
  if (mode === 'catch' ? gap > 0 : gap > 0.025) return 'catch';
  return 'play';
}
