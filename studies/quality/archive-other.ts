/** Preserve completed research payloads locally, retaining their source paths. */
import assert from 'node:assert/strict';
import {readdirSync,readFileSync,writeFileSync,lstatSync,existsSync,mkdirSync,renameSync,symlinkSync} from 'node:fs';
import {join,relative,dirname} from 'node:path';
import {createHash} from 'node:crypto';
const main='/home/wyss/line',root=join(main,'archives/quality-20261005'),indexPath=join(main,'docs/research/quality-20261005-archive.json');
const index=JSON.parse(readFileSync(indexPath,'utf8'));index.datasets??=[];
const sha=(b:Buffer|string)=>createHash('sha256').update(b).digest('hex');
const includeCatalog=process.argv.includes('--include-catalog');
const sources:string[]=[];
for(const wt of readdirSync('/tmp').filter(n=>n.startsWith('line-quality-'))){
 const generated=join('/tmp',wt,'generated');if(!existsSync(generated))continue;
 for(const name of readdirSync(generated)){
  const source=join(generated,name);
  if(name==='eval'||lstatSync(source).isSymbolicLink()||!lstatSync(source).isDirectory())continue;
  if(wt==='line-quality-current-value-20261006'&&!includeCatalog)continue;
  sources.push(source);
 }
}
if(includeCatalog){
 for(const name of ['catalog','passive-catalog']){
  const source=name==='catalog'?'/tmp/line-quality-catalog-panel-20261006':'/tmp/line-quality-passive-catalog-20261006';
  assert.ok(existsSync(join(main,`docs/research/quality-20261005-${name}.json`)),'complete audited catalog evidence is required');
  sources.push(source);
 }
}
for(const source of sources){
 if(lstatSync(source).isSymbolicLink())continue;
 const files:any[]=[];
 function scan(dir:string){for(const name of readdirSync(dir).sort()){
  assert.notEqual(name,'.generation.lock','active writer: '+dir);if(name==='archive-files.json')continue;
  const p=join(dir,name),stat=lstatSync(p);assert.ok(!stat.isSymbolicLink(),'unexpected nested link: '+p);
  if(stat.isDirectory())scan(p);else{assert.ok(stat.isFile());const bytes=readFileSync(p);files.push([relative(source,p),bytes.length,sha(bytes)]);}
 }}scan(source);
 const target=join(root,'research',relative('/tmp',source));assert.ok(!existsSync(target),'archive destination exists');
 writeFileSync(join(source,'archive-files.json'),JSON.stringify(files)+'\n');mkdirSync(dirname(target),{recursive:true});
 renameSync(source,target);symlinkSync(target,source,'dir');
 index.datasets.push({source,archive:relative(main,target),files:files.length,bytes:files.reduce((s,x)=>s+x[1],0),manifestSha256:sha(JSON.stringify(files))});
 console.log('preserved',source,files.length);
}
writeFileSync(indexPath,JSON.stringify(index,null,2)+'\n');writeFileSync(join(root,'migration-index.json'),JSON.stringify(index,null,2)+'\n');
