import type {ZoomLane} from '../../scripts/video/zooms.ts';

const lanes: ZoomLane[] = [
  {id: "rattle", name: "After the rattle",
    about: "Draw away from the roll to reveal the restarting bass. Come closer over the calls and let the drummer open the picture again.",
    keyframes: [{t: 0.0, wide: 0.38}, {t: 1.89, wide: 0.38}, {t: 3.84, wide: 0.74}, {t: 9.82, wide: 0.74}, {t: 12.57, wide: 0.39}, {t: 13.59, wide: 0.86}]},
  {id: "answer", name: "The upper answer",
    about: "Keep the broad drum stride steady. Open as its high offbeats take over, then draw closer to the independent treble phrase.",
    keyframes: [{t: 0.0, wide: 0.47}, {t: 18.96, wide: 0.47}, {t: 24.45, wide: 0.76}, {t: 29.94, wide: 0.76}, {t: 36.65, wide: 0.39}]},
];
export default lanes;
