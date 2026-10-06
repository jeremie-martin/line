/** Two explicitly diagnostic counterexamples, cut from verified existing rides. */
import {mkdirSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {loadRun, readTrack} from '../../tools/eval/records.ts';
import {verifyCachedRide, reviewRenderInput, assertReviewSources, cutClip} from '../../tools/measure/clip_render.ts';
const main = '/home/wyss/line', out = 'generated/report/quality-20261005/drag';
process.chdir(main); mkdirSync(out, {recursive: true});
const picks = [
  {id:'amour_de_ma_vie_44s~404', frame:65, title:'Quiet opening · Amour 404 · body contact from 1.625–2.05 s'},
  {id:'amour_de_ma_vie_44s~101', frame:262, title:'Strong passage · Amour 101 · body contact from 6.55–6.975 s'},
];
const rows = picks.map((p, i) => {
  const pair: any = {...p};
  for (const [side, name] of [['before','q52-baseline-remeasured'],['after','q52-cached-contacts']]) {
    const run = loadRun(name), c = run.cells.get(p.id), track = readTrack(run.dir,p.id);
    assertReviewSources(c.case.song,c.case.input);
    const movie = `generated/report/quality-20261005/q52/rides/${name}~${p.id}.mp4`;
    verifyCachedRide(movie,reviewRenderInput(c.case.song,track));
    const file = join(out,`${i+1}-${side}.mp4`); cutClip(movie,p.frame,file);
    pair[side] = {src:'/'+file,rideSrc:'/'+movie,trackHash:c.trackHash};
  }
  return pair;
});
writeFileSync(join(out,'clips.json'),JSON.stringify({note:'Both sides use the same music time. The marked second is the candidate body-contact run start, not a matched beat or an impact-strength claim.',pairs:rows},null,2));
console.log('Two diagnostic body-contact comparisons; cached source identities and movie bytes verified');
