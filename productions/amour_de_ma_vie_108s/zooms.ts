/**
 * L'amour de ma vie (108.5 s, the full cut): zoom lanes. Each follows one thing in the music; a ride is given one of them from
 * its id. A lane is keyframes {t, wide}: song seconds, and how wide the picture is from 0 (closest) to 1 (widest), on the
 * scale every song shares (scripts/video/zoom.js). Nothing is written for the last three seconds: there the picture pulls back
 * to the whole course. Times are the song's (music.ts).
 *
 * The song: the voice alone (to 3.25), the drums' groove with words alone in its rests (10.286, 15.604, 23.766), a break
 * (24.3) and re-entry (25.252) into the loudest stretch, a fill and groove B (46.579) whose lift (57) ends with the drums
 * stopping (64.935); then 24 s of calm, bass and voice (65–89), light drums with a swell (89.2, 94.575), and the voice
 * thinning out to the fade (97.3–105).
 */
import type {ZoomLane} from '../../scripts/video/zooms.ts';
const zooms: ZoomLane[] = [
  {id: 'words', name: 'Leans in for her words',
    about: 'Follows the voice between the drums. The drums open the picture; in each rest where she sings alone it comes a little closer and steps back; the break stays close and the re-entry opens it wide. When the drums stop it comes in for the long calm, opens a little for the light drums, and settles close for the voice at the end.',
    keyframes: [{t: 0, wide: 0.35}, {t: 3.0, wide: 0.35}, {t: 3.5, wide: 0.75}, {t: 9.79, wide: 0.75}, {t: 10.29, wide: 0.55}, {t: 10.6, wide: 0.55},
      {t: 11.6, wide: 0.75}, {t: 15.1, wide: 0.75}, {t: 15.6, wide: 0.55}, {t: 15.9, wide: 0.55}, {t: 16.9, wide: 0.75}, {t: 23.27, wide: 0.75},
      {t: 23.77, wide: 0.5}, {t: 25.0, wide: 0.45}, {t: 25.5, wide: 0.85}, {t: 47.1, wide: 0.85}, {t: 47.6, wide: 0.65}, {t: 47.9, wide: 0.65},
      {t: 48.9, wide: 0.85}, {t: 57.76, wide: 0.85}, {t: 58.26, wide: 0.65}, {t: 58.56, wide: 0.65}, {t: 59.56, wide: 0.85}, {t: 64.9, wide: 0.85},
      {t: 68.0, wide: 0.4}, {t: 89.0, wide: 0.4}, {t: 90.5, wide: 0.55}, {t: 97.0, wide: 0.55}, {t: 99.0, wide: 0.4}]},
  {id: 'arc', name: 'The drums leave',
    about: 'Follows the song\'s long shape, with no sudden change. The picture opens slowly through the first groove, again through the second and its lift, and is widest as the drums stop; it closes in slowly over the calm, opens a little for the light drums and their swell, and comes back in for the voice at the end.',
    keyframes: [{t: 0, wide: 0.3}, {t: 3.25, wide: 0.3}, {t: 25.25, wide: 0.75}, {t: 46.58, wide: 0.75}, {t: 64.9, wide: 1}, {t: 72.0, wide: 0.3},
      {t: 89.2, wide: 0.3}, {t: 94.6, wide: 0.5}, {t: 97.3, wide: 0.5}, {t: 103.0, wide: 0.3}]},
];
export default zooms;
