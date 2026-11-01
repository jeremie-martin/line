/** Playback for the review pages and the spec dashboard
 * (docs/research/playback-20261031.md).
 *
 * Music plays through Web Audio, whose output timestamp says which sample the
 * speakers play at a given performance.now(), so each animation frame draws the
 * ride or cursor at the music position heard when that frame reaches the screen. Pair studies use a single combined video with native audio/video sync. */

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

/** Decoded music on the audio hardware clock. Playback runs on the audio
 * context's clock, so a position before or after the music, or with no music
 * loaded, plays as silence on the same clock. */
export function createMusic() {
  let context, buffer, source, clock, run, stopped = 0, loads = 0, plays = 0;
  const stopSource = () => {source?.stop(); source = undefined;};
  const music = {
    get duration() {return buffer?.duration;},
    get playing() {return !!run;},
    get context() {return context;},
    async load(bytes) {
      const n = ++loads; buffer = undefined;
      context ??= new AudioContext();
      const decoded = await context.decodeAudioData(bytes);
      if (n === loads) buffer = decoded;
    },
    clear() {loads++; music.pause(); buffer = undefined;},
    /** Plays from position `from` (s) at `rate`; the first call must come from a user
     * gesture. A later play or pause cancels it while the audio is still resuming. */
    async play(from, rate = 1) {
      const n = ++plays; stopSource(); run = undefined;
      context ??= new AudioContext();
      await context.resume();
      if (n !== plays) return;
      run = {from, startedAt: context.currentTime, rate}; clock = outputClock();
      if (buffer && from < buffer.duration) {
        source = context.createBufferSource(); source.buffer = buffer; source.playbackRate.value = rate;
        source.connect(context.destination);
        source.start(music.when(Math.max(0, from)), Math.max(0, from));
      }
    },
    /** Stops and returns the position heard now. */
    pause() {plays++; stopped = music.position(performance.now()); stopSource(); run = undefined; return stopped;},
    /** Position heard at performance time `ms`. */
    position(ms) {
      if (!run) return stopped;
      clock.read(context.getOutputTimestamp());
      const contextTime = clock.at(ms);
      return contextTime === undefined ? run.from : heard(run, contextTime);
    },
    /** Position being rendered now: heard after the output latency. */
    rendered() {return run ? heard(run, context.currentTime) : stopped;},
    /** Audio context time at which position `at` plays, to schedule sounds with the music. */
    when(at) {return run.startedAt + (at - run.from) / run.rate;},
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
