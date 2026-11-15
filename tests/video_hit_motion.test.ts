import {describe, expect, it} from 'vitest';
import {MODES, motionAt, effectsAt} from '../generated/concept-lab/hit-motion-model.mjs';
import {hitEffectsAt} from '../scripts/video/hits.js';
import {strength} from '../scripts/video/intensity.js';
const hit = (time = 1, s = .85, normal = {x: 0, y: -1}) => ({time, strength: s, energy: strength(s), normal});
describe('hit movement study contracts', () => {
  it('current arm is the production response; colour and timing stay identical in every arm', () => {
    const hs = [hit(),hit(1.08,.7,{x:-.6,y:-.8})];
    for(const t of [.9,1,1.02,1.08,1.15,1.4]) {
      const current=hitEffectsAt(hs,t), got=effectsAt('current')(hs,t);
      for(const k of Object.keys(current)) expect(got[k]).toEqual(current[k]);
      for(const mode of Object.keys(MODES)) {
        const fx=effectsAt(mode)(hs,t);
        for(const k of ['split','boost','direction','lit']) expect(fx[k]).toEqual(current[k]);
      }
    }
  });
  it('is causal, finite, bounded under dense opposing hits, and independent of sample order', () => {
    const hs=Array.from({length:60},(_,i)=>hit(1+i/240,1.2,{x:i%2?1:-1,y:0}));
    for(const mode of Object.keys(MODES)) {
      expect(motionAt(mode,hs,.99)).toEqual({dx:0,dy:0,rotation:0,scale:1});
      const times=[.9,1,1.015,1.11,1.3,1.5,3], values=times.map(t=>motionAt(mode,hs,t));
      for(let i=times.length-1;i>=0;i--){const v=motionAt(mode,hs,times[i]);expect(v).toEqual(values[i]);for(const x of Object.values(v))expect(Number.isFinite(x)).toBe(true);expect(Math.hypot(v.dx,v.dy)).toBeLessThanOrEqual(48);expect(Math.abs(v.rotation)).toBeLessThanOrEqual(.75);expect(v.scale).toBeLessThanOrEqual(1.05+1e-12);}
    }
  });
  it('keeps one-way recoil on one side of rest and smooth attacks at zero', () => {
    for(let i=0;i<=240;i++){const t=1+i/600;for(const mode of ['recoil','press'])expect(motionAt(mode,[hit()],t).dy).toBeGreaterThanOrEqual(0);}
    for(const mode of ['press','spring','grain','roll','lens']) expect(motionAt(mode,[hit()],1)).toEqual({dx:0,dy:0,rotation:0,scale:1});
    for(const mode of ['recoil','press','spring','grain','roll','lens']) expect(motionAt(mode,[hit()],1.4)).toEqual({dx:0,dy:0,rotation:0,scale:1});
  });
  it('recovers the archived accumulation and absolute-time oscillator formula', () => {
    const hs=[hit(.8,.4),hit(1,.7)],t=1.03;
    const m=Math.min(1,hs.reduce((sum,h)=>sum+h.strength*1.6*Math.exp(-(t-h.time)*7),0))**1.5;
    expect(motionAt('old',hs,t)).toEqual({dx:10*m*Math.sin(2*Math.PI*9*t),dy:10*m*Math.sin(2*Math.PI*9*1.37*t+1.7),rotation:.4*m*Math.sin(2*Math.PI*9*.9*t+3.1),scale:1});
  });
  it('movement gain does not alter colour or the hit threshold, and unknown modes fail', () => {
    for(const mode of Object.keys(MODES)) {
      const hs=[hit()],a=effectsAt(mode,1)(hs,1.03),b=effectsAt(mode,2)(hs,1.03);
      expect(b.dx).toBeCloseTo(2*a.dx);expect(b.dy).toBeCloseTo(2*a.dy);expect(b.boost).toBe(a.boost);expect(b.split).toBe(a.split);
      expect(effectsAt(mode,1,false)(hs,1.03)).toMatchObject({boost:0,split:0});
    }
    expect(()=>motionAt('typo',[],0)).toThrow(/Unknown/);
  });
});

import {legacyZoomAt} from '../generated/concept-lab/hit-motion-zoom.mjs';
describe('recovered authored zoom', () => {
  it('interpolates log zoom and respects endpoint values and production multiplier', () => {
    const camera={zoom:{keyframes:[{t:0,zoom:2},{t:2,zoom:8}]}};
    expect(legacyZoomAt(camera,[],0)).toBeCloseTo(3.6);
    expect(legacyZoomAt(camera,[],1)).toBeCloseTo(7.2);
    expect(legacyZoomAt(camera,[],2)).toBeCloseTo(14.4);
    expect(legacyZoomAt(camera,[],10)).toBeCloseTo(14.4);
  });
  it('gates authored beats, anticipates by one frame, and returns after the finite tail', () => {
    const camera={zoom:{keyframes:[{t:0,zoom:2}]}}, contacts=[{t:1,impact:.1},{t:2,impact:.9}];
    expect(legacyZoomAt(camera,contacts,1)).toBeCloseTo(3.6);
    expect(legacyZoomAt(camera,contacts,2)).toBeCloseTo(3.6*1.065);
    expect(legacyZoomAt(camera,contacts,1.975)).toBeCloseTo(3.6);
    expect(legacyZoomAt(camera,contacts,2.6)).toBeCloseTo(3.6);
  });
});
