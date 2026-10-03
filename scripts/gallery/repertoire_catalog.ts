/** Concrete starting arrangements. They are editable examples, not musical rules. */
import {creativePreferences,type CreativePreferences} from '../v0/optimizer/repertoire_policy.ts';
import {productionBudget} from '../v0/optimizer/production_budget.ts';
import {compositionCatalog,validateRepertoirePlan,type RepertoirePlan} from '../v0/optimizer/repertoire_plan.ts';
export const repertoireSongs=[
 {id:'luna_bala_44s',title:'Luna Bala',duration:44},
 {id:'amor_na_praia_46s',title:'Amor na Praia',duration:46},
 {id:'tiki_tiki_48s',title:'Tiki Tiki',duration:48},
 {id:'amour_de_ma_vie_44s',title:'L’amour de ma vie',duration:44.544},
];
const phrase=(title:string,start:number,end:number,recipe:any,controls?:any)=>({title,start,end,recipe,...(controls?{controls}:{})});
const ripple={profileStart:0,profileStrength:1,rippleCycles:1};
export const repertoirePresets:RepertoirePlan[]=[
 {schema:'line.repertoire-plan.v1',title:'Islands and folds',song:'luna_bala_44s',phrases:[
  phrase('Scattered entrance',6.4,8.55,'scattered'),phrase('First folds',16,18,'fold'),
  phrase('Scattered reprise',24.2,25.8,'scattered'),phrase('Folded reply',32,34,'fold')]},
 {schema:'line.repertoire-plan.v1',title:'Long wave phrases',song:'luna_bala_44s',phrases:[
  phrase('Pronounced ripple',6.4,8.55,'scallops',ripple),phrase('Eased ledges',12,15,'terraces',{profileStart:0,profileStrength:.8}),
  phrase('Folded climax',24.2,27,'fold'),phrase('S-shaped return',32,35,'serpentine',{profileStart:0,profileStrength:.8})]},
 {schema:'line.repertoire-plan.v1',title:'Air and edges',song:'amor_na_praia_46s',phrases:[
  phrase('Open introduction',1.5,3.5,'single'),phrase('Folded percussion',4.46,7.87,'fold'),
  phrase('Scattered bridge',14,16,'scattered'),phrase('Ripple phrase',23,27,'scallops',ripple),phrase('Folded return',35,38,'fold')]},
 {schema:'line.repertoire-plan.v1',title:'Ripples and interruptions',song:'amor_na_praia_46s',phrases:[
  phrase('Scattered introduction',1.5,3.5,'scattered'),phrase('Ripple percussion',4.46,7.87,'scallops',ripple),
  phrase('Scattered interruption',18,20,'scattered'),phrase('Ripple return',32,35,'scallops',ripple)]},
];
export type RepertoireRequest={composition:RepertoirePlan;seed:number;baselineBudget:number;compositionBudget:number};
export function validateRepertoireRequest(input:any):RepertoireRequest{
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['composition','seed','baselineBudget','compositionBudget'].includes(k)))throw new Error('invalid compile request');
 const composition=validateRepertoirePlan(input.composition),song=repertoireSongs.find(s=>s.id===composition.song);
 if(!song||composition.phrases.some(p=>p.end>song.duration))throw new Error('unsupported song or phrase beyond music');
 if(!Number.isSafeInteger(input.seed)||input.seed<0||input.seed>2147483647)throw new Error('seed must be a non-negative 31-bit integer');
 for(const budget of [input.baselineBudget,input.compositionBudget])if(!Number.isSafeInteger(budget)||budget<20000||budget>5000000)throw new Error('each work allowance must be between 20,000 and 5,000,000 simulated frames');
 return {...input,composition};
}
export const repertoireCatalog={songs:repertoireSongs,recipes:compositionCatalog,presets:repertoirePresets};

/** Automatic production uses broad preferences, never manually placed passages. */
/** `budget` is optional on input and defaults to the length-scaled production allowance. */
export type AutomaticProductionRequest={mode:'production';song:string;seed:number;budget:number;creative:CreativePreferences};
export type GalleryRequest=RepertoireRequest|AutomaticProductionRequest;
export function validateAutomaticProductionRequest(input:any):AutomaticProductionRequest{
 if(!input||input.mode!=='production'||Object.keys(input).some(k=>!['mode','song','seed','budget','referenceBudget','creative'].includes(k)))throw new Error('invalid automatic production request');
 if(!repertoireSongs.some(s=>s.id===input.song))throw new Error('unsupported production song');
 if(!Number.isSafeInteger(input.seed)||input.seed<0||input.seed>2147483647)throw new Error('seed must be a non-negative 31-bit integer');
 const song=repertoireSongs.find(s=>s.id===input.song)!;
 const budget=input.budget??productionBudget(song.duration);
 if(!Number.isSafeInteger(budget)||budget<12*(Math.round(song.duration*40)+21)||budget>4*productionBudget(song.duration))throw new Error('production allowance must cover search and replay, up to four times the standard allowance');
 // Requests saved before the ordinary reference compiler was retired carry a zero reference allowance.
 if((input.referenceBudget??0)!==0)throw new Error('the ordinary reference compiler is retired');
 return {mode:'production',song:input.song,seed:input.seed,budget,creative:creativePreferences(input.creative)};
}
export const isAutomatic=(r:GalleryRequest):r is AutomaticProductionRequest=>'mode' in r&&r.mode==='production';
export const requestSong=(r:GalleryRequest)=>isAutomatic(r)?r.song:r.composition.song;
export const validateGalleryRequest=(input:any):GalleryRequest=>input?.mode==='production'?validateAutomaticProductionRequest(input):validateRepertoireRequest(input);
