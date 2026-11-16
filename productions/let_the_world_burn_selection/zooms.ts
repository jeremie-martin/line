/**
 * Let the World Burn (59 s selection): zoom lanes. Each follows one thing in the music; a ride is given one of them from its
 * id. A lane is keyframes {t, wide}: song seconds, and how wide the picture is from 0 (closest) to 1 (widest), on the scale
 * every song shares (scripts/video/zoom.js). Nothing is written for the last three seconds: there the picture pulls back to
 * the whole course. Times are the song's (composition.json).
 *
 * The song: a quiet vocal pickup rising (to 4.48), the last chorus with the drums (4.481–44.2) in which the voice holds
 * (24.46) and then climbs (34.15), the drums falling away and the voice alone (44.94), its last words (54) and release.
 */
import type {ZoomLane} from '../../scripts/video/zooms.ts';
const zooms: ZoomLane[] = [
  {id: 'close', name: "Out for the chorus, then in with the voice",
    about: "The vocal rise carries the picture out to the last chorus. From the held vocal it closes slowly, all the way, until the voice is alone.",
    keyframes: [{t: 0, wide: 0.4}, {t: 3.3, wide: 0.4}, {t: 4.58, wide: 0.9}, {t: 24, wide: 0.9}, {t: 34.15, wide: 0.7}, {t: 44.94, wide: 0.45}, {t: 54, wide: 0.2}, {t: 56, wide: 0.2}]},
  {id: 'voice', name: "Follows the voice",
    about: "Out for the chorus; in for the held vocal, a little out again when the voice goes up, and in close when it is alone.",
    keyframes: [{t: 0, wide: 0.5}, {t: 3.3, wide: 0.5}, {t: 4.58, wide: 0.8}, {t: 22, wide: 0.95}, {t: 22.5, wide: 0.95}, {t: 26, wide: 0.6}, {t: 33.1, wide: 0.6}, {t: 34.25, wide: 0.75}, {t: 40.94, wide: 0.75}, {t: 44.94, wide: 0.35}, {t: 54, wide: 0.35}]},
];
export default zooms;
