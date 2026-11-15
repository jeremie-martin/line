// usage: body.mjs STUDYDIR [from to]   per-frame: contact push (accel minus gravity), body deformation, spin; plus strike events
import fs from 'fs'; import path from 'path';
const dir=process.argv[2], f=fs.readdirSync(dir).find(f=>f.endsWith('-production.json')), p=JSON.parse(fs.readFileSync(path.join(dir,f)));
const F=p.trace.frames, n=F.length, fps=p.trace.fps;
const pt=(i,k)=>[F[i][2*k],F[i][2*k+1]];
const com=F.map(fr=>{let x=0,y=0;for(let k=0;k<10;k++){x+=fr[2*k];y+=fr[2*k+1];}return [x/10,y/10];});
const vel=com.map((c,i)=>i?[c[0]-com[i-1][0],c[1]-com[i-1][1]]:[0,0]);
const acc=vel.map((v,i)=>i>1?[v[0]-vel[i-1][0],v[1]-vel[i-1][1]]:[0,0]);
// gravity: median vertical accel
const ys=acc.map(a=>a[1]).sort((a,b)=>a-b), g=ys[Math.floor(ys.length*0.5)];
const push=acc.map(a=>Math.hypot(a[0],a[1]-g));
// deformation: pairwise distances vs median over the ride
const pairs=[];for(let a=0;a<10;a++)for(let b=a+1;b<10;b++)pairs.push([a,b]);
const D=F.map((_,i)=>pairs.map(([a,b])=>{const A=pt(i,a),B=pt(i,b);return Math.hypot(A[0]-B[0],A[1]-B[1]);}));
const med=pairs.map((_,j)=>{const s=D.map(d=>d[j]).sort((a,b)=>a-b);return s[Math.floor(n/2)];});
const deform=D.map(d=>Math.sqrt(d.reduce((s,x,j)=>s+(x-med[j])**2,0)/pairs.length));
const ddef=deform.map((d,i)=>i?Math.abs(d-deform[i-1]):0);
// shape change rate: rms change of pairwise distances per frame
const shapeRate=D.map((d,i)=>i?Math.sqrt(d.reduce((s,x,j)=>s+(x-D[i-1][j])**2,0)/pairs.length):0);
// sled angle
const ang=F.map((_,i)=>{const A=pt(i,1),B=pt(i,2);return Math.atan2(B[1]-A[1],B[0]-A[0])*180/Math.PI;});
const spin=ang.map((a,i)=>{if(!i)return 0;let d=a-ang[i-1];while(d>180)d-=360;while(d<-180)d+=360;return d;});
const ev=p.impactEvaluation.events, acct=p.impactEvaluation.account, tg=p.impactEvaluation.targets;
const matched=new Map(acct.matches.map(m=>[m.event,m.target]));
export const data={p,F,n,fps,com,vel,acc,g,push,deform,shapeRate,spin,ang,ev,acct,tg,matched};
if(process.argv[1].endsWith('body.mjs')){
const a=+(process.argv[3]??0)*fps|0,b=Math.min(n-1,+(process.argv[4]??n/fps)*fps|0);
console.log('gravity',g.toFixed(4),'frames',n,'fps',fps);
console.log('EVENTS in window (t, kind, strength, asked):');
ev.forEach((e,i)=>{if(e.onset>=a&&e.onset<=b)console.log(' ',(e.onset/fps).toFixed(2),e.kind,'str',e.strength.toFixed(2),matched.has(i)?'asked '+tg[matched.get(i)].impact:'UNASKED');});
console.log('frame t speed push shapeRate deform spin');
for(let i=a;i<=b;i++){const bar='#'.repeat(Math.min(40,Math.round(shapeRate[i]*20)));console.log(i,(i/fps).toFixed(3),Math.hypot(...vel[i]).toFixed(1),push[i].toFixed(2),shapeRate[i].toFixed(2),deform[i].toFixed(2),spin[i].toFixed(1).padStart(6),bar);}
}
