/** Cold configuration loading only. Compare before simulating any geometry. */
import {performance} from 'node:perf_hooks';
import {createHash} from 'node:crypto';
import {repertoireSearchOptions,loadConstructionArtifact} from '../../scripts/v0/optimizer/repertoire_search.ts';
import {impactSearchProfile} from '../../scripts/v0/optimizer/contact_impact_profile.ts';
import {planIntentionalRepertoire} from '../../scripts/v0/optimizer/intentional_repertoire.ts';
const spec={duration:2,preroll:0,jitter:0,contacts:[{t:1,impact:.8}],axes:{air:()=>.5,speed:()=>.5}};
const plan=planIntentionalRepertoire(spec,101),resolved=process.argv[2]==='resolved';
global.gc?.();const start=performance.now();
const options=repertoireSearchOptions(spec,plan,200000,...(resolved?['line.strike.v3'] as const:[]));
if(!resolved){
 const {id,constructionModel,...profile}=impactSearchProfile('line.strike.v3') as any;
 const artifact=loadConstructionArtifact(constructionModel);
 Object.assign(options,{constructionPolicies:artifact.policies,constructionExamples:artifact.examples},profile,{impactContract:'line.strike.v3'});
}
const loadMs=performance.now()-start;
global.gc?.();const memory=process.memoryUsage(),maxRss=process.resourceUsage().maxRSS;
const sha=createHash('sha256').update(JSON.stringify(options)).digest('hex');
console.log(JSON.stringify({resolved,loadMs,memory,maxRss,sha}));
