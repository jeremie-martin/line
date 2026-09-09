import {expect,it} from 'vitest';
import {arcValueGuidance} from '../scripts/v0/optimizer/arc_value.ts';

it('preserves physical residuals and replaces only the unresolved arrival prior',()=>{
  // The physical boundary correction contributes a constant -0.02 to the loss.
  const residuals=[.1,.2,.3,.4],local=.1**2+.2**2-.02,cost=local+.3**2+.4**2;
  const result=arcValueGuidance(cost,local,residuals,2,.09,.25);
  expect(result.residuals.slice(0,2)).toEqual(residuals.slice(0,2));
  expect(result.cost).toBeCloseTo(local+.75*(.3**2+.4**2)+.25*.09,14);
  expect(result.residuals.reduce((sum,r)=>sum+r*r,0)-.02).toBeCloseTo(result.cost,14);
  expect(residuals).toEqual([.1,.2,.3,.4]);
  expect(arcValueGuidance(cost,local,residuals,2,.09,1).cost).toBeCloseTo(local+.09,14);
});

it('leaves the existing objective exact when guidance is disabled or no model is available',()=>{
  const residuals=[.2,.3];
  expect(arcValueGuidance(.13,.04,residuals,1,.8,0)).toEqual({cost:.13,residuals});
  expect(arcValueGuidance(.13,.04,residuals,1,undefined,.5)).toEqual({cost:.13,residuals});
  for(const weight of [-1,1.1,NaN])expect(()=>arcValueGuidance(.13,.04,residuals,1,.8,weight)).toThrow('weight');
});
