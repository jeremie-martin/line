/** The songs and settings the production page offers. */
import {constructions,creativePreferences,type CreativePreferences} from '../v0/optimizer/repertoire_policy.ts';
import {GEOMETRY_FAMILIES} from '../v0/optimizer/geometry_families.ts';
import {productionBudget} from '../v0/optimizer/production_budget.ts';
export const repertoireSongs=[
 {id:'luna_bala_44s',title:'Luna Bala',duration:44},
 {id:'amor_na_praia_46s',title:'Amor na Praia',duration:46},
 {id:'tiki_tiki_48s',title:'Tiki Tiki',duration:48},
 {id:'amour_de_ma_vie_44s',title:'L’amour de ma vie',duration:44.544},
 {id:'trouble_50s',title:'Trouble',duration:50.3},
];
/** Every geometry family is offered under its label, in the planner's order. */
export const repertoireCatalog={songs:repertoireSongs,constructions:constructions.map(id=>({id,label:GEOMETRY_FAMILIES[id].label}))};

/** Automatic production uses broad preferences, never manually placed passages. */
/** `budget` is optional on input and defaults to the length-scaled production allowance. */
/** `variant` names productions/<song>/variants/<variant>.ts; without it the song's spec.ts is used. */
export type AutomaticProductionRequest={mode:'production';song:string;variant?:string;seed:number;budget:number;creative:CreativePreferences};
export function validateAutomaticProductionRequest(input:any):AutomaticProductionRequest{
 if(!input||input.mode!=='production'||Object.keys(input).some(k=>!['mode','song','variant','seed','budget','referenceBudget','creative'].includes(k)))throw new Error('invalid automatic production request');
 if(!repertoireSongs.some(s=>s.id===input.song))throw new Error('unsupported production song');
 if(input.variant!==undefined&&!/^[a-z0-9_-]+$/.test(input.variant))throw new Error('variant must be a plain file name');
 if(!Number.isSafeInteger(input.seed)||input.seed<0||input.seed>2147483647)throw new Error('seed must be a non-negative 31-bit integer');
 const song=repertoireSongs.find(s=>s.id===input.song)!;
 const budget=input.budget??productionBudget(song.duration);
 if(!Number.isSafeInteger(budget)||budget<12*(Math.round(song.duration*40)+21)||budget>4*productionBudget(song.duration))throw new Error('production allowance must cover search and replay, up to four times the standard allowance');
 // Requests saved before the ordinary reference compiler was retired carry a zero reference allowance.
 if((input.referenceBudget??0)!==0)throw new Error('the ordinary reference compiler is retired');
 return {mode:'production',song:input.song,...(input.variant?{variant:input.variant}:{}),seed:input.seed,budget,creative:creativePreferences(input.creative)};
}
