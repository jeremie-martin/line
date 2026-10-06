/** Hash the complete new review in place; large movies stay local. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,readdirSync,lstatSync} from 'node:fs';
import {join,relative} from 'node:path';
import {createHash} from 'node:crypto';
const main='/home/wyss/line',dir=join(main,'generated/report/quality-20261005'),indexPath=join(main,'docs/research/quality-20261005-archive.json');
const sha=(x:Buffer|string)=>createHash('sha256').update(x).digest('hex'),files:any[]=[];
function scan(d:string){for(const n of readdirSync(d).sort()){
 if(n==='archive-files.json')continue;assert.notEqual(n,'.generation.lock');const p=join(d,n),st=lstatSync(p);assert.ok(!st.isSymbolicLink());
 if(st.isDirectory())scan(p);else{assert.ok(st.isFile());const data=readFileSync(p);files.push([relative(dir,p),data.length,sha(data)]);}
}}scan(dir);
writeFileSync(join(dir,'archive-files.json'),JSON.stringify(files)+'\n');
const index=JSON.parse(readFileSync(indexPath,'utf8'));index.review={archive:relative(main,dir),files:files.length,bytes:files.reduce((s,x)=>s+x[1],0),manifestSha256:sha(JSON.stringify(files)),
 note:'Separate campaign dashboard, full native musical rides, paired clips and physical frame inspections. Kept locally in place; previous dashboards and unanswered questions are untouched.'};
writeFileSync(indexPath,JSON.stringify(index,null,2)+'\n');writeFileSync(join(main,'archives/quality-20261005/migration-index.json'),JSON.stringify(index,null,2)+'\n');console.log(index.review);
