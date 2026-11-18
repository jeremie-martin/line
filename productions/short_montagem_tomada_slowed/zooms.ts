import type {ZoomLane} from '../../scripts/video/zooms.ts';

const lanes: ZoomLane[] = [
  {id: 'seven', name: "Seven strokes",
    about: "The upper phrase fills the frame by its loudest repeat and recedes as its strokes soften.",
    keyframes: [{t: 0, wide: 0.41}, {t: 2.9, wide: 0.41}, {t: 6.9, wide: 0.68}, {t: 8.8, wide: 0.68}, {t: 14.8, wide: 0.38}, {t: 16.6, wide: 0.38}, {t: 17.98, wide: 0.83}]},
  {id: 'return', name: "When the drums arrive",
    about: "Hold close through the unaccompanied figure. The sung pickup opens onto the drum entrance.",
    keyframes: [{t: 0, wide: 0.43}, {t: 15.39, wide: 0.43}, {t: 16.54, wide: 0.51}, {t: 17.55, wide: 0.62}, {t: 17.96, wide: 0.94}, {t: 24.18, wide: 0.94}, {t: 27.05, wide: 0.77}]},
];
export default lanes;
