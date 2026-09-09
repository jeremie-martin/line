/** Versioned input selection for compiler research; scoring stays in its frozen version. */
import {loadCases as v3,caseSpec,caseGaps,targets,sha,type Case} from '../../benchmark/v3/model.ts';
import {loadCases as v4} from '../../benchmark/v4/model.ts';
export type ArcSuite='v3'|'v4';
export function requestedArcSuite():ArcSuite{
  const value=process.argv.find(a=>a.startsWith('--suite='))?.slice(8)??'v3';
  if(value!=='v3'&&value!=='v4')throw new Error('unsupported arc research suite');
  return value;
}
export function loadArcCases(suite:ArcSuite):Case[]{return suite==='v4'?v4():v3();}
export {caseSpec,caseGaps,targets,sha,type Case};
