// The zoom page's helpers. The zoom itself (keyframes on one fixed scale) is the renderer's: scripts/video/zoom.js.
export {RANGE, zoomOfWide, wideAt, laneScale} from '../../scripts/video/zoom.js';
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
/** The older specs wrote zooms in the first renderer's units (1.55 to 2.9 over all of them, a small number being wide). One fixed
 * conversion for every spec, so their lanes can be looked at on today's scale. */
export const legacyWide = zoom => clamp((Math.log(2.9) - Math.log(zoom)) / (Math.log(2.9) - Math.log(1.55)), 0, 1);
