/** Experimental interpretations of shared native observations. Not a judge or
 * compiler objective. Construction labels and line identities are not inputs.
 */
import {localPeaks} from './ride_accents.ts';
export type InteractionFrame = {frame: number; correction: number; contact: boolean};
export type Interaction = {start: number; end: number; peakFrame: number; peak: number; responseSum: number};

function validate(frames: readonly InteractionFrame[]) {
  for (const [i, f] of frames.entries()) {
    if (!Number.isSafeInteger(f.frame) || (i > 0 && f.frame !== frames[i - 1].frame + 1) ||
      !Number.isFinite(f.correction) || f.correction < 0 || typeof f.contact !== 'boolean') throw new Error('invalid interaction observations');
  }
}
function summarize(frames: readonly InteractionFrame[], start: number, end: number): Interaction {
  const xs = frames.slice(start, end + 1);
  const peak = xs.reduce((a, b) => b.correction > a.correction ? b : a);
  return {start: frames[start].frame, end: frames[end].frame, peakFrame: peak.frame,
    peak: peak.correction, responseSum: xs.reduce((s, f) => s + f.correction, 0)};
}

/** B: maximal runs of actual contact by ANY rider point. The hole allowance is
 * explicit: bridging one airborne frame can merge two visible engagements.
 * No strength floor: quiet contacts remain observations too.
 */
export function contactEpisodes(frames: readonly InteractionFrame[], holes = 0): Interaction[] {
  validate(frames);
  if (!Number.isSafeInteger(holes) || holes < 0) throw new Error('invalid hole allowance');
  const result: Interaction[] = [];
  let first = -1, last = -1;
  for (let i = 0; i < frames.length; i++) if (frames[i].contact) {
    if (first >= 0 && i - last > holes + 1) {result.push(summarize(frames, first, last)); first = -1;}
    if (first < 0) first = i;
    last = i;
  }
  if (first >= 0) result.push(summarize(frames, first, last));
  return result;
}

export type PulseOptions = {floor: number; valleyFraction: number; edgeFraction: number};
export const DEFAULT_PULSE: PulseOptions = {floor: .5, valleyFraction: .4, edgeFraction: .2};
/** C: local response peaks near current/prior contact, merged if the intervening
 * trough stays above a fraction of the weaker peak. Edge threshold describes
 * extent; it is not the strength calibration. All choices remain study parameters.
 */
export function responsePulses(frames: readonly InteractionFrame[], options: PulseOptions = DEFAULT_PULSE): Interaction[] {
  validate(frames);
  const {floor, valleyFraction, edgeFraction} = options;
  if (!Number.isFinite(floor) || floor < 0 || !(valleyFraction > 0 && valleyFraction <= 1) ||
    !(edgeFraction > 0 && edgeFraction <= valleyFraction)) throw new Error('invalid pulse parameters');
  const values = frames.map(f => f.correction);
  const peaks = localPeaks(values).filter(p => p.value >= floor && (frames[p.frame].contact || frames[p.frame - 1]?.contact));
  const groups: typeof peaks[] = [];
  for (const p of peaks) {
    const group = groups.at(-1), prior = group?.at(-1);
    const trough = prior ? Math.min(...values.slice(prior.frame, p.frame + 1)) : 0;
    if (prior && trough >= valleyFraction * Math.min(prior.value, p.value)) group!.push(p);
    else groups.push([p]);
  }
  const troughIndex = (a: number, b: number) => {
    let best = a; for (let f = a + 1; f <= b; f++) if (values[f] < values[best]) best = f; return best;
  };
  return groups.map((g, i) => {
    let first = g[0].frame, last = g.at(-1)!.frame;
    const left = i ? troughIndex(groups[i - 1].at(-1)!.frame, first) + 1 : 0;
    const right = i + 1 < groups.length ? troughIndex(last, groups[i + 1][0].frame) : frames.length - 1;
    const edge = edgeFraction * Math.max(...g.map(p => p.value));
    while (first > left && values[first - 1] >= edge) first--;
    while (last < right && values[last + 1] >= edge) last++;
    return summarize(frames, first, last);
  });
}

/** Monotone one-to-one association. Maximize matches inside an explicit time
 * window, then minimize absolute timing error. Unmatched events/beats and all
 * alternative eligible edges stay visible. No force-fitting to the nearest beat.
 */
export function matchInteractions(events: readonly Interaction[], beatFrames: readonly number[], tolerance: number, clock: 'start' | 'peakFrame' = 'start') {
  if (!Number.isFinite(tolerance) || tolerance < 0 || beatFrames.some((f, i) => !Number.isFinite(f) || (i > 0 && f < beatFrames[i - 1])) ||
    events.some((e, i) => !Number.isFinite(e[clock]) || (i > 0 && e[clock] < events[i - 1][clock]))) throw new Error('invalid matching inputs');
  const n = events.length, m = beatFrames.length, width = m + 1;
  const count = new Int32Array((n + 1) * width), cost = new Float64Array(count.length), choice = new Uint8Array(count.length);
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) {
    const k = i * width + j, up = k - width, left = k - 1;
    let from = up, how = 1;
    if (count[left] > count[from] || (count[left] === count[from] && cost[left] < cost[from])) {from = left; how = 2;}
    count[k] = count[from]; cost[k] = cost[from]; choice[k] = how;
    const distance = Math.abs(events[i - 1][clock] - beatFrames[j - 1]), diagonal = up - 1;
    if (distance <= tolerance && (count[diagonal] + 1 > count[k] || (count[diagonal] + 1 === count[k] && cost[diagonal] + distance <= cost[k]))) {
      count[k] = count[diagonal] + 1; cost[k] = cost[diagonal] + distance; choice[k] = 3;
    }
  }
  const pairs: {event: number; beat: number; offsetFrames: number}[] = [];
  let i = n, j = m;
  while (i && j) {
    const c = choice[i * width + j];
    if (c === 3) {pairs.push({event: i - 1, beat: j - 1, offsetFrames: events[i - 1][clock] - beatFrames[j - 1]}); i--; j--;}
    else if (c === 1) i--; else j--;
  }
  pairs.reverse();
  const eligible = events.map(e => beatFrames.flatMap((f, b) => Math.abs(e[clock] - f) <= tolerance ? [b] : []));
  return {clock, tolerance, pairs, eligible,
    unmatchedEvents: events.flatMap((_, e) => pairs.some(p => p.event === e) ? [] : [e]),
    unmatchedBeats: beatFrames.flatMap((_, b) => pairs.some(p => p.beat === b) ? [] : [b])};
}
