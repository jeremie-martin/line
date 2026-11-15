// Songs outside the 20 handcrafted specs: default specifications, seeds 101/202/303, baseline against the rule.
import fs from 'node:fs'; import {measure} from './paired.ts';
const songs = fs.readdirSync('generated/visible/hold-base');
const keys = ['score', 'hitError', 'air', 'speed', 'bumps', 'lips', 'either', 'lateJolt'] as const;
for (const song of songs.filter(s => !s.endsWith('.log'))) {
  const row = (cfg: string) => [101, 202, 303].map(seed => measure(`generated/visible/hold-${cfg}/${song}/s${seed}`));
  const a = row('base'), b = row('rule'), mean = (r: any[], k: string) => {const ok = r.filter(Boolean); return ok.length ? ok.reduce((s, x) => s + x[k], 0) / ok.length : NaN;};
  console.log(song.padEnd(26), `complete ${a.filter(Boolean).length}/3 → ${b.filter(Boolean).length}/3 `, keys.map(k => `${k} ${mean(a, k).toFixed(k === 'score' ? 0 : 3)}→${mean(b, k).toFixed(k === 'score' ? 0 : 3)}`).join('  '));
}
