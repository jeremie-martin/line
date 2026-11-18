import type {ZoomLane} from '../../scripts/video/zooms.ts';

const lanes: ZoomLane[] = [
  {id: "vowels", name: "Space around the vowels",
    about: "Keep the first calls near, then widen over the drum reply and the end of the exposed pickup.",
    keyframes: [{t: 0.0, wide: 0.29}, {t: 7.89, wide: 0.29}, {t: 11.4, wide: 0.48}, {t: 14.92, wide: 0.48}, {t: 15.89, wide: 0.85}]},
  {id: "refrain", name: "The returning refrain",
    about: "Give the duet one middle distance until the clearer sung hook repeats and widens the returning phrase.",
    keyframes: [{t: 0.0, wide: 0.39}, {t: 14.35, wide: 0.39}, {t: 15.92, wide: 0.62}, {t: 31.65, wide: 0.62}, {t: 36.95, wide: 0.81}, {t: 44.23, wide: 0.81}]},
];
export default lanes;
