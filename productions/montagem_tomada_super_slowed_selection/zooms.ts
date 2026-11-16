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
  {id: 'swell', name: "The swell opens it",
    about: "A step out into the body, in for the voice; the last bars of the voice and the swell carry the picture out to the drum return.",
    keyframes: [{t: 0, wide: 0.4}, {t: 3, wide: 0.4}, {t: 4.35, wide: 0.7}, {t: 17.33, wide: 0.7}, {t: 20.5, wide: 0.4}, {t: 34, wide: 0.4}, {t: 37.01, wide: 0.9}, {t: 55, wide: 0.9}]},
  {id: 'long', name: "One breath in, one breath out",
    about: "Slowly in through the whole first voice passage, slowly out through the second, arriving wide at the drum return.",
    keyframes: [{t: 0, wide: 0.5}, {t: 4.35, wide: 0.6}, {t: 17.33, wide: 0.6}, {t: 26.38, wide: 0.3}, {t: 37.01, wide: 0.85}, {t: 55, wide: 0.85}]},
];
export default zooms;
