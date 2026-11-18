import type {ZoomLane} from '../../scripts/video/zooms.ts';

const lanes: ZoomLane[] = [
  {id: "doublets", name: "Two syllables",
    about: "Give the paired syllables a held middle distance, drawing nearer over the final pair to meet the exposed call.",
    keyframes: [{t: 0.0, wide: 0.33}, {t: 8.2, wide: 0.43}, {t: 12.45, wide: 0.69}, {t: 23.22, wide: 0.69}, {t: 27.39, wide: 0.35}, {t: 28.4, wide: 0.35}, {t: 29.03, wide: 0.8}]},
  {id: "broken", name: "Weight of the broken drums",
    about: "The two low accents first broaden the picture. Reserve its full width for the broken drums after the link.",
    keyframes: [{t: 0.0, wide: 0.41}, {t: 7.19, wide: 0.41}, {t: 8.31, wide: 0.61}, {t: 25.29, wide: 0.61}, {t: 28.4, wide: 0.48}, {t: 30.23, wide: 0.88}]},
];
export default lanes;
