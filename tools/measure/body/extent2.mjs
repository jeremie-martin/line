import {load,visual} from './visual.mjs';
const hist=new Array(24).fill(0);let dAirFar=0,dAirNear=0,dContact=0,spinAir=0,airFrames=0,spinFast=0;const off={};let pushesPerContact=[0,0,0,0,0,0];
for(const dir of process.argv.slice(2)){const p=load(dir);if(!p)continue;const r=visual(p),n=Math.min(r.n,p.case.durationFrames);
 const S=i=>.25*r.T[i-1]+.5*r.T[i]+.25*r.T[i+1];
 const askedNear=new Uint8Array(r.n);for(const t of r.tg)for(let i=t.frame-2;i<=t.frame+3;i++)if(i>=0&&i<r.n)askedNear[i]=1;
 // unasked smoothed push peaks
 for(let i=3;i<n-2;i++){const v=S(i);if(askedNear[i]||v<.2||v<S(i-1)||v<=S(i+1))continue;hist[Math.min(23,Math.floor(v/.1))]++;}
 // shape push: where does it happen
 let since=99;for(let i=2;i<n;i++){since=r.contact[i]?0:since+1;const q=r.D[i]**2;if(r.contact[i])dContact+=q;else if(since<=8)dAirNear+=q;else dAirFar+=q;
  if(!r.contact[i]){airFrames++;const w=Math.abs(r.mo[i].L/(10*r.mo[i].R**2))*180/Math.PI;spinAir+=w;if(w>6)spinFast++;}}
 // timing: visible peak vs the beat
 for(const t of r.tg){let b=-9,v=0;for(let i=t.frame-5;i<=t.frame+5;i++)if(i>1&&i<r.n&&r.M[i]>v){v=r.M[i];b=i-t.frame;}if(t.impact>=.3)off[b]=(off[b]??0)+1;}
 // separate pushes per contact (peaks of S ≥ .3 separated by a valley ≤ half)
 for(let i=2;i<n;){if(!r.contact[i]){i++;continue;}let j=i;while(j+1<n&&r.contact[j+1])j++;let c=0,last=-1,valley=1e9;
  for(let k=Math.max(3,i);k<=j&&k<n-2;k++){const v=S(k);if(last>=0)valley=Math.min(valley,v);if(v>=.3&&v>=S(k-1)&&v>S(k+1)&&(last<0||valley<=.5*v)){c++;last=k;valley=1e9;}}
  pushesPerContact[Math.min(5,c)]++;i=j+1;}
}
console.log('unasked push peaks by smoothed size (px/frame², bins of 0.1 from 0.2; the event floor is 0.8):');
console.log(hist.map((c,i)=>(i/10).toFixed(1)+':'+c).slice(2).join('  '));
const dt=dContact+dAirNear+dAirFar;console.log('shape push energy: during contact',(100*dContact/dt).toFixed(0)+'%, within 0.2 s after leaving',(100*dAirNear/dt).toFixed(0)+'%, later in the air',(100*dAirFar/dt).toFixed(1)+'%');
console.log('in the air: mean rotation',(spinAir/airFrames).toFixed(1),'°/frame; frames above 6°/frame',(100*spinFast/airFrames).toFixed(1)+'%');
console.log('visible peak minus beat, frames (asks ≥0.3):',Object.entries(off).sort((a,b)=>a[0]-b[0]).map(([k,v])=>k+':'+v).join(' '));
console.log('separate pushes ≥0.3 per contact: 0,1,2,3,4,5+ :',pushesPerContact.join(' '));
