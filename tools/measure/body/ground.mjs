// usage: node tools/measure/body/ground.mjs TAG... : the 20 picked specs under each tag ('before' = generated/handcraft):
// score parts, the families actually built, and how rough the ground under the rider is per section.
import fs from 'fs'; import {load} from './visual.mjs'; import {wiggle} from './wiggle.mjs';
const picks=fs.readFileSync('generated/visible/picks.txt','utf8').trim().split('\n').map(l=>l.split(' '));
const dirOf=(tag,[s,v,seed])=>tag==='before'?`generated/handcraft/${s}/${v}/s${seed}`:`generated/visible/${tag}/${s}/${v}/s${seed}`;
for(const tag of process.argv.slice(2)){let n=0,score=0,imp=0,air=0,spd=0,secs=0,rough=0,fall=0;const fam={},roughBy={};
  for(const pk of picks){const p=load(dirOf(tag,pk));if(!p){console.log(tag,'missing',pk.join(' '));continue;}n++;
    score+=p.score.score;imp+=p.impactEvaluation.account.strengthMse;air+=p.score.components.air.rmsError;spd+=p.score.components.speed.rmsError;fall+=(p.production.sectionFallbacks??[]).length;
    for(const s of p.sections){if(s.end-s.start<.1)continue;secs++;fam[s.shape]=(fam[s.shape]??0)+1;const w=wiggle(p,s.start,s.end).worst;if(w>=12){rough++;roughBy[s.shape]=(roughBy[s.shape]??0)+1;}}}
  console.log(`\n${tag}: ${n} rides  score ${(score/n).toFixed(1)}  hit error ${(imp/n).toFixed(4)}  air ${(air/n).toFixed(3)}  speed ${(spd/n).toFixed(3)}  fallbacks/ride ${(fall/n).toFixed(1)}`);
  console.log('  sections with rough ground (reversal ≥12° within 60 px):',(100*rough/secs).toFixed(1)+'%');
  console.log('  families:',Object.entries(fam).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`${k} ${(100*v/secs).toFixed(0)}% (rough ${(100*(roughBy[k]??0)/v).toFixed(0)}%)`).join(', '));}
