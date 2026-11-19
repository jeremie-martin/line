import type {ZoomLane} from '../../scripts/video/zooms.ts';

const lanes: ZoomLane[] = [
  {id: "gap", name: "Across the gap",
    about: "Hold the first words at conversational distance. Broaden with the uneven kicks, then open from just before the exposed E, so its tall hang has room, into the low drop.",
    keyframes: [{t: 0.0, wide: 0.38}, {t: 12.54, wide: 0.38}, {t: 14.82, wide: 0.55}, {t: 26.9, wide: 0.55}, {t: 29.14, wide: 0.9}]},
  {id: "triples", name: "Room for the triples",
    about: "Come a little closer while the rider runs flat under the small drum strokes, open for the high exposed E and G, then give each heavy triple another small step outward.",
    keyframes: [{t: 0.0, wide: 0.41}, {t: 13.85, wide: 0.41}, {t: 15.38, wide: 0.55}, {t: 17.9, wide: 0.55}, {t: 19.6, wide: 0.42}, {t: 26.9, wide: 0.42}, {t: 28.1, wide: 0.64}, {t: 32.61, wide: 0.64}, {t: 34.51, wide: 0.76}, {t: 39.78, wide: 0.76}, {t: 41.63, wide: 0.88}]},
];
export default lanes;
