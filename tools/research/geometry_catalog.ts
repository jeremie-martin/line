/** Pictures and usage numbers for the geometry catalog (docs/geometry-catalog.md).
 * From saved compare cells of one arm: for each geometry, example gaps drawn as
 * the compiler built them (main line dark, upper rail red, the rider's path
 * dotted blue, the neighbouring gaps faint), and how much of the rides each
 * geometry takes. Report only.
 * node tools/research/geometry_catalog.ts ARM_DIR */
import {readdirSync, writeFileSync, mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {observe} from '../measure/observe.ts';
import {resolveCase} from '../eval/inputs.ts';
import {readJson} from '../eval/records.ts';
import {readArmMeta, readArmTrack} from '../eval/arms.ts';

const armDir = process.argv[2], out = 'docs/assets/geometry';
mkdirSync(out, {recursive: true});
const arm = {dir: armDir} as any;
readArmMeta(armDir); // refuses an arm compiled under another timing setting
const cells = readdirSync(join(armDir, 'cells')).filter(f => f.endsWith('.json')).map(f => readJson(join(armDir, 'cells', f))).filter(c => c.complete && c.geometry);
const usage: Record<string, {frames: number; sections: number; railUsed: number; offered: number}> = {}, total = {frames: 0};
const candidates: Record<string, Array<{cell: any; i: number; frame: number; frames: number; rail: boolean}>> = {};
for (const cell of cells) {
  let frame = 1;
  cell.geometry.sections.forEach((s: any, i: number) => {
    const u = usage[s.family] ??= {frames: 0, sections: 0, railUsed: 0, offered: 0};
    u.frames += s.frames; u.sections++; total.frames += s.frames;
    if (s.guidance !== 'forbidden') {u.offered++; if (s.guideFrames > 0) u.railUsed++;}
    if (s.fulfilled && s.frames >= 24 && s.frames <= 48 && i > 1) (candidates[s.family] ??= []).push({cell, i, frame, frames: s.frames, rail: s.guideFrames > 0});
    frame += s.frames;
  });
}
console.log('geometry   share of ride time   gaps   upper rail offered   used when offered');
for (const [f, u] of Object.entries(usage).sort((a, b) => b[1].frames - a[1].frames))
  console.log(`${f.padEnd(11)}${(100 * u.frames / total.frames).toFixed(1).padStart(6)}%${String(u.sections).padStart(14)}${String(u.offered).padStart(14)}${(u.offered ? (100 * u.railUsed / u.offered).toFixed(0) + '%' : '—').padStart(20)}`);

/** One picture: the gap's lines and two neighbours on each side, and the rider path through the gap. */
async function draw(name: string, x: {cell: any; i: number; frame: number; frames: number}) {
  const track = readArmTrack(arm, x.cell.case.id), {music} = await resolveCase(x.cell.case);
  const sec = (l: any) => Math.floor((l.id - 1000) / 10000), chain = new Map<number, number>(), last = new Map<number, any>(), count = new Map<number, number>();
  for (const l of track.lines) {
    const s = sec(l), p = last.get(s); let k = count.get(s) ?? 0;
    if (p && (p.x2 !== l.x1 || p.y2 !== l.y1)) k++;
    count.set(s, k); last.set(s, l); chain.set(l.id, k);
  }
  const own = track.lines.filter((l: any) => sec(l) === x.i), near = track.lines.filter((l: any) => Math.abs(sec(l) - x.i) <= 2 && sec(l) !== x.i);
  const obs = observe(track, music.durationFrames, music.contacts);
  const path = obs.frames.slice(x.frame, x.frame + x.frames + 1).map((f: any) => {
    const p = f.points; return [p.reduce((n: number, q: number[]) => n + q[0], 0) / p.length, p.reduce((n: number, q: number[]) => n + q[1], 0) / p.length];
  });
  const xs = [...own.flatMap((l: any) => [l.x1, l.x2]), ...path.map(p => p[0])], ys = [...own.flatMap((l: any) => [l.y1, l.y2]), ...path.map(p => p[1])];
  const pad = 30, x0 = Math.min(...xs) - pad, x1 = Math.max(...xs) + pad, y0 = Math.min(...ys) - pad, y1 = Math.max(...ys) + pad;
  const W = 480, scale = W / (x1 - x0), H = Math.max(120, Math.min(320, (y1 - y0) * scale));
  const sy = H / (y1 - y0), s = Math.min(scale, sy), X = (v: number) => ((v - x0) * s).toFixed(1), Y = (v: number) => ((v - y0) * s).toFixed(1);
  const seg = (l: any, cls: string) => `<line class="${cls}" x1="${X(l.x1)}" y1="${Y(l.y1)}" x2="${X(l.x2)}" y2="${Y(l.y2)}"/>`;
  const scattered = x.cell.geometry.sections[x.i].family === 'scattered';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${((x1 - x0) * s).toFixed(0)} ${((y1 - y0) * s).toFixed(0)}" width="${((x1 - x0) * s).toFixed(0)}">
<style>line{stroke-linecap:round}.near{stroke:#bbb;stroke-width:2}.main{stroke:#222;stroke-width:3}.rail{stroke:#d33;stroke-width:3}.path{fill:none;stroke:#27c;stroke-width:1.5;stroke-dasharray:3 3}</style>
<rect width="100%" height="100%" fill="#fff"/>
${near.map((l: any) => seg(l, 'near')).join('\n')}
${own.map((l: any) => seg(l, !scattered && chain.get(l.id)! > 0 ? 'rail' : 'main')).join('\n')}
<polyline class="path" points="${path.map(p => `${X(p[0])},${Y(p[1])}`).join(' ')}"/>
</svg>\n`;
  writeFileSync(join(out, name + '.svg'), svg);
  return {name, id: x.cell.case.id, gap: x.i, frames: x.frames, seconds: (x.frame / 40).toFixed(2)};
}
const made = [];
for (const [family, list] of Object.entries(candidates)) {
  // One with the upper rail used and one without, where both exist; the middle of the length range.
  const pick = (rail: boolean) => list.filter(x => x.rail === rail).sort((a, b) => Math.abs(a.frames - 36) - Math.abs(b.frames - 36))[0];
  for (const [rail, x] of [[true, pick(true)], [false, pick(false)]] as const) if (x) made.push(await draw(`${family}-${rail ? 'rail' : 'norail'}`, x));
}
console.log(JSON.stringify(made, null, 1));
