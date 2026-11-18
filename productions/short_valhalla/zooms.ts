import type {ZoomLane} from '../../scripts/video/zooms.ts';

const lanes: ZoomLane[] = [
  {id: 'register', name: "The high refrain",
    about: "Open into the first kick, draw in as the lower voice occupies the verse, and lift into the high refrain over the roll.",
    keyframes: [{t: 0, wide: 0.38}, {t: 0.5, wide: 0.38}, {t: 1.25, wide: 0.82}, {t: 10.26, wide: 0.82}, {t: 16.14, wide: 0.44}, {t: 36.37, wide: 0.44}, {t: 40.55, wide: 0.56}, {t: 42.61, wide: 0.86}]},
  {id: 'drum', name: "The drum sentence",
    about: "Frame the uneven kick pairs broadly. The clipped percussion thins at the end of the low verse, then its roll opens the picture.",
    keyframes: [{t: 0, wide: 0.55}, {t: 1.28, wide: 0.74}, {t: 30.27, wide: 0.74}, {t: 34.49, wide: 0.65}, {t: 40.58, wide: 0.6}, {t: 41.39, wide: 0.6}, {t: 42.6, wide: 0.96}]},
];
export default lanes;
