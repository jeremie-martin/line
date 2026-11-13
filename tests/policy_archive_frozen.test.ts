import {expect,it} from 'vitest';
import {readFileSync,statSync} from 'node:fs';

// Experiment branch: pin the compact catalogue + 57-feature network artifact
// in place of the frozen construction archive. This is not a production adoption.
const FROZEN='af1d6a199368563c5d8e6555fbc10fe087caca0ab5e16133507732126fbef2f0';

it('pins the compact construction-policy experiment artifact',()=>{
  const dir=new URL('../scripts/v0/optimizer/',import.meta.url);
  const pointer=JSON.parse(readFileSync(new URL('repertoire_policy_model_v3.json',dir),'utf8'));
  expect(pointer.compressedSha256).toBe(FROZEN);
  expect(statSync(new URL(pointer.file,dir)).size).toBe(210575);
});
