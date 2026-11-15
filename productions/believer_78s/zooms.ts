/**
 * Believer (78.5 s): zoom lanes. Each follows one thing in the music; a ride is given one of them from its id.
 * A lane is keyframes {t, wide}: song seconds, and how wide the picture is from 0 (closest) to 1 (widest), on the scale
 * every song shares (scripts/video/zoom.js). Nothing is written for the last three seconds: there the picture pulls back to
 * the whole course. Times are the song's (music.ts).
 *
 * The song: a stomp in bars of 1.92 s from 0.43, the same from first bar to last; every fourth bar is a stop (kick and snare,
 * three guitar notes in the gap, then a downbeat alone): bars starting 6.19, 13.87, 21.55, 29.23, 36.91, 44.59, 52.27, 59.95,
 * 67.63. Verse (0.43), denser verse (15.79), pre-chorus (31.15), the drums stop for a bar (46.51), "Pain!" and the chorus
 * (48.43), where a second percussion layer joins from 61.87.
 */
import type {ZoomLane} from '../../scripts/video/zooms.ts';
/** A stop bar starting at s: the picture leans in over the bar and steps back as the next downbeat (s + 1.92) lands. */
const stop = (s: number, base: number, lean: number) =>
  [[0, base], [1.0, lean], [1.7, lean], [2.15, base]].map(([dt, wide]) => ({t: +(s + dt).toFixed(2), wide}));
const zooms: ZoomLane[] = [
  {id: 'stops', name: 'A breath at every stop',
    about: 'Follows the stomp\'s stop bars. In every fourth bar, when the toms and the pickup fall silent, the picture comes a little closer, and it steps back as the next downbeat lands alone. The last stop before the chorus runs into the break and stays close; "Pain!" opens the picture, and the chorus keeps the same breath one step wider.',
    keyframes: [{t: 0, wide: 0.5}, ...stop(6.19, 0.5, 0.33), ...stop(13.87, 0.5, 0.33), ...stop(21.55, 0.5, 0.33), ...stop(29.23, 0.5, 0.33),
      ...stop(36.91, 0.5, 0.33), {t: 44.59, wide: 0.5}, {t: 45.59, wide: 0.33}, {t: 48.2, wide: 0.33}, {t: 48.65, wide: 0.9},
      ...stop(52.27, 0.9, 0.72), ...stop(59.95, 0.9, 0.72), ...stop(67.63, 0.9, 0.72)]},
  {id: 'chorus', name: 'Opens for the chorus',
    about: 'Follows the form. Close-ish for the verses and their fast words; through the pre-chorus the picture slowly closes in, closest when the drums stop; "Pain!" opens it at once, and it opens once more when the second percussion layer joins the chorus.',
    keyframes: [{t: 0, wide: 0.4}, {t: 31.15, wide: 0.4}, {t: 46.51, wide: 0.25}, {t: 48.2, wide: 0.25}, {t: 48.65, wide: 0.85}, {t: 61.6, wide: 0.85},
      {t: 62.4, wide: 1}]},
];
export default zooms;
