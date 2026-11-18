import type {ZoomLane} from '../../scripts/video/zooms.ts';

const lanes: ZoomLane[] = [
  {id: "weight", name: "Weight of the low beat",
    about: "Open gently across the quickening words, saving the last large step for the arrival of the low drum. Keep that width through the F refrain.",
    keyframes: [{t: 0.0, wide: 0.31}, {t: 10.99, wide: 0.31}, {t: 14.56, wide: 0.55}, {t: 15.7, wide: 0.55}, {t: 16.41, wide: 0.94}]},
  {id: "answer", name: "Space for the F",
    about: "Hold the first return at middle distance. Lean nearer as the F emerges, then widen with the heavier low downbeats of the last wave.",
    keyframes: [{t: 0.0, wide: 0.39}, {t: 15.25, wide: 0.39}, {t: 16.44, wide: 0.66}, {t: 23.26, wide: 0.66}, {t: 28.32, wide: 0.44}, {t: 34.86, wide: 0.44}, {t: 37.63, wide: 0.88}]},
];
export default lanes;
