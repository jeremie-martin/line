import {policy as v3} from '../v3/policy.ts';
/** Expand coverage while retaining every V3 scoring and resource decision. */
export const policy={...v3,schema:'line.benchmark-v4.policy.v1',status:'frozen',
  specifications:176,unchangedV3Specifications:88,companions:88,
  recovery:{referenceV3:930.1556,fraction:.75,rounding:'ceil_4_decimals'},
  relationship:'One companion per unchanged V3 case, inside the same aggregation parent.'} as const;
