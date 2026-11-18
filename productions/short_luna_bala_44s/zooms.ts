import type {ZoomLane} from '../../scripts/video/zooms.ts';

const lanes: ZoomLane[] = [
  {id: "breath", name: "Voice into bass",
    about: "Hold near across the break in the sentence, opening with its second line to give the first bass note room.",
    keyframes: [{t: 0.0, wide: 0.3}, {t: 4.5, wide: 0.3}, {t: 6.96, wide: 0.44}, {t: 8.72, wide: 0.91}]},
  {id: "toms", name: "The four toms",
    about: "Settle at medium width for the groove. Draw in over the bass departure and open with the last upper reply before the re-entry.",
    keyframes: [{t: 0.0, wide: 0.34}, {t: 7.31, wide: 0.34}, {t: 8.74, wide: 0.72}, {t: 20.88, wide: 0.72}, {t: 24.7, wide: 0.41}, {t: 25.51, wide: 0.41}, {t: 26.17, wide: 0.88}]},
];
export default lanes;
