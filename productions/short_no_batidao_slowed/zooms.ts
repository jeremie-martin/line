import type {ZoomLane} from '../../scripts/video/zooms.ts';

const lanes: ZoomLane[] = [
  {id: "signal", name: "Upper signal",
    about: "Open a little before the bright signal so its high float and the rolling ball after it have room, then draw in for the singer and stay close on the low run home.",
    keyframes: [{t: 0.0, wide: 0.44}, {t: 3.2, wide: 0.44}, {t: 4.9, wide: 0.62}, {t: 20.32, wide: 0.62}, {t: 25.62, wide: 0.4}]},
  {id: "low", name: "Low voice",
    about: "Give the exposed low voice a closer frame and let its final pickup reopen the returning drums by a modest amount.",
    keyframes: [{t: 0.0, wide: 0.52}, {t: 21.3, wide: 0.52}, {t: 26.23, wide: 0.32}, {t: 29.76, wide: 0.32}, {t: 31.54, wide: 0.61}]},
];
export default lanes;
