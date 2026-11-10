import {expect,it} from 'vitest';
import {musicSource,assertLibraryEntry,LIBRARY_SCHEMA} from '../scripts/produce/library_plan.ts';
it('a production collection rejects internally valid cells from another timing setting or authoring',()=>{
 const c={specSha256:'spec',audioSha256:'audio',analysisSha256:'analysis',durationFrames:100,contacts:[{frame:10,impact:.5}],air:[],samples:{},phases:[]};
 const entry={request:{song:'song',seed:101}},plan={schema:'line.automatic-production.v2',compiler:{head:'a'},request:entry.request,cases:[c]};
 const collection={schema:LIBRARY_SCHEMA,compiler:plan.compiler,sources:{song:musicSource(c)}};
 const manifest={plan,cells:[{method:'production'}]};
 expect(()=>assertLibraryEntry(collection,entry,manifest,plan)).not.toThrow();
 expect(()=>assertLibraryEntry({...collection,schema:'line.production-library-plan.v2'},entry,manifest,plan)).toThrow(/retired on 2026-11-11/);
 const old={...plan,schema:'line.automatic-production.v1'};
 expect(()=>assertLibraryEntry(collection,entry,{...manifest,plan:old},old)).toThrow(/timing setting/);
 expect(()=>assertLibraryEntry({...collection,sources:{song:musicSource({...c,contacts:[{frame:9,impact:.5}]})}},entry,manifest,plan)).toThrow(/authoring/);
 expect(()=>assertLibraryEntry({...collection,compiler:{head:'b'}},entry,manifest,plan)).toThrow(/compiler/);
});
