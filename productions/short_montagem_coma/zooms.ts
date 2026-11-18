import type {ZoomLane} from '../../scripts/video/zooms.ts';

const lanes: ZoomLane[] = [
  {id: "holes", name: "Drums leave holes",
    about: "Open on the first complete burst, draw close over the uncovered vocal descent, then release at the last drum return.",
    keyframes: [{t: 0.0, wide: 0.31}, {t: 6.84, wide: 0.31}, {t: 8.2, wide: 0.9}, {t: 20.46, wide: 0.9}, {t: 25.14, wide: 0.38}, {t: 30.84, wide: 0.38}, {t: 32.2, wide: 0.94}]},
  {id: "answers", name: "Rap answers",
    about: "Give the middle burst a steady width, leaning near for the rap and reopening as the broken beat resumes.",
    keyframes: [{t: 0.0, wide: 0.42}, {t: 4.1, wide: 0.42}, {t: 9.34, wide: 0.76}, {t: 13.34, wide: 0.76}, {t: 17.1, wide: 0.48}, {t: 18.2, wide: 0.79}]},
];
export default lanes;
