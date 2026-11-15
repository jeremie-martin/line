// Small-scale waviness of the ground under the rider: along each chain of track lines near the rider's path, the
// heading as a function of distance; at every point where the bend changes direction, the degrees undone within
// `reach` px on each side (min of the two). A smooth arc gives 0, a long S little, bumps and corners a lot.
import fs from 'fs'; import {rows} from './answers.mjs'; import {load} from './visual.mjs';
export function wiggle(p,t0,t1,reach=60,nearPx=28){const F=p.trace.frames,a=Math.round(t0*40),b=Math.round(t1*40);
  const xs=[],ys=[];for(let i=a;i<=b;i++){let x=0,y=0;for(let k=0;k<10;k++){x+=F[i][2*k];y+=F[i][2*k+1];}xs.push(x/10);ys.push(y/10);}
  const near=(x,y)=>xs.some((cx,i)=>Math.hypot(cx-x,ys[i]-y)<nearPx);
  const L=p.track.lines.filter(l=>near(l.x1,l.y1)||near(l.x2,l.y2)),key=(x,y)=>x.toFixed(2)+','+y.toFixed(2);
  const byStart=new Map(L.map(l=>[key(l.x1,l.y1),l])),ends=new Set(L.map(l=>key(l.x2,l.y2)));
  let total=0,worst=0,len=0;
  for(const head of L.filter(l=>!ends.has(key(l.x1,l.y1)))){const hs=[],ds=[];let l=head,d=0,prev=null,guard=0;
    while(l&&guard++<5000){let h=Math.atan2(l.y2-l.y1,l.x2-l.x1)*180/Math.PI;if(prev!==null){while(h-prev>180)h-=360;while(h-prev<-180)h+=360;}const seg=Math.hypot(l.x2-l.x1,l.y2-l.y1);hs.push(h);ds.push(d+seg/2);d+=seg;prev=h;l=byStart.get(key(l.x2,l.y2));}
    len+=d;
    // turning points of the heading
    for(let i=1;i+1<hs.length;i++){const up=hs[i]-hs[i-1],dn=hs[i+1]-hs[i];if(up*dn>=0)continue;
      let before=0,after=0;for(let k=i-1;k>=0&&ds[i]-ds[k]<=reach;k--)before=Math.max(before,Math.abs(hs[i]-hs[k]));for(let k=i+1;k<hs.length&&ds[k]-ds[i]<=reach;k++)after=Math.max(after,Math.abs(hs[k]-hs[i]));
      const u=Math.min(before,after);total+=u;worst=Math.max(worst,u);}}
  return {total,worst,len};}
if(process.argv[1]?.endsWith('wiggle.mjs')){
const picks=fs.readFileSync('generated/visible/picks.txt','utf8').trim().split('\n').map(l=>l.split(' '));const cache={};
const ride=v=>{const name=v.split('/').pop().replace('.mp4','');const pk=picks.find(p=>`${p[0]}-${p[1]}`===name);return cache[name]??=load(`generated/handcraft/${pk[0]}/${pk[1]}/s${pk[2]}`);};
for(const reach of [30,60,120,400]){const fs_=rows.map(r=>({...r,...wiggle(ride(r.video),r.focus[0],r.focus[1],reach)}));
 const cor=f=>{const n=fs_.length,mx=fs_.reduce((s,r)=>s+f(r),0)/n,my=fs_.reduce((s,r)=>s+r.score,0)/n;let a=0,b=0,c=0;for(const r of fs_){a+=(f(r)-mx)*(r.score-my);b+=(f(r)-mx)**2;c+=(r.score-my)**2;}return (a/Math.sqrt(b*c)).toFixed(2);};
 console.log('reach',reach,'px: correlation with the answer: total',cor(r=>r.total),' worst',cor(r=>r.worst),' sqrt total',cor(r=>Math.sqrt(r.total)),' total per 100 px',cor(r=>r.total/Math.max(40,r.len)*100));
 if(reach===60){const g={};for(const r of fs_)(g[r.ans]??=[]).push(r.total);for(const k of ['clean','little','clearly'])console.log('  ',k.padEnd(8),'median wiggle',g[k].sort((a,b)=>a-b)[Math.floor(g[k].length/2)].toFixed(0)+'°',' values',g[k].map(v=>v.toFixed(0)).join(' '));
  for(const r of fs_.sort((a,b)=>b.total-a.total))console.log('  ',r.id,r.ans.padEnd(8),r.family.padEnd(10),'wiggle',r.total.toFixed(0).padStart(4)+'°','worst',r.worst.toFixed(0).padStart(3)+'°');}}
}
