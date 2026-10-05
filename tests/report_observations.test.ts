import {expect, it} from 'vitest';
import {detectStrikes, STRIKE_V2_CONTRACT as V2, STRIKE_V3_CONTRACT as V3, type StrikeFrame} from '../scripts/lib/strike_impact.ts';
import {arrivalPose} from '../tools/measure/arrival.ts';
import {selectPairs} from '../tools/report/morning_study.ts';

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
it('blind posture selection uses the saved arrival observation and rejects insufficient contrasts', () => {
  const planned={id:'song~101',song:'song',seed:101,perturbation:null,input:{jolt:-15}};
  const cell=(headDown:boolean)=>({case:planned,trackHash:'track',beats:[{frame:80}],impact3:{perBeat:[{requested:.8,hit:{onset:82,offset:2,contactStart:80,headDown,strength:.5}}]}});
  const run=(headDown:boolean):any=>({dir:'unused',run:{panel:[planned],evaluator:'same'},cells:new Map([[planned.id,cell(headDown)]])});
  const [p]=selectPairs(run(false),run(true),'a','b',0,1,11);
  expect(p.poseAt).toBe('contactStart'); expect(p.left.headDown).not.toBe(p.right.headDown);
  expect([p.left.frame,p.right.frame]).toEqual([82,82]);
  expect(()=>selectPairs(run(false),run(false),'a','b',0,1,11)).toThrow(/not enough posture/);
});

it('review video reuse requires matching inputs and intact movie bytes', async () => {
  const {mkdtempSync,writeFileSync,rmSync} = await import('node:fs');
  const {tmpdir} = await import('node:os'); const {join} = await import('node:path');
  const {createHash} = await import('node:crypto');
  const {verifyCachedRide} = await import('../tools/measure/clip_render.ts');
  const dir=mkdtempSync(join(tmpdir(),'review-cache-')),movie=join(dir,'ride.mp4'),input={trackHash:'a',audioSha256:'b'};
  try {
    writeFileSync(movie,'movie');
    expect(()=>verifyCachedRide(movie,input)).toThrow();
    writeFileSync(movie+'.render.json',JSON.stringify({input,movieSha256:createHash('sha256').update('movie').digest('hex')}));
    expect(()=>verifyCachedRide(movie,input)).not.toThrow();
    expect(()=>verifyCachedRide(movie,{...input,trackHash:'other'})).toThrow(/inputs changed/);
    writeFileSync(movie,'different');expect(()=>verifyCachedRide(movie,input)).toThrow(/video differs/);
  } finally {rmSync(dir,{recursive:true,force:true});}
});
