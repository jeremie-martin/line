// What moves the rider's body: the push itself, or the change of the push? Shape motion (from positions, rigid-invariant)
// against |impulse| and |impulse − previous impulse| per contact frame.
import {accounts} from './recount.ts';
const PAIRS: number[][] = []; for (let i = 0; i < 10; i++) for (let j = i + 1; j < 10; j++) PAIRS.push([i, j]);
const xs: number[][] = [];
for (const dir of process.argv.slice(2)) {
  const a = accounts(dir); if (!a) continue; const F: number[][] = a.p.trace.frames, fr = a.frames;
  const dist = F.map(f => PAIRS.map(([i, j]) => Math.hypot(f[2 * i] - f[2 * j], f[2 * i + 1] - f[2 * j + 1])));
  for (let i = 3; i + 1 < Math.min(F.length, fr.length); i++) {
    if (!fr[i].contact && !fr[i - 1].contact) continue;
    const rate = (k: number) => Math.sqrt(dist[k].reduce((s, d, q) => s + (d - dist[k - 1][q]) ** 2, 0) / 45);
    const acc = Math.sqrt(dist[i].reduce((s, d, q) => s + (d - 2 * dist[i - 1][q] + dist[i - 2][q]) ** 2, 0) / 45);
    const I = fr[i].impulse, P = fr[i - 1].impulse;
    xs.push([Math.hypot(I[0], I[1], I[2]), Math.hypot(I[0] - P[0], I[1] - P[1], I[2] - P[2]), rate(i), acc, Math.max(rate(i), rate(i + 1))]);
  }
}
const cor = (a: number, b: number) => {const n = xs.length, ma = xs.reduce((s, x) => s + x[a], 0) / n, mb = xs.reduce((s, x) => s + x[b], 0) / n;
  let sab = 0, sa = 0, sb = 0; for (const x of xs) {sab += (x[a] - ma) * (x[b] - mb); sa += (x[a] - ma) ** 2; sb += (x[b] - mb) ** 2;} return sab / Math.sqrt(sa * sb);};
console.log(xs.length, 'contact frames');
console.log('shape speed (how fast the posture changes):   with push', cor(0, 2).toFixed(2), ' with change of push', cor(1, 2).toFixed(2), ' (next frame too:', cor(0, 4).toFixed(2), cor(1, 4).toFixed(2) + ')');
console.log('shape acceleration:                            with push', cor(0, 3).toFixed(2), ' with change of push', cor(1, 3).toFixed(2));
console.log('push vs change of push', cor(0, 1).toFixed(2));
// steady pushes: frames where the push is ≥0.3 but changed by under 20% of itself
const steady = xs.filter(x => x[0] >= .3 && x[1] < .2 * x[0]), jumpy = xs.filter(x => x[0] >= .3 && x[1] >= .8 * x[0]);
const mean = (a: number[][], k: number) => a.reduce((s, x) => s + x[k], 0) / a.length;
console.log('push ≥0.3 and steady:', steady.length, 'frames, mean push', mean(steady, 0).toFixed(2), 'shape speed', mean(steady, 2).toFixed(3), '| push ≥0.3 and changing:', jumpy.length, 'frames, mean push', mean(jumpy, 0).toFixed(2), 'shape speed', mean(jumpy, 2).toFixed(3));
