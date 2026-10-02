/** Research definitions over a shared physical observation. These are compared
 * before selecting a versioned compiler contract; none changes frozen scoring. */
import {contactEpisodes, responsePulses, type Interaction} from './interaction_candidates.ts';

export type Vector = readonly [number, number];
export type ImpactObservation = {
  frame: number; contact: boolean; incoming: Vector; effective: Vector;
  visible: Vector; position: Vector;
  normals?: readonly Vector[];
};
export function redirection(a: Vector, b: Vector): number {
  const sa = Math.hypot(...a), sb = Math.hypot(...b);
  if (sa < 1e-10 || sb < 1e-10) return 0;
  return .5 * (sa + sb) * Math.abs(Math.atan2(a[0] * b[1] - a[1] * b[0], a[0] * b[0] + a[1] * b[1]));
}
export type ResponseSignal = 'visible' | 'solver' | 'stored' | 'path' | 'effective';
export function responseSignal(frames: readonly ImpactObservation[], signal: ResponseSignal): number[] {
  return frames.map((f, i) => !i ? 0 : signal === 'visible' ? redirection(frames[i - 1].visible, f.visible) :
    signal === 'solver' ? redirection(f.incoming, f.effective) : signal === 'effective' ? redirection(frames[i - 1].effective, f.effective) : signal === 'path' ?
      (frames[i + 1] ? redirection(f.incoming, frames[i + 1].incoming) : 0) : redirection(frames[i - 1].incoming, f.incoming));
}
export type CandidateImpact = Interaction & {raw: number; support: number; concentration: number};
export type CandidateOptions = {
  grouping: 'engagement' | 'pulse' | 'surface'; signal: ResponseSignal; window: number;
  strength: 'sum' | 'net' | 'concentrated'; valley: number;
  onsetFraction?: number;
};
/** Complete contact gaps are always boundaries. Within sustained contact the
 * pulse arm tests response valleys; it never uses rail roles or segment IDs.
 * Quiet engagements remain available without a global response threshold. */
export function candidateImpacts(frames: readonly ImpactObservation[], options: CandidateOptions): CandidateImpact[] {
  const signal = responseSignal(frames, options.signal), response = responseSignal(frames, 'solver'), offset = frames[0]?.frame ?? 0;
  const source = frames.map((f, i) => ({frame: f.frame, contact: f.contact, correction: signal[i]}));
  let episodes = contactEpisodes(source);
  if (options.grouping === 'surface') {
    // A brief contact hole on the same oriented surface can be chatter. An
    // opposed receiver remains separate even with a one-frame flight. Normals
    // come from actual collision geometry; line IDs/roles are not compared.
    const grouped: typeof episodes = [];
    for (const e of episodes) {
      const prior = grouped.at(-1), a = prior && frames[prior.end - offset].normals, b = frames[e.start - offset].normals;
      const compatible = a?.length && b?.length && b.every(n => a.some(m => n[0] * m[0] + n[1] * m[1] >= Math.SQRT1_2));
      if (prior && e.start - prior.end <= 3 && compatible) {
        prior.end = e.end; prior.responseSum += e.responseSum;
        if (e.peak > prior.peak) {prior.peak = e.peak; prior.peakFrame = e.peakFrame;}
      } else grouped.push({...e});
    }
    episodes = grouped;
  }
  const intervals: Interaction[] = [];
  for (const episode of episodes) {
    if (options.grouping !== 'pulse') {intervals.push(episode); continue;}
    const part = source.slice(episode.start - offset, episode.end - offset + 1);
    // Include zero-valued bookends so a first/last-frame maximum is observable.
    const padded = [{frame: episode.start - 1, contact: false, correction: 0}, ...part,
      {frame: episode.end + 1, contact: false, correction: 0}];
    const pulses = responsePulses(padded, {floor: 1e-9, valleyFraction: options.valley, edgeFraction: Math.min(.2, options.valley)});
    if (!pulses.length) intervals.push(episode);
    else for (const [i, p] of pulses.entries()) intervals.push({...p,
      // Preserve a quiet approach at the episode onset; expose peak time too.
      start: i ? p.start : episode.start,
      end: i + 1 === pulses.length ? episode.end : p.end});
  }
  return intervals.map(event => {
    let first = event.start - offset;
    if (options.onsetFraction) {
      const through = Math.min(event.end - offset, first + 6), threshold = options.onsetFraction * Math.max(...response.slice(first, through + 1));
      while (first < through && response[first] < threshold) first++;
    }
    const last = Math.min(event.end - offset, first + options.window - 1);
    const values = signal.slice(first, last + 1).map((x, i) => frames[first + i].contact ? x : 0), sum = values.reduce((s, x) => s + x, 0);
    const peak = Math.max(0, ...values), concentration = sum ? peak / sum : 0;
    const initial = options.signal === 'visible' ? frames[Math.max(0, first - 1)].visible : frames[first].incoming;
    const final = options.signal === 'visible' ? frames[last].visible : frames[last].effective;
    // The net arm deliberately tests cancellation; the concentrated arm tests
    // a duration discount. Neither is assumed preferable to accumulation.
    const raw = options.strength === 'net' ? redirection(initial, final) :
      options.strength === 'concentrated' ? sum * Math.min(1, options.window / (event.end - event.start + 1)) : sum;
    return {...event, start: frames[first].frame, raw, support: last - first + 1, concentration};
  });
}
