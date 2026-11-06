/** Descriptive study of unrequested impacts (v3 extras) in saved eval runs.
 * For each extra: section (and its family/guidance), which line it touched
 * (main chain or guide), which rider points, and its offset from the previous
 * and next beat. Report only; changes nothing.
 * node tools/research/stray_hits.ts RUN [RUN...] */
import {join} from 'node:path';
import {readJson, readTrack, runDir} from '../eval/records.ts';
import {resolveCase} from '../eval/inputs.ts';
import {observe} from '../measure/observe.ts';
import {LineRiderEngine as Engine} from '../../scripts/lib/native_motion/engine.ts';

const BODY = new Set([4, 5, 6, 7]);
const rows: any[] = [];
for (const name of process.argv.slice(2)) {
  const dir = runDir(name), run = readJson(join(dir, 'run.json'));
  for (const c of run.panel) {
    const cell = readJson(join(dir, 'cells', c.id + '.json'));
    if (!cell.complete || !cell.geometry) continue;
    const track = readTrack(dir, c.id), {music} = await resolveCase(c, run.jolt);
    const targets = music.contacts, obs = observe(track, music.durationFrames, targets);
    const frames = [1, ...targets.map((t: any) => t.frame)];
    // Chain index of every line within its section: 0 = main chain, 1+ = guide / fragments.
    const chainOf = new Map<number, [number, number]>(), last = new Map<number, any>(), chainN = new Map<number, number>();
    for (const l of track.lines) {
      const s = Math.floor((l.id - 1000) / 10000), p = last.get(s);
      let k = chainN.get(s) ?? 0;
      if (p && (p.x2 !== l.x1 || p.y2 !== l.y1)) k++;
      chainN.set(s, k); last.set(s, l); chainOf.set(l.id, [s, k]);
    }
    const geo = cell.geometry.sections;
    for (const e of cell.impact3.extras) {
      if (e.strength < .1) continue;
      const f = e.onset;
      let sec = frames.findIndex((fr, i) => f >= fr && f < (frames[i + 1] ?? Infinity));
      const prevBeat = targets.filter((t: any) => t.frame <= f).at(-1), nextBeat = targets.find((t: any) => t.frame > f);
      // Contacts during the event's first frames.
      const hits: Array<[number, number]> = [];
      for (let g = f; g <= f + 2 && g < obs.frames.length; g++) for (const x of obs.frames[g].collisions) hits.push(x as any);
      const lineSecs = [...new Set(hits.map(h => chainOf.get(h[0])))].map(v => v ? `${v[0]}:${v[1]}` : '?');
      const guide = hits.some(h => (chainOf.get(h[0])?.[1] ?? 0) > 0), main = hits.some(h => (chainOf.get(h[0])?.[1] ?? 1) === 0);
      const body = hits.some(h => BODY.has(h[1]));
      const lineSec = hits.length ? chainOf.get(hits[0][0])?.[0] ?? -1 : -1;
      const g = geo[sec] ?? {}, lg = geo[lineSec] ?? {};
      rows.push({run: name, id: c.id, stratum: c.bench?.stratum, f, strength: e.strength, cost: e.cost, sec, family: g.family, guidance: g.guidance,
        guideUsed: (g.guideFrames ?? 0) > 0, secFrames: g.frames, lineSec, lineFamily: lg.family,
        sinceBeat: prevBeat ? f - prevBeat.frame : null, toBeat: nextBeat ? nextBeat.frame - f : null,
        prevImpact: prevBeat?.impact ?? null, line: guide && main ? 'both' : guide ? 'guide' : main ? 'main' : 'none', body, lineSecs});
    }
    Engine.retainOnly([]);
  }
}
console.log(JSON.stringify(rows));
