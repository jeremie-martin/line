// usage: node tools/measure/body/panel.ts TAG_A TAG_B : the 20 picked specs, before (generated/handcraft) or a tag under generated/visible
import fs from 'node:fs'; import {clarity} from './clarity.ts';
// @ts-ignore
import {rocking} from './rocking.mjs'; import {load} from './visual.mjs';
const picks = fs.readFileSync('generated/visible/picks.txt', 'utf8').trim().split('\n').map(l => l.split(' '));
const dirOf = (tag: string, [s, v, seed]: string[]) => tag === 'before' ? `generated/handcraft/${s}/${v}/s${seed}` : `generated/visible/${tag}/${s}/${v}/s${seed}`;
const keys = ['v3strength', 'v5strength', 'v5extra', 'air', 'speed', 'meanRest', 'louder', 'quietLouder', 'rock', 'rock20'] as const;
const tags = process.argv.slice(2), tot: Record<string, number[]> = {}; let n = 0;
const rowsOut: string[] = [];
for (const pk of picks) {
  const cs = tags.map(t => {const d = dirOf(t, pk); if (!fs.existsSync(d)) return null; const c: any = clarity(d); if (!c) return null;
    const r = rocking(load(d)), dur = r.reduce((s: number, x: any) => s + x.dur, 0);
    c.rock = r.reduce((s: number, x: any) => s + x.rock, 0) / dur; c.rock20 = r.filter((x: any) => x.rock >= 20).length / r.length; return c;});
  if (cs.some(c => !c)) {rowsOut.push(pk.join(' ') + ' missing'); continue;} n++;
  cs.forEach((c, i) => {(tot[tags[i]] ??= keys.map(() => 0)); keys.forEach((k, j) => tot[tags[i]][j] += c[k]);});
  rowsOut.push((pk[0].split('_')[0] + ' ' + pk[1]).padEnd(36) + cs.map(c => `drowned ${(100 * c.quietLouder).toFixed(0).padStart(3)}% louder ${(100 * c.louder).toFixed(0).padStart(3)}% hitErr ${c.v5strength.toFixed(4)} air ${c.air.toFixed(3)} spd ${c.speed.toFixed(3)} rock ${c.rock.toFixed(0).padStart(2)}`).join(' || '));
}
console.log(rowsOut.join('\n')); console.log(n, 'specs. means:');
for (const t of tags) console.log(t.padEnd(8), keys.map((k, j) => k + ' ' + (tot[t][j] / n).toFixed(4)).join('  '));
