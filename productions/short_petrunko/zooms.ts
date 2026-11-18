import type {ZoomLane} from '../../scripts/video/zooms.ts';

const lanes: ZoomLane[] = [
  {id: "doubling", name: "The pulse doubles",
    about: "Open a little when the tick becomes a drum, then open further when it doubles. Hold that width into the replies.",
    keyframes: [{t: 0.0, wide: 0.23}, {t: 10.81, wide: 0.23}, {t: 14.9, wide: 0.42}, {t: 16.94, wide: 0.42}, {t: 20.88, wide: 0.88}, {t: 22.52, wide: 0.95}]},
  {id: "suspension", name: "After the roll",
    about: "Draw closer as the roll gathers, then spend its silence opening into the returning drum. Stay wide across the answering bars.",
    keyframes: [{t: 0.0, wide: 0.49}, {t: 14.9, wide: 0.49}, {t: 19.84, wide: 0.28}, {t: 20.88, wide: 0.28}, {t: 22.51, wide: 0.98}, {t: 45.08, wide: 0.89}]},
];
export default lanes;
