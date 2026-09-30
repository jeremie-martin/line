/** A small composition document separate from the authored music specification.
 * The document chooses construction and phrase windows; simulation realizes it. */
import {arcRecipeOptions,railRecipes,type RailRecipe} from './rail_recipes.ts';
import {validProfileControls} from './motion_profiles.ts';
import {arcMainSteps,type ArcSectionStyle} from './arc_geometry.ts';
export const compositionRecipes=['arcs','single','scattered','fold','scallops','serpentine','terraces','facets']as const;
export type CompositionRecipe=typeof compositionRecipes[number];
export type CompositionPhrase={title:string;start:number;end:number;recipe:CompositionRecipe;
  controls?:Pick<ArcSectionStyle,'profileStrength'|'profileStart'|'rippleCycles'|'faces'|'foldAngle'|'guides'>;fragmentWidth?:number};
export type RepertoirePlan={schema:'line.repertoire-plan.v1';title:string;song:string;phrases:CompositionPhrase[]};
const object=(x:unknown):x is Record<string,any>=>!!x&&typeof x==='object'&&!Array.isArray(x);
function keys(x:Record<string,any>,allowed:string[]){if(Object.keys(x).some(k=>!allowed.includes(k)))throw new Error('unknown composition field');}
export function validateRepertoirePlan(input:unknown):RepertoirePlan{
  if(!object(input))throw new Error('composition must be an object');
  keys(input,['schema','title','song','phrases']);
  if(input.schema!=='line.repertoire-plan.v1'||typeof input.title!=='string'||!input.title.trim()||input.title.length>120||
    typeof input.song!=='string'||!/^[a-z0-9_]+$/.test(input.song)||!Array.isArray(input.phrases)||input.phrases.length>32)throw new Error('invalid composition document');
  let previous=0;
  for(const p of input.phrases){
    if(!object(p))throw new Error('invalid composition phrase');keys(p,['title','start','end','recipe','controls','fragmentWidth']);
    if(typeof p.title!=='string'||!p.title.trim()||p.title.length>120||!Number.isFinite(p.start)||!Number.isFinite(p.end)||p.start<previous||p.end<=p.start||
      !compositionRecipes.includes(p.recipe))throw new Error('phrases need ordered non-overlapping windows and a supported construction');
    previous=p.end;
    if(p.controls!==undefined){if(!object(p.controls))throw new Error('invalid construction controls');keys(p.controls,recipeControls(p.recipe));}
    if(p.recipe==='scattered'){
      if(p.controls&&Object.keys(p.controls).length)throw new Error('scattered phrases inherit the realized source motion; connected controls do not apply');
      if(p.fragmentWidth!==undefined&&(!Number.isFinite(p.fragmentWidth)||p.fragmentWidth<=0||p.fragmentWidth>1))throw new Error('invalid fragment width');
    }else{
      if(p.fragmentWidth!==undefined)throw new Error('fragment width requires scattered construction');
      const style=phraseStyle(p as CompositionPhrase);
      if(!validProfileControls(style)||(style.guides!==undefined&&typeof style.guides!=='boolean'))throw new Error('invalid profile or guide controls');
      if(p.recipe==='single'&&style.guides!==false)throw new Error('single rail forbids guides');
      arcMainSteps(1,style.subdivisions,style.faces);
    }
  }
  return structuredClone(input) as RepertoirePlan;
}
export function phraseStyle(phrase:CompositionPhrase):ArcSectionStyle{
  if(phrase.recipe==='scattered')return {};
  const recipe=arcRecipeOptions(phrase.recipe as RailRecipe)!;
  const {profile,profileStart,foldAngle,faces,subdivisions,guides}=recipe;
  return {...(profile===undefined?{}:{profile}),...(profileStart===undefined?{}:{profileStart}),
    ...(foldAngle===undefined?{}:{foldAngle}),...(faces===undefined?{}:{faces}),
    ...(subdivisions===undefined?{}:{subdivisions}),...(guides===undefined?{}:{guides}),...phrase.controls};
}
export function resolveComposition(plan:RepertoirePlan,rows:readonly {frame:number}[],duration:number){
  validateRepertoirePlan(plan);
  return plan.phrases.map(phrase=>{
    if(phrase.end>duration)throw new Error('phrase extends beyond the authored music');
    const sections=rows.flatMap((r,i)=>r.frame/40>=phrase.start&&r.frame/40<phrase.end?[i]:[]);
    if(!sections.length)throw new Error(`No support begins in "${phrase.title}"; widen its window`);
    if(phrase.recipe==='scattered'&&sections.at(-1)===rows.length-1)throw new Error('scattered phrase needs a later support for its return');
    return {...phrase,sections,style:phraseStyle(phrase),actualStart:rows[sections[0]].frame/40,
      actualEnd:(rows[sections.at(-1)!+1]?.frame??duration*40)/40};
  });
}
export function recipeControls(id:CompositionRecipe):string[]{
 return id==='scattered'?['fragmentWidth']:[...(id==='single'?[]:['guides']),
 ...(['fold','scallops','serpentine','terraces'].includes(id)?['profileStrength','profileStart']:[]),
 ...(id==='scallops'?['rippleCycles']:[]),...(id==='fold'?['foldAngle','faces']:[]),...(id==='facets'?['faces']:[])];
}
export const compositionCatalog=compositionRecipes.map(id=>({id,title:railRecipes[id].title,description:railRecipes[id].description,
 controls:recipeControls(id),defaults:id==='scattered'?{fragmentWidth:.003}:phraseStyle({recipe:id,title:'',start:0,end:1})}));
