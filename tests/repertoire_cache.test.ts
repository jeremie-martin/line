import {it,expect} from 'vitest';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {readRepertoireCache,publishRepertoireCache} from '../scripts/gallery/repertoire_cache.ts';
it('preserves the first complete publication and rejects corrupted or misidentified cache entries',()=>{
 const root=mkdtempSync(join(tmpdir(),'repertoire-cache-')),key='a'.repeat(64);
 try{
  expect(readRepertoireCache(root,key)).toBeNull();publishRepertoireCache(root,key,{sourceKey:key,original:true});
  publishRepertoireCache(root,key,{sourceKey:key,original:false});expect(readRepertoireCache(root,key).original).toBe(true);
  expect(()=>publishRepertoireCache(root,key,{sourceKey:'b'.repeat(64)})).toThrow('identity');
  writeFileSync(join(root,key,'source.json'),'{}');expect(()=>readRepertoireCache(root,key)).toThrow('checksum');
  expect(()=>publishRepertoireCache(root,key,{sourceKey:key})).toThrow('checksum');
 }finally{rmSync(root,{recursive:true,force:true});}
});
