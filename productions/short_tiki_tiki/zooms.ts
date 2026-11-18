import type {ZoomLane} from '../../scripts/video/zooms.ts';

const lanes: ZoomLane[] = [
  {id: "breath", name: "From the breath",
    about: "Hold on the solo words and drift wider after the breath. Finish the opening over the cut before the first big kick.",
    keyframes: [{t: 0.0, wide: 0.23}, {t: 5.27, wide: 0.23}, {t: 8.7, wide: 0.43}, {t: 9.64, wide: 0.45}, {t: 10.58, wide: 0.91}, {t: 38.3, wide: 0.91}, {t: 44.44, wide: 0.39}]},
  {id: "booms", name: "Two boom repeats",
    about: "Keep the first groove at middle width. Draw in over its last bar, then use the two quieter booms to lead out into the run.",
    keyframes: [{t: 0.0, wide: 0.35}, {t: 7.0, wide: 0.35}, {t: 10.59, wide: 0.68}, {t: 20.9, wide: 0.68}, {t: 25.25, wide: 0.4}, {t: 26.12, wide: 0.4}, {t: 27.98, wide: 0.93}, {t: 41.78, wide: 0.93}, {t: 44.8, wide: 0.6}]},
];
export default lanes;
