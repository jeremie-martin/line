import {describe,it,expect} from 'vitest';
import {persistentContactTiming,repairPersistentContactTiming} from '../scripts/benchmark/persistent_contact_timing.ts';
describe('necessary persistent contact timing',()=>{
  it('rejects three 8-frame gaps that exceed the total timing tolerance',()=>{
    expect(persistentContactTiming([20,28,36,44])).toBeNull();
  });
  it('accepts two 8-frame gaps using opposite tolerance endpoints',()=>{
    const authored=[20,28,36],witness=persistentContactTiming(authored)!;
    expect(witness).not.toBeNull();expect(witness[2]-witness[0]).toBeGreaterThanOrEqual(18);
    witness.forEach((frame,i)=>expect(Math.abs(frame-authored[i])).toBeLessThanOrEqual(1));
    expect(repairPersistentContactTiming(authored)).toEqual(authored);
  });
  it('repairs the impossible triple with the minimum one-frame authored change',()=>{
    const authored=[20,28,36,44,64],repaired=repairPersistentContactTiming(authored);
    expect(repaired).toHaveLength(authored.length);expect(persistentContactTiming(repaired)).not.toBeNull();
    expect(repaired.reduce((s,f,i)=>s+Math.abs(f-authored[i]),0)).toBe(1);
    expect(repaired.at(-1)).toBe(64);
  });
  it('retains the distinct detector-limited bounce rule',()=>{
    expect(persistentContactTiming([20,24,28])).not.toBeNull();
  });
});
