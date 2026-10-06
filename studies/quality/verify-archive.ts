/** Verify the durable raw evidence against the committed compact archive index. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,realpathSync,readdirSync,lstatSync} from 'node:fs';
import {join,relative} from 'node:path';
import {createHash} from 'node:crypto';
const main='/home/wyss/line',indexPath=join(main,'docs/research/quality-20261005-archive.json');
const raw=readFileSync(indexPath),index=JSON.parse(raw.toString());
const sha=(b:Buffer|string)=>createHash('sha256').update(b).digest('hex');
let files=0,bytes=0;
for(const entry of [...index.runs,...index.datasets,index.validation,...(index.review?[index.review]:[])]){
 const dir=join(main,entry.archive),manifest=JSON.parse(readFileSync(join(dir,'archive-files.json'),'utf8'));
 assert.equal(sha(JSON.stringify(manifest)),entry.manifestSha256);assert.equal(manifest.length,entry.files);
 if(entry.source)assert.equal(realpathSync(entry.source),realpathSync(dir),'source link changed');
 const found:string[]=[];function scan(d:string){for(const n of readdirSync(d)){
  if(n==='archive-files.json')continue;const p=join(d,n);if(lstatSync(p).isDirectory())scan(p);else found.push(relative(dir,p));
 }}scan(dir);assert.deepEqual(found.sort(),manifest.map((r:any)=>r[0]).sort(),'unexpected or missing archived file');
 let total=0;for(const [name,size,digest]of manifest){const b=readFileSync(join(dir,name));assert.equal(b.length,size);assert.equal(sha(b),digest);files++;total+=size;}
 assert.equal(total,entry.bytes);bytes+=total;
}
const result={schema:'line.quality-archive-verification.v1',at:new Date().toISOString(),indexSha256:sha(raw),
 runs:index.runs.length,datasets:index.datasets.length,files,bytes,allRecordedBytesAndSourceLinksVerified:true};
writeFileSync(join(main,'docs/research/quality-20261005-archive-verification.json'),JSON.stringify(result,null,2)+'\n');
console.log(result);
