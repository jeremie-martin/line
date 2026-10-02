import {it,expect} from 'vitest';
import {validateAutomaticProductionRequest,validateGalleryRequest} from '../scripts/gallery/repertoire_catalog.ts';
const request={mode:'production',song:'luna_bala_44s',seed:101,budget:3000000,creative:{}};
it('validates broad production settings without requiring manual windows',()=>{
 const r=validateGalleryRequest(request);expect(r).toMatchObject({mode:'production',referenceBudget:0});
 expect(()=>validateAutomaticProductionRequest({...request,seed:-1})).toThrow();
 expect(()=>validateAutomaticProductionRequest({...request,budget:1000})).toThrow();
 expect(()=>validateAutomaticProductionRequest({...request,creative:{repertoire:[]}})).toThrow();
 expect(()=>validateAutomaticProductionRequest({...request,composition:{}})).toThrow();
});
it('requires an explicit allowance for historical ordinary comparisons',()=>{
 expect(validateAutomaticProductionRequest({...request,referenceBudget:750000}).referenceBudget).toBe(750000);
 expect(validateAutomaticProductionRequest({...request,referenceBudget:0}).referenceBudget).toBe(0);
 for(const referenceBudget of [-1,1,19999,5000001,NaN])expect(()=>validateAutomaticProductionRequest({...request,referenceBudget})).toThrow('reference allowance');
});
it('preserves the authored fourth-song musical targets',async()=>{
 const a=(await import('../scripts/v0/specs/amour_de_ma_vie_short.ts')).default;
 const b=(await import('../productions/amour_de_ma_vie_44s/spec.ts')).default;
 expect(b.contacts).toEqual(a.contacts);expect(b.duration).toBe(a.duration);expect(b.camera).toEqual(a.camera);
 for(let f=0;f<=Math.round(a.duration*40);f++)for(const axis of ['air','speed'] as const)expect(b.axes[axis]!(f/40)).toBe(a.axes[axis]!(f/40));
});
