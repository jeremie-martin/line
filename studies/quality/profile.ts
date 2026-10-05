/** One unchanged production compile for CPU profiling, with a verified input. */
import {resolveCase,digest} from '../../tools/eval/inputs.ts';
import {compileHandoff} from '../../scripts/v0/optimizer/handoff.ts';
import {productionBudget} from '../../scripts/v0/optimizer/production_budget.ts';
import {loadRun} from '../../tools/eval/records.ts';
import assert from 'node:assert/strict';
const song=process.argv[2]??'tiki_tiki_48s',seed=101;
const {spec,music}=await resolveCase({id:`${song}~${seed}`,song,seed,perturbation:null},-15);
const start=performance.now();
const c=compileHandoff(spec,seed,{budget:productionBudget(spec.duration),creative:{},impactContract:'line.strike.v3',
 phraseBoundaries:music.phases.map((p:any)=>p.t0??p.t??p.start).filter(Number.isFinite)});
const reference=loadRun('/home/wyss/line/generated/eval/quality-20261005-baseline').cells.get(`${song}~${seed}`);
assert.equal(digest(c.track),reference.trackHash);
assert.equal(c.repertoire?.physicalFrames,reference.physicalFrames);
console.log(JSON.stringify({song,hash:digest(c.track),ms:performance.now()-start,frames:c.repertoire?.physicalFrames}));
