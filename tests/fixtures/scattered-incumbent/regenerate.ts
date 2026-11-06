/** Rebuild the scattered-incumbent fixtures after an intended change to catch
 * construction. The prefix lines, plan, spec and carrier controls are inputs
 * and stay; the incumbent (an offered scattered control) and its impact are
 * re-measured: the recorded control if it still realizes a scattered catch,
 * otherwise the best one the search finds on the same prefix.
 * node tests/fixtures/scattered-incumbent/regenerate.ts */
import {readFileSync, writeFileSync} from 'node:fs';
import {gunzipSync, gzipSync} from 'node:zlib';
import {repertoireSearchOptions} from '../../../scripts/v0/optimizer/repertoire_search.ts';
import {createArcCompileContext} from '../../../scripts/v0/optimizer/arc_compile_context.ts';
import {searchInterval} from '../../../scripts/v0/optimizer/arc_interval.ts';
import {resetFrameCount, setPhysicsFrameLimit} from '../../../scripts/lib/detector.ts';

for (const song of ['tiki_tiki_48s', 'luna_bala_44s']) {
  const path = new URL(`./${song}.json.gz`, import.meta.url), f = JSON.parse(gunzipSync(readFileSync(path)).toString());
  const spec = {...f.spec, axes: Object.fromEntries(Object.entries(f.axes).map(([k, values]: [string, any]) => [k, (t: number) => values[Math.round(t * 40)] ?? undefined]))};
  const options = repertoireSearchOptions(spec, f.plan, 100_000_000, 'line.strike.v3'), ctx = createArcCompileContext(spec, options);
  const engine = ctx.lineage.rebuild(f.lines);
  resetFrameCount(); setPhysicsFrameLimit(null);
  const recorded = searchInterval(ctx, engine, f.section, {directControls: [f.control]}, [engine]);
  const best = recorded?.best ?? searchInterval(ctx, engine, f.section, {}, [engine])?.best;
  if (!best) throw new Error(`${song}: no scattered realization on this prefix`);
  const next = {...f, control: best.c, impact: best.actualImpact};
  writeFileSync(path, gzipSync(JSON.stringify(next)));
  console.log(song, recorded?.best ? 'recorded control still realizes' : 'incumbent re-found by the search', 'impact', f.impact, '->', best.actualImpact);
}
