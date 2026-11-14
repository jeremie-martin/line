/** A ride's character, for the reports (no headline counts it): where the final track keeps guide rails, and how the
 * rider meets the track, from the cold replay the measurement already made (tools/eval/measure.ts). Definitions of a
 * contact's kind: contact_role.ts. Needs the geometry facts' guide ids (cells compiled or rebuilt since 2026-11-14);
 * without them it is null. */
import {guideIds, hitKind, pushSide, type Line} from './contact_role.ts';

const BODY = [4, 5, 6, 7]; // BUTT, SHOULDER, RHAND, LHAND (observe.ts POINTS), as the body-drag guard counts them

export function rideCharacter(track: {lines: Line[]}, geometry: any, frames: Array<{collisions: number[][]}>, durationFrames: number) {
  if (!geometry?.sections?.length || !geometry.sections.every((s: any) => Array.isArray(s.guides))) return null;
  const guides = guideIds(geometry.sections), lines = new Map(track.lines.map(l => [l.id, l])), drawn = new Set(track.lines.map(l => l.id));
  // A section keeps a rail when the final track still draws one of its guide lines (unused rails are trimmed).
  const railDrawn = geometry.sections.map((s: any) => s.guides.some(([lo, hi]: number[]) => {for (let id = lo; id <= hi; id++) if (drawn.has(id)) return true; return false;}));
  const last = Math.min(durationFrames, frames.length - 1), minutes = last / 40 / 60, collisions = frames.map(fr => fr.collisions);
  let guide = 0, upper = 0, body = 0;
  for (let f = 1; f <= last; f++) {
    const c = frames[f].collisions;
    if (c.some(([id]) => guides.has(id))) guide++;
    if (c.some(([id]) => !guides.has(id) && lines.has(id) && pushSide(lines.get(id)!) === 'down')) upper++;
    if (c.some(([, point]) => BODY.includes(point))) body++;
  }
  const perMinute = (n: number) => +(n / 40 / minutes).toFixed(3);
  return {railDrawn, guideContact: perMinute(guide), upperContact: perMinute(upper), bodyContact: perMinute(body),
    /** The kind of the hit whose contact starts at `start` (contact_role.ts). */
    hit: (start: number) => hitKind(collisions, start, lines, guides)};
}
