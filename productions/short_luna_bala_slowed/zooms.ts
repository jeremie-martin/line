import type {ZoomLane} from '../../scripts/video/zooms.ts';

const lanes: ZoomLane[] = [
  {id: "breath", name: "Inside the breath",
    about: "Ease near over the faint voice and stay there through its break. The last quick syllables open onto the five strokes.",
    keyframes: [{t: 0.0, wide: 0.49}, {t: 5.64, wide: 0.32}, {t: 11.32, wide: 0.23}, {t: 14.35, wide: 0.23}, {t: 15.55, wide: 0.86}]},
  {id: "answers", name: "Low replies",
    about: "Give the upper figure a middle distance until the bass returns beneath it, widening through the exposed strokes.",
    keyframes: [{t: 0.0, wide: 0.34}, {t: 13.83, wide: 0.34}, {t: 16.26, wide: 0.65}, {t: 30.16, wide: 0.65}, {t: 32.99, wide: 0.91}]},
];
export default lanes;
