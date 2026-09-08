import {expect,it} from 'vitest';
import {developmentCases} from '../benchmark/v2/catalog.ts';
import {benchmarkPolicy} from '../benchmark/v2/policy.ts';
import {applyJolt} from '../scripts/produce/seed.ts';
import {compileHandoff} from '../scripts/v0/optimizer/handoff.ts';

// Reproductions from the audit's full 150k panel. Reusing candidates freed enough
// work to admit a retry whose real restart was earlier than its cost estimate.
it.each(['frontier_low_air_endurance_4s','frontier_dense_recovery'])(
  'preserves completion capacity when a retry rebuilds an earlier prefix: %s',source=>{
    const entry=developmentCases.find(e=>e.case.metadata.id===source)!;
    const spec=applyJolt(entry.case.spec,benchmarkPolicy.transform.joltMs);
    const result=compileHandoff(spec,260908011,{budget:150000});
    expect(result.report.contacts.every(c=>c.status==='hit')).toBe(true);
    expect(result.report.off_beat_landings).toHaveLength(0);
    expect(result.report.terminus.reason).toBe('endOfSpec');
    expect(result.stats.sim_frames).toBeLessThanOrEqual(150000);
    expect(result.track.lines.every(l=>l.type===0)).toBe(true);
  });
