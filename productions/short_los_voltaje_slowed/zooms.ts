import type {ZoomLane} from '../../scripts/video/zooms.ts';

const lanes: ZoomLane[] = [
  {id: "vowels", name: "Space around the vowels",
    about: "Keep the first calls near, then widen over the drum reply and the end of the exposed pickup.",
    keyframes: [{t: 0.0, wide: 0.29}, {t: 7.89, wide: 0.29}, {t: 11.4, wide: 0.48}, {t: 14.92, wide: 0.48}, {t: 15.89, wide: 0.85}]},
  {id: "refrain", name: "The returning refrain",
    about: "Give the duet one middle distance until the clearer sung hook repeats and widens the returning phrase.",
    keyframes: [{t: 0.0, wide: 0.39}, {t: 14.35, wide: 0.39}, {t: 15.92, wide: 0.62}, {t: 31.65, wide: 0.62}, {t: 36.95, wide: 0.81}, {t: 44.23, wide: 0.81}]},
  {id: "fuse", name: "Close on the fuse",
    about: "Come in as the quick voice starts its low flat run, hold close over the fuse, then open sharply into the first kick that the blend throws into space; a last small step gives the taller hook swing room.",
    keyframes: [{t: 0.0, wide: 0.4}, {t: 9.9, wide: 0.4}, {t: 11.67, wide: 0.24}, {t: 15.25, wide: 0.24}, {t: 15.88, wide: 0.8}, {t: 33.0, wide: 0.8}, {t: 34.48, wide: 0.9}]},
];
export default lanes;
