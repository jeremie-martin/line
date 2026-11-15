// usage: node tools/measure/body/recount.ts DIR... : replay recorded rides and account them under v3 and v5
import fs from 'node:fs'; import path from 'node:path';
import {LineRiderEngine as Engine} from '../../../scripts/lib/native_motion/engine.ts';
import {extractRawTrajectory} from '../../../scripts/lib/detector.ts';
import {impactRuler} from '../../../scripts/v0/optimizer/impact_accounts.ts';
import {STRIKE_V3_CONTRACT, STRIKE_V5_CONTRACT, evaluateStrikes, type StrikeContract} from '../../../scripts/lib/strike_impact.ts';
export function accounts(dir: string, contracts: StrikeContract[] = [STRIKE_V3_CONTRACT, STRIKE_V5_CONTRACT]) {
  const f = fs.readdirSync(dir).find(f => f.endsWith('-production.json')); if (!f) return null;
  const p = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')), track = p.track;
  const engine = new Engine().setStart(track.startPosition, track.riders[0].startVelocity).addLine(track.lines);
  const raw = extractRawTrajectory(engine, p.case.durationFrames + 20), frames = impactRuler.observe(engine, raw.frames) as any;
  return {p, frames, results: contracts.map(c => evaluateStrikes(frames, p.impactEvaluation.targets, p.case.durationFrames, true, c))};
}
if (process.argv[1].endsWith('recount.ts')) {
  let n = 0; const sum = Array(9).fill(0);
  for (const dir of process.argv.slice(2)) {
    const a = accounts(dir); if (!a) continue; n++;
    const rec = a.p.impactEvaluation.account, [v3, v5] = a.results.map(r => r.account);
    const row = [rec.strengthMse, rec.extraMse, v3.strengthMse, v3.extraMse, v5.strengthMse, v5.extraMse, v5.unmatchedEvents.length, v5.missingTargets.length, v5.timingMse];
    row.forEach((v, i) => sum[i] += v);
    if (process.env.V) console.log(dir.split('/').filter(Boolean).slice(-3).join('/').padEnd(50), row.map(v => v.toFixed(4)).join(' '));
  }
  const m = sum.map(v => v / n);
  console.log(n, 'rides. recorded: strength', m[0].toFixed(4), 'extra', m[1].toFixed(4), '| v3 replayed: strength', m[2].toFixed(4), 'extra', m[3].toFixed(4),
    '| v5: strength', m[4].toFixed(4), 'timing', m[8].toFixed(4), 'extra', m[5].toFixed(4), 'extras per ride', m[6].toFixed(1), 'missing per ride', m[7].toFixed(2));
}
