import {expect,it} from 'vitest';
import {createHash} from 'node:crypto';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {gzipSync} from 'node:zlib';
import {parseArcPolicyArtifact} from '../scripts/v0/optimizer/connected_arcs.ts';
it('loads exact policy bytes and rejects damaged compressed or decoded commitments',()=>{
  const dir=mkdtempSync(join(tmpdir(),'arc-policy-test-'));
  try{
    const raw=JSON.stringify({featureCount:57,weights:[.1,-17.618600633958097],absent:undefined})+'\n';
    const compressed=gzipSync(raw),hash=(b:Buffer|string)=>createHash('sha256').update(b).digest('hex');
    writeFileSync(join(dir,'policy.json.gz'),compressed);
    const url=pathToFileURL(join(dir,'policy.json'));
    const archive={schema:'line.arc-compressed-policy.v1',compression:'gzip-file',file:'policy.json.gz',
      uncompressedBytes:Buffer.byteLength(raw),sha256:hash(raw),compressedSha256:hash(compressed)};
    const load=(change={})=>parseArcPolicyArtifact(JSON.stringify({...archive,...change}),url);
    expect(load()).toEqual(JSON.parse(raw));expect(parseArcPolicyArtifact(raw)).toEqual(JSON.parse(raw));
    expect(()=>load({sha256:'0'.repeat(64)})).toThrow('checksum');
    expect(()=>load({compressedSha256:'0'.repeat(64)})).toThrow('checksum');
    expect(()=>load({uncompressedBytes:archive.uncompressedBytes+1})).toThrow('checksum');
    expect(()=>load({file:'../policy.json.gz'})).toThrow('invalid');
  }finally{rmSync(dir,{recursive:true,force:true});}
});
