// usage: node tools/measure/body/paired.ts TAG_A TAG_B ... : 20 specs × seeds 101/202/303 ('before' = generated/handcraft).
// Per tag: completion, score parts, and the ground the rider touches, measured from the replayed contacts. Then each
// later tag against the first, paired by spec (seeds averaged), with a bootstrap interval over the 20 specs.
import fs from 'node:fs';
import {ride, touchedIn} from './late.ts';
import {roughestReversal, sharpestTurn, REVERSAL_LIMIT, LATE_TURN_LIMIT} from '../../../scripts/v0/optimizer/ground_smoothness.ts';
const specs = fs.readFileSync('generated/visible/picks.txt', 'utf8').trim().split('\n').map(l => l.split(' ').slice(0, 2)), SEEDS = [101, 202, 303];
const dirOf = (tag: string, s: string, v: string, seed: number) => tag === 'before' ? `generated/handcraft/${s}/${v}/s${seed}` : `generated/visible/${tag}/${s}/${v}/s${seed}`;
const KEYS = ['score', 'hitError', 'air', 'speed', 'extras', 'bumps', 'lips', 'either', 'hitBumps', 'lateJolt', 'shaped'] as const;
type Row = Record<typeof KEYS[number], number>;
export function measure(dir: string): Row | null {
  if (!fs.existsSync(dir) || !fs.readdirSync(dir).some(f => f.endsWith('-production.json'))) return null;
  const r = ride(dir), p = r.p, tg = p.impactEvaluation.targets, n = r.raw.frames.length;
  let bumps = 0, lips = 0, either = 0, secs = 0, hitBumps = 0;
  for (let k = 0; k < tg.length; k++) {
    const hit = tg[k].frame, nx = k + 1 < tg.length ? tg[k + 1].frame : p.case.durationFrames, {early, late} = touchedIn(r, hit, hit, nx - 3);   // the next support may be touched up to two frames before its beat
    const b = roughestReversal(r.lines, late) > REVERSAL_LIMIT, l = sharpestTurn(r.lines, late) > LATE_TURN_LIMIT;
    secs++; if (b) bumps++; if (l) lips++; if (b || l) either++; if (roughestReversal(r.lines, early) > REVERSAL_LIMIT) hitBumps++;
  }
  // hard pushes the account does not record: a 2-frame whole-body change of 0.4 or more, later than the hit's own frames, no recorded event of half its size there
  const ev = p.impactEvaluation.events; let lateJolt = 0;
  const F: number[][] = p.trace.frames; const cv = (i: number) => {let x = 0, y = 0; for (let q = 0; q < 10; q++) {x += F[i][2 * q] - F[i - 1][2 * q]; y += F[i][2 * q + 1] - F[i - 1][2 * q + 1];} return [x / 10, y / 10];};
  for (let i = 3; i + 2 < Math.min(n, F.length); i++) {const a = cv(i - 1), c = cv(i + 1), m = Math.hypot(c[0] - a[0], c[1] - a[1] - .35) / 7.55;
    if (m < .4) continue; const b2 = cv(i - 2), c2 = cv(i + 2); if (Math.hypot(cv(i)[0] - b2[0], cv(i)[1] - b2[1] - .35) / 7.55 > m || Math.hypot(c2[0] - cv(i)[0], c2[1] - cv(i)[1] - .35) / 7.55 >= m) continue;
    if (!ev.some((e: any) => i >= e.onset - 2 && i <= e.end + 1 && e.strength >= m / 2)) lateJolt++;}
  const shaped = p.sections.filter((s: any) => !['arcs', 'fragments'].includes(s.shape)).length / p.sections.length;
  return {score: p.score.score, hitError: p.impactEvaluation.account.strengthMse, air: p.score.components.air.rmsError, speed: p.score.components.speed.rmsError,
    extras: p.impactEvaluation.account.extraMse, bumps: bumps / secs, lips: lips / secs, either: either / secs, hitBumps: hitBumps / secs, lateJolt, shaped};
}
const tags = process.argv[1].endsWith("paired.ts") ? process.argv.slice(2) : [], data: Record<string, Array<Array<Row | null>>> = {};
for (const tag of tags) data[tag] = specs.map(([s, v]) => SEEDS.map(seed => measure(dirOf(tag, s, v, seed))));
const fmt = (k: string, v: number) => k === 'score' ? v.toFixed(1) : ['bumps', 'lips', 'either', 'hitBumps', 'shaped'].includes(k) ? (100 * v).toFixed(1) + '%' : k === 'lateJolt' ? v.toFixed(2) : v.toFixed(4);
if (tags.length) console.log('bumps = sections whose ground touched after the hit\'s frames reverses more than', REVERSAL_LIMIT + '° within 60 px (hitBumps: the same on ground touched within them); lips = sections whose ground touched after the hit\'s frames turns more than', LATE_TURN_LIMIT + '° within 30 px; lateJolt = unrecorded pushes of 0.4 or more per ride\n');
for (const tag of tags) {const rows = data[tag].flat(), ok = rows.filter(Boolean) as Row[];
  console.log(tag.padEnd(9), `complete ${ok.length}/${rows.length}`, KEYS.map(k => `${k} ${fmt(k, ok.reduce((s, r) => s + r[k], 0) / ok.length)}`).join('  '));}
let seed = 7; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
for (const tag of tags.slice(1)) {
  console.log(`\n${tag} − ${tags[0]}, paired by spec (rides complete under both; mean over their seeds), 95% bootstrap over specs:`);
  for (const k of KEYS) {
    const diffs: number[] = [];
    specs.forEach((_, i) => {const pairs = SEEDS.map((_, j) => [data[tags[0]][i][j], data[tag][i][j]]).filter(([a, b]) => a && b) as Row[][];
      if (pairs.length) diffs.push(pairs.reduce((s, [a, b]) => s + b[k] - a[k], 0) / pairs.length);});
    const mean = diffs.reduce((s, d) => s + d, 0) / diffs.length, boots: number[] = [];
    for (let b = 0; b < 4000; b++) {let s = 0; for (let i = 0; i < diffs.length; i++) s += diffs[Math.floor(rnd() * diffs.length)]; boots.push(s / diffs.length);}
    boots.sort((a, b) => a - b); const sc = ['bumps', 'lips', 'either', 'hitBumps', 'shaped'].includes(k) ? 100 : 1, d = k === 'score' ? 1 : ['bumps', 'lips', 'either', 'hitBumps', 'shaped'].includes(k) ? 1 : k === 'lateJolt' ? 2 : 4;
    console.log('  ', k.padEnd(9), (mean * sc >= 0 ? '+' : '') + (mean * sc).toFixed(d), `[${(boots[100] * sc).toFixed(d)}, ${(boots[3899] * sc).toFixed(d)}]`, ` specs up/down ${diffs.filter(x => x > 0).length}/${diffs.filter(x => x < 0).length}`, `(${diffs.length} specs)`);
  }
}
