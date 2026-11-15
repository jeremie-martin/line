/**
 * Los Voltaje (ultra slowed, 60 s selection): zoom lanes. Each follows one thing in the music; a ride is given one of them from
 * its id. A lane is keyframes {t, wide}: song seconds, and how wide the picture is from 0 (closest) to 1 (widest), on the scale
 * every song shares (scripts/video/zoom.js). Nothing is written for the last three seconds: there the picture pulls back to the
 * whole course. Times are the song's (composition.json).
 *
 * The song: no groove tail in this cut; the voice over soft drums from the start, a phrase (5.68) that quickens (11.32) over a
 * gap in the drums, then the broad return (16.289) to the end, where a short three-stroke answer comes every 10.6 s (20.93,
 * 31.54, 42.16, 52.77) and a synth joins from about 27.4.
 */
import type {ZoomLane} from '../../scripts/video/zooms.ts';
const zooms: ZoomLane[] = [
  {id: 'held', name: 'Held breath',
    about: 'Follows tension. The voice starts a little close; as the phrase quickens the picture closes in, closest just before the return, which opens it at once to the widest.',
    keyframes: [{t: 0, wide: 0.45}, {t: 5.68, wide: 0.45}, {t: 14.0, wide: 0.25}, {t: 16.04, wide: 0.25}, {t: 16.54, wide: 0.95}]},
  {id: 'answers', name: 'A step at each answer',
    about: 'Follows the drums\' short three-stroke answers. Close for the voice; the return opens the picture halfway, and each answer pushes it a step wider, widest at the last.',
    keyframes: [{t: 0, wide: 0.4}, {t: 16.04, wide: 0.4}, {t: 16.54, wide: 0.6}, {t: 20.83, wide: 0.6}, {t: 21.53, wide: 0.7}, {t: 31.44, wide: 0.7},
      {t: 32.14, wide: 0.8}, {t: 42.06, wide: 0.8}, {t: 42.76, wide: 0.9}, {t: 52.67, wide: 0.9}, {t: 53.37, wide: 1}]},
];
export default zooms;
