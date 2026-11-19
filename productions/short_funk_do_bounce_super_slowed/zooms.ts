import type {ZoomLane} from '../../scripts/video/zooms.ts';

const lanes: ZoomLane[] = [
  {id: "rattle", name: "After the rattle",
    about: "Draw away from the roll to reveal the restarting bass. Come closer over the calls and let the drummer open the picture again, so the tall regular bounces have room from the first step.",
    keyframes: [{t: 0.0, wide: 0.38}, {t: 1.89, wide: 0.38}, {t: 3.84, wide: 0.74}, {t: 9.82, wide: 0.74}, {t: 12.57, wide: 0.39}, {t: 13.59, wide: 0.86}]},
  {id: "answer", name: "The upper answer",
    about: "Keep the drum stride's bounce at a steady middle width. Open into the high offbeats, ease a little for the broad arcs of the upper phrase, and draw closer as the ball comes to rest.",
    keyframes: [{t: 0.0, wide: 0.47}, {t: 20.9, wide: 0.47}, {t: 22.3, wide: 0.72}, {t: 32.7, wide: 0.72}, {t: 35.5, wide: 0.62}, {t: 41.0, wide: 0.62}, {t: 42.95, wide: 0.42}]},
];
export default lanes;
