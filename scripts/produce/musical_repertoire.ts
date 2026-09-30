/** Concrete phrase edits for the repertoire study, outside authored music specs. */
import type {ArcSectionStyle} from '../v0/optimizer/arc_geometry.ts';
export type ConstructionPhrase={title:string;window:readonly [number,number];style:ArcSectionStyle};

export function stylesForPhrases(rows:readonly {frame:number}[],phrases:readonly ConstructionPhrase[]){
  const styles:Record<number,ArcSectionStyle>={};
  for(const phrase of phrases){
    const [from,to]=phrase.window;
    if(!Number.isFinite(from)||!Number.isFinite(to)||from<0||to<=from)throw new Error('invalid construction window');
    const selected=rows.flatMap((r,i)=>r.frame/40>=from&&r.frame/40<to?[i]:[]);
    if(!selected.length)throw new Error('empty construction window');
    for(const i of selected){
      if(styles[i])throw new Error('overlapping construction windows');
      styles[i]={...phrase.style};
    }
  }
  return styles;
}
