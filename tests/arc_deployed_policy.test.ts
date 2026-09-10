import {expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {arcControlProposals} from '../scripts/v0/optimizer/arc_control_policy.ts';
import {parseArcPolicyArtifact} from '../scripts/v0/optimizer/connected_arcs.ts';
import fixtures from './fixtures/arc_reference_policy_predictions.json' with {type:'json'};
const url=new URL('../scripts/v0/optimizer/arc_control_policy_model.json',import.meta.url);
const policy=parseArcPolicyArtifact(readFileSync(url),url).rolloutPolicy;
it('retrieves independently reconstructed opening and catch controls without any numeric or optional-field loss',()=>{
  for(const row of fixtures){
    const model=row.startup?policy.startupModel:policy;
    expect(arcControlProposals(row.features,row.incoming,row.span,model,1)).toEqual([row.control]);
    const shifted=arcControlProposals(row.features,row.incoming+5,row.span*2,model,1)[0];
    expect(shifted.entry).toBeCloseTo(row.control.entry+5,12);
    expect(shifted.exit).toBeCloseTo(row.control.exit+5,12);
    expect(shifted.support).toBe(row.control.support*2);
  }
});
