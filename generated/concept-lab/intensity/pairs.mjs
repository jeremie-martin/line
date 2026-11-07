// The blind passages. Predictions are written to pairs-key.json BEFORE the owner sees any curve; the page loads only pairs.json.
// Clips are 5 s, and they avoid the first 4 s and the last 7 s (whole-course bookends live there in the films).
import fs from 'node:fs';
const C = JSON.parse(fs.readFileSync('intensity/curves.json')), LEN = 5, HZ = 2, clips = [];
const mean = (a, t) => {const i = Math.round(t * HZ), j = i + LEN * HZ; let s = 0; for (let f = i; f < j; f++) s += a[f]; return s / (j - i);};
for (const [song, c] of Object.entries(C)) for (let t = 4; t < c.duration - 7 - LEN; t += 1) clips.push({song, t, both: mean(c.both, t), speed: mean(c.speed, t), impact: mean(c.impact, t)});
// xorshift, fixed seed: reproducible, and not chosen by looking at the music
let st = 20261106; const rnd = () => {st ^= st << 13; st ^= st >>> 17; st ^= st << 5; st >>>= 0; return st / 2 ** 32;};
const shuffle = a => {for (let i = a.length - 1; i > 0; i--) {const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]];} return a;};
const used = [], fresh = c => used.every(u => u.song !== c.song || Math.abs(u.t - c.t) >= 8);
const take = (kind, count, ok) => {
  const out = [], perSong = {}, pool = shuffle(clips.slice());
  for (const a of pool) {
    if (out.length === count) break; if (!fresh(a) || (perSong[a.song] ?? 0) >= Math.ceil(count / 3)) continue;
    const b = pool.find(b => b !== a && fresh(b) && ok(a, b)); if (!b) continue;
    out.push({kind, a, b}); used.push(a, b); perSong[a.song] = (perSong[a.song] ?? 0) + 1;
  }
  console.log(kind, out.length, 'of', count); return out;
};
const same = (a, b) => a.song === b.song && Math.abs(a.t - b.t) >= 8;
// On all 22 rides the two ingredients nearly agree once shaped (corr 0.65–0.96), so true disagreements are rare and small.
const split = take('split', 2, (a, b) => same(a, b) && a.speed - b.speed >= 0.07 && b.impact - a.impact >= 0.07);
const pairs = [
  ...split,
  // close calls: the metric's real claim. Easy pairs would agree with anything.
  ...take('close', 5, (a, b) => same(a, b) && a.both - b.both >= 0.14 && a.both - b.both <= 0.3 && a.speed > b.speed && a.impact > b.impact),
  // two sanity pairs: clearly different
  ...take('clear', 2, (a, b) => same(a, b) && a.both - b.both >= 0.4),
  // two songs: the shared scale claims these differ; a per-song scale would rank them differently or not at all
  ...take('across', 3, (a, b) => a.song !== b.song && a.both - b.both >= 0.2 && a.both - b.both <= 0.4 && a.both > .35),
];
// two repeats, sides swapped: how repeatable a felt answer is, which is the ceiling for any metric
const rep = [pairs.find(p => p.kind === 'close'), pairs.find(p => p.kind === 'split') ?? pairs.findLast(p => p.kind === 'close')].map(p => ({kind: 'repeat', a: p.b, b: p.a, of: pairs.indexOf(p)}));
const all = shuffle([...pairs, ...rep]).map((p, i) => ({id: i + 1, ...p}));
for (const p of all) if (p.kind !== 'repeat') {if (rnd() < .5) [p.a, p.b] = [p.b, p.a]; p.A = p.a; p.B = p.b;}
// a repeat shows the original with its sides swapped, whatever the original's sides ended up being
for (const p of all) if (p.kind === 'repeat') {const o = all.find(q => q.kind !== 'repeat' && pairs[p.of] && q.a.song === pairs[p.of].a.song && [q.a.t, q.b.t].includes(p.a.t) && [q.a.t, q.b.t].includes(p.b.t)); p.A = o.B; p.B = o.A; p.of = o.id;}
const round = c => ({song: c.song, t: c.t});
fs.writeFileSync('intensity/pairs.json', JSON.stringify(all.map(p => ({id: p.id, A: round(p.A), B: round(p.B)}))));
const verdict = k => p => p.A[k] > p.B[k] ? 'A' : 'B';
fs.writeFileSync('intensity/pairs-key.json', JSON.stringify(all.map(p => ({id: p.id, kind: p.kind, of: p.of, both: verdict('both')(p), speed: verdict('speed')(p), impact: verdict('impact')(p), A: p.A, B: p.B})), null, 1));
for (const p of all) console.log(String(p.id).padStart(2), p.kind.padEnd(7), p.A.song.padEnd(9), String(p.A.t).padStart(3), ' ', p.B.song.padEnd(9), String(p.B.t).padStart(3), ' both', p.A.both.toFixed(2), p.B.both.toFixed(2), ' speed', p.A.speed.toFixed(2), p.B.speed.toFixed(2), ' impact', p.A.impact.toFixed(2), p.B.impact.toFixed(2), p.of ? '(repeat of ' + p.of + ')' : '');
