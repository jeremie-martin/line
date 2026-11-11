import {expect,it} from 'vitest';
import {readFileSync,statSync} from 'node:fs';

// Experiment branch: pin the compact catalogue + 57-feature network artifact
// in place of the frozen construction archive. This is not a production adoption.
const FROZEN='3f5c0cee67e979826900b215914ab1e4e405223d32db461d5c16d4c52f8d9e06';

it('pins the compact construction-policy experiment artifact',()=>{
  const dir=new URL('../scripts/v0/optimizer/',import.meta.url);
  const pointer=JSON.parse(readFileSync(new URL('repertoire_policy_model_v3.json',dir),'utf8'));
  expect(pointer.compressedSha256).toBe(FROZEN);
  expect(statSync(new URL(pointer.file,dir)).size).toBe(109590);
});
