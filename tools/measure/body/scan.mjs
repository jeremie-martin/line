// usage: scan.mjs STUDYDIR [-v]  : hidden jolts = local whole-body motion change (2 frames, travel+spin, /7.55) that no recorded event accounts for
import fs from 'fs'; import path from 'path';
export function scan(dir){
const f=fs.readdirSync(dir).find(f=>f.endsWith('-production.json')); if(!f) return null; const p=JSON.parse(fs.readFileSync(path.join(dir,f)));
const F=p.trace.frames,n=F.length,fps=p.trace.fps,g=0.175;
const st=F.map((fr,i)=>{let cx=0,cy=0;for(let k=0;k<10;k++){cx+=fr[2*k];cy+=fr[2*k+1];}cx/=10;cy/=10;return{cx,cy};});
const mo=F.map((fr,i)=>{if(!i)return null;const pr=F[i-1];let vx=0,vy=0;for(let k=0;k<10;k++){vx+=fr[2*k]-pr[2*k];vy+=fr[2*k+1]-pr[2*k+1];}vx/=10;vy/=10;let L=0,R2=0;for(let k=0;k<10;k++){const rx=fr[2*k]-st[i].cx,ry=fr[2*k+1]-st[i].cy;L+=rx*(fr[2*k+1]-pr[2*k+1]-vy)-ry*(fr[2*k]-pr[2*k]-vx);R2+=rx*rx+ry*ry;}return{vx,vy,L,R:Math.sqrt(R2/10)};});
const imp=F.map((_,i)=>i<2?[0,0,0]:[mo[i].vx-mo[i-1].vx,mo[i].vy-mo[i-1].vy-g,(mo[i].L-mo[i-1].L)/(10*(mo[i].R+mo[i-1].R)/2)]);
const J=imp.map(v=>Math.hypot(v[0],v[1]));
const local=F.map((_,i)=>i+1<n?Math.hypot(imp[i][0]+imp[i+1][0],imp[i][1]+imp[i+1][1],imp[i][2]+imp[i+1][2])/7.55:0);
const ev=p.impactEvaluation.events,acct=p.impactEvaluation.account,tg=p.impactEvaluation.targets;
const asked=new Map(acct.matches.map(m=>[m.event,tg[m.target].impact]));
// recorded strength covering each frame
const rec=new Float64Array(n),ask=new Float64Array(n).fill(-1);
ev.forEach((e,i)=>{for(let k=Math.max(0,e.onset-2);k<=Math.min(n-1,e.end+1);k++){rec[k]=Math.max(rec[k],e.strength);if(asked.has(i))ask[k]=Math.max(ask[k],asked.get(i));}});
const hidden=[];
for(let i=2;i<n-1;i++){if(local[i]>=0.2&&local[i]>=local[i-1]&&local[i]>local[i+1]&&local[i]-rec[i]>=0.15){if(hidden.length&&i-hidden.at(-1).frame<4){if(local[i]>hidden.at(-1).local)hidden[hidden.length-1]={frame:i,local:local[i],rec:rec[i]};}else hidden.push({frame:i,local:local[i],rec:rec[i]});}}
// low-level agitation: seconds with contact push between 0.15 and floor outside events
return {p,fps,n,J,local,rec,ask,hidden,ev,asked,imp};}
if(process.argv[1].endsWith('scan.mjs')){const r=scan(process.argv[2]);const dur=r.p.case.durationFrames/r.fps;
console.log(process.argv[2],'score',r.p.score.score.toFixed(0),'events',r.ev.length,'asked',r.asked.size,'hidden jolts ≥0.2:',r.hidden.length,' ≥0.4:',r.hidden.filter(h=>h.local>=.4).length,' ≥0.6:',r.hidden.filter(h=>h.local>=.6).length);
if(process.argv[3]==='-v')for(const h of r.hidden)console.log('  t',(h.frame/r.fps).toFixed(2),'real',h.local.toFixed(2),'recorded',h.rec.toFixed(2));}
