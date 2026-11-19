import type {ZoomLane} from '../../scripts/video/zooms.ts';

const lanes: ZoomLane[] = [
  {id: 'pain', name: "Two bass notes",
    about: "Close in over the low quick run of the triplets. The last snare opens the picture for the tall bounds across the empty beat, and the two bass notes open the rest into Pain!",
    keyframes: [{t: 0, wide: 0.52}, {t: 7.3, wide: 0.52}, {t: 11.0, wide: 0.36}, {t: 18.9, wide: 0.36}, {t: 19.86, wide: 0.62}, {t: 20.9, wide: 0.62}, {t: 22.75, wide: 0.94}]},
  {id: 'voices', name: "From one voice to the whole chorus",
    about: "Hold on the triplets, then widen with the last rising line so the great leap starts with room, and open further for Pain! A second opening belongs to the extra percussion.",
    keyframes: [{t: 0, wide: 0.38}, {t: 12.99, wide: 0.38}, {t: 19.86, wide: 0.6}, {t: 21.72, wide: 0.6}, {t: 22.75, wide: 0.78}, {t: 34.63, wide: 0.78}, {t: 36.16, wide: 0.97}]},
];
export default lanes;
