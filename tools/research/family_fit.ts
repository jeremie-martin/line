/** Where each construction family costs least: the mean loss of a section by family and context, from saved rides.
 * A section's loss is its catch's squared strength error plus its span's squared air and speed errors, weighted by the
 * span's length as the grade weighs them (length × beats ÷ ride length), plus half the next catch's squared strength
 * error (the section's exit sets up that arrival). Contexts: the catch's strength ask (below
 * 0.3, 0.3–0.6, 0.6–0.8, 0.8 and above) × the section's length (below 16 frames, 16–28, 28 and above). The planner
 * places the families it drew where they cost least (intentional_repertoire.ts).
 *   node tools/research/family_fit.ts ARM_DIR[,ARM_DIR...] SUITE_REGEX OUT.json */
import {readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {ASK_BINS, LENGTH_BINS, contextOf, familyKey} from '../../scripts/v0/optimizer/family_fit.ts';

{
  const [armDirs, pattern, out] = process.argv.slice(2), re = new RegExp(pattern);
  const sums: Record<string, number[]> = {}, files: string[] = [];
  for (const armDir of armDirs.split(',')) for (const f of readdirSync(join(armDir, 'cells')).filter(f => re.test(f) && /~\d+\.json$/.test(f))) {
    const c = JSON.parse(readFileSync(join(armDir, 'cells', f), 'utf8'));
    const g = JSON.parse(gunzipSync(readFileSync(join(armDir, 'cells', f.replace('.json', '.gallery.json.gz')))).toString());
    const t = c.case.targets, m = t.length, total = t.at(-1).frame, gap: Record<number, Record<string, number>> = {};
    for (const [i, ax, tg, a] of c.gaps) (gap[i] ??= {})[ax] = a === null ? 1 : (a - tg) ** 2;
    files.push(join(armDir, f));
    for (const r of g.production.plan.requests) {
      const j = t.findIndex((x: any) => x.frame === r.frame), b = j >= 0 ? c.impact3.perBeat[j] : null;
      if (!b?.hit || b.requested == null) continue;
      const frames = r.next - r.frame, span = gap[j + 1] ?? {};
      // Half of the next catch's strength error: the section's exit sets up that arrival.
      const next = c.impact3.perBeat[j + 1], setup = next?.requested == null ? 0 : .5 * ((next.hit?.strength ?? 0) - next.requested) ** 2;
      const loss = (b.hit.strength - b.requested) ** 2 + setup + frames * m / total * ((span.air ?? 0) + (span.speed ?? 0));
      const key = `${familyKey(r.construction, r.guidance)}|${contextOf(b.requested, frames)}`;
      (sums[key] ??= [0, 0])[0] += loss; sums[key][1]++;
    }
  }
  const cost = Object.fromEntries(Object.entries(sums).filter(([, [, n]]) => n >= 30).map(([k, [s, n]]) => [k, +(s / n).toFixed(5)]));
  writeFileSync(out, JSON.stringify({schema: 'line.family-fit.v1', askBins: ASK_BINS, lengthBins: LENGTH_BINS, cost,
    provenance: {arms: armDirs.split(',').map(d => JSON.parse(readFileSync(join(d, 'arm.json'), 'utf8'))), rides: files.length,
      ridesSha256: createHash('sha256').update(files.sort().join('\n')).digest('hex'), minimumSections: 30}}, null, 1) + '\n');
  console.log(`${files.length} rides, ${Object.keys(cost).length} family × context cells → ${out}`);
}
