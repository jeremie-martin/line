/** The owner's review of the production readings, as an author should read it:
 *   node tools/music/notes.ts --song=<song> [--variant=<name>]   one reading, in full
 *   node tools/music/notes.ts --all                              every reading of the production set, one line each
 * For a reading: his verdict, his words on it and his timeline notes, each in two groups. **Open**: written since the last
 * recorded revision of that reading (tools/music/revision.ts): to act on. **Answered or earlier**: written before it, on
 * another reading of the song, or before notes recorded their reading: kept as context; a landing number in them belongs
 * to a ride that no longer exists, their times still say where he heard something. The grouping is the spec dashboard's
 * (scripts/gallery/spec_api.ts revisionTimes). Add --json for the same as data. */
import {existsSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import {isVersion, listSpecs, revisionTimes} from '../../scripts/gallery/spec_api.ts';
import {readingWords, verdictRows} from '../../scripts/gallery/spec_review_api.ts';

const arg = (name: string) => process.argv.find(a => a.startsWith(`--${name}=`))?.split('=')[1];
const flag = (name: string) => process.argv.includes(`--${name}`);
const song = arg('song'), variant = arg('variant'), root = process.cwd();
if (!song && !flag('all')) {console.error('usage: node tools/music/notes.ts --song=<song> [--variant=<name>] | --all   [--json]'); process.exit(1);}
const flat = (text: string) => text.trim().replace(/\s+/g, ' ');
const allRows = verdictRows(root);

function review(spec: string) {
  const name = spec.split('/')[1], revised = revisionTimes(root, spec);
  const rows = allRows.filter(r => r.spec === spec), row = rows.at(-1), words = readingWords(rows, revised);
  const file = join(root, 'productions', name, 'notes.json');
  const notes: any[] = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')).notes ?? [] : [];
  const open = notes.filter(n => n.on?.spec === spec && !(n.createdAt <= (revised.at(-1) ?? '')));
  return {spec, verdict: row?.verdict ?? null, verdictOnThisVersion: !!row?.verdict && isVersion(join(root, spec), row.specSha256), verdictAt: row?.verdict ? row.at : null,
    words: words.current, wordsAt: words.currentAt, earlierWords: words.earlier, lastRevision: revised.at(-1) ?? null,
    open, earlier: notes.filter(n => !open.includes(n))};
}

if (flag('all')) {
  const all = listSpecs(root).filter(s => s.path.startsWith('productions/short_')).map(s => review(s.path));
  if (flag('json')) console.log(JSON.stringify(all, null, 2));
  else {
    console.log('reading'.padEnd(52) + 'verdict'.padEnd(26) + 'open'.padEnd(18) + 'last revision');
    for (const r of all) console.log(r.spec.slice(12).replace('/spec.ts', '').replace('/variants/', ' · ').replace('.ts', '').padEnd(52)
      + (r.verdict ? r.verdict + (r.verdictOnThisVersion ? '' : ' (earlier)') : '-').padEnd(26)
      + ([r.open.length ? `${r.open.length} notes` : '', r.words.trim() ? 'words' : ''].filter(Boolean).join(' + ') || '-').padEnd(18)
      + (r.lastRevision?.slice(0, 16).replace('T', ' ') ?? '-'));
    const waiting = all.filter(r => r.open.length || r.words.trim());
    console.log(`\n${all.length} readings; ${all.filter(r => r.verdict).length} with a verdict; ${waiting.length} with open input.`);
  }
} else {
  const spec = variant ? `productions/${song}/variants/${variant}.ts` : `productions/${song}/spec.ts`, r = review(spec);
  if (flag('json')) console.log(JSON.stringify(r, null, 2));
  else {
    console.log(`# ${spec}`);
    console.log(`verdict: ${r.verdict ?? 'none'}${r.verdict ? (r.verdictOnThisVersion ? ' (on this version)' : ' (given on an earlier version)') : ''}`);
    if (r.lastRevision) console.log(`last recorded revision: ${r.lastRevision}`);
    if (r.words.trim()) console.log(`his words on the reading, open (to act on): ${flat(r.words)}`);
    if (r.earlierWords.length) {
      console.log(`his words on the reading, before earlier revisions (context: answered then):`);
      for (const w of r.earlierWords) console.log(`  (${w.at.slice(0, 10)}) ${flat(w.note)}`);
    }
    const time = (n: any) => n.scope === 'range' && n.t0 != null && n.t1 != null ? `${n.t0.toFixed(3)}–${n.t1.toFixed(3)} s` : `${n.t.toFixed(3)} s`;
    const line = (n: any, now: boolean) => `  ${time(n).padEnd(20)} ${n.scope}${now && n.scope === 'contact' && n.index != null ? ` #${n.index}` : ''}`.padEnd(38)
      + `${n.tags?.length ? `[${n.tags.join(', ')}] ` : ''}${flat(n.text ?? '')}`.trimEnd()
      + (now ? '' : `   (${n.createdAt?.slice(0, 10) ?? 'undated'}${n.on && n.on.spec !== spec ? `, on ${n.on.spec.split('/').slice(2).join('/')}` : ''})`);
    console.log(`\n## Open: ${r.open.length} note${r.open.length === 1 ? '' : 's'}${r.open.length ? ' (to act on)' : ''}`);
    for (const n of r.open) console.log(line(n, true));
    console.log(`\n## Answered or earlier: ${r.earlier.length} (context: may already be answered; landing numbers no longer valid)`);
    for (const n of r.earlier) console.log(line(n, false));
  }
}
