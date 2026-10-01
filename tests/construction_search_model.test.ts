import {expect,it} from 'vitest';
import {constructionSearchModelData} from '../scripts/v0/optimizer/repertoire_search.ts';
const example=(entry:number)=>({control:{entry,turn:-15,exit:20,support:8,bias:0,offset:0},
 incoming:40,span:20,features:Array(57).fill(0)});
const a=example(10),b=example(20),extra=example(30);
const policy={featureCount:57,exemplars:[a,b].map(({features,...controlReference})=>({features,controlReference}))};
const model={schema:'line.construction-policies.v1',groups:{arcs:policy}};

it('preserves the selected policy and the exact independently ordered memory',()=>{
 const plain=constructionSearchModelData(model);
 expect(plain.examples.arcs).toEqual([a,b]);
 const packed=constructionSearchModelData({...model,memoryGroups:{arcs:[1,extra,0]}});
 expect(packed.policies).toBe(model.groups);
 expect(packed.examples.arcs).toEqual([b,extra,a]);
 expect(packed.examples.arcs[1]).toBe(extra);
});

it('rejects invalid references rather than silently losing demonstrations',()=>{
 for(const entry of [-1,.5,2,null,{...extra,span:Infinity},{...extra,control:{entry:0}}])
  expect(()=>constructionSearchModelData({...model,memoryGroups:{arcs:[entry]}})).toThrow('memory reference');
 expect(()=>constructionSearchModelData({...model,memoryGroups:{missing:[0]}})).toThrow('memory reference');
});
