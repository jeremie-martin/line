import {readFileSync} from 'node:fs';
const FPS = 40, clamp = (x, a, b) => Math.max(a, Math.min(b, x));
function gauss1(arr, sig) {const R = Math.ceil(2.5 * sig), ker = []; for (let k = -R; k <= R; k++) ker.push(Math.exp(-k * k / (2 * sig * sig)));
  const n = arr.length, out = new Float64Array(n); for (let f = 0; f < n; f++) {let s = 0, w = 0; for (let i = 0; i < ker.length; i++) {s += arr[clamp(f + i - R, 0, n - 1)] * ker[i]; w += ker[i];} out[f] = s / w;} return out;}
const reach = (v, v0) => v / Math.sqrt(1 + (v / v0) ** 2) / v0;
for (const s of process.argv.slice(2)) {
  const d = JSON.parse(readFileSync(`pos-${s}.json`)); const vy = gauss1(d.vy, 2), vs = gauss1(Array.from(vy), 80);
  const fast = vy.map((v, f) => 0.2 * reach(Math.max(0, v - vs[f] - 100), 160));
  // episodes: dive-high screen difference > 0.04 H
  const diff = d.dive.map((y, f) => y - d.high[f]); let ep = [], on = false, a = 0;
  for (let f = 0; f < d.n; f++) {if (!on && diff[f] > 0.04) {on = true; a = f;} if (on && diff[f] < 0.01) {on = false; ep.push([a / FPS, f / FPS, Math.max(...diff.slice(a, f))]);}}
  const airFrac = ep.map(([t0]) => d.air[Math.round(t0 * FPS)]).reduce((x, y) => x + y, 0);
  console.log(`${s}: ${ep.length} drop episodes >4% H in ${(d.n / FPS).toFixed(0)} s (${airFrac} start airborne): ` + ep.map(([a, b, m]) => `${a.toFixed(1)}-${b.toFixed(1)}(${(100 * m).toFixed(0)}%)`).join(' '));
  if (s === 'los') for (let f = 27.6 * FPS; f <= 29.6 * FPS; f += 2) console.log(`   t ${(f / FPS).toFixed(2)} vy ${vy[f].toFixed(0)} raw ${d.vy[f]} fast ${fast[f].toFixed(3)} high ${d.high[f].toFixed(3)} dive ${d.dive[f].toFixed(3)} air ${d.air[f]}`);
}
