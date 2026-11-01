/** Hits from a surface above (report only): every matched hit on saved rides, with
 * the direction of its scored push (down = a surface above the rider), the
 * points and lines touched in its first frames, the arc's contact side, the
 * velocity just before, timing, and the air/speed errors of the gaps around it.
 * Writes one JSON row per hit.
 * node --import tsx tools/research/upper_hits.ts ARM_DIR OUT.jsonl */
import {readdirSync, readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {gunzipSync} from 'node:zlib';
import {readJson} from '../eval/records.ts';
import {readArmTrack} from '../eval/arms.ts';
import {resolveCase} from '../eval/inputs.ts';
import {observe} from '../measure/observe.ts';
import {strikeMotionFrames, detectStrikes, accountStrikes, STRIKE_V3_CONTRACT} from '../measure/strike.ts';
import {LineRiderEngine as Engine} from '../../scripts/lib/native_motion/engine.ts';
const dir = process.argv[2], out = process.argv[3], arm = {dir} as any, rows: any[] = [];
for (const f of readdirSync(join(dir, 'cells')).filter(f => /\d\.json$/.test(f))) {
  const cell = readJson(join(dir, 'cells', f));
  if (['E', 'H'].includes(cell.case.bench.stratum)) continue;
  const gal = JSON.parse(gunzipSync(readFileSync(join(dir, 'cells', f.replace('.json', '.gallery.json.gz')))).toString()).result.rows;
  const {music} = await resolveCase(cell.case, -15), track = readArmTrack(arm, cell.case.id);
  const o = observe(track, music.durationFrames, music.contacts), mf = strikeMotionFrames(o);
  const at = new Map(mf.map((x, i) => [x.frame, i]));
  const ev = detectStrikes(mf, STRIKE_V3_CONTRACT).filter(e => e.onset <= music.durationFrames), acc = accountStrikes(ev, music.contacts, STRIKE_V3_CONTRACT);
  const secs = cell.geometry?.sections ?? [];
  const gapErr = (g: number, axis: string) => {const r = cell.gaps.find((x: any) => x[0] === g && x[1] === axis); return r && r[3] !== null ? r[3] - r[2] : null;};
  const guideIds = new Set<number>(gal.flatMap((r: any) => r.railGuides ?? []));
  for (const m of acc.matches) {
    const e = ev[m.event], t = music.contacts[m.target], j = m.target, row = gal[j + 1];
    if (t.impact === undefined || !row) continue;
    const a = at.get(e.onset)!, b = at.get(e.end)!;
    let best = {s: -1, x: 0, y: 0};
    for (let k = a; k <= Math.max(a, b - 1); k++) {
      const w = [mf[k], mf[Math.min(k + 1, b)]].filter((q, n) => n === 0 || k + 1 <= b);
      const x = w.reduce((s, q) => s + q.impulse![0], 0), y = w.reduce((s, q) => s + q.impulse![1], 0), z = w.reduce((s, q) => s + q.impulse![2], 0);
      const s = Math.hypot(x, y, z); if (s > best.s) best = {s, x, y};
    }
    // Which lines the body or sled touched in the first contact frames of the hit.
    const touched = new Set<number>(), points = new Set<number>(), owners = new Set<number>();
    for (let g = e.contactStart; g <= e.contactStart + 2; g++) for (const [id, p] of o.frames[g]?.collisions ?? []) {touched.add(id); points.add(p); owners.add(Math.floor((id - 1000) / 10000) - (j + 1));}
    const vb = o.frames[e.contactStart - 1]?.v ?? [0, 0];
    const sec = secs[j + 1];
    rows.push({spec: cell.case.id, beat: j, ask: t.impact, got: e.strength, offset: m.offset, pushDown: best.y > 0, pushY: best.y, pushX: best.x,
      side: row.control.contactSide ?? 1, guideHit: [...touched].some(id => guideIds.has(id)), points: [...points], owners: [...owners], vx: vb[0], vy: vb[1], peakLag: e.peakFrame - e.onset, onsetLag: e.onset - e.contactStart, family: sec?.family, rail: (sec?.guideFrames ?? 0) > 0,
      before: (music.contacts[j]?.frame ?? 0) - (music.contacts[j - 1]?.frame ?? 0),
      airBefore: gapErr(j, 'air'), speedBefore: gapErr(j, 'speed'), airAfter: gapErr(j + 1, 'air'), speedAfter: gapErr(j + 1, 'speed')});
  }
  Engine.retainOnly([]);
}
writeFileSync(out, rows.map(r => JSON.stringify(r)).join('\n')); console.log(rows.length);
