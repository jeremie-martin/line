// The review player's contact inspection, bundled for the browser (generated/renderer/inspect.js): which lines guided the ride
// (blue) and which ones the rider touches at each frame (orange), drawn over the video picture with its own camera.
import {inspectRailContacts} from './contacts.ts';
export {inspectRailContacts};
/** Stroke lines `ids` of `record` through `world` (the picture's world-to-canvas transform), `width` canvas pixels wide. */
export function highlight(context, world, record, ids, color, width) {
  const byId = new Map(record.track.lines.map(l => [l.id, l]));
  context.save(); context.setTransform(world); context.lineWidth = width / world.a; context.lineCap = 'round'; context.strokeStyle = color;
  context.beginPath(); for (const id of ids) {const l = byId.get(id); if (l) {context.moveTo(l.x1, l.y1); context.lineTo(l.x2, l.y2);}}
  context.stroke(); context.restore();
}
