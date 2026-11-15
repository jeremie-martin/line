/**
 * Valhalla (40 s): zoom lanes. Each follows one thing in the music; a ride is given one of them from its id.
 * A lane is keyframes {t, wide}: song seconds, and how wide the picture is from 0 (closest) to 1 (widest), on the scale
 * every song shares (scripts/video/zoom.js). Nothing is written for the last three seconds: there the picture pulls back to
 * the whole course. Times are the song's (music.ts).
 *
 * The song: the voice alone in long held notes (to 9.3), a lone drum hit (9.32), sung phrases with fast runs of words, a
 * second lone kick (19.69), more phrases, a quiet gap (27.5–29.37) and one syllable, then the drop (30.06), the loudest hit,
 * into a ten-second groove.
 */
import type {ZoomLane} from '../../scripts/video/zooms.ts';
const zooms: ZoomLane[] = [
  {id: 'drop', name: 'Waits for the drop',
    about: 'Follows the drums announcing themselves. Close on the held notes; each lone drum hit opens the picture a step; the quiet gap draws it back in, and the drop opens it to the widest at once.',
    keyframes: [{t: 0, wide: 0.3}, {t: 9.1, wide: 0.3}, {t: 9.55, wide: 0.42}, {t: 19.47, wide: 0.42}, {t: 19.92, wide: 0.54}, {t: 27.5, wide: 0.54},
      {t: 29.4, wide: 0.4}, {t: 29.81, wide: 0.4}, {t: 30.31, wide: 1}]},
  {id: 'held', name: 'Held breath',
    about: 'Follows tension. Wide for the long held notes far apart; through the sung phrases the picture slowly closes in, closest in the quiet gap; the drop opens it at once, so the loudest hit lands in the widest picture.',
    keyframes: [{t: 0, wide: 0.6}, {t: 9.97, wide: 0.6}, {t: 27.5, wide: 0.3}, {t: 29.37, wide: 0.2}, {t: 29.81, wide: 0.2}, {t: 30.31, wide: 1}]},
];
export default zooms;
