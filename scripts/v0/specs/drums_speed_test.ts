/**
 * drums speed test — speed=0.5. Exercises the speed axis (untested in v0
 * baseline runs; air/grain/contact_style have been measured but speed
 * targeting hasn't been stressed).
 *
 * 0.5 corresponds to roughly 6 px/frame mean velocity, close to natural
 * rider behaviour after a few seconds of gravity-driven acceleration on
 * the drums beat density.
 */
import { drumsSpec } from "./_drums.ts";

const spec = drumsSpec([{ t0: 0, t1: 30, speed: 0.5 }]);
export default spec;
