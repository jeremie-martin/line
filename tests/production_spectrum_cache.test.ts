import {it,expect} from 'vitest';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {ensureSpectrum} from '../scripts/produce/render.ts';
it('separates changed recordings with the same song name and atomically shares concurrent analysis',async()=>{
 const root=mkdtempSync(join(tmpdir(),'line-spectrum-')),name='test-'+root.split('/').at(-1),outputs=new Set<string>();
 try{
  for(const frequency of [440,1800])execFileSync('ffmpeg',['-v','error','-f','lavfi','-i',`sine=frequency=${frequency}:duration=0.5`,'-ar','22050',join(root,frequency+'.wav')]);
  const [first,same]=await Promise.all([0,1].map(()=>ensureSpectrum(join(root,'440.wav'),name,join(root,'log'))));outputs.add(first);outputs.add(same);
  const second=await ensureSpectrum(join(root,'1800.wav'),name,join(root,'log'));outputs.add(second);
  expect(first).toBe(same);expect(second).not.toBe(first);
  const a=JSON.parse(readFileSync(join('remotion/public',first),'utf8')),b=JSON.parse(readFileSync(join('remotion/public',second),'utf8'));
  expect(a.frames.length).toBeGreaterThan(0);expect(a.frames).not.toEqual(b.frames);
 }finally{for(const file of outputs)rmSync(join('remotion/public',file),{force:true});rmSync(root,{recursive:true,force:true});}
},30000);
