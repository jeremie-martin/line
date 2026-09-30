import {it,expect} from 'vitest';
import {requestScore,summarize} from '../benchmark/v5/evaluator.ts';
it('gives no construction credit to unmet requests and no credit to invalid music',()=>{
  expect(requestScore(960,true,[true,false,true])).toBe(640);
  expect(requestScore(960,false,[true,true,true])).toBe(0);
  expect(requestScore(960,true,[false,false])).toBe(0);
});
it('requires complete paired panels and keeps panel weights independent of variant counts',()=>{
  const cases=[{id:'f',sourceId:'song',panel:'fixed',family:'fold'},{id:'a',sourceId:'song',panel:'automatic',family:'music'}]as any;
  const rows=cases.map((c:any)=>({id:c.id,seed:1,score:c.id==='f'?800:600,musicalScore:950,valid:true,fulfilled:1,requested:1,trackHash:c.id}));
  expect(summarize(rows,cases,[1]).headline).toBeCloseTo(700);
  expect(()=>summarize(rows.slice(0,1),cases,[1])).toThrow();
  expect(()=>summarize(rows,cases,[1,1])).toThrow();
});
