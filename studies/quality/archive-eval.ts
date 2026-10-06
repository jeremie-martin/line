/** Move completed evidence to durable local storage; preserve all source paths. */
import {readdirSync,readFileSync,writeFileSync,lstatSync,existsSync,mkdirSync,renameSync,symlinkSync} from 'node:fs';
import {join,relative,basename} from 'node:path';
import {createHash} from 'node:crypto';
import {loadRun} from '../../tools/eval/records.ts';
import {lockArtifacts} from '../../scripts/lib/artifact_lock.ts';
const main='/home/wyss/line', root=join(main,'archives/quality-20261005');
const indexFile=join(main,'docs/research/quality-20261005-archive.json');
const index=JSON.parse(readFileSync(indexFile,'utf8')), added=[], skipped=[];
const sha=(b:Buffer|string)=>createHash('sha256').update(b).digest('hex');
for(const wt of readdirSync('/tmp').filter(n=>n.startsWith('line-quality-'))){
 const evalDir=join('/tmp',wt,'generated/eval');if(!existsSync(evalDir))continue;
 for(const name of readdirSync(evalDir)){
  const source=join(evalDir,name);if(lstatSync(source).isSymbolicLink()||!lstatSync(source).isDirectory()||!existsSync(join(source,'run.json')))continue;
  if(existsSync(join(source,'.generation.lock'))){skipped.push({source,reason:'active lock'});continue;}
  const release=lockArtifacts(source);
  try{
   try{loadRun(source);}catch(e){skipped.push({source,reason:String(e)});continue;}
   const target=join(root,'eval',wt,name);if(existsSync(target))throw Error('archive collision '+target);
   const files:any[]=[];
   function scan(dir:string){for(const entry of readdirSync(dir).sort()){
    if(entry==='.generation.lock'||entry==='archive-files.json')continue;
    const path=join(dir,entry);if(lstatSync(path).isDirectory())scan(path);else{const b=readFileSync(path);files.push([relative(source,path),b.length,sha(b)]);}
   }}scan(source);
   writeFileSync(join(source,'archive-files.json'),JSON.stringify(files)+'\n');
   mkdirSync(join(root,'eval',wt),{recursive:true});renameSync(source,target);symlinkSync(target,source,'dir');
   const entry={source,archive:relative(main,target),files:files.length,bytes:files.reduce((s,x)=>s+x[1],0),manifestSha256:sha(JSON.stringify(files))};
   index.runs.push(entry);added.push(entry);
  }finally{release();}
 }
}
writeFileSync(indexFile,JSON.stringify(index,null,2)+'\n');
writeFileSync(join(root,'migration-index.json'),JSON.stringify(index,null,2)+'\n');
console.log(JSON.stringify({added:added.length,bytes:added.reduce((s,x)=>s+x.bytes,0),skipped},null,2));
