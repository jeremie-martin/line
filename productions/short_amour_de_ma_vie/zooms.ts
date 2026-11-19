import type {ZoomLane} from '../../scripts/video/zooms.ts';

const lanes: ZoomLane[] = [
  {id: "breath", name: "The one-bar breath",
    about: "Let the sway sit at middle distance, open a little through the bass pickup so the held voice's one tall flight has room, keep that width over the four heavy bars and draw in gently as the groove lets go.",
    keyframes: [{t: 0.0, wide: 0.32}, {t: 4.7, wide: 0.48}, {t: 22.9, wide: 0.48}, {t: 24.3, wide: 0.62}, {t: 30.6, wide: 0.62}, {t: 36.6, wide: 0.52}]},
  {id: "voice", name: "Keep the singer near",
    about: "Hold near through the opening line and ease outward over the swaying bars, reaching full width as the held voice takes off. Come closer again, not too far, as the groove eases and floats out.",
    keyframes: [{t: 0.0, wide: 0.29}, {t: 4.02, wide: 0.29}, {t: 12.59, wide: 0.54}, {t: 24.24, wide: 0.64}, {t: 34.26, wide: 0.64}, {t: 40.25, wide: 0.46}]},
];
export default lanes;
