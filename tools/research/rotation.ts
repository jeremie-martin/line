/** How much the rider rotates between catches, and what at the release sets it (report only). For every flight between
 * two catches in rides `npm run compare` saved (replayed once): the rider's spin as it leaves the line (the sled axis's
 * turn per frame over the first three frames of free flight), the total turn of the sled axis over the flight, and the
 * rider's orientation the frame before the next catch: the angle between the body's direction from the sled (sled centre
 * → shoulder) and straight up (0° upright, 90° on its side, 180° upside down). At the release it records what the line
 * did there: how much the last line touched turns from the one before it (a lip: + turns the rider's nose up), the
 * release heading, and the family of the gap released from. Screen y points down; angles in degrees, + clockwise.
 *
 *   node tools/research/rotation.ts [--arm=2fee4728896e469a] [--seeds=101,202,303,404] [--out=FILE.jsonl] */
import {readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {join} from 'node:path';
import {observe, POINTS} from '../measure/observe.ts';

const arg = (k: string, d: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const dir = join('generated/eval/arms', arg('arm', '2fee4728896e469a'), 'cells'), seeds = arg('seeds', '101,202,303,404').split(',');
const deg = (r: number) => r * 180 / Math.PI, wrap = (a: number) => ((a + 540) % 360) - 180;
const gz = (p: string) => JSON.parse(gunzipSync(readFileSync(p)).toString());
const I = (k: string) => POINTS.indexOf(k), SLED = ['PEG', 'TAIL', 'NOSE', 'STRING'].map(I);

const axis = (fr: any) => deg(Math.atan2(fr.points[I('NOSE')][1] - fr.points[I('TAIL')][1], fr.points[I('NOSE')][0] - fr.points[I('TAIL')][0]));
/** The body's direction from the sled centre against straight up (screen −y): 0 upright, 180 upside down. */
function tilt(fr: any) {
  const cx = SLED.reduce((a, k) => a + fr.points[k][0], 0) / 4, cy = SLED.reduce((a, k) => a + fr.points[k][1], 0) / 4;
  const [sx, sy] = fr.points[I('SHOULDER')];
  return Math.abs(wrap(deg(Math.atan2(sx - cx, -(sy - cy)))));
}
const lineAngle = (l: any) => deg(Math.atan2(l.y2 - l.y1, l.x2 - l.x1)) + (l.flipped ? 180 : 0);

const rows: any[] = [];
for (const f of readdirSync(dir).filter(f => /~v8-.*~\d+\.json$/.test(f) && seeds.some(s => f.endsWith(`~${s}.json`))).sort()) {
  const id = f.slice(0, -5), cell = JSON.parse(readFileSync(join(dir, f), 'utf8'));
  const track = gz(join(dir, `${id}.track.json.gz`)), lines = new Map<number, any>(track.lines.map((l: any) => [l.id, l]));
  const frames = observe(track, cell.terminus.frame, cell.case.targets).frames, sections = cell.geometry.sections;
  cell.impact3.perBeat.forEach((b: any, j: number) => {
    const start = b.hit?.contactStart;
    if (!start || start < 4) return;
    // the flight before this catch: back from the catch to the last frame with contact
    let release = start - 1;
    while (release > 0 && !frames[release].collisions.length) release--;
    const air = start - 1 - release;
    if (air < 4 || release < 3) return;
    // the line touched last at the release, and the one touched before it
    const touched: number[] = [];
    for (let t = release; t > Math.max(0, release - 12) && touched.length < 2; t--)
      for (const [lid] of frames[t].collisions) if (!touched.includes(lid) && lines.has(lid)) touched.push(lid);
    const lip = touched.length === 2 ? wrap(lineAngle(lines.get(touched[0])) - lineAngle(lines.get(touched[1]))) : null;
    let turn = 0;
    for (let t = release + 1; t < start; t++) turn += wrap(axis(frames[t]) - axis(frames[t - 1]));
    const spin = wrap(axis(frames[release + 3]) - axis(frames[release])) / 3;
    // the rider's turn per frame while still on the line, over the last three contact frames: the line's own turning
    const onLine = wrap(axis(frames[release]) - axis(frames[release - 3])) / 3;
    const v = frames[release + 1].points.reduce((a: number[], [x, y, px, py]: number[]) => [a[0] + x - px, a[1] + y - py], [0, 0]);
    // the gap released from: the gap whose lines the rider leaves (line id → gap), else the catching gap's predecessor
    const from = touched.length ? Math.floor((touched[0] - 1000) / 10000) : j;
    rows.push({ride: id, beat: j, ask: b.requested, kind: b.hit.contact, air, spin, turn, tiltAtCatch: tilt(frames[start - 1]),
      tiltAtRelease: tilt(frames[release]), lip, onLine, releaseHeading: deg(Math.atan2(v[1], v[0])), family: sections[from]?.family ?? null,
      strength: b.hit.strength});
  });
}
if (arg('out', '')) writeFileSync(arg('out', ''), rows.map(r => JSON.stringify(r)).join('\n') + '\n');

const q = (xs: number[], p: number) => {const s = xs.filter(Number.isFinite).sort((a, b) => a - b); return s[Math.floor(p * (s.length - 1))];};
const mean = (xs: number[]) => {const v = xs.filter(Number.isFinite); return v.reduce((a, b) => a + b, 0) / v.length;};
const pc = (x: number) => `${(100 * x).toFixed(1)}%`, share = (xs: boolean[]) => xs.filter(Boolean).length / xs.length;
const corr = (a: number[], b: number[]) => {
  const k = a.map((x, i) => Number.isFinite(x) && Number.isFinite(b[i])), x = a.filter((_, i) => k[i]), y = b.filter((_, i) => k[i]);
  const mx = mean(x), my = mean(y); let n = 0, sx = 0, sy = 0;
  x.forEach((v, i) => {n += (v - mx) * (y[i] - my); sx += (v - mx) ** 2; sy += (y[i] - my) ** 2;});
  return n / Math.sqrt(sx * sy);
};
console.log(`${rows.length} flights of 4 frames or more before a catch; ${dir}`);
console.log(`air frames p10/p50/p90: ${q(rows.map(r => r.air), .1)} / ${q(rows.map(r => r.air), .5)} / ${q(rows.map(r => r.air), .9)}`);
console.log(`spin at release, deg/frame, p10/p50/p90: ${q(rows.map(r => r.spin), .1).toFixed(2)} / ${q(rows.map(r => r.spin), .5).toFixed(2)} / ${q(rows.map(r => r.spin), .9).toFixed(2)}`);
console.log(`turn over the flight, deg, p10/p50/p90: ${q(rows.map(r => r.turn), .1).toFixed(0)} / ${q(rows.map(r => r.turn), .5).toFixed(0)} / ${q(rows.map(r => r.turn), .9).toFixed(0)}; |turn| over 45°: ${pc(share(rows.map(r => Math.abs(r.turn) > 45)))}, over 90°: ${pc(share(rows.map(r => Math.abs(r.turn) > 90)))}`);
console.log(`tilt at the catch (0 upright, 180 upside down): p50 ${q(rows.map(r => r.tiltAtCatch), .5).toFixed(0)}°, p90 ${q(rows.map(r => r.tiltAtCatch), .9).toFixed(0)}°, p99 ${q(rows.map(r => r.tiltAtCatch), .99).toFixed(0)}°; over 60°: ${pc(share(rows.map(r => r.tiltAtCatch > 60)))}, over 90°: ${pc(share(rows.map(r => r.tiltAtCatch > 90)))}`);
console.log(`does the release spin carry the flight? corr(spin × air, turn) = ${corr(rows.map(r => r.spin * r.air), rows.map(r => r.turn)).toFixed(2)}`);
console.log(`spin carried from the line: corr(turn rate on the line, spin) = ${corr(rows.map(r => r.onLine), rows.map(r => r.spin)).toFixed(2)}; mean spin − on-line rate ${mean(rows.map(r => r.spin - r.onLine)).toFixed(2)} deg/frame`);
console.log(`what sets the spin: corr(lip, spin) = ${corr(rows.map(r => r.lip), rows.map(r => r.spin)).toFixed(2)}; corr(tilt at release, spin) = ${corr(rows.map(r => r.tiltAtRelease), rows.map(r => r.spin)).toFixed(2)}; corr(release heading, spin) = ${corr(rows.map(r => r.releaseHeading), rows.map(r => r.spin)).toFixed(2)}`);
for (const lo of [-30, -15, -5, 5, 15]) {
  const hi = lo === 15 ? 999 : lo === -30 ? -15 : lo === -15 ? -5 : lo === -5 ? 5 : 15, g = rows.filter(r => r.lip !== null && r.lip >= (lo === -30 ? -999 : lo) && r.lip < hi);
  console.log(`  lip ${lo === -30 ? '<-15' : lo === 15 ? '>15' : `${lo}..${hi}`}°: ${g.length} flights, spin ${mean(g.map(r => r.spin)).toFixed(2)} deg/frame, flight turn ${mean(g.map(r => r.turn)).toFixed(0)}°, tilt at catch over 60° ${pc(share(g.map(r => r.tiltAtCatch > 60)))}`);
}
for (const fam of [...new Set(rows.map(r => r.family))]) {
  const g = rows.filter(r => r.family === fam);
  console.log(`  released from ${fam}: ${g.length} flights, |spin| ${mean(g.map(r => Math.abs(r.spin))).toFixed(2)}, |turn| ${mean(g.map(r => Math.abs(r.turn))).toFixed(0)}°, tilt at catch over 60° ${pc(share(g.map(r => r.tiltAtCatch > 60)))}`);
}
for (const k of ['upper', 'floor']) {
  const g = rows.filter(r => r.kind === k && r.ask >= .6);
  console.log(`  strong ${k} catches: ${g.length}, tilt at catch p50 ${q(g.map(r => r.tiltAtCatch), .5).toFixed(0)}° p90 ${q(g.map(r => r.tiltAtCatch), .9).toFixed(0)}°, |flight turn| ${mean(g.map(r => Math.abs(r.turn))).toFixed(0)}°`);
}
process.exit(0);
