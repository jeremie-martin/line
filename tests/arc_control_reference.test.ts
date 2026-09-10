import {expect,it} from 'vitest';
import {arcReferencedControl,arcControlProposals,ARC_POLICY_SCHEMA} from '../scripts/v0/optimizer/arc_control_policy.ts';
const control={entry:-0,turn:.7717157855081368,exit:-15.560485142611265,support:11.031070267482425,bias:1.9660388497159325,offset:.3380755850406746};
it('preserves every demonstrated control and omitted parameter exactly at its reference state',()=>{
  const reference={control,incoming:1.123456789,span:24};
  expect(arcReferencedControl(reference,reference.incoming,reference.span)).toEqual(control);
  expect(Object.is(arcReferencedControl(reference,reference.incoming,24).entry,-0)).toBe(true);
  const changed=arcReferencedControl(reference,reference.incoming+10,48);
  expect(changed.entry).toBeCloseTo(10,13);expect(changed.exit).toBeCloseTo(control.exit+10,13);
  expect(changed.support).toBe(control.support*2);expect(changed.turn).toBe(control.turn);
  expect(()=>arcReferencedControl({...reference,span:0},0,24)).toThrow('reference');
});
it('uses raw references after the unchanged nearest-example search',()=>{
  const features=Array(57).fill(0),reference={control,incoming:0,span:24};
  const model={featureSchema:ARC_POLICY_SCHEMA,featureCount:57,exemplars:[{features,target:Array(10).fill(1),controlReference:reference}]};
  expect(arcControlProposals(features,0,24,model,1)).toEqual([control]);
  expect(arcControlProposals(features,10,48,model,1)[0].support).toBe(control.support*2);
});
