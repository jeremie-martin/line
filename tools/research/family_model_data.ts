/** Rows for the placement model (tools/research/family_model.py): one per section of saved rides. Features: the
 * family (construction and whether its guide is forbidden), the section's context as the planner sees it (strength and
 * speed asks of its catch and of the next, calm, length in frames); target: the section's loss as family_fit.ts defines
 * it (squared strength error of its catch + its span's air and speed errors weighted by length as the grade weighs them).
 *   node tools/research/family_model_data.ts ARM_DIR[,ARM_DIR...] SUITE_REGEX OUT.jsonl */
import {readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {gunzipSync} from 'node:zlib';
const [armDirs, pattern, out] = process.argv.slice(2), re = new RegExp(pattern), lines: string[] = [];
for (const armDir of armDirs.split(',')) for (const f of readdirSync(join(armDir, 'cells')).filter(f => re.test(f) && /~\d+\.json$/.test(f))) {
  const c = JSON.parse(readFileSync(join(armDir, 'cells', f), 'utf8'));
  const g = JSON.parse(gunzipSync(readFileSync(join(armDir, 'cells', f.replace('.json', '.gallery.json.gz')))).toString());
  const t = c.case.targets, m = t.length, total = t.at(-1).frame, gap: Record<number, Record<string, number>> = {};
  for (const [i, ax, tg, a] of c.gaps) (gap[i] ??= {})[ax] = a === null ? 1 : (a - tg) ** 2;
  for (const r of g.production.plan.requests) {
    const j = t.findIndex((x: any) => x.frame === r.frame), b = j >= 0 ? c.impact3.perBeat[j] : null;
    if (!b?.hit || b.requested == null || !r.context) continue;
    const frames = r.next - r.frame, span = gap[j + 1] ?? {};
    const loss = (b.hit.strength - b.requested) ** 2 + frames * m / total * ((span.air ?? 0) + (span.speed ?? 0));
    const x = r.context;
    lines.push(JSON.stringify({ride: f, family: r.construction, open: r.guidance === 'forbidden' ? 1 : 0,
      f: [x.impact ?? 0, x.speed ?? .5, x.nextImpact ?? 0, x.nextSpeed ?? .5, x.quiet, frames], loss}));
  }
}
writeFileSync(out, lines.join('\n') + '\n');
console.log(`${lines.length} sections → ${out}`);
