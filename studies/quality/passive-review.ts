/** Inspect the predeclared quiet counterexample without selecting different authoring. */
import {mkdirSync,writeFileSync} from 'node:fs';
import {loadRun,readTrack} from '../../tools/eval/records.ts';
import {renderRides,assertReviewSources,cutClip} from '../../tools/measure/clip_render.ts';
import {observe} from '../../tools/measure/observe.ts';
import {LineRiderEngine as Engine} from '../../scripts/lib/native_motion/engine.ts';
process.chdir('/home/wyss/line');
const root='/tmp/line-quality-passive-arrival-20261006/generated/eval/q65-passive-arrival',run=loadRun(root);
const id='amour_de_ma_vie_44s~404',cell=run.cells.get(id),track=readTrack(root,id),out='generated/report/quality-20261005/passive';
assertReviewSources(cell.case.song,cell.case.input);
const o=observe(track,1782,cell.case.targets),bodyFrames=o.frames.slice(1,129).filter(f=>f.collisions.some(c=>c[1]>=4&&c[1]<=7)).length;
Engine.retainOnly([]);mkdirSync(out,{recursive:true});
writeFileSync(out+'/opening.json',JSON.stringify({compiler:run.run.identity,case:cell.case,trackHash:cell.trackHash,first128FramesWithBodyContact:bodyFrames,
  firstThreeImpacts:cell.impact3.perBeat.slice(0,3),note:'This counts all body-contact frames for diagnosis; it is not the six-frame drag guard.'},null,2));
await renderRides(new Map([[id,{song:cell.case.song,track}]]),out+'/rides',1);
cutClip(out+'/rides/'+id+'.mp4',65,out+'/opening.mp4');
console.log('Quiet counterexample rendered; body-contact frames in first128:',bodyFrames);
