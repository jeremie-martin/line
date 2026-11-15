import {scan} from './scan.mjs'; import fs from 'fs';
const dirs=process.argv.slice(2);const by={};let rides=0,h2=0,h4=0,h6=0,ridesWith4=0;const worst=[];
for(const dir of dirs){const r=scan(dir);if(!r)continue;rides++;const p=r.p,F=p.trace.frames,fps=r.fps;
 const n4=r.hidden.filter(h=>h.local>=.4).length;h2+=r.hidden.length;h4+=n4;h6+=r.hidden.filter(h=>h.local>=.6).length;if(n4)ridesWith4++;
 for(const h of r.hidden)if(h.local>=.6)worst.push(dir.split('/').slice(-3).join('/')+' t='+(h.frame/fps).toFixed(2)+' real '+h.local.toFixed(2)+' rec '+h.rec.toFixed(2));
 const ang=F.map(fr=>Math.atan2(fr[5]-fr[3],fr[4]-fr[2])*180/Math.PI);
 for(const s of p.sections){const f0=Math.round(s.start*fps),f1=Math.round(s.end*fps);const tgt=p.case.contacts.find(t=>Math.abs(t.frame-f1)<=2);
  const o=by[s.shape]??={sec:0,frames:0,contact:0,bumps:0,swing:0,quiet:0,qframes:0,qbumps:0,qswing:0,hid:0};
  let c=0,bumps=0,inb=false,turn=0;for(let i=f0+3;i<f1-2;i++){const J=r.J[i];if(J>1e-6)c++;if(J>=.3&&!inb){bumps++;inb=true;}if(J<.15)inb=false;let d=ang[i]-ang[i-1];while(d>180)d-=360;while(d<-180)d+=360;turn+=Math.abs(d);}
  const len=Math.max(0,f1-f0-5);o.sec++;o.frames+=len;o.contact+=c;o.bumps+=bumps;o.swing+=turn;o.hid+=r.hidden.filter(h=>h.frame>=f0&&h.frame<f1&&h.local>=.4).length;
  if(tgt&&tgt.impact<=.3){o.quiet++;o.qframes+=len;o.qbumps+=bumps;o.qswing+=turn;}}}
console.log('rides',rides,'hidden jolts ≥.2',h2,'≥.4',h4,'≥.6',h6,'rides with a hidden ≥.4:',ridesWith4);
console.log('shape       sections  time%  contact%  bumps/s  swing°/s | quiet sections(ask≤.3): n bumps/s swing°/s | hidden≥.4');
const tot=Object.values(by).reduce((s,o)=>s+o.frames,0);
for(const [k,o] of Object.entries(by).sort((a,b)=>b[1].frames-a[1].frames))console.log(k.padEnd(11),String(o.sec).padStart(6),(100*o.frames/tot).toFixed(0).padStart(6)+'%',(100*o.contact/o.frames).toFixed(0).padStart(7)+'%',(o.bumps/o.frames*40).toFixed(2).padStart(8),(o.swing/o.frames*40).toFixed(0).padStart(8),'|',String(o.quiet).padStart(5),(o.qbumps/o.qframes*40).toFixed(2).padStart(7),(o.qswing/o.qframes*40).toFixed(0).padStart(6),'|',o.hid);
console.log(worst.slice(0,40).join('\n'));
