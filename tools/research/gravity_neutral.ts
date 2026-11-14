/** A gravity-neutral strike strength, computed beside today's (report only). Today's strength is the contact's own push
 * over the strongest two frames (the change of whole-body motion less gravity, with spin), ÷ 7.55. A floor's push works
 * against gravity; a surface pushing down is helped by it, so it needs less push for the same turn of the path and
 * reads softer (REWORK.md, November 14). The gravity-neutral strength is the push a surface would need for that turn
 * with gravity against it: the push's length plus twice gravity's share along it, where that share points the push's
 * way (2 × window × g × max(0, ĝ·p̂)); a floor's is unchanged. For every matched hit of saved rides it reports both,
 * and checks that today's is reproduced.
 *   node tools/research/gravity_neutral.ts [--arm=2fee4728896e469a] [--seeds=101,202,303,404] [--out=FILE.jsonl] [--key=STUDY.key.json] */
import {readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {join} from 'node:path';
import {LineRiderEngine as Engine} from '../../scripts/lib/native_motion/engine.ts';
import {extractRawTrajectory} from '../../scripts/lib/detector.ts';
import {impactRuler} from '../../scripts/v0/optimizer/impact_accounts.ts';
import {STRIKE_V3_CONTRACT as C} from '../../scripts/lib/strike_impact.ts';

const arg = (k: string, d: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const gz = (p: string) => JSON.parse(gunzipSync(readFileSync(p)).toString());

/** Both strengths of the hit whose event starts at `onset`, over its own frames (at most C.window, never past `stop`). */
export function strengths(frames: any[], byFrame: Map<number, number>, onset: number, stop: number) {
  let best = -1, old = 0, neutral = 0;
  for (let a = onset; a + C.strengthWindow - 1 <= stop; a++) {
    let x = 0, y = 0, z = 0;
    for (let f = a; f < a + C.strengthWindow; f++) {const p = frames[byFrame.get(f)!].impulse; x += p[0]; y += p[1]; z += p[2];}
    const size = Math.hypot(x, y, z);
    if (size > best) {
      best = size; old = size / C.veryStrong;
      const push = Math.hypot(x, y), down = push > 0 ? Math.max(0, y / push) : 0;
      neutral = Math.hypot(push + 2 * C.strengthWindow * C.gravity * down, z) / C.veryStrong;
    }
  }
  return {old, neutral};
}

/** Replays a saved track and returns the strike frames by frame number. */
function replay(track: any, last: number) {
  const engine = new Engine().setStart(track.startPosition ?? track.riders[0].startPosition, track.riders[0].startVelocity).addLine(track.lines);
  const raw = extractRawTrajectory(engine, last);
  const frames = impactRuler.observe(engine, raw.frames) as any[];
  return {frames, byFrame: new Map(frames.map((f, i) => [f.frame, i]))};
}

function hitsOf(dir: string, id: string, beats?: number[]) {
  const cell = JSON.parse(readFileSync(join(dir, `${id}.json`), 'utf8')), track = gz(join(dir, `${id}.track.json.gz`));
  const {frames, byFrame} = replay(track, cell.terminus.frame);
  const perBeat = cell.impact3.perBeat, onsets = perBeat.map((b: any) => b.hit?.onset).filter(Number.isFinite).sort((a: number, b: number) => a - b);
  const out: any[] = [];
  perBeat.forEach((b: any, j: number) => {
    if (!b.hit || (beats && !beats.includes(j))) return;
    const next = onsets.find((o: number) => o > b.hit.onset) ?? Infinity;
    const stop = Math.min(b.hit.onset + C.window - 1, next - 1, frames.at(-1).frame);
    const s = strengths(frames, byFrame, b.hit.onset, stop);
    out.push({ride: id, beat: j, ask: b.requested, kind: b.hit.contact, saved: b.hit.strength, old: +s.old.toFixed(4), neutral: +s.neutral.toFixed(4)});
  });
  return out;
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
if (arg('key', '')) {
  // A blind study's pairs: both strengths of each side.
  const key = JSON.parse(readFileSync(arg('key', ''), 'utf8'));
  for (const p of key) {
    const side = (h: any) => {
      const dir = join('generated/eval/arms', h.set.slice(4), 'cells');
      return hitsOf(dir, h.cell, [h.beat])[0];
    };
    const L = side(p.left), R = side(p.right);
    console.log(JSON.stringify({pair: p.pair, kind: p.kind, left: [L.kind, L.old.toFixed(3), L.neutral.toFixed(3)], right: [R.kind, R.old.toFixed(3), R.neutral.toFixed(3)]}));
  }
  process.exit(0);
}
const dir = join('generated/eval/arms', arg('arm', '2fee4728896e469a'), 'cells'), seeds = arg('seeds', '101,202,303,404').split(',');
const rows: any[] = [];
for (const f of readdirSync(dir).filter(f => /~v8-.*~\d+\.json$/.test(f) && seeds.some(s => f.endsWith(`~${s}.json`))).sort())
  rows.push(...hitsOf(dir, f.slice(0, -5)));
if (arg('out', '')) writeFileSync(arg('out', ''), rows.map(r => JSON.stringify(r)).join('\n') + '\n');
const off = rows.filter(r => Math.abs(r.old - r.saved) > 1e-3);
console.log(`${rows.length} matched hits; today's strength reproduced in ${rows.length - off.length} (${off.length} differ by more than 0.001)`);
for (const kind of ['floor', 'floor+rail', 'upper', 'upper+rail', 'rail']) {
  const g = rows.filter(r => r.kind === kind && r.ask >= .6);
  if (g.length) console.log(`strong ${kind}: ${g.length}, ask ${mean(g.map(r => r.ask)).toFixed(3)}, today ${mean(g.map(r => r.old)).toFixed(3)}, gravity-neutral ${mean(g.map(r => r.neutral)).toFixed(3)} (+${mean(g.map(r => r.neutral - r.old)).toFixed(3)})`);
}
process.exit(0);
