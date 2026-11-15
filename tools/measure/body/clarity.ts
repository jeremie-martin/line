// usage: node tools/measure/body/clarity.ts DIR... : per ride, how readable the asked hits are (replayed through the engine)
//  seen  = strongest whole-body motion change over 2 frames (account scale) within [t−2, t+3] of an asked hit
//  rest  = the same, from t+4 to 3 frames before the next asked hit
import {accounts} from './recount.ts';
export function clarity(dir: string) {
  const a = accounts(dir); if (!a) return null;
  const {p, frames, results} = a, n = frames.length, M = new Float64Array(n);
  for (let i = 1; i + 1 < n; i++) {const x = frames[i].impulse, y = frames[i + 1].impulse; M[i] = Math.hypot(x[0] + y[0], x[1] + y[1], x[2] + y[2]) / 7.55;}
  const tg = p.impactEvaluation.targets as Array<{frame: number; impact: number}>;
  let louder = 0, half = 0, rest = 0, quiet = 0, quietLouder = 0, sq = 0, big = 0;
  for (let k = 0; k < tg.length; k++) {
    const f = tg[k].frame, nx = k + 1 < tg.length ? tg[k + 1].frame : p.case.durationFrames;
    let seen = 0, r = 0;
    for (let i = Math.max(1, f - 2); i <= f + 3 && i < n; i++) seen = Math.max(seen, M[i]);
    for (let i = f + 4; i <= nx - 3 && i < n; i++) r = Math.max(r, M[i]);
    rest += r; sq += r * r; if (r >= seen) louder++; if (r >= seen / 2) half++; if (r >= .25) big++;
    if (tg[k].impact <= .15) {quiet++; if (r >= seen) quietLouder++;}
  }
  const [v3, v5] = results.map(r => r.account), s = p.score.components;
  return {name: dir.split('/').filter(Boolean).slice(-3).join('/'), hits: tg.length, score: p.score.score, air: s.air.rmsError, speed: s.speed.rmsError,
    v3strength: v3.strengthMse, v3extra: v3.extraMse, v5strength: v5.strengthMse, v5extra: v5.extraMse, v5missing: v5.missingTargets.length,
    meanRest: rest / tg.length, restRms: Math.sqrt(sq / tg.length), louder: louder / tg.length, half: half / tg.length, big: big / tg.length, quiet, quietLouder: quiet ? quietLouder / quiet : 0};
}
if (process.argv[1].endsWith('clarity.ts')) {
  console.log('ride'.padEnd(46), 'score  air   speed | v3 str  extra | v5 str  extra | unasked: mean  ≥half  ≥hit  ≥.25 | quiet hits: n, drowned');
  for (const dir of process.argv.slice(2)) {
    const c = clarity(dir); if (!c) continue;
    console.log(c.name.padEnd(46), c.score.toFixed(0).padStart(4), c.air.toFixed(3), c.speed.toFixed(3), '|', c.v3strength.toFixed(4), c.v3extra.toFixed(4), '|', c.v5strength.toFixed(4), c.v5extra.toFixed(4),
      '|', c.meanRest.toFixed(3).padStart(10), (100 * c.half).toFixed(0).padStart(5) + '%', (100 * c.louder).toFixed(0).padStart(4) + '%', (100 * c.big).toFixed(0).padStart(4) + '%', '|', String(c.quiet).padStart(4), (100 * c.quietLouder).toFixed(0).padStart(4) + '%');
  }
}
