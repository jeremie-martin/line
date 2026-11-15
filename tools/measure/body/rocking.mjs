// usage: rocking.mjs [-v from to] DIR... : back-and-forth rotation of the sled.
// The sled angle is cut into swings of at least 4° (smaller wiggles ignored). Between two asked hits, rocking =
// for every reversal, the degrees undone (the smaller of the two swings) (rotation in one direction, however large, is 0).
import {load} from './visual.mjs';
export function swings(ang,from,to,min=4){const out=[];let ext=ang[from],extAt=from,dir=0,start=ang[from],startAt=from;
  for(let i=from+1;i<=to;i++){const a=ang[i];
    if(dir===0){if(Math.abs(a-start)>=min){dir=Math.sign(a-start);ext=a;extAt=i;}}
    else if((a-ext)*dir>0){ext=a;extAt=i;}
    else if(Math.abs(a-ext)>=min){out.push({from:startAt,to:extAt,deg:ext-start});start=ext;startAt=extAt;dir=-dir;ext=a;extAt=i;}}
  if(dir!==0)out.push({from:startAt,to:extAt,deg:ext-start});return out;}
export function rocking(p){const F=p.trace.frames,fps=p.trace.fps;let prev=0;const ang=F.map(fr=>{let a=Math.atan2(fr[5]-fr[3],fr[4]-fr[2])*180/Math.PI;while(a-prev>180)a-=360;while(a-prev<-180)a+=360;prev=a;return a;});
  const tg=p.impactEvaluation.targets,rows=[];
  for(let k=0;k<tg.length;k++){const f=tg[k].frame,nx=k+1<tg.length?tg[k+1].frame:p.case.durationFrames;
    const sw=swings(ang,Math.max(0,f-2),Math.min(F.length-1,nx-3));let rock=0,rev=0;for(let i=1;i<sw.length;i++){rock+=Math.min(Math.abs(sw[i-1].deg),Math.abs(sw[i].deg));rev++;}
    const sec=p.sections.find(s=>Math.abs(Math.round(s.start*fps)-f)<=3);
    rows.push({t:f/fps,ask:tg[k].impact,shape:sec?.shape??'?',rock,rev,dur:(nx-f)/fps,sw});}
  return rows;}
if(process.argv[1]?.endsWith('rocking.mjs')){let args=process.argv.slice(2),v=null;if(args[0]==='-v'){v=[+args[1],+args[2]];args=args.slice(3);}
  const by={},band=a=>a<=.15?'ask ≤0.15':a<=.4?'ask 0.15–0.4':a<=.7?'ask 0.4–0.7':'ask >0.7';
  for(const dir of args){const p=load(dir);if(!p)continue;const rows=rocking(p);let rock=0,rev=0,n20=0;
    for(const r of rows){rock+=r.rock;rev+=r.rev;if(r.rock>=20)n20++;for(const k of [r.shape,band(r.ask)]){const o=by[k]??={n:0,rock:0,n20:0,dur:0};o.n++;o.rock+=r.rock;o.dur+=r.dur;if(r.rock>=20)o.n20++;}
      if(v&&r.t>=v[0]&&r.t<=v[1])console.log(r.t.toFixed(2),r.shape.padEnd(10),'ask',r.ask.toFixed(2),'rocking',r.rock.toFixed(0).padStart(4)+'°','swings',r.sw.map(s=>s.deg.toFixed(0)).join(' '));}
    const dur=p.case.durationFrames/p.trace.fps;console.log(dir.split('/').filter(Boolean).slice(-4).join('/').padEnd(52),'rocking',(rock/dur).toFixed(1).padStart(5),'°/s  reversals',(rev/dur).toFixed(2),'/s  sections with ≥20° of rocking',(100*n20/rows.length).toFixed(0)+'%');}
  if(args.length>4){console.log();for(const [k,o] of Object.entries(by).sort((a,b)=>b[1].n-a[1].n))console.log(k.padEnd(14),String(o.n).padStart(5),'sections  rocking',(o.rock/o.dur).toFixed(1).padStart(5),'°/s  with ≥20°:',(100*o.n20/o.n).toFixed(0)+'%');}}
