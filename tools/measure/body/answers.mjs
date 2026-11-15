// usage: node tools/measure/body/answers.mjs [-v] : the owner's motion-review answers against the hidden key
import fs from 'fs';
const S='motion-2026-11',key=JSON.parse(fs.readFileSync(`labels/studies/${S}.key.json`)).clips;
const latest=new Map();for(const l of fs.readFileSync(`labels/studies/${S}.jsonl`,'utf8').trim().split('\n'))  {const r=JSON.parse(l);latest.set(r.clip,r);}
const SC={clean:0,little:1,clearly:2,badly:3};
export const rows=key.filter(k=>latest.has(k.id)&&!latest.get(k.id).skipped).map(k=>({...k,ans:latest.get(k.id).answers.unasked,score:SC[latest.get(k.id).answers.unasked],note:latest.get(k.id).note??''}));
if(process.argv[1]?.endsWith('answers.mjs')){
const tab=(name,f)=>{const g={};for(const r of rows)(g[f(r)]??=[]).push(r);console.log('\n'+name);for(const [k,a] of Object.entries(g).sort())console.log(' ',k.padEnd(18),String(a.length).padStart(3),'clips  mean',(a.reduce((s,r)=>s+r.score,0)/a.length).toFixed(2),' clean',a.filter(r=>r.score===0).length,' little',a.filter(r=>r.score===1).length,' clearly',a.filter(r=>r.score===2).length,' badly',a.filter(r=>r.score===3).length);};
console.log(rows.length,'answers (0 clean, 1 a little, 2 clearly, 3 badly)');
tab('by my measured level',r=>r.level);tab('by family',r=>r.family);tab('by passage',r=>r.context);tab('family × level',r=>r.family+' '+r.level);tab('passage × level',r=>r.context+' '+r.level);
const cor=(f)=>{const n=rows.length,mx=rows.reduce((s,r)=>s+f(r),0)/n,my=rows.reduce((s,r)=>s+r.score,0)/n;let a=0,b=0,c=0;for(const r of rows){a+=(f(r)-mx)*(r.score-my);b+=(f(r)-mx)**2;c+=(r.score-my)**2;}return (a/Math.sqrt(b*c)).toFixed(2);};
console.log('\ncorrelation of the answer with: loudest unasked push',cor(r=>r.rest),'| push relative to the hit',cor(r=>r.rest/Math.max(.03,r.seen)),'| rocking degrees',cor(r=>r.rock),'| ask',cor(r=>r.ask));
const tags={};for(const r of rows){const m=/tags: ([a-z,]+)/.exec(r.note);if(m)for(const t of m[1].split(','))(tags[t]??=[]).push(r.id);}
console.log('tags:',Object.entries(tags).map(([k,v])=>k+' '+v.length).join(', '));
if(process.argv[2]==='-v')for(const r of rows)console.log(r.id,r.ans.padEnd(8),r.family.padEnd(10),r.context.padEnd(7),r.level.padEnd(4),'ask',r.ask.toFixed(2),'seen',r.seen.toFixed(2),'rest',r.rest.toFixed(2),'rock',String(r.rock).padStart(5),'|',r.video.split('/').pop().replace('.mp4',''),r.focus[0],'|',r.note);
}
