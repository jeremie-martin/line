import {expect,it} from 'vitest';
import {musicSource,assertLibraryEntry} from '../scripts/produce/library_plan.ts';
import {resolveJoltMs} from '../scripts/produce/jolt.ts';
it('a production collection rejects internally valid cells from another offset or authoring',()=>{
 const c={specSha256:'spec',audioSha256:'audio',analysisSha256:'analysis',durationFrames:100,contacts:[{frame:10,impact:.5}],air:[],samples:{},phases:[],render:{}};
 const entry={request:{song:'song',seed:101}},plan={jolt:-15,compiler:{head:'a'},request:entry.request,cases:[c]};
 const collection={schema:'line.production-library-plan.v2',jolt:-15,compiler:plan.compiler,sources:{song:musicSource(c)}};
 const manifest={plan,cells:[{method:'production'}]};
 expect(()=>assertLibraryEntry(collection,entry,manifest,plan)).not.toThrow();
 expect(()=>assertLibraryEntry({...collection,jolt:0},entry,manifest,plan)).toThrow(/timing/);
 expect(()=>assertLibraryEntry({...collection,sources:{song:musicSource({...c,contacts:[{frame:9,impact:.5}]})}},entry,manifest,plan)).toThrow(/authoring/);
 expect(()=>assertLibraryEntry({...collection,compiler:{head:'b'}},entry,manifest,plan)).toThrow(/compiler/);
});
it('an invalid explicit timing offset is not silently replaced by the default',()=>{
 const prior=process.env.LR_JOLT_OFFSET_MS;
 try{process.env.LR_JOLT_OFFSET_MS='typo';expect(()=>resolveJoltMs()).toThrow(/finite/);process.env.LR_JOLT_OFFSET_MS='0';expect(resolveJoltMs()).toBe(0);}
 finally{if(prior===undefined)delete process.env.LR_JOLT_OFFSET_MS;else process.env.LR_JOLT_OFFSET_MS=prior;}
});
