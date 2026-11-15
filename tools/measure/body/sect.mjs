// usage: sect.mjs STUDYDIR from to : per section, what the body does between landings
import {scan} from './scan.mjs'; import fs from 'fs';
const dir=process.argv[2],r=scan(dir),p=r.p,F=p.trace.frames,fps=r.fps,a=+process.argv[3],b=+process.argv[4];
const pairs=[];for(let i=0;i<10;i++)for(let j=i+1;j<10;j++)pairs.push([i,j]);
const dist=(fr,[i,j])=>Math.hypot(fr[2*i]-fr[2*j],fr[2*i+1]-fr[2*j+1]);
const shape=F.map((fr,i)=>i?Math.sqrt(pairs.reduce((s,q)=>s+(dist(fr,q)-dist(F[i-1],q))**2,0)/pairs.length):0);
const ang=F.map(fr=>Math.atan2(fr[5]-fr[3],fr[4]-fr[2])*180/Math.PI);
console.log('sec  start-end   shape      guide ask  | contact% | push: mean max | pushes≥.3 (count of separate bumps) | body change/s | sled swing° | recorded events');
for(const s of p.sections){if(s.end<a||s.start>b)continue;const f0=Math.round(s.start*fps),f1=Math.round(s.end*fps);
 let c=0,sum=0,mx=0,bumps=0,inb=false,sh=0,amin=1e9,amax=-1e9,turn=0;
 for(let i=f0+3;i<f1;i++){const J=r.J[i];if(J>1e-6){c++;sum+=J;}mx=Math.max(mx,J);if(J>=.3&&!inb){bumps++;inb=true;}if(J<.15)inb=false;sh+=shape[i];let d=ang[i]-ang[i-1];while(d>180)d-=360;while(d<-180)d+=360;turn+=Math.abs(d);}
 const evs=r.ev.map((e,i)=>({e,i})).filter(({e})=>e.onset>=f0&&e.onset<f1).map(({e,i})=>e.strength.toFixed(2)+(r.asked.has(i)?'*':'')).join(' ');
 const tgt=p.case.contacts.find(t=>Math.abs(t.frame-f1)<=2);
 console.log(String(s.section).padStart(3),s.start.toFixed(2).padStart(6)+'-'+s.end.toFixed(2).padEnd(6),s.shape.padEnd(10),String(s.guideContactFrames).padStart(3),' ',(tgt?tgt.impact.toFixed(2):'  - '),'|',(100*c/(f1-f0-3)).toFixed(0).padStart(3)+'%','|',(c?sum/c:0).toFixed(2),mx.toFixed(2),'|',bumps,'|',(sh/(f1-f0-3)*fps).toFixed(1).padStart(5),'|',turn.toFixed(0).padStart(4),'|',evs);}
