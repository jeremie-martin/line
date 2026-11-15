// Where does a variant's cost come from? usage: node tools/measure/body/cost.ts TAG_A TAG_B
// Search totals (samples, viable), and matched-hit strength by ask band, over the 20 specs × 3 seeds.
import fs from 'node:fs'; import path from 'node:path';
const specs = fs.readFileSync('generated/visible/picks.txt', 'utf8').trim().split('\n').map(l => l.split(' ').slice(0, 2)), SEEDS = [101, 202, 303];
const dirOf = (tag: string, s: string, v: string, seed: number) => tag === 'before' ? `generated/handcraft/${s}/${v}/s${seed}` : `generated/visible/${tag}/${s}/${v}/s${seed}`;
const band = (a: number) => a <= .15 ? '≤0.15' : a <= .4 ? '0.15–0.4' : a <= .7 ? '0.4–0.7' : '>0.7';
for (const tag of process.argv.slice(2)) {
  let n = 0, samples = 0, viable = 0, rebuilds = 0, ms = 0; const b: Record<string, {n: number; bias: number; sq: number}> = {};
  const gapAir: number[] = [], sup: number[] = [];
  for (const [s, v] of specs) for (const seed of SEEDS) {
    const d = dirOf(tag, s, v, seed), f = fs.existsSync(d) && fs.readdirSync(d).find(f => f.endsWith('-production.json')); if (!f) continue;
    const p = JSON.parse(fs.readFileSync(path.join(d, f), 'utf8')); n++;
    samples += p.production.searchTotals.samples; viable += p.production.searchTotals.viable; rebuilds += p.production.searchTotals.rebuilds; ms += p.compileMs;
    const tg = p.impactEvaluation.targets;
    for (const m of p.impactEvaluation.account.matches) {const a = tg[m.target].impact, o = b[band(a)] ??= {n: 0, bias: 0, sq: 0}; o.n++; o.bias += m.strengthError; o.sq += m.strengthError ** 2;}
    for (const sct of p.sections) sup.push(sct.mainContactFrames / Math.max(1, Math.round((sct.end - sct.start) * 40)));
  }
  console.log(`\n${tag}: ${n} rides; per ride: candidates tried ${(samples / n / 1000).toFixed(1)}k, viable ${(viable / n / 1000).toFixed(1)}k (${(100 * viable / samples).toFixed(0)}%), rebuilds ${(rebuilds / n).toFixed(1)}, compile ${(ms / n / 1000).toFixed(0)} s; time on the main support ${(100 * sup.reduce((x, y) => x + y, 0) / sup.length).toFixed(0)}% of a section`);
  for (const k of ['≤0.15', '0.15–0.4', '0.4–0.7', '>0.7']) if (b[k]) console.log('  ask', k.padEnd(9), String(b[k].n).padStart(5), 'hits  bias', (b[k].bias / b[k].n >= 0 ? '+' : '') + (b[k].bias / b[k].n).toFixed(3), ' rms error', Math.sqrt(b[k].sq / b[k].n).toFixed(3));
}
