import type {ZoomLane} from '../../scripts/video/zooms.ts';

const lanes: ZoomLane[] = [
  {id: "clock", name: "The clock fills out",
    about: "Begin close enough for the faint clock. Open with its upper melody and widen again over the fill into the motor.",
    keyframes: [{t: 0.0, wide: 0.19}, {t: 4.18, wide: 0.19}, {t: 8.81, wide: 0.51}, {t: 15.52, wide: 0.51}, {t: 17.88, wide: 0.92}]},
  {id: "motor", name: "Leave room for the motor",
    about: "Keep the words and their drum replies in one near frame. Open during the final reply and hold through the dip in the bass.",
    keyframes: [{t: 0.0, wide: 0.39}, {t: 16.23, wide: 0.39}, {t: 17.88, wide: 0.85}, {t: 36.45, wide: 0.85}]},
  {id: "rewind", name: "Stall and wind up",
    about: "A sibling of the motor lane that follows the blend's stall: open into the motor, lean in gently as the bass hollows and the rider loses its pace, then widen bar by bar as the motor winds back up to full speed.",
    keyframes: [{t: 0.0, wide: 0.36}, {t: 16.23, wide: 0.36}, {t: 17.88, wide: 0.8}, {t: 25.0, wide: 0.8}, {t: 26.9, wide: 0.6}, {t: 27.4, wide: 0.6}, {t: 36.5, wide: 0.9}]},
];
export default lanes;
