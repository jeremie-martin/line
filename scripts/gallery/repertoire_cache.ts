/** Publish immutable source-cache entries with one atomic directory rename.
 * Concurrent CLI workers may compute the same source; readers never observe a
 * JSON file from one writer paired with another writer's checksum. */
import {existsSync,mkdirSync,mkdtempSync,readFileSync,writeFileSync,renameSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
const hash=(b:string|Buffer)=>createHash('sha256').update(b).digest('hex');
export function readRepertoireCache(root:string,key:string){
 if(!/^[a-f0-9]{64}$/.test(key))throw new Error('invalid source cache key');
 const dir=join(root,key);if(!existsSync(dir))return null;
 const body=readFileSync(join(dir,'source.json'));
 if(hash(body)!==readFileSync(join(dir,'source.sha256'),'utf8').trim())throw new Error('source cache checksum mismatch');
 const value=JSON.parse(body.toString());if(value.sourceKey!==key)throw new Error('source cache identity mismatch');return value;
}
export function publishRepertoireCache(root:string,key:string,value:any){
 if(!/^[a-f0-9]{64}$/.test(key)||value.sourceKey!==key)throw new Error('invalid source cache identity');
 mkdirSync(root,{recursive:true});const temporary=mkdtempSync(join(root,'.publishing-'));
 try{
  const body=JSON.stringify(value)+'\n';writeFileSync(join(temporary,'source.json'),body);writeFileSync(join(temporary,'source.sha256'),hash(body)+'\n');
  try{renameSync(temporary,join(root,key));}catch(e){
   if(!['EEXIST','ENOTEMPTY'].includes((e as NodeJS.ErrnoException).code??''))throw e;
   readRepertoireCache(root,key); // An existing corrupt entry is never accepted.
  }
 }finally{rmSync(temporary,{recursive:true,force:true});}
}
