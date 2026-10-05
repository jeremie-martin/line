/** exp/retrain-v3 decomposition: re-extract the PREVIOUS construction corpus
 * (archive docs/evidence/repertoire-search-memory-v6-provenance.json, 238
 * native compile outputs) into the collector format, optionally excluding the
 * evaluation songs, so train_construction_v3.py can rebuild it.
 * Selection and keys follow archive scripts/benchmark/build_construction_examples.ts.
 *
 *   node --import tsx tools/research/old_construction_corpus.ts --provenance=FILE --out=DIR [--exclude-eval] */
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {arcConstructionMemoryKey} from '../../scripts/v0/optimizer/arc_memory.ts';
import {constructionStyle} from '../../scripts/v0/optimizer/repertoire_policy.ts';

const arg = (k: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const provenance = JSON.parse(readFileSync(arg('provenance')!, 'utf8')), out = arg('out')!;
const excludeEval = process.argv.includes('--exclude-eval'), EVAL = /luna|amor|tiki|amour/i;
const excluded = new Set<string>(provenance.demonstrations.excluded);
mkdirSync(out, {recursive: true});
let files = 0, rows = 0;
for (const [n, source] of provenance.demonstrations.sources.entries()) {
  const bytes = readFileSync(source.path);
  if (createHash('sha256').update(bytes).digest('hex') !== source.sha256) throw new Error(`source changed: ${source.path}`);
  const r = JSON.parse(bytes.toString());
  if (!r.rows || !r.plan || !r.realization || excluded.has(r.song) || (excludeEval && EVAL.test(r.song))) continue;
  const construction = r.rows.map((row: any, i: number) => {
    const request = r.plan.requests[i], check = r.realization.sections[i];
    return {key: request ? arcConstructionMemoryKey({...r.changes, ...constructionStyle(request)}) : null, context: !!request?.context,
      fulfilled: !!check?.fulfilled, control: row.control ?? null, incoming: row.incoming, span: row.span, features: row.features ?? null};
  });
  rows += construction.length; files++;
  // Zero-padded index keeps the archive's source order (memory order matters for distance ties).
  writeFileSync(join(out, `${String(n).padStart(3, '0')}.json.gz`), gzipSync(JSON.stringify({id: `old:${r.song}:${source.path.split('/').slice(-2).join('/')}`,
    group: r.song, seed: r.seed, complete: r.valid, trackHash: source.sha256, probes: [], construction})));
}
console.log(JSON.stringify({files, rows, excludeEval}));
