import type {ZoomLane} from '../../scripts/video/zooms.ts';

const lanes: ZoomLane[] = [
  {id: "breath", name: "The one-bar breath",
    about: "Let the groove sit at middle distance, drawing in gently through the held voice and settling back over the next phrase.",
    keyframes: [{t: 0.0, wide: 0.32}, {t: 4.7, wide: 0.48}, {t: 19.92, wide: 0.48}, {t: 24.24, wide: 0.41}, {t: 30.59, wide: 0.50}]},
  {id: "voice", name: "Keep the singer near",
    about: "Hold near through the opening line and ease outward over the syncopations. Come closer again as the groove eases.",
    keyframes: [{t: 0.0, wide: 0.29}, {t: 4.02, wide: 0.29}, {t: 12.59, wide: 0.54}, {t: 25.25, wide: 0.64}, {t: 34.26, wide: 0.64}, {t: 40.25, wide: 0.41}]},
];
export default lanes;
