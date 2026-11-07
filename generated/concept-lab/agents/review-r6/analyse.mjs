import {readFileSync} from 'node:fs';
const FPS = 40, clamp = (x, a, b) => Math.max(a, Math.min(b, x));
function gauss1(arr, sig) {const R = Math.ceil(2.5 * sig), ker = []; for (let k = -R; k <= R; k++) ker.push(Math.exp(-k * k / (2 * sig * sig)));
  const n = arr.length, out = new Float64Array(n); for (let f = 0; f < n; f++) {let s = 0, w = 0; for (let i = 0; i < ker.length; i++) {s += arr[clamp(f + i - R, 0, n - 1)] * ker[i]; w += ker[i];} out[f] = s / w;} return out;}
const reach = (v, v0) => v / Math.sqrt(1 + (v / v0) ** 2) / v0;
const pct = (a, p) => [...a].sort((x, y) => x - y)[Math.floor(p * (a.length - 1))];
for (const s of process.argv.slice(2)) {
  const d = JSON.parse(readFileSync(`pos-${s}.json`)); const vy = gauss1(d.vy, 2), vs = gauss1(Array.from(vy), 80);
  const fast = vy.map((v, f) => 0.2 * reach(Math.max(0, v - vs[f] - 100), 160)), slow = vs.map(v => 0.05 * reach(v, 220));
  const row = k => `${k}: med ${pct(d[k], .5).toFixed(3)} p5 ${pct(d[k], .05).toFixed(3)} p95 ${pct(d[k], .95).toFixed(3)} max ${Math.max(...d[k]).toFixed(3)}`;
  console.log(`\n${s}  ${row('tamed')} | ${row('high')} | ${row('dive')}`);
  console.log(`  fast term: max ${Math.max(...fast).toFixed(3)} H, frames>0.05H ${fast.filter(x => x > 0.05).length}/${d.n}, >0.02 ${fast.filter(x => x > .02).length}; slow term range ${Math.min(...slow).toFixed(3)}..${Math.max(...slow).toFixed(3)}; vy p95 ${pct(vy, .95).toFixed(0)} max ${Math.max(...vy).toFixed(0)}`);
  // biggest dive-minus-high difference
  let bi = 0; for (let f = 0; f < d.n; f++) if (d.dive[f] - d.high[f] > d.dive[bi] - d.high[bi]) bi = f;
  console.log(`  max dive-high ${(d.dive[bi] - d.high[bi]).toFixed(3)} at ${(bi / FPS).toFixed(2)} s; max fast at ${(fast.indexOf(Math.max(...fast)) / FPS).toFixed(2)} s`);
  if (s === 'los') for (let t = 26; t <= 33; t += 0.5) {const f = Math.round(t * FPS); console.log(`   t ${t.toFixed(1)} vy ${vy[f].toFixed(0)} vs ${vs[f].toFixed(0)} fast ${fast[f].toFixed(3)} | tamed ${d.tamed[f].toFixed(3)} high ${d.high[f].toFixed(3)} dive ${d.dive[f].toFixed(3)} air ${d.air[f]}`);}
}
