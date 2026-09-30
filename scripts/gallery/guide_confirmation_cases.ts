/** Authored before the coverage-search experiments; never used for development.
 * Ordinary contrasting phrases and a longer release, outside frozen benchmarks. */
import {makeGalleryCase,type GalleryCaseDefinition} from './cases.ts';
const definitions:GalleryCaseDefinition[]=[
  {id:'offset-cadence',title:'Offset cadence',duration:7.2,beats:[.65,1.45,2.05,3.05,3.65,4.45,5.1,6.3],
    air:[.35,.55,.45],speed:[.48,.6,.5],amplitude:[.1,.16],impact:[.3,.55,.4]},
  {id:'rising-pulse',title:'Rising pulse',duration:7.6,beats:[.8,1.7,2.5,3.3,4,4.7,5.35,6,6.65,7.25],
    air:[.4,.45,.5],speed:[.42,.47,.52,.57,.62],amplitude:[.08,.12,.16],impact:[.3,.4,.5]},
  {id:'long-breath',title:'Long breath',duration:10.5,beats:[.8,1.6,2.6,3.4,9.1,9.9],
    air:[.4,.5],speed:[.45,.55],amplitude:[.11,.15],impact:[.35,.5]},
];
export const guideConfirmationCases=definitions.map(d=>makeGalleryCase(d,'scripts/gallery/guide_confirmation_cases.ts'));
