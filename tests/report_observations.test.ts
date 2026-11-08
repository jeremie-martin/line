import {expect, it} from 'vitest';
import {detectStrikes, STRIKE_V2_CONTRACT as V2, STRIKE_V3_CONTRACT as V3, type StrikeFrame} from '../scripts/lib/strike_impact.ts';
import {arrivalPose} from '../tools/measure/arrival.ts';

it('counts opposite pushes directly even when thresholded net counts lose hits', () => {
  // Two small impulses add to a >=.2 event under v2; separating the opposing
  // travel directions leaves two <.2 events. Their spin components reinforce.
  const impulse: Array<[number,number,number]> = [[0,0,0], [0,-.9,1], [0,.9,1], [0,0,0]];
  const fs: StrikeFrame[] = impulse.map((p, i) => ({frame:i,contact:i===1||i===2,J:Math.hypot(p[0],p[1]),bend:0,solverGain:0,gravityGain:0,speedBefore:1,impulse:p}));
  const pairs: any[] = [], events = detectStrikes(fs,V3,(a,b)=>pairs.push([a,b])), old = detectStrikes(fs,V2);
  expect(events).toEqual(detectStrikes(fs,V3)); expect(pairs).toHaveLength(1);
  expect(pairs[0]).toEqual(events); expect(events.every(e=>e.strength<.2)).toBe(true);
  expect(old.filter(e=>e.strength>=.2).length).toBe(1);
  expect(events.filter(e=>e.strength>=.2).length-old.filter(e=>e.strength>=.2).length).toBe(-1);
  const corner = fs.map(f=>({...f,impulse: f.frame===2 ? [.9,0,1] as const : f.impulse}));
  const noPairs: any[]=[];detectStrikes(corner,V3,(a,b)=>noPairs.push([a,b]));expect(noPairs).toHaveLength(0);
});
it('samples incoming pose at first contact, even when the rider flips before onset', () => {
  const frame = (nose:number) => ({points:Array.from({length:10},(_,i)=>[i===2?nose:0,0,(i===2?nose:0)-1,0])});
  const frames=[frame(1),frame(1),frame(-1)];
  expect(arrivalPose(frames,1)).toEqual({contactStart:1,headDown:false});
  expect(arrivalPose(frames,2).headDown).toBe(true);
});
it('a review clip is reused only for the same inputs and intact bytes', async () => {
  const {mkdtempSync,writeFileSync,rmSync} = await import('node:fs');
  const {tmpdir} = await import('node:os'); const {join} = await import('node:path');
  const {createHash} = await import('node:crypto');
  const {verifyCachedClip} = await import('../tools/measure/clip_render.ts');
  const dir=mkdtempSync(join(tmpdir(),'review-cache-')),movie=join(dir,'clip.mp4'),input={trackHash:'a',audioSha256:'b'};
  try {
    writeFileSync(movie,'movie');
    expect(()=>verifyCachedClip(movie,input)).toThrow();
    writeFileSync(movie+'.json',JSON.stringify({input,movieSha256:createHash('sha256').update('movie').digest('hex')}));
    expect(()=>verifyCachedClip(movie,input)).not.toThrow();
    expect(()=>verifyCachedClip(movie,{...input,trackHash:'other'})).toThrow(/other inputs/);
    writeFileSync(movie,'different');expect(()=>verifyCachedClip(movie,input)).toThrow(/differs from the clip/);
  } finally {rmSync(dir,{recursive:true,force:true});}
});
