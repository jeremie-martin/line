// Candidate single reading of the ground under the rider: the most turning (sum of |heading change|, any direction)
// within a window of W px along a chain. A bump, a corner and a tight lip all turn a lot within a short distance;
// a smooth arc turns W / radius. Compared with the owner's 41 answers and at named moments.
import fs from 'fs'; import {load} from './visual.mjs';
export function turning(p,t0,t1,W=40,nearPx=28){const F=p.trace.frames,a=Math.round(t0*40),b=Math.min(F.length-1,Math.round(t1*40));
  const xs=[],ys=[];for(let i=a;i<=b;i++){let x=0,y=0;for(let k=0;k<10;k++){x+=F[i][2*k];y+=F[i][2*k+1];}xs.push(x/10);ys.push(y/10);}
  const near=(x,y)=>xs.some((cx,i)=>Math.hypot(cx-x,ys[i]-y)<nearPx);
  const L=p.track.lines.filter(l=>near(l.x1,l.y1)||near(l.x2,l.y2)),key=(x,y)=>x.toFixed(2)+','+y.toFixed(2);
  const byStart=new Map(L.map(l=>[key(l.x1,l.y1),l])),ends=new Set(L.map(l=>key(l.x2,l.y2)));let worst=0,at=null;
  for(const head of L.filter(l=>!ends.has(key(l.x1,l.y1)))){const hs=[],ds=[],pts=[];let l=head,d=0,prev=null,g=0;
    while(l&&g++<5000){let h=Math.atan2(l.y2-l.y1,l.x2-l.x1)*180/Math.PI;if(prev!==null){while(h-prev>180)h-=360;while(h-prev<-180)h+=360;}const seg=Math.hypot(l.x2-l.x1,l.y2-l.y1);hs.push(h);ds.push(d+seg/2);pts.push([l.x1,l.y1]);d+=seg;prev=h;l=byStart.get(key(l.x2,l.y2));}
    let lo=0,sum=0;for(let i=1;i<hs.length;i++){sum+=Math.abs(hs[i]-hs[i-1]);while(ds[i]-ds[lo]>W){lo++;sum-=Math.abs(hs[lo]-hs[lo-1]);}if(sum>worst){worst=sum;at=pts[i];}}}
  return {worst,at};}
if(process.argv[1]?.endsWith('sharp.mjs')){
const {rows}=await import('./answers.mjs');
const picks=fs.readFileSync('generated/visible/picks.txt','utf8').trim().split('\n').map(l=>l.split(' '));const cache={};
const ride=v=>{const name=v.split('/').pop().replace('.mp4','');const pk=picks.find(p=>`${p[0]}-${p[1]}`===name);return cache[name]??=load(`generated/handcraft/${pk[0]}/${pk[1]}/s${pk[2]}`);};
for(const W of [20,30,40,60]){const f=rows.map(r=>({...r,t:turning(ride(r.video),r.focus[0],r.focus[1],W).worst}));
 const n=f.length,mx=f.reduce((s,r)=>s+r.t,0)/n,my=f.reduce((s,r)=>s+r.score,0)/n;let a=0,b=0,c=0;for(const r of f){a+=(r.t-mx)*(r.score-my);b+=(r.t-mx)**2;c+=(r.score-my)**2;}
 const g={};for(const r of f)(g[r.ans]??=[]).push(Math.round(r.t));
 console.log('window',W,'px: correlation',(a/Math.sqrt(b*c)).toFixed(2));for(const k of ['clean','little','clearly'])console.log('   ',k.padEnd(8),g[k].sort((x,y)=>x-y).join(' '));}
const named=[['generated/handcraft/valhalla_40s/still-drop/s303',4.2,5.2,'lip at 5 s (owner: sharp turn)'],['generated/handcraft/valhalla_40s/still-drop/s303',6.8,7.4,'lip at 7 s (owner: sharper)'],['generated/visible/notf-g10/valhalla_40s/still-drop/s303',22.5,24.2,'smooth version, 23 s (owner: sharp turn at the end)'],['generated/visible/notf-g10/valhalla_40s/still-drop/s303',4.2,5.3,'smooth version, 5 s'],['generated/visible/notf-g10/valhalla_40s/still-drop/s303',6.8,7.5,'smooth version, 7 s']];
for(const [d,a,b,name] of named){const p=load(d);console.log(name.padEnd(52),[20,30,40,60].map(W=>'W'+W+': '+turning(p,a,b,W).worst.toFixed(0)+'°').join('  '));}
}
