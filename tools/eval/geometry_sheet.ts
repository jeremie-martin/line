/** A still sheet of two versions' geometry, for review by eye (`npm run compare -- review`).
 *
 * Each ride is cut into windows of WINDOW seconds of the song; a window shows the
 * lines near the rider's path in that time, the reference's left of the
 * candidate's, both at one scale so their sizes compare. Drawn: the track's lines
 * (black), the section rail guides (blue), the sled's path (grey), and each
 * authored beat where the sled is at its frame (red, its area growing with the
 * ask; hollow when no strength is asked). Under each panel: the phrases'
 * constructions in that window, and whether each keeps a rail in the final track. Nothing is scored. */
import {observe} from '../measure/observe.ts';

export const WINDOW = 10;
const FPS = 40, PANEL = [620, 300], MARGIN = 30;
type Side = {label: string; track: any; production: any};
export type SheetRide = {title: string; durationFrames: number; targets: {frame: number; impact?: number | null}[]; sides: [Side, Side]};

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]!));

function phrasesIn(production: any, drawn: Set<number>, from: number, to: number) {
  const plan = production?.plan;
  if (!plan) return '';
  // A phrase is named by its family and whether its final track keeps a rail (unused rails are trimmed).
  const names = plan.phrases.filter((p: any) => {
    const r = plan.requests.slice(p.first, p.first + p.count);
    return r.length && r[0].frame < to && r.at(-1).next > from;
  }).map((p: any) => {
    const rail = plan.requests.slice(p.first, p.first + p.count).some((r: any) => (production.railGuides?.[r.section] ?? []).some((id: number) => drawn.has(id)));
    return `${p.construction}${rail ? ' with rail' : ''}`;
  });
  return [...new Set(names)].join(', ');
}

/** The sled's path per frame, from a replay of the track. */
function sledPath(track: any, durationFrames: number, targets: SheetRide['targets']) {
  const obs = observe(track, durationFrames, targets.map(t => ({frame: t.frame, impact: t.impact ?? undefined})));
  return obs.frames.map((f: any) => [f.points[0][0], f.points[0][1]] as [number, number]);
}

function panel(side: Side, path: [number, number][], box: number[], scale: number, ride: SheetRide, from: number, to: number) {
  const [x0, y0, x1, y1] = box, [w, h] = PANEL, ox = (w - (x1 - x0) / scale) / 2, oy = (h - (y1 - y0) / scale) / 2;
  const X = (x: number) => (ox + (x - x0) / scale).toFixed(1), Y = (y: number) => (oy + (y - y0) / scale).toFixed(1);
  const inside = (x: number, y: number) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
  const guides = new Set<number>(Object.values(side.production?.railGuides ?? {}).flat() as number[]);
  let plain = '', guide = '';
  for (const l of side.track.lines) {
    if (!inside(l.x1, l.y1) && !inside(l.x2, l.y2)) continue;
    const d = `M${X(l.x1)} ${Y(l.y1)}L${X(l.x2)} ${Y(l.y2)}`;
    if (guides.has(l.id)) guide += d; else plain += d;
  }
  const seen = path.slice(from, Math.min(to, path.length - 1) + 1);
  const trail = seen.length ? 'M' + seen.map(([x, y]) => `${X(x)} ${Y(y)}`).join('L') : '';
  const beats = ride.targets.filter(t => t.frame >= from && t.frame < to && t.frame < path.length).map(t => {
    const [x, y] = path[t.frame], r = 2.5 + 6 * Math.sqrt(t.impact ?? 0);
    return t.impact == null ? `<circle cx="${X(x)}" cy="${Y(y)}" r="3" fill="none" stroke="#d33"/>` : `<circle cx="${X(x)}" cy="${Y(y)}" r="${r.toFixed(1)}" fill="#d33" fill-opacity=".55"/>`;
  }).join('');
  const ended = path.length - 1 < to && path.length - 1 < ride.durationFrames ? `<text x="8" y="${h - 8}" fill="#d33" font-size="12">ride ended at ${((path.length - 1) / FPS).toFixed(1)} s</text>` : '';
  return `<figure><svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><path d="${trail}" stroke="#bbb" stroke-width="1" fill="none"/>` +
    `<path d="${plain}" stroke="#111" stroke-width="1.6" fill="none" stroke-linecap="round"/><path d="${guide}" stroke="#2a6fdb" stroke-width="1.6" fill="none" stroke-linecap="round"/>` +
    `${beats}${ended}</svg><figcaption>${esc(side.label)} · ${esc(phrasesIn(side.production, new Set(side.track.lines.map((l: any) => l.id)), from, to))}</figcaption></figure>`;
}

/** The whole sheet as one HTML page. */
export function geometrySheet(title: string, description: string, rides: SheetRide[]) {
  const sections = rides.map(ride => {
    const paths = ride.sides.map(s => sledPath(s.track, ride.durationFrames, ride.targets));
    const rows: string[] = [];
    for (let from = 0; from < ride.durationFrames; from += WINDOW * FPS) {
      const to = Math.min(ride.durationFrames, from + WINDOW * FPS);
      const boxes = paths.map(p => {
        const seen = p.slice(from, Math.min(to, p.length - 1) + 1);
        if (!seen.length) return null;
        const xs = seen.map(q => q[0]), ys = seen.map(q => q[1]);
        return [Math.min(...xs) - MARGIN, Math.min(...ys) - MARGIN, Math.max(...xs) + MARGIN, Math.max(...ys) + MARGIN];
      });
      // one scale for both panels of a window, so equal sizes look equal
      const scale = Math.max(...boxes.filter(b => b).map(b => Math.max((b![2] - b![0]) / PANEL[0], (b![3] - b![1]) / PANEL[1])));
      const cells = ride.sides.map((s, i) => boxes[i] ? panel(s, paths[i], boxes[i]!, scale, ride, from, to) : `<figure class="empty">${esc(s.label)}: ride ended</figure>`);
      rows.push(`<div class="row"><div class="time">${(from / FPS).toFixed(0)}–${(to / FPS).toFixed(0)} s</div>${cells.join('')}</div>`);
    }
    return `<section><h2>${esc(ride.title)}</h2>${rows.join('')}</section>`;
  });
  return `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title>
<style>body{font:14px system-ui,sans-serif;margin:16px;background:#fafafa;color:#222}h1{font-size:20px}h2{font-size:16px;margin:28px 0 6px}
.row{display:flex;gap:10px;align-items:flex-start;margin:4px 0;flex-wrap:wrap}.time{width:64px;color:#666;padding-top:6px}
figure{margin:0;background:#fff;border:1px solid #ddd}figure.empty{width:${PANEL[0]}px;height:${PANEL[1]}px;display:grid;place-items:center;color:#999}
figcaption{font-size:12px;color:#555;padding:2px 6px;max-width:${PANEL[0] - 12}px}svg{display:block;max-width:100%;height:auto}</style>
<h1>${esc(title)}</h1><p>${esc(description)}</p>${sections.join('\n')}\n`;
}
