import type {ZoomLane} from '../../scripts/video/zooms.ts';

const lanes: ZoomLane[] = [
  {id: "doublets", name: "Two syllables",
    about: "Open into the swing so its high arcs have room, draw in over its last measures, only partly so the exposed words can float, and open on the shared word and drum.",
    keyframes: [{t: 0.0, wide: 0.33}, {t: 8.2, wide: 0.43}, {t: 12.45, wide: 0.69}, {t: 24.4, wide: 0.69}, {t: 26.85, wide: 0.47}, {t: 28.4, wide: 0.47}, {t: 29.03, wide: 0.8}]},
  {id: "broken", name: "Weight of the broken drums",
    about: "The two low accents first broaden the picture. Reserve its full width for the broken drums after the link, opening across the shared word that leads into them.",
    keyframes: [{t: 0.0, wide: 0.41}, {t: 7.19, wide: 0.41}, {t: 8.31, wide: 0.61}, {t: 25.29, wide: 0.61}, {t: 27.9, wide: 0.48}, {t: 29.5, wide: 0.88}]},
];
export default lanes;
