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

it('loads only the chosen construction archive and resolves the complete search profile once',()=>{
 const spec:Spec={duration:2,preroll:0,jitter:0,contacts:[{t:1,impact:.8}],axes:{air:()=>.5,speed:()=>.5}};
 const plan=planIntentionalRepertoire(spec,101);
 reads.length=0;
 const current=repertoireSearchOptions(spec,plan,200000,'line.strike.v3');
 const archives=()=>reads.filter(p=>/repertoire_policy_model.*\.json(?:\.gz)?$/.test(p));
 expect(archives().length).toBe(2);
 expect(archives().every(p=>p.includes('repertoire_policy_model_v3'))).toBe(true);
 expect(current.impactContract).toBe('line.strike.v3');
 expect(current.impactSearch?.uprightArrival).toBe(1);
 expect(current.coupledIntervalSamples).toBe(64);
 expect(current).not.toHaveProperty('constructionModel');
 expect(repertoireSearchOptions(spec,plan,200000,'line.strike.v3').constructionPolicies).toBe(current.constructionPolicies);
 expect(archives().length).toBe(2);
 expect(()=>repertoireSearchOptions(spec,plan,200000,'unknown')).toThrow('unknown impact contract');
 expect(archives().length).toBe(2);
});
