/**
 * Montagem Tomada (super slowed, 60 s selection): zoom lanes. Each follows one thing in the music; a ride is given one of them
 * from its id. A lane is keyframes {t, wide}: song seconds, and how wide the picture is from 0 (closest) to 1 (widest), on the
 * scale every song shares (scripts/video/zoom.js). Nothing is written for the last three seconds: there the picture pulls back
 * to the whole course. Times are the song's (composition.json).
 *
 * The song: a light figure with sparse drum answers (to 4.35), the body with the bass (4.354–16.1), a long passage of voice
 * without drums (17.334), the bass returning under it (26.378), a swell (35.677) and the drum return (37.013) to the end.
 */
import type {ZoomLane} from '../../scripts/video/zooms.ts';
const zooms: ZoomLane[] = [
  {id: 'handover', name: 'Drums wide, voice close',
    about: 'Follows the handover. The body opens the picture; the voice alone brings it close, the bass returning under her opens it a little; the swell starts to open it and the drum return completes it at once.',
    keyframes: [{t: 0, wide: 0.55}, {t: 4.1, wide: 0.55}, {t: 4.6, wide: 0.8}, {t: 16.07, wide: 0.8}, {t: 17.6, wide: 0.35}, {t: 26.2, wide: 0.35},
      {t: 27.4, wide: 0.45}, {t: 35.68, wide: 0.45}, {t: 36.76, wide: 0.6}, {t: 37.26, wide: 0.95}]},
  {id: 'held', name: 'Held breath',
    about: 'Follows tension. The body sits a little wide; from the voice\'s entry the picture closes in slowly through the whole drumless passage, closest as the bass swells; the swell starts to open it and the return opens it to the widest.',
    keyframes: [{t: 0, wide: 0.55}, {t: 4.1, wide: 0.55}, {t: 4.6, wide: 0.7}, {t: 16.07, wide: 0.7}, {t: 35.68, wide: 0.25}, {t: 36.76, wide: 0.5},
      {t: 37.26, wide: 0.95}]},
];
export default zooms;
