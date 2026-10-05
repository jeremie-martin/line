/** Survivable-hit envelope: which single hits on a straight surface the rider
 * survives, and how strong they read under the product account (line.strike.v3).
 * The rider (authored start pose) flies at speed v with heading θ (degrees below
 * horizontal) into a long line tilted β (degrees, descending to the right); the
 * incidence is θ − β. Ceilings: the rider rises into a line above it.
 *
 *   node --import tsx tools/measure/survival_envelope.ts [--out=FILE.json] */
import {writeFileSync} from 'node:fs';
import {observe} from './observe.ts';
import {strikeMotionFrames, detectStrikes, STRIKE_V3_CONTRACT} from './strike.ts';

const G = .175, rad = (d: number) => d * Math.PI / 180;
const arg = (k: string, d: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;

/** One hit: returns the v3 strength of the first impact on the surface and whether
 * the rider is still mounted with the sled intact 20 frames after it. */
export function hit(v: number, theta: number, beta: number, roof = false) {
  const vx = v * Math.cos(rad(theta)), vy = (roof ? -1 : 1) * v * Math.sin(rad(theta));
  // The surface passes about 12 px beyond where the rider is after 6 frames of flight.
  const px = 6 * vx, py = 6 * vy + .5 * G * 36 + (roof ? -14 : 12);
  const dx = Math.cos(rad(beta)), dy = Math.sin(rad(beta)), L = 3000;
  // Floors are drawn left to right, ceilings right to left (the colliding side faces the rider).
  const [a, b] = roof ? [[px + L * dx, py + L * dy], [px - L * dx, py - L * dy]] : [[px - L * dx, py - L * dy], [px + L * dx, py + L * dy]];
  const track = {startPosition: {x: 0, y: 0}, riders: [{startPosition: {x: 0, y: 0}, startVelocity: {x: vx, y: vy}}],
    lines: [{id: 1, type: 0, x1: a[0], y1: a[1], x2: b[0], y2: b[1], flipped: false, leftExtended: false, rightExtended: false}]};
  const o: any = observe(track, 80, []);
  const first = o.frames.findIndex((f: any) => f.collisions.length);
  if (first < 1) return {touched: false};
  const e = detectStrikes(strikeMotionFrames(o), STRIKE_V3_CONTRACT).find(x => x.contactStart >= first);
  const at = Math.min(o.frames.length - 1, first + 20), f = o.frames[at];
  const crashed = o.terminus.frame < first + 20 || !f.mounted || !f.intact;
  return {touched: true, frame: first, strength: e?.strength ?? 0, survived: !crashed};
}

if (import.meta.filename === process.argv[1]) {
  if (process.argv.includes('--fine')) {
    // Flat floor, fine grid around the survive/crash boundary.
    const rows: any[] = [];
    for (let v = 5; v <= 12.01; v += .5) for (let theta = 25; theta <= 85.01; theta += 2.5) {
      const r: any = hit(v, theta, 0);
      if (r.touched) rows.push({v, theta, normal: v * Math.sin(rad(theta)), ...r});
    }
    const ok = rows.filter(r => r.survived).sort((a, b) => b.strength - a.strength);
    console.log('strongest survived (fine grid, flat floor):', ok.slice(0, 8).map(r => `v${r.v} ${r.theta}° n${r.normal.toFixed(1)} → ${r.strength.toFixed(2)}`).join('; '));
    for (const lo of [.85, .9, .95, .99]) console.log(`  survived with strength ≥ ${lo}: ${ok.filter(r => r.strength >= lo).length} of ${rows.length}`);
    const out = arg('out', ''); if (out) writeFileSync(out, JSON.stringify(rows, null, 1));
    process.exit(0);
  }
  const rows: any[] = [];
  for (const roof of [false, true]) for (const beta of roof ? [0] : [-30, 0, 30]) for (const theta of [0, 15, 30, 45, 60, 75]) for (const v of [4, 6, 8, 10, 12, 14]) {
    if (!roof && theta - beta <= 0) continue;
    rows.push({surface: roof ? 'ceiling' : `floor β${beta}`, v, theta, incidence: roof ? theta : theta - beta, normal: v * Math.sin(rad(roof ? theta : theta - beta)), ...hit(v, theta, beta, roof)});
  }
  const out = arg('out', '');
  if (out) writeFileSync(out, JSON.stringify(rows, null, 1));
  for (const surface of [...new Set(rows.map(r => r.surface))]) {
    console.log(`\n${surface}: v3 strength (x = crashed, - = no contact); rows incidence, columns speed`);
    const speeds = [...new Set(rows.map(r => r.v))];
    console.log('incid.' + speeds.map(v => String(v).padStart(7)).join(''));
    for (const inc of [...new Set(rows.filter(r => r.surface === surface).map(r => r.incidence))].sort((a, b) => a - b)) {
      console.log(String(inc).padStart(5) + '°' + speeds.map(v => {
        const r = rows.find(x => x.surface === surface && x.incidence === inc && x.v === v);
        return (!r ? '' : !r.touched ? '-' : (r.survived ? r.strength.toFixed(2) : 'x' + r.strength.toFixed(2))).padStart(7);
      }).join(''));
    }
  }
  const ok = rows.filter(r => r.touched && r.survived), strongest = ok.sort((a, b) => b.strength - a.strength).slice(0, 5);
  console.log('\nstrongest survived:', strongest.map(r => `${r.surface} v${r.v} incidence ${r.incidence}° → ${r.strength.toFixed(2)}`).join('; '));
  process.exit(0);
}
