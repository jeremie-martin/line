// Per-frame visible disturbance of the rider, independent of the impact account.
//  T: travel push  |Δv_com − g|          S: spin push (ΔL / (N·R))       (the account's own two parts)
//  D: shape push   rms over the 45 point pairs of the 2nd difference of their distance (0 for any rigid motion)
// All px/frame per frame. Events = peaks of the 2-frame sums, on the account's scale (÷ 7.55).
import fs from 'fs'; import path from 'path';
export function load(dir){const f=fs.readdirSync(dir).find(f=>f.endsWith('-production.json'));return f?JSON.parse(fs.readFileSync(path.join(dir,f))):null;}
const PAIRS=[];for(let i=0;i<10;i++)for(let j=i+1;j<10;j++)PAIRS.push([i,j]);
export function visual(p){
  const F=p.trace.frames,n=F.length,g=0.175,VS=7.55;
  const c=F.map(fr=>{let x=0,y=0;for(let k=0;k<10;k++){x+=fr[2*k];y+=fr[2*k+1];}return [x/10,y/10];});
  const mo=F.map((fr,i)=>{if(!i)return {vx:0,vy:0,L:0,R:1};const pr=F[i-1];let vx=0,vy=0;for(let k=0;k<10;k++){vx+=fr[2*k]-pr[2*k];vy+=fr[2*k+1]-pr[2*k+1];}vx/=10;vy/=10;let L=0,R2=0;
    for(let k=0;k<10;k++){const rx=fr[2*k]-c[i][0],ry=fr[2*k+1]-c[i][1];L+=rx*(fr[2*k+1]-pr[2*k+1]-vy)-ry*(fr[2*k]-pr[2*k]-vx);R2+=rx*rx+ry*ry;}return {vx,vy,L,R:Math.sqrt(R2/10)};});
  const dist=F.map(fr=>PAIRS.map(([i,j])=>Math.hypot(fr[2*i]-fr[2*j],fr[2*i+1]-fr[2*j+1])));
  const tx=new Float64Array(n),ty=new Float64Array(n),s=new Float64Array(n),T=new Float64Array(n),D=new Float64Array(n),dv=F.map(()=>null);
  for(let i=2;i<n;i++){tx[i]=mo[i].vx-mo[i-1].vx;ty[i]=mo[i].vy-mo[i-1].vy-g;T[i]=Math.hypot(tx[i],ty[i]);s[i]=(mo[i].L-mo[i-1].L)/(10*(mo[i].R+mo[i-1].R)/2);
    let q=0;const v=new Float64Array(45);for(let k=0;k<45;k++){v[k]=dist[i][k]-2*dist[i-1][k]+dist[i-2][k];q+=v[k]*v[k];}D[i]=Math.sqrt(q/45);dv[i]=v;}
  // 2-frame strengths on the account's scale
  const M=new Float64Array(n),Dd=new Float64Array(n),Tt=new Float64Array(n);
  for(let i=2;i+1<n;i++){M[i]=Math.hypot(tx[i]+tx[i+1],ty[i]+ty[i+1],s[i]+s[i+1])/VS;Tt[i]=Math.hypot(tx[i]+tx[i+1],ty[i]+ty[i+1])/VS;
    let q=0;for(let k=0;k<45;k++)q+=(dv[i][k]+dv[i+1][k])**2;Dd[i]=Math.sqrt(q/45)/VS;}
  const contact=Array.from(T,v=>v>1e-6);
  const ev=p.impactEvaluation.events,acct=p.impactEvaluation.account,tg=p.impactEvaluation.targets;
  const asked=new Map(acct.matches.map(m=>[m.event,tg[m.target]]));
  return {F,n,fps:p.trace.fps,T,s,D,M,Dd,Tt,contact,ev,asked,tg,acct,mo};
}
/** Peaks of signal x at least `min`, at least `gap` frames apart (the higher wins). */
export function peaks(x,min,gap=4){const out=[];for(let i=1;i+1<x.length;i++){if(x[i]<min||x[i]<x[i-1]||x[i]<=x[i+1])continue;const l=out.at(-1);if(l&&i-l.f<gap){if(x[i]>l.v){l.f=i;l.v=x[i];}}else out.push({f:i,v:x[i]});}return out;}
