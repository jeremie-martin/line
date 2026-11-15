import {describe, expect, it} from 'vitest';
import {punchAmplitude, punchSettings, realizedPunchAt, realizedHits} from '../generated/concept-lab/hit-motion-realized.mjs';
import {riderOnScreen, screenMetrics, NO_MOTION} from '../generated/concept-lab/hit-motion-screen.mjs';
import {BODY_POINTS} from '../scripts/video/picture.js';
import {cameraZoomAt} from '../generated/concept-lab/hit-motion-zoom.mjs';
describe('absolute realized-strength punch', () => {
  it('has explicit thresholds, reference, growth and cap, with no song ranking', () => {
    expect(punchAmplitude(.55)).toBe(0);expect(punchAmplitude(.85)).toBe(.13);
    expect(punchAmplitude(1)).toBeCloseTo(.195);expect(punchAmplitude(20)).toBe(.35);
    let last=0;for(let s=0;s<2;s+=.005){const a=punchAmplitude(s);expect(a).toBeGreaterThanOrEqual(last);last=a;}
    expect(punchAmplitude(.85,punchSettings({peak:.26}))).toBe(.26);
    expect(punchAmplitude(.719559295187359)).toBeCloseTo(.07764148603150812);
    expect(()=>punchSettings({threshold:.85})).toThrow();expect(()=>punchSettings({peak:NaN})).toThrow();
  });
  it('reads measured peaks and strengths, irrespective of requested impact or other beats', () => {
    const make=(impact:number)=>({account:{targets:[{impact}],events:[{onset:38,peak:40,strength:.72}],matches:[{target:0,event:0}]}});
    expect(realizedHits(make(0))).toEqual(realizedHits(make(1)));
    const hits=realizedHits(make(0)), t=1.03;
    expect(realizedPunchAt(hits,t)).toBe(realizedPunchAt([...hits,{time:100,strength:100}],t));
  });
  it('peaks on the measured hit, preserves timing when enlarged, and never adds overlapping pulses', () => {
    const hits=[{time:1,strength:.85}];
    expect(realizedPunchAt(hits,.974)).toBe(1);expect(realizedPunchAt(hits,1)).toBe(1.13);
    expect(realizedPunchAt(hits,1.1)-1).toBeCloseTo(.13/Math.E);expect(realizedPunchAt(hits,1.501)).toBe(1);
    expect(realizedPunchAt([...hits,...hits],1)).toBe(1.13);
    for(const t of [.98,1,1.02,1.2])expect(realizedPunchAt(hits,t,punchSettings({peak:.26}))-1).toBeCloseTo(2*(realizedPunchAt(hits,t)-1));
  });
  it('shares the same frame-sampled dose across all three measured-camera choices', () => {
    const scene={account:{events:[{peak:40,strength:.85}],matches:[{event:0}]}};
    for(let f=30;f<70;f+=.25){const a=cameraZoomAt('measured-punch',scene,f);expect(cameraZoomAt('measured-locked',scene,f)).toEqual(a);expect(cameraZoomAt('measured-current',scene,f)).toEqual(a);}
  });
});
describe('screen geometry diagnostics', () => {
  const points=BODY_POINTS.map((name,i)=>({name,pos:{x:Math.cos(i*2*Math.PI/10)*10,y:Math.sin(i*2*Math.PI/10)*10}}));
  const frame={x:0,y:0,ax:400,ay:600,z:2};
  it('separates translation from radius and ignores rotation when measuring size', () => {
    const plain=riderOnScreen(frame,NO_MOTION,{points});expect(plain.radius).toBeCloseTo(20);
    const moved=riderOnScreen(frame,{dx:10,dy:-20,scale:1.13,rotation:37},{points});
    expect(moved.x).toBeCloseTo(410);expect(moved.y).toBeCloseTo(580);expect(moved.radius/plain.radius).toBeCloseTo(1.13);
  });
  it('reports path length and sampled speed, not a quality score', () => {
    expect(screenMetrics([{t:0,x:0,y:0,dx:0,dy:0,size:0},{t:1/60,x:10,y:0,dx:10,dy:0,size:13},{t:2/60,x:0,y:0,dx:0,dy:0,size:0}])).toEqual({travel:20,maxSpeed:600,maxShift:10,maxSize:13});
  });
});
