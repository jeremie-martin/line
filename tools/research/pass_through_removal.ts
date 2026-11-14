/** What removing the passed-through pieces would do (report only). For rides `npm run compare` saved: remove every line
 * piece the rider passes through or that cuts its figure and that it never touches (pass_through.ts `removable`),
 * replay the cleaned track, and check that every rider point is exactly where it was in every frame. Then count what is
 * left (lines through the body, through the sled, points passing 3 px or more through a line) and what the cleaning
 * costs the drawing: pieces and length removed, and new breaks (a gap's main line, rail or fragments split into more
 * connected runs than before).
 * --remove=all (every such piece), figure (those cutting the rider's figure), body (those cutting the body); a -trim
 * suffix shortens the line from its nearer untouched end instead of making a hole where it can.
 *   node tools/research/pass_through_removal.ts [--arm=2fee4728896e469a] [--seeds=101] [--remove=all|figure|body] */
import {readFileSync, readdirSync} from 'node:fs';
import {join} from 'node:path';
import {observe} from '../measure/observe.ts';
import {passThroughs} from './pass_through.ts';

const arg = (k: string, d: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const dir = join('generated/eval/arms', arg('arm', '2fee4728896e469a'), 'cells'), seeds = arg('seeds', '101').split(',');
const rides = readdirSync(dir).filter(f => /~v8-.*~\d+\.json$/.test(f) && seeds.some(s => f.endsWith(`~${s}.json`))).map(f => f.slice(0, -5)).sort();

/** With `-trim`: a cut piece takes with it the untouched pieces between it and the nearer end of its connected run, when
 * that whole stretch is untouched (the line ends earlier instead of breaking); otherwise it goes alone (a hole). */
function trimmed(lines: any[], cut: number[], touched: Set<number>) {
  const k = (x: number, y: number) => `${x.toFixed(6)},${y.toFixed(6)}`, byStart = new Map<string, any>(), byEnd = new Map<string, any>();
  for (const l of lines) {byStart.set(`${Math.floor((l.id - 1000) / 10000)}|${k(l.x1, l.y1)}`, l); byEnd.set(`${Math.floor((l.id - 1000) / 10000)}|${k(l.x2, l.y2)}`, l);}
  const gap = (l: any) => Math.floor((l.id - 1000) / 10000), byId = new Map(lines.map(l => [l.id, l])), drop = new Set<number>();
  const walk = (l: any, next: (x: any) => any) => {const out = [l]; for (let x = next(l); x; x = next(x)) {if (touched.has(x.id)) return null; out.push(x);} return out;};
  for (const id of cut) {
    const l = byId.get(id); if (!l) continue;
    const back = walk(l, x => byEnd.get(`${gap(x)}|${k(x.x1, x.y1)}`)), ahead = walk(l, x => byStart.get(`${gap(x)}|${k(x.x2, x.y2)}`));
    const side = [back, ahead].filter(Boolean).sort((a, b) => a!.length - b!.length)[0];
    for (const x of side ?? [l]) drop.add(x.id);
  }
  return drop;
}
/** Connected runs of pieces per gap (pieces joined end to start). */
function runs(lines: any[]) {
  const byGap = new Map<number, any[]>();
  for (const l of lines) {const g = Math.floor((l.id - 1000) / 10000); if (!byGap.has(g)) byGap.set(g, []); byGap.get(g)!.push(l);}
  let n = 0;
  for (const ls of byGap.values()) {
    const ends = new Set(ls.map(l => `${l.x2.toFixed(6)},${l.y2.toFixed(6)}`));
    n += ls.filter(l => !ends.has(`${l.x1.toFixed(6)},${l.y1.toFixed(6)}`)).length;  // a run starts where no piece ends
  }
  return n;
}
const count = (r: ReturnType<typeof passThroughs>) => ({
  body: r.sightings.filter(x => x.body).length, body3: r.sightings.filter(x => x.body && x.frames >= 3).length,
  sled: r.sightings.filter(x => !x.body).length, deep: r.crossed.filter(x => x.depth >= 3).length});

let identical = 0;
const sum = {before: {body: 0, body3: 0, sled: 0, deep: 0}, after: {body: 0, body3: 0, sled: 0, deep: 0}, pieces: 0, removed: 0, length: 0, lengthRemoved: 0, breaks: 0};
for (const id of rides) {
  const cell = JSON.parse(readFileSync(join(dir, `${id}.json`), 'utf8'));
  const before = passThroughs(dir, id), mode = arg('remove', 'all');
  const cut = mode.startsWith('body') ? before.removableBody : mode.startsWith('figure') ? before.removableFigure : before.removable;
  const drop = mode.endsWith('-trim') ? trimmed(before.track.lines, cut, before.touched) : new Set(cut);
  const cleaned = {...before.track, lines: before.track.lines.filter((l: any) => !drop.has(l.id))};
  const a = observe(before.track, cell.terminus.frame, cell.case.targets).frames, b = observe(cleaned, cell.terminus.frame, cell.case.targets).frames;
  const same = a.length === b.length && a.every((fa: any, f: number) => JSON.stringify(fa.points) === JSON.stringify(b[f].points));
  if (same) identical++; else console.log(`${id}: the cleaned replay differs`);
  const after = passThroughs(dir, id, cleaned), cb = count(before), ca = count(after);
  for (const k of Object.keys(cb) as Array<keyof typeof cb>) {sum.before[k] += cb[k]; sum.after[k] += ca[k];}
  const len = (l: any) => Math.hypot(l.x2 - l.x1, l.y2 - l.y1);
  sum.pieces += before.track.lines.length; sum.removed += drop.size;
  sum.length += before.track.lines.reduce((t: number, l: any) => t + len(l), 0);
  sum.lengthRemoved += before.track.lines.filter((l: any) => drop.has(l.id)).reduce((t: number, l: any) => t + len(l), 0);
  sum.breaks += runs(cleaned.lines) - runs(before.track.lines);
}
const n = rides.length, per = (x: number) => (x / n).toFixed(1);
console.log(`${n} rides; cleaned replay identical in ${identical} of ${n}`);
console.log(`per ride, before → after: lines through the body ${per(sum.before.body)} → ${per(sum.after.body)} (3+ frames ${per(sum.before.body3)} → ${per(sum.after.body3)}); through the sled ${per(sum.before.sled)} → ${per(sum.after.sled)}; points 3 px or more through a line ${per(sum.before.deep)} → ${per(sum.after.deep)}`);
console.log(`the drawing: pieces removed ${(100 * sum.removed / sum.pieces).toFixed(1)}% (${per(sum.removed)} per ride), length removed ${(100 * sum.lengthRemoved / sum.length).toFixed(1)}%, new breaks ${per(sum.breaks)} per ride`);
process.exit(0);
