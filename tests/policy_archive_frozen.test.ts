import {expect,it} from 'vitest';
import {readFileSync,statSync} from 'node:fs';

// The construction-policy sources are pinned: a catalogue, a 57-feature network and
// 493 representative demonstrations (210 KB), adopted 2026-11-13 in place of the
// 52 MB archive (REWORK.md). A change here is a behavioural change and needs a comparison.
const FROZEN='af1d6a199368563c5d8e6555fbc10fe087caca0ab5e16133507732126fbef2f0';

it('pins the construction-policy sources',()=>{
  const dir=new URL('../scripts/v0/optimizer/',import.meta.url);
  const pointer=JSON.parse(readFileSync(new URL('repertoire_policy_model_v3.json',dir),'utf8'));
  expect(pointer.compressedSha256).toBe(FROZEN);
  expect(statSync(new URL(pointer.file,dir)).size).toBe(210575);
});
