// Camera telemetry: how the rider moves in the frame, against how it moves in the world.
// node generated/concept-lab/camstats.mjs [tag]   (reads analysis/pos-<song><tag>.json written by camdump.mjs)
import {readFileSync, existsSync} from 'node:fs';
const tag = process.argv[2] ?? '', FPS = 40, W = 1080, H = 1920;
const SONGS = ['los', 'petrunko', 'lua', 'batidao', 'burn', 'coma', 'tomada'], CAMS = ['today', 'tamed', 'high', 'dive', 'follow'];
const q = (a, p) => {const s = [...a].sort((x, y) => x - y); return s[Math.floor(p * (s.length - 1))];};
const rows = [];
for (const song of SONGS) {
  const file = new URL(`./analysis/pos-${song}${tag}.json`, import.meta.url);
  if (!existsSync(file)) continue;
  const d = JSON.parse(readFileSync(file)), n = d.vel.length, min = n / FPS / 60;
  const ang = d.vel.map(([x, y]) => Math.atan2(y, Math.abs(x)) * 180 / Math.PI), speed = d.vel.map(([x, y]) => Math.hypot(x, y));
  for (const cam of CAMS) {
    if (!d[cam]) continue;
    const P = d[cam], sv = P.map((p, f) => {const a = P[Math.max(0, f - 1)], b = P[Math.min(n - 1, f + 1)]; return [(b[0] - a[0]) * FPS / 2, (b[1] - a[1]) * FPS / 2];});
    const y = P.map(p => p[1] / H);
    // the artefact the owner disliked: the rider rising on screen while it is going down in the world
    const falseClimb = sv.filter((v, f) => v[1] < -60 && d.vel[f][1] > 120).length / FPS / min;
    // any screen motion against the world motion (cosine < −0.3, both clearly moving)
    const against = sv.filter((v, f) => {const a = Math.hypot(...v), b = speed[f]; return a > 80 && b > 100 && (v[0] * d.vel[f][0] + v[1] * d.vel[f][1]) / (a * b) < -0.3;}).length / FPS / min;
    const activity = sv.reduce((s, v) => s + Math.hypot(...v), 0) / n;
    const grounded = f => !d.air[f] && speed[f] > 150;
    const mean = sel => {let s = 0, c = 0; for (let f = 0; f < n; f++) if (sel(f)) {s += y[f]; c++;} return c ? s / c : NaN;};
    const steep = mean(f => grounded(f) && ang[f] > 45) - mean(f => grounded(f) && ang[f] > 10 && ang[f] < 35);
    let drops = 0; for (let f = 24; f < n; f++) {let m = Infinity; for (let g = f - 24; g < f; g++) m = Math.min(m, y[g]); if (y[f] - m > 0.05) {drops++; f += 60;}}
    rows.push({song, cam, y50: q(y, 0.5), y5: q(y, 0.05), y95: q(y, 0.95), activity, falseClimb, against, steep, drops: drops / min});
  }
}
const fmt = (v, k = 3) => Number.isFinite(v) ? v.toFixed(k) : '–';
console.log('song      camera   y p5   p50   p95 | activity px/s | false climb s/min | against s/min | steep − normal (H) | drops>5%/min');
for (const r of rows) console.log(`${r.song.padEnd(9)} ${r.cam.padEnd(7)} ${fmt(r.y5)} ${fmt(r.y50)} ${fmt(r.y95)} | ${fmt(r.activity, 0).padStart(8)} | ${fmt(r.falseClimb, 2).padStart(10)} | ${fmt(r.against, 2).padStart(8)} | ${fmt(r.steep).padStart(8)} | ${fmt(r.drops, 1)}`);
// the mean over songs, per camera
console.log('\nmean over songs');
for (const cam of CAMS) {const rs = rows.filter(r => r.cam === cam); if (!rs.length) continue; const m = k => rs.reduce((s, r) => s + r[k], 0) / rs.length;
  console.log(`${cam.padEnd(7)} y50 ${fmt(m('y50'))}  activity ${fmt(m('activity'), 0)}  false climb ${fmt(m('falseClimb'), 2)}  against ${fmt(m('against'), 2)}  steep ${fmt(m('steep'))}  drops ${fmt(m('drops'), 1)}`);}
