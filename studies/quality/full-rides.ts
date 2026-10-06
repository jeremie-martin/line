/** One fixed fresh-panel seed for all four songs, independent of clip ranking. */
import {writeFileSync} from 'node:fs';
import {loadRun,readTrack,assertPairedRuns} from '../../tools/eval/records.ts';
import {renderRides,assertReviewSources} from '../../tools/measure/clip_render.ts';
const main='/home/wyss/line',out='generated/report/quality-20261005/q67',root='/tmp/line-quality-passive-final-20261006/generated/eval/';
process.chdir(main);
const runs={before:loadRun(root+'quality-passive-baseline-remeasured'),after:loadRun(root+'quality-passive-final')};
assertPairedRuns(runs.before,runs.after);
const cases=[...runs.after.cells.values()].filter(c=>!c.case.perturbation&&c.case.seed===3001);
const tracks=new Map<string,{song:string;track:any}>();
for(const c of cases)for(const [side,run]of Object.entries(runs)){
 assertReviewSources(c.case.song,c.case.input);
 tracks.set(`${side}~${c.case.id}`,{song:c.case.song,track:readTrack(run.dir,c.case.id)});
}
await renderRides(tracks,out+'/rides',2);
const pairs=cases.map(c=>({id:c.case.id,song:c.case.song,seed:c.case.seed,...Object.fromEntries(Object.entries(runs).map(([side,run])=>[side,{src:`/${out}/rides/${side}~${c.case.id}.mp4`,trackHash:run.cells.get(c.case.id).trackHash}]))}));
writeFileSync(out+'/full-rides.json',JSON.stringify({selection:'All four songs at seed3001, the first predeclared seed of the fresh panel; no selection by outcome.',before:runs.before.run.identity,after:runs.after.run.identity,evaluator:runs.after.run.evaluator,pairs},null,2)+'\n');
console.log('Four complete paired musical rides verified');
