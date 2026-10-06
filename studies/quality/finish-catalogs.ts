/** Summarize only after both declared jobs finish and release their artifact locks. */
import {existsSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
const dirs=['/tmp/line-quality-catalog-panel-20261006','/tmp/line-quality-passive-catalog-20261006'];
const count=(dir:string)=>readdirSync(dir).filter(n=>n.endsWith('.json')).length;
while(dirs.some(d=>existsSync(join(d,'.generation.lock')))||count(dirs[0]+'/baseline')!==336||count(dirs[0]+'/candidate')!==336||count(dirs[1]+'/candidate')!==336)
 await new Promise(r=>setTimeout(r,15000));
for(const file of ['catalog-summary.ts','passive-catalog-summary.ts']){
 const r=spawnSync(process.execPath,['--import','tsx',new URL(file,import.meta.url).pathname],{stdio:'inherit'});
 if(r.status!==0)process.exit(r.status??1);
}
