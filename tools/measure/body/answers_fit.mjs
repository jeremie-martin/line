// What predicts the owner's answers? Candidate readings of each judged part, from the ride's trace and track.
import fs from 'fs'; import {rows} from './answers.mjs'; import {load} from './visual.mjs';
const picks=fs.readFileSync('generated/visible/picks.txt','utf8').trim().split('\n').map(l=>l.split(' '));
const cache={};const ride=v=>{const name=v.split('/').pop().replace('.mp4','');const pk=picks.find(p=>`${p[0]}-${p[1]}`===name);return cache[name]??=load(`generated/handcraft/${pk[0]}/${pk[1]}/s${pk[2]}`);};
const feats=[];
for(const r of rows){const p=ride(r.video),F=p.trace.frames,a=Math.round(r.focus[0]*40),b=Math.round(r.focus[1]*40);
  const com=i=>{let x=0,y=0;for(let k=0;k<10;k++){x+=F[i][2*k];y+=F[i][2*k+1];}return [x/10,y/10];};
  const head=i=>{const c=com(i),d=com(i-1);return Math.atan2(c[1]-d[1],c[0]-d[0])*180/Math.PI;};
  const dh=i=>{let d=head(i)-head(i-1);while(d>180)d-=360;while(d<-180)d+=360;return d;};
  let maxTurn1=0,maxTurn2=0,turning=0,signs=0,last=0;for(let i=a+1;i<=b;i++){const d=dh(i),d2=d+dh(i+1);maxTurn1=Math.max(maxTurn1,Math.abs(d));maxTurn2=Math.max(maxTurn2,Math.abs(d2));turning+=Math.abs(d);if(Math.abs(d)>1.5){if(last&&Math.sign(d)!==last)signs++;last=Math.sign(d);}}
  // track corners near the rider's path during the part: angle between consecutive lines that share an endpoint
  const xs=[],ys=[];for(let i=a;i<=b;i++){const c=com(i);xs.push(c[0]);ys.push(c[1]);}
  const near=(x,y)=>xs.some((cx,i)=>Math.hypot(cx-x,ys[i]-y)<28);
  const L=p.track.lines.filter(l=>near(l.x1,l.y1)||near(l.x2,l.y2));const byStart=new Map(L.map(l=>[l.x1.toFixed(2)+','+l.y1.toFixed(2),l]));
  let corner=0,corners10=0,len=0;for(const l of L){const n=byStart.get(l.x2.toFixed(2)+','+l.y2.toFixed(2));len+=Math.hypot(l.x2-l.x1,l.y2-l.y1);if(!n)continue;let d=(Math.atan2(n.y2-n.y1,n.x2-n.x1)-Math.atan2(l.y2-l.y1,l.x2-l.x1))*180/Math.PI;while(d>180)d-=360;while(d<-180)d+=360;corner=Math.max(corner,Math.abs(d));if(Math.abs(d)>=10)corners10++;}
  // curvature: sharpest bend over ~12 px of track near the rider
  const sec=p.sections.find(s=>Math.abs(s.start-r.focus[0])<.2||(s.start<=r.focus[0]&&s.end>r.focus[0]));
  feats.push({...r,maxTurn1,maxTurn2,turning,signs,corner,corners10,dur:r.focus[1]-r.focus[0],guide:sec?.guideContactFrames??0,speed:Math.hypot(com(a+1)[0]-com(a)[0],com(a+1)[1]-com(a)[1])});}
const cor=f=>{const n=feats.length,mx=feats.reduce((s,r)=>s+f(r),0)/n,my=feats.reduce((s,r)=>s+r.score,0)/n;let a=0,b=0,c=0;for(const r of feats){a+=(f(r)-mx)*(r.score-my);b+=(f(r)-mx)**2;c+=(r.score-my)**2;}return (a/Math.sqrt(b*c)).toFixed(2);};
for(const [n,f] of [['sharpest path turn in 1 frame',r=>r.maxTurn1],['sharpest path turn in 2 frames',r=>r.maxTurn2],['total path turning',r=>r.turning],['path turn reversals',r=>r.signs],['sharpest track corner',r=>r.corner],['track corners ≥10°',r=>r.corners10],['time on the track',r=>r.dur],['guide rail touched (frames)',r=>r.guide],['speed',r=>r.speed],['loudest unasked push',r=>r.rest],['rocking',r=>r.rock]])console.log(n.padEnd(34),cor(f));
console.log('\nid  answer   family     path turn 1f/2f  total  reversals  track corner  ≥10°  guide');
for(const r of feats.sort((a,b)=>b.score-a.score||a.family.localeCompare(b.family)))console.log(r.id,r.ans.padEnd(8),r.family.padEnd(10),r.maxTurn1.toFixed(0).padStart(4),r.maxTurn2.toFixed(0).padStart(4),r.turning.toFixed(0).padStart(6),String(r.signs).padStart(6),r.corner.toFixed(0).padStart(10),String(r.corners10).padStart(6),String(r.guide).padStart(5));
