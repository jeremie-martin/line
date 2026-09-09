import {expect,it} from 'vitest';
import {arcSecantUpdate} from '../scripts/v0/optimizer/arc_response.ts';

it('matches a newly observed coupled response while preserving orthogonal information',()=>{
  const before=[[2,1],[0,3]],step=[.5,.5],change=[2,-1];
  const after=arcSecantUpdate(before,step,change)!;
  for(let r=0;r<2;r++){
    expect(after[r][0]*step[0]+after[r][1]*step[1]).toBeCloseTo(change[r],12);
    expect(after[r][0]-after[r][1]).toBeCloseTo(before[r][0]-before[r][1],12);
  }
  expect(before).toEqual([[2,1],[0,3]]);
  expect(arcSecantUpdate(before,[0,0],change)).toBeNull();
  expect(arcSecantUpdate(before,[Infinity,0],change)).toBeNull();
});
