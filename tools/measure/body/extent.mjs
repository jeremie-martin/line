// usage: extent.mjs DIR...  : every visible event (peak of whole-body motion change M ≥ min), and what the account made of it
import {load,visual,peaks} from './visual.mjs';
const MIN=+(process.env.MIN??0.25);const cls={};let rides=0,secs=0;const add=(k,v)=>{const o=cls[k]??={n:0,sum:0,strong:0};o.n++;o.sum+=v;if(v>=.5)o.strong++;};
const ratios=[];let dOnly=0,dOnlyStrong=0,allPk=0;const dstat=[];
for(const dir of process.argv.slice(2)){const p=load(dir);if(!p)continue;rides++;const r=visual(p);const end=p.case.durationFrames;secs+=end/r.fps;
  for(const pk of peaks(r.M,MIN)){if(pk.f>end)continue;allPk++;
    // the recorded event whose own frames hold the peak (onset-1..end+1), else the nearest within 2 frames
    let hit=-1;r.ev.forEach((e,i)=>{if(pk.f>=e.onset-2&&pk.f<=e.end+1&&(hit<0||e.strength>r.ev[hit].strength))hit=i;});
    const tNear=r.tg.find(t=>Math.abs(t.frame-pk.f)<=2);
    let k;
    if(hit>=0&&r.asked.has(hit)){const e=r.ev[hit];k=e.strength>=pk.v*.6?'asked hit, recorded fairly':'asked hit, recorded at under 60% of what the body shows';ratios.push(e.strength/pk.v);}
    else if(hit>=0){const e=r.ev[hit];k=e.strength>=pk.v*.6?'extra event, charged fairly':'extra event, charged at under 60%';}
    else{ // no recorded event covers it: why?
      let i=pk.f;while(i>0&&r.contact[i-1])i--;const into=pk.f-i;
      const peakT=Math.max(r.T[pk.f],r.T[pk.f+1]);
      k=!r.contact[pk.f]&&!r.contact[pk.f+1]?'no contact (spin/shape only)':peakT<.8?'not recorded: push under the event floor':'not recorded: outside the 6-frame window ('+(into>6?'late in a long contact':'early')+')';}
    add(k,pk.v);dstat.push([pk.v,r.Dd[pk.f]]);}
  // shape-only events: strong shape push with little whole-body push
  for(const pk of peaks(r.Dd,MIN)){if(pk.f>end)continue;let m=0;for(let i=Math.max(0,pk.f-3);i<=pk.f+3;i++)m=Math.max(m,r.M[i]);if(m<pk.v*.5){dOnly++;if(pk.v>=.5)dOnlyStrong++;}}
}
console.log(rides,'rides,',secs.toFixed(0),'s. Visible events (whole-body motion change ≥',MIN,'):',allPk,'=',(allPk/secs).toFixed(2),'per second');
for(const [k,o] of Object.entries(cls).sort((a,b)=>b[1].n-a[1].n))console.log(String(o.n).padStart(6),(100*o.n/allPk).toFixed(1).padStart(5)+'%','mean',(o.sum/o.n).toFixed(2),' ≥0.5:',String(o.strong).padStart(4),' ',k);
ratios.sort((a,b)=>a-b);console.log('asked hits: recorded/visible ratio, quartiles',[.1,.25,.5,.75,.9].map(q=>ratios[Math.floor(q*ratios.length)].toFixed(2)).join(' '));
console.log('shape-only events (shape push ≥',MIN,'with whole-body push under half of it nearby):',dOnly,' of which ≥0.5:',dOnlyStrong);
const cor=(a)=>{const n=a.length,mx=a.reduce((s,v)=>s+v[0],0)/n,my=a.reduce((s,v)=>s+v[1],0)/n;let sxy=0,sx=0,sy=0;for(const [x,y] of a){sxy+=(x-mx)*(y-my);sx+=(x-mx)**2;sy+=(y-my)**2;}return sxy/Math.sqrt(sx*sy);};
console.log('at visible events: correlation of whole-body push and shape push',cor(dstat).toFixed(2),' mean shape/whole ratio',(dstat.reduce((s,v)=>s+v[1]/v[0],0)/dstat.length).toFixed(2));
