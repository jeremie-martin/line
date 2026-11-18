import type {ZoomLane} from '../../scripts/video/zooms.ts';

const lanes: ZoomLane[] = [
  {id: 'pain', name: "Two bass notes",
    about: "Close in through the rush of words. The two isolated bass notes open the picture into Pain!",
    keyframes: [{t: 0, wide: 0.52}, {t: 7.3, wide: 0.52}, {t: 15.92, wide: 0.34}, {t: 20.27, wide: 0.34}, {t: 21.78, wide: 0.6}, {t: 22.75, wide: 0.94}]},
  {id: 'voices', name: "From one voice to the whole chorus",
    about: "Hold on the triplets, then widen with the last rising line. A second opening belongs to the extra percussion.",
    keyframes: [{t: 0, wide: 0.38}, {t: 12.99, wide: 0.38}, {t: 19.76, wide: 0.56}, {t: 21.72, wide: 0.57}, {t: 22.79, wide: 0.78}, {t: 34.63, wide: 0.78}, {t: 36.16, wide: 0.97}]},
];
export default lanes;
