/** Append completed validation logs without overwriting previous evidence. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,copyFileSync,existsSync,readdirSync} from 'node:fs';
import {join,basename} from 'node:path';
import {createHash} from 'node:crypto';
const main='/home/wyss/line',dir=main+'/archives/quality-20261005/validation',indexPath=main+'/docs/research/quality-20261005-archive.json';
const sha=(x:Buffer|string)=>createHash('sha256').update(x).digest('hex');
for(const file of process.argv.slice(2)){
 const target=join(dir,basename(file));if(existsSync(target))assert.equal(sha(readFileSync(target)),sha(readFileSync(file)),'existing evidence differs');else copyFileSync(file,target);
}
const files=readdirSync(dir).filter(f=>f!=='archive-files.json').sort().map(name=>{const bytes=readFileSync(join(dir,name));return [name,bytes.length,sha(bytes)]});
writeFileSync(join(dir,'archive-files.json'),JSON.stringify(files)+'\n');
const index=JSON.parse(readFileSync(indexPath,'utf8'));index.validation={...index.validation,files:files.length,bytes:files.reduce((s,x)=>s+Number(x[1]),0),manifestSha256:sha(JSON.stringify(files))};
writeFileSync(indexPath,JSON.stringify(index,null,2)+'\n');writeFileSync(main+'/archives/quality-20261005/migration-index.json',JSON.stringify(index,null,2)+'\n');console.log(index.validation);
