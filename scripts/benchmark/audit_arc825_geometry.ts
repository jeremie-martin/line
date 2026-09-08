/** Audit the actual canonical geometries using matching rich research tracks. */
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
const arg=(name:string)=>process.argv.find(a=>a.startsWith(`--${name}=`))?.slice(name.length+3);
const archive=arg('archive')!,inputs=arg('inputs')!,out=arg('out')!;
const hash=(b:string|Buffer)=>createHash('sha256').update(b).digest('hex');
const archiveBody=readFileSync(archive);
const runs=archive.endsWith('.jsonl')?archiveBody.toString().trim().split('\n').slice(1).map(line=>JSON.parse(line).result).filter(Boolean):JSON.parse(archiveBody.toString()).runs;
const sources=[...new Set(runs.map((r:any)=>r.task.sourceId))].sort() as string[];
const rows=[];
for(const source of sources){
 const record=JSON.parse(readFileSync(`${inputs}/${source}.json`,'utf8')),track=record.track,trackSha256=hash(JSON.stringify(track));
 const matching=runs.filter((r:any)=>r.task.sourceId===source);
 if(matching.some((r:any)=>r.trackHash!==trackSha256))throw new Error(`canonical track differs: ${source}`);
 const groups=new Map<number,any[]>();
 for(const line of track.lines){
  if(line.type!==0)throw new Error('non-normal geometry');
  const group=Math.floor((line.id-1000)/10000);groups.set(group,[...(groups.get(group)??[]),line]);
 }
 const counts=[],lengths=[];
 for(const lines of groups.values()){
  const chains:any[][]=[[]];
  for(const line of lines){const last=chains.at(-1)!.at(-1);if(last&&(last.x2!==line.x1||last.y2!==line.y1))chains.push([]);chains.at(-1)!.push(line);}
  if(chains.length>2)throw new Error('fragmented geometry');
  for(const chain of chains){
   const length=chain.reduce((sum,line)=>sum+Math.hypot(line.x2-line.x1,line.y2-line.y1),0);
   if(chain.length<2||length<10)throw new Error('insubstantial curve');lengths.push(length);
  }counts.push(chains.length);
 }
 rows.push({source,trackSha256,canonicalRuns:matching.length,allNormal:true,groups:groups.size,
  singleCurves:counts.filter(n=>n===1).length,pairedCurves:counts.filter(n=>n===2).length,
  segments:track.lines.length,shortestChain:Math.min(...lengths),longestChain:Math.max(...lengths),
  reportMatches:matching.every((r:any)=>JSON.stringify(r.report)===JSON.stringify(record.report)),
  scoreMatches:matching.every((r:any)=>JSON.stringify(r.score)===JSON.stringify(record.score)),
  framesMatch:matching.every((r:any)=>r.stats.sim_frames===record.stats.sim_frames)});
}
const record={schema:'line.arc-825-geometry-audit.v1',archiveSha256:hash(archiveBody),inputs,sources:rows.length,
 canonicalRuns:rows.reduce((s,r)=>s+r.canonicalRuns,0),allNormal:true,groups:rows.reduce((s,r)=>s+r.groups,0),
 singleCurves:rows.reduce((s,r)=>s+r.singleCurves,0),pairedCurves:rows.reduce((s,r)=>s+r.pairedCurves,0),
 segments:rows.reduce((s,r)=>s+r.segments,0),shortestChain:Math.min(...rows.map(r=>r.shortestChain)),rows};
const body=JSON.stringify(record)+'\n';writeFileSync(out,body);writeFileSync(out+'.sha256',hash(body)+'\n');
console.log(JSON.stringify({...record,rows:undefined}));
