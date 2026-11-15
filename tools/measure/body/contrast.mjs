// usage: contrast.mjs DIR... : for every asked hit, is it the most visible thing until the next asked hit?
// hit = max 2-frame whole-body motion change (account scale) within [t-2, t+3]; rest = the same maximum from t+4 to next−3.
import {load,visual} from './visual.mjs';
const band=a=>a<=.15?'ask ≤0.15':a<=.4?'ask 0.15–0.4':a<=.7?'ask 0.4–0.7':'ask >0.7';
const T={},Sh={},W={};const add=(o,k,hit,rest,ask)=>{const x=o[k]??={n:0,louder:0,half:0,rest:0,hit:0,r25:0,ask:0};x.n++;x.rest+=rest;x.hit+=hit;x.ask+=ask;if(rest>=hit)x.louder++;if(rest>=hit*.5)x.half++;if(rest>=.25)x.r25++;};
let unaskedSq=0,hitSq=0,errSq=0,frames=0;
for(const dir of process.argv.slice(2)){const p=load(dir);if(!p)continue;const r=visual(p),tg=r.tg;
 for(let k=0;k<tg.length;k++){const f=tg[k].frame,nx=k+1<tg.length?tg[k+1].frame:p.case.durationFrames;
  let hit=0;for(let i=f-2;i<=f+3&&i<r.n;i++)hit=Math.max(hit,r.M[i]);
  let rest=0,at=-1;for(let i=f+4;i<=nx-3;i++){if(r.M[i]>rest){rest=r.M[i];at=i;}unaskedSq+=r.M[i]**2;}
  hitSq+=hit**2;errSq+=(hit-tg[k].impact)**2;
  const sec=p.sections.find(s=>Math.abs(Math.round(s.start*r.fps)-f)<=3);
  add(T,band(tg[k].impact),hit,rest,tg[k].impact);if(sec)add(Sh,sec.shape,hit,rest,tg[k].impact);
  if(at>=0&&rest>=hit*.5){ // where is the loudest unasked push?
    let a=at;while(a>0&&r.contact[a-1])a--;let b=at;while(b+1<r.n&&r.contact[b+1])b++;
    const sameContact=a<=f+3,launch=b-at<=3;
    const w=!r.contact[at]&&!r.contact[at+1]?'in the air':launch?(sameContact?'launch off the support it landed on':'launch off a later contact'):sameContact?'riding the support after the hit':'a second contact before the next hit';
    W[w]=(W[w]??0)+1;}
 }}
const show=(o,title)=>{console.log(title.padEnd(14),'  hits   mean ask  mean seen  loudest unasked after | unasked ≥ half the hit | unasked ≥ the hit | unasked ≥0.25');
 for(const [k,x] of Object.entries(o).sort((a,b)=>b[1].n-a[1].n))console.log(k.padEnd(14),String(x.n).padStart(6),(x.ask/x.n).toFixed(2).padStart(9),(x.hit/x.n).toFixed(2).padStart(10),(x.rest/x.n).toFixed(2).padStart(15),(100*x.half/x.n).toFixed(0).padStart(20)+'%',(100*x.louder/x.n).toFixed(0).padStart(18)+'%',(100*x.r25/x.n).toFixed(0).padStart(12)+'%');};
show(T,'by ask');console.log();show(Sh,'by family');
console.log('\nwhere the loudest unasked push is (when ≥ half the hit):',JSON.stringify(W,null,1));
console.log('squared motion: at asked hits',hitSq.toFixed(0),' their error vs the ask',errSq.toFixed(1),' unasked, all frames between hits',unaskedSq.toFixed(1));
