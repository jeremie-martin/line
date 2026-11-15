/**
 * Amor na Praia (slowed, 46 s): zoom lanes. Each follows one thing in the music; a ride is given one of them from its id.
 * A lane is keyframes {t, wide}: song seconds, and how wide the picture is from 0 (closest) to 1 (widest), on the scale
 * every song shares (scripts/video/zoom.js). Nothing is written for the last three seconds: there the picture pulls back to
 * the whole course. Times are the song's (music.ts).
 *
 * The song: a whispered intro over one 808 (to 4.46), the burst of the 808 alone (4.46–7.9, the loudest hits), a breath
 * with the voice alone (7.9–9.1), the drop (9.125) into an even four-on-the-floor groove, a hole filled by a sung "hey"
 * (26.29), the re-drop (26.726) and the same groove to the fade (43.3). After the drop nothing builds: it is one level.
 */
import type {ZoomLane} from '../../scripts/video/zooms.ts';
const zooms: ZoomLane[] = [
  {id: 'entries', name: 'Each entry opens',
    about: 'Follows the stops and the entries. Close for the whispered intro; the burst opens the picture at once; the breath with the voice alone comes back in; the drop opens it wide; the hole draws in a little and the re-drop opens it to the widest.',
    keyframes: [{t: 0, wide: 0.3}, {t: 4.2, wide: 0.3}, {t: 4.66, wide: 0.8}, {t: 7.76, wide: 0.8}, {t: 8.5, wide: 0.4}, {t: 8.9, wide: 0.4},
      {t: 9.35, wide: 0.9}, {t: 26.18, wide: 0.9}, {t: 26.6, wide: 0.75}, {t: 26.73, wide: 0.75}, {t: 27.15, wide: 0.95}]},
  {id: 'tides', name: 'Two long tides',
    about: 'Follows the long shape, with no sudden change. The picture opens slowly from the intro through the burst; over the even groove it keeps opening; before the hole it breathes back in, and the second groove opens it again to the end.',
    keyframes: [{t: 0, wide: 0.25}, {t: 3.9, wide: 0.25}, {t: 9.6, wide: 0.6}, {t: 24.0, wide: 0.95}, {t: 26.7, wide: 0.6}, {t: 41.5, wide: 1}]},
];
export default zooms;
