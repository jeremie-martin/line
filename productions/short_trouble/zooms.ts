import type {ZoomLane} from '../../scripts/video/zooms.ts';

const lanes: ZoomLane[] = [
  {id: "gap", name: "Across the gap",
    about: "Hold the first words at conversational distance. Broaden with the uneven kicks, then open through the short vocal break into the low drop.",
    keyframes: [{t: 0.0, wide: 0.38}, {t: 12.54, wide: 0.38}, {t: 14.82, wide: 0.55}, {t: 27.25, wide: 0.55}, {t: 29.14, wide: 0.9}]},
  {id: "triples", name: "Room for the triples",
    about: "Keep the bass anticipations readable at medium width and give each heavy triple another small step outward.",
    keyframes: [{t: 0.0, wide: 0.41}, {t: 13.85, wide: 0.41}, {t: 15.38, wide: 0.55}, {t: 32.61, wide: 0.55}, {t: 34.51, wide: 0.73}, {t: 39.78, wide: 0.73}, {t: 41.63, wide: 0.88}]},
];
export default lanes;
