// usage: inventory.mjs STUDYDIR...  : where the body's shape says "hit" and the account does not, by kind
import {scan} from './scan.mjs';
const pairs=[];for(let i=0;i<10;i++)for(let j=i+1;j<10;j++)pairs.push([i,j]);
const dist=(fr,[i,j])=>Math.hypot(fr[2*i]-fr[2*j],fr[2*i+1]-fr[2*j+1]);
const rows=[];const rides=[];
for(const dir of process.argv.slice(2)){const r=scan(dir);if(!r)continue;const F=r.p.trace.frames,n=F.length;
 const D=F.map(fr=>pairs.map(q=>dist(fr,q)));
 const rate=D.map((d,i)=>i?Math.sqrt(d.reduce((s,x,j)=>s+(x-D[i-1][j])**2,0)/pairs.length):0);
 // body response of a moment: largest shape change over 3 frames
 const resp=rate.map((_,i)=>i+2<n?Math.sqrt(D[i+2].reduce((s,x,j)=>s+(x-D[Math.max(0,i-1)][j])**2,0)/pairs.length):0);
 rides.push({dir,r,rate,resp,n});
 r.ev.forEach((e,i)=>{let m=0,b=0,mf=e.onset;for(let k=Math.max(2,e.onset-2);k<=Math.min(n-3,e.end+2);k++){if(r.local[k]>m){m=r.local[k];mf=k;}b=Math.max(b,resp[k]);}
  rows.push({asked:r.asked.get(i),rec:e.strength,real:m,body:b,dt:mf-e.onset});});}
// 1. calibration: body response against real motion change at recorded events
const xs=rows.map(x=>x.real),ys=rows.map(x=>x.body),mx=xs.reduce((a,b)=>a+b)/xs.length,my=ys.reduce((a,b)=>a+b)/ys.length;
const cov=xs.reduce((s,x,i)=>s+(x-mx)*(ys[i]-my),0),vx=xs.reduce((s,x)=>s+(x-mx)**2,0),vy=ys.reduce((s,y)=>s+(y-my)**2,0);
const slope=cov/vx,icpt=my-slope*mx;console.log('events',rows.length,'corr(body shape change, motion change)',(cov/Math.sqrt(vx*vy)).toFixed(2),'body≈',icpt.toFixed(2),'+',slope.toFixed(2),'×strength');
const eq=b=>(b-icpt)/slope;
// 2. matched events: recorded strength against real
const M=rows.filter(x=>x.asked!==undefined);const bins=[[0,.2],[.2,.4],[.4,.6],[.6,.8],[.8,1.01]];
console.log('asked hits: ask band | n | mean asked | recorded | real (any 2 frames near it) | peak later than recorded start by (frames)');
for(const [a,b] of bins){const s=M.filter(x=>x.asked>=a&&x.asked<b);if(!s.length)continue;const av=k=>(s.reduce((t,x)=>t+x[k],0)/s.length).toFixed(2);console.log(' ',a,'-',b,'|',s.length,'|',av('asked'),'|',av('rec'),'|',av('real'),'|',av('dt'));}
// 3. body says hit, nothing in whole-body motion: squeeze-like
let squeeze=0,sq6=0,ringing=0,unrec=0;const ex=[];
for(const {dir,r,resp,n} of rides){let last=-99;
 for(let i=3;i<n-3;i++){const e=eq(resp[i]);if(e<.4||resp[i]<resp[i-1]||resp[i]<=resp[i+1])continue;
  let m=0,rec=0;for(let k=Math.max(2,i-3);k<=Math.min(n-2,i+3);k++){m=Math.max(m,r.local[k]);rec=Math.max(rec,r.rec[k]);}
  let recent=0;for(let k=Math.max(2,i-14);k<i-3;k++)recent=Math.max(recent,r.local[k]);
  if(i-last<6)continue;last=i;
  if(m>=e/2){if(rec<m/3&&m>=.4)unrec++;continue;}          // explained by a real motion change (recorded or not)
  if(recent>=e/2){ringing++;continue;}                        // the body still ringing after a hit
  squeeze++;if(e>=.6)sq6++;if(ex.length<12)ex.push(dir.split('/').filter(Boolean).slice(-3).join('/')+' t='+(i/r.fps).toFixed(2)+' body-equivalent '+e.toFixed(2)+' motion '+m.toFixed(2)+' contact '+(r.J[i]>1e-6));}}
console.log('body-shape peaks worth ≥0.4: unrecorded real hits',unrec,'| ringing after a hit',ringing,'| body change with little whole-body motion',squeeze,'(≥.6:',sq6,')');
console.log(ex.join('\n'));
