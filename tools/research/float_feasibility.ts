/** How hard the asks around high floats pull against each other, under a
 * simple model (report only; a model, not a bound: it ignores asymmetric floats,
 * redirection spread past the catch, rails and geometry the catalog lacks).
 * For every gap asked air >= 0.75 and at least 40 frames long:
 * the float the asks imply (a symmetric parabola airborne ask x length frames,
 * whose mean speed is the asked speed), and the turn its closing catch makes to
 * relaunch into the next float, as speed x turn (px/frame; the impact ruler's
 * "very strong" is 7.55), next to the impact asked there. Also what the search
 * expected for the gap's air (gallery row) against what was measured.
 * node --import tsx tools/research/float_feasibility.ts ARM_DIR */
import {readdirSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import {gunzipSync} from 'node:zlib';
import {readJson} from '../eval/records.ts';
import {authoredSpeedToPx, IMPACT_RULER} from '../../scripts/v0/types.ts';

const G = .175, dir = process.argv[2];
/** The asked float: launch vertical speed and the horizontal speed giving the asked mean speed. */
function float(L: number, air: number, speed: number) {
  const vy = G * air * L / 2, target = authoredSpeedToPx(speed);
  const mean = (vx: number) => {let m = 0; for (let i = 0; i < 64; i++) m += Math.hypot(vx, vy * (2 * (i + .5) / 64 - 1)); return m / 64;};
  let lo = 0, hi = 30; for (let i = 0; i < 50; i++) {const mid = (lo + hi) / 2; if (mean(mid) < target) lo = mid; else hi = mid;}
  return {vy, vx: lo};
}
const bySpec = new Map<string, {n: number; shortfall: number; raw: number[]; asked: number[]; predicted: number[]}>();
for (const f of readdirSync(join(dir, 'cells')).filter(f => /\d\.json$/.test(f))) {
  const cell = readJson(join(dir, 'cells', f));
  if (['E', 'H'].includes(cell.case.bench.stratum)) continue;
  const frames = [1, ...cell.beats.map((b: any) => b.frame)], ask = (gap: number, axis: string) => cell.gaps.find((r: any) => r[0] === gap && r[1] === axis);
  const rows = JSON.parse(gunzipSync(readFileSync(join(dir, 'cells', f.replace('.json', '.gallery.json.gz')))).toString()).result.rows;
  const at = (gap: number) => {
    const a = ask(gap, 'air'), s = ask(gap, 'speed'), L = frames[gap + 1] - frames[gap];
    return a && s && a[3] !== null && Number.isFinite(L) ? {L, air: a[2], got: a[3], ...float(L, a[2], s[2])} : undefined;
  };
  for (let gap = 0; gap < cell.beats.length; gap++) {
    const here = at(gap);
    if (!here || here.air < .75 || here.L < 40) continue;
    const next = at(gap + 1), turn = Math.atan2(here.vy, here.vx) + (next ? Math.atan2(next.vy, next.vx) : 0);
    const key = cell.case.id.replace(/~\d+$/, ''), e = bySpec.get(key) ?? bySpec.set(key, {n: 0, shortfall: 0, raw: [], asked: [], predicted: []}).get(key)!;
    e.n++; e.shortfall += Math.max(0, here.air - here.got) ** 2;
    if (next && cell.beats[gap]?.requested !== undefined) {e.raw.push(Math.hypot(here.vx, here.vy) * turn); e.asked.push(cell.beats[gap].requested);}
    const row = rows.find((r: any) => r.frame === frames[gap] && r.next === frames[gap + 1]);
    if (row?.achieved?.air !== undefined) e.predicted.push(Math.abs(row.achieved.air - here.got));
  }
}
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const total = [...bySpec.values()].reduce((a, e) => a + e.shortfall, 0);
console.log(`high floats (air ask >= 0.75, >= 40 frames); "very strong" = ${IMPACT_RULER.VERY_STRONG} px/frame`);
console.log('spec                                    floats  share of squared air shortfall  closing catch: speed x turn implied  impact asked  |search air - measured|');
for (const [key, e] of [...bySpec.entries()].sort((a, b) => b[1].shortfall - a[1].shortfall))
  console.log(`${key.padEnd(40)}${String(e.n).padStart(6)}  ${(e.shortfall / total).toFixed(2).padStart(30)}  ${mean(e.raw).toFixed(1).padStart(35)}  ${mean(e.asked).toFixed(2).padStart(12)}  ${mean(e.predicted).toFixed(3).padStart(22)}`);
