import {expect,it,vi} from 'vitest';
const reads=vi.hoisted(()=>[] as string[]);
vi.mock('node:fs',async importOriginal=>{
 const fs=await importOriginal<typeof import('node:fs')>();
 return {...fs,readFileSync:(...args:Parameters<typeof fs.readFileSync>)=>{
  reads.push(String(args[0]));return (fs.readFileSync as any)(...args);
 }};
});
import {planIntentionalRepertoire} from '../scripts/v0/optimizer/intentional_repertoire.ts';
import {repertoireSearchOptions} from '../scripts/v0/optimizer/repertoire_search.ts';
import type {Spec} from '../scripts/v0/types.ts';

it('reads no construction archive (imagined proposals experiment) and resolves the complete search profile',()=>{
 const spec:Spec={duration:2,preroll:0,contacts:[{t:1,impact:.8}],axes:{air:()=>.5,speed:()=>.5}};
 const plan=planIntentionalRepertoire(spec,101);
 reads.length=0;
 const current=repertoireSearchOptions(spec,plan,200000);
 const archives=()=>reads.filter(p=>/repertoire_policy_model.*\.json(?:\.gz)?$/.test(p));
 expect(archives().length).toBe(0);
 expect(current.impactSearch?.uprightArrival).toBe(1);
 expect(current).not.toHaveProperty('coupledIntervalSamples');
 expect(current).not.toHaveProperty('constructionModel');
 expect(current.constructionPolicies).toBeUndefined();
 expect(current.constructionExamples).toBeUndefined();
 expect(current).toMatchObject({imaginedProposals:true,policySamples:64,samples:160});
});
