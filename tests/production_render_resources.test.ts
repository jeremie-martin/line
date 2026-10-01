import {describe,it,expect} from 'vitest';
import {renderResourceArgs} from '../scripts/produce/render.ts';

describe('bounded production rendering resources',()=>{
 it('caps both workers and decoded video cache without environment overrides',()=>{
  expect(renderResourceArgs({})).toEqual(['--concurrency=4','--offthreadvideo-cache-size-in-bytes=536870912']);
 });
 it('supports explicit per-render resource allowances',()=>{
  expect(renderResourceArgs({LR_REMOTION_CONCURRENCY:'6',LR_REMOTION_CACHE_MB:'256'}))
   .toEqual(['--concurrency=6','--offthreadvideo-cache-size-in-bytes=268435456']);
 });
 it('rejects invalid allowances before starting expensive rendering',()=>{
  for(const name of ['LR_REMOTION_CONCURRENCY','LR_REMOTION_CACHE_MB'])
   for(const value of ['0','-1','1.5','Infinity','NaN','4junk','9007199254740992'])
    expect(()=>renderResourceArgs({[name]:value})).toThrow();
  expect(()=>renderResourceArgs({LR_REMOTION_CACHE_MB:'9007199254740991'})).toThrow(/too large/);
 });
});
