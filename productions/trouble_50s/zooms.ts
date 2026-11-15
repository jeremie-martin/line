/**
 * Trouble: zoom lanes. Each follows one thing in the music; a ride is given one of them from its id.
 * A lane is keyframes {t, wide}: song seconds, and how wide the picture is from 0 (closest) to 1 (widest), on the scale
 * every song shares (scripts/video/zoom.js). Nothing is written for the last three seconds: there the picture pulls back to
 * the whole course. Times are the song's (music.ts).
 *
 * The song: a quiet voice intro (to 14.71), a 3-3-2 groove, a short break (27.6), the drop (29.02) with heavy kicks in a
 * stop-and-go, two climbing triples (34.40, 41.56), a vocal break (43.4), and last kicks climbing from 46.95. The owner liked
 * the step at each triple and found the plain lane reasonable; the voice lane was too close on the voice, and is eased here.
 */
import type {ZoomLane} from '../../scripts/video/zooms.ts';
const zooms: ZoomLane[] = [
  {id: 'kicks', name: 'A step at each triple',
    about: 'Follows the heavy kicks. The picture drifts toward the voice through the intro, and after the drop it steps wider at each climbing triple of kicks, then widens as the last kicks begin (they run into the ending, where the picture pulls back anyway).',
    keyframes: [{t: 0, wide: 0.45}, {t: 14.0, wide: 0.25}, {t: 14.31, wide: 0.25}, {t: 15.11, wide: 0.55}, {t: 28.6, wide: 0.55}, {t: 28.82, wide: 0.55}, {t: 29.22, wide: 0.7}, {t: 34.34, wide: 0.7}, {t: 35.14, wide: 0.85}, {t: 41.5, wide: 0.85}, {t: 42.3, wide: 1}, {t: 43.2, wide: 1}, {t: 44.4, wide: 0.5}, {t: 46.6, wide: 0.55}, {t: 47.6, wide: 0.85}]},
  {id: 'who', name: 'Voice close, drums wide',
    about: 'Follows who is playing. Closer for the voice, at the start and in the vocal break; wider for the groove; the break draws in, and the drop opens the picture at once.',
    keyframes: [{t: 0, wide: 0.3}, {t: 14.11, wide: 0.3}, {t: 15.31, wide: 0.6}, {t: 27.6, wide: 0.6}, {t: 28.2, wide: 0.45}, {t: 28.82, wide: 0.45}, {t: 29.22, wide: 1}, {t: 43.0, wide: 1}, {t: 44.2, wide: 0.45}, {t: 46.55, wide: 0.45}, {t: 47.35, wide: 0.85}]},
  {id: 'plain', name: 'Section by section',
    about: 'The lane the spec has carried since the first videos: one gentle move per section, wider for the groove and the drop.',
    keyframes: [{t: 0, wide: 0.17}, {t: 14.71, wide: 0.52}, {t: 29.02, wide: 0.76}, {t: 43.4, wide: 0.37}, {t: 46.95, wide: 0.59}]},
];
export default zooms;
