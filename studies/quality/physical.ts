/** Diagnostic only: describe the motion available before each matched hit. */
import {writeFileSync} from 'node:fs';
import {loadRun, readTrack} from '../../tools/eval/records.ts';
import {resolveCase} from '../../tools/eval/inputs.ts';
import {observe} from '../../tools/measure/observe.ts';
import {strikeMotionFrames, detectStrikes, accountStrikes, STRIKE_V3_CONTRACT} from '../../tools/measure/strike.ts';
import {LineRiderEngine as Engine} from '../../scripts/lib/native_motion/engine.ts';

const run = loadRun(process.argv[2]), rows: any[] = [];
for (const c of run.run.panel) {
  const track = readTrack(run.dir, c.id), cell = run.cells.get(c.id);
  const {music, planned} = await resolveCase(c, run.run.jolt);
  if (JSON.stringify(planned) !== JSON.stringify(c)) throw new Error('input identity differs');
  const D = music.durationFrames;
  const o = observe(track, D, c.targets), frames = strikeMotionFrames(o);
  const events = detectStrikes(frames, STRIKE_V3_CONTRACT).filter(e => e.onset <= D);
  const account = accountStrikes(events, c.targets, STRIKE_V3_CONTRACT);
  const byId = new Map<number, any>(track.lines.map((l: any) => [l.id, l]));
  for (const m of account.matches) {
    const e = events[m.event], t = c.targets[m.target];
    const before = o.frames[Math.max(0, e.contactStart - 1)], first = o.frames[e.contactStart];
    const velocity = before.points.reduce(([x,y], [a,b,p,q]) => [x+(a-p)/10,y+(b-q)/10], [0,0]);
    const axis = [before.points[2][0]-before.points[1][0], before.points[2][1]-before.points[1][1]];
    const unique = [...new Set(first.collisions.map(x => x[0]))];
    const normals = unique.map(id => {
      const l = byId.get(id), dx = l.x2-l.x1, dy=l.y2-l.y1, length=Math.hypot(dx,dy);
      return Math.abs((velocity[0]*dy-velocity[1]*dx)/length);
    });
    let best = {total:0,travel:0,spin:0,frame:0};
    for (let a=e.onset; a<=e.end; a++) {
      if (a+1>e.end && e.end>e.onset) break;
      const v=[0,0,0];
      for(let f=a;f<=Math.min(a+1,e.end);f++) frames[f].impulse!.forEach((x,k)=>v[k]+=x);
      const total=Math.hypot(...v);
      if(total>best.total) best={total,travel:Math.hypot(v[0],v[1]),spin:Math.abs(v[2]),frame:a};
    }
    rows.push({id:c.id,song:c.song,perturbation:c.perturbation??null,seed:c.seed,target:m.target,
      requested:t.impact,frame:t.frame,strength:e.strength,error:e.strength-(t.impact??0),
      onset:e.onset,contactStart:e.contactStart,length:e.end-e.contactStart+1,
      speed:Math.hypot(...velocity),heading:Math.atan2(velocity[1],velocity[0])*180/Math.PI,
      pose:Math.atan2(axis[1],axis[0])*180/Math.PI,normalSpeed:Math.max(0,...normals),
      points:[...new Set(first.collisions.map(x=>x[1]))],
      totalImpulse:best.total,travel:best.travel,spin:best.spin,strongestWindow:best.frame,
      savedStrength:cell.impact3.perBeat[m.target].hit?.strength});
  }
  Engine.retainOnly([]);
}
writeFileSync(process.argv[3], rows.map(r=>JSON.stringify(r)).join('\n')+'\n');
console.log(`${run.cells.size} rides; ${rows.length} matched hits`);
