/**
 * L'amour de ma vie (44.5 s cut): zoom lanes. Each follows one thing in the music; a ride is given one of them from its id.
 * A lane is keyframes {t, wide}: song seconds, and how wide the picture is from 0 (closest) to 1 (widest), on the scale
 * every song shares (scripts/video/zoom.js). Nothing is written for the last three seconds: there the picture pulls back to
 * the whole course. Times are the song's (music.ts).
 *
 * The song: the voice alone (to 3.25), the drums enter with three kicks (3.251) in a syncopated groove of runs and rests;
 * the voice sings alone in a few rests (10.275, 15.604, 23.766); the hook (17–24); a break where the voice holds a word
 * alone (24.3–25.25); the re-entry (25.252) into the same groove, the loudest stretch of the cut, to the end.
 */
import type {ZoomLane} from '../../scripts/video/zooms.ts';
const zooms: ZoomLane[] = [
  {id: 'words', name: 'Leans in for her words',
    about: 'Follows the voice between the drums. Close for the sung intro; the drums open the picture; in each rest where she sings alone it comes a little closer and steps back for the drums; it stays close for the held word of the break, and the re-entry opens it wide.',
    keyframes: [{t: 0, wide: 0.35}, {t: 3.0, wide: 0.35}, {t: 3.5, wide: 0.75}, {t: 9.78, wide: 0.75}, {t: 10.28, wide: 0.55}, {t: 10.6, wide: 0.55},
      {t: 11.6, wide: 0.75}, {t: 15.1, wide: 0.75}, {t: 15.6, wide: 0.55}, {t: 15.9, wide: 0.55}, {t: 16.9, wide: 0.75}, {t: 23.27, wide: 0.75},
      {t: 23.77, wide: 0.5}, {t: 25.0, wide: 0.45}, {t: 25.5, wide: 0.85}]},
  {id: 'break', name: 'Pushes in to the break',
    about: 'Follows tension. The drums open the picture; through the first groove and the hook it slowly closes in, closest for the held word of the break; the re-entry opens it at once, so the loudest stretch plays in the widest picture.',
    keyframes: [{t: 0, wide: 0.35}, {t: 3.0, wide: 0.35}, {t: 3.5, wide: 0.8}, {t: 8.0, wide: 0.8}, {t: 24.24, wide: 0.4}, {t: 25.0, wide: 0.35},
      {t: 25.5, wide: 0.95}]},
];
export default zooms;
