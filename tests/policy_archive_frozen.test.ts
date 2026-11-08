import {expect,it} from 'vitest';
import {readFileSync,statSync} from 'node:fs';

// The construction-policy archive is frozen (owner, 2026-11-08; REWORK.md "the archive is
// frozen"). It stays committed because compare and collection checkouts build every arm
// from git, but it is no longer retrained: each retrain would add tens of MB to git
// history. Readable mechanisms are added beside it, and its worth is measured by the
// no-archive comparison until it can be removed. Changing it needs the owner's decision
// and a deliberate edit of this pin.
const FROZEN='1825fb176887f5c9ce4fe27f9614299214b248dd4cdbfaf7baf14320c61060b5';

it('keeps the construction-policy archive frozen',()=>{
  const dir=new URL('../scripts/v0/optimizer/',import.meta.url);
  const pointer=JSON.parse(readFileSync(new URL('repertoire_policy_model_v3.json',dir),'utf8'));
  expect(pointer.compressedSha256).toBe(FROZEN);
  expect(statSync(new URL(pointer.file,dir)).size).toBe(51949467);
});
