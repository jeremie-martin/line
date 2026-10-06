import assert from 'node:assert/strict';
import {loadRun} from '../../tools/eval/records.ts';
import {resolveCase,digest} from '../../tools/eval/inputs.ts';
import {compileHandoff} from '../../scripts/v0/optimizer/handoff.ts';
import {productionBudget} from '../../scripts/v0/optimizer/production_budget.ts';
const source=loadRun('quality-development-remeasured'),c=source.run.panel.find(c=>c.id==='luna_bala_44s~101')!;
const {spec,music,planned}=await resolveCase(c,source.run.jolt);assert.deepEqual(planned,c);
const start=performance.now(),cpu=process.cpuUsage();
const cp=compileHandoff(spec,c.seed,{budget:productionBudget(spec.duration),creative:{},impactContract:'line.strike.v3',
 phraseBoundaries:music.phases.map((p:any)=>p.t0??p.t??p.start).filter(Number.isFinite)});
const used=process.cpuUsage(cpu),saved=source.cells.get(c.id);
assert.equal(digest(cp.track),saved.trackHash);assert.equal(cp.repertoire!.physicalFrames,saved.physicalFrames);
console.log(JSON.stringify({id:c.id,trackHash:saved.trackHash,physicalFrames:saved.physicalFrames,wallMs:performance.now()-start,cpuMs:(used.user+used.system)/1000}));
