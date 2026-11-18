/** The owner's review of a production reading, as an author should read it:
 *   node tools/music/notes.ts --song=<song> [--variant=<name>]
 * Prints his verdict and words on the reading, then his timeline notes in two groups: those written on the reading as it
 * stands (to act on), and those written on earlier versions or other readings (kept as context: they may already be
 * answered, and a landing number in them belongs to a ride that no longer exists; their times still say where he heard
 * something). The grouping is the spec dashboard's (scripts/gallery/spec_api.ts: a note's `on`). */
import {existsSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import {specSha256} from '../../scripts/gallery/spec_api.ts';

const arg = (name: string) => process.argv.find(a => a.startsWith(`--${name}=`))?.split('=')[1];
const song = arg('song'), variant = arg('variant');
if (!song) {console.error('usage: node tools/music/notes.ts --song=<song> [--variant=<name>]'); process.exit(1);}
const root = process.cwd(), spec = variant ? `productions/${song}/variants/${variant}.ts` : `productions/${song}/spec.ts`;
const sha = specSha256(join(root, spec));

const verdicts = join(root, 'labels/spec-verdicts.jsonl');
let row: any = null;
if (existsSync(verdicts)) for (const line of readFileSync(verdicts, 'utf8').split('\n')) if (line.trim()) {const r = JSON.parse(line); if (r.spec === spec) row = r;}
console.log(`# ${spec}`);
console.log(`verdict: ${row?.verdict ?? 'none'}${row?.verdict ? (row.specSha256 === sha ? ' (on this version)' : ' (given on an earlier version)') : ''}`);
if (row?.note) console.log(`his words on the reading: ${row.note}`);

const file = join(root, 'productions', song, 'notes.json');
const notes: any[] = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')).notes ?? [] : [];
const time = (n: any) => n.scope === 'range' && n.t0 != null && n.t1 != null ? `${n.t0.toFixed(3)}–${n.t1.toFixed(3)} s` : `${n.t.toFixed(3)} s`;
const line = (n: any, now: boolean) => `  ${time(n).padEnd(20)} ${n.scope}${now && n.scope === 'contact' && n.index != null ? ` #${n.index}` : ''}`.padEnd(38)
  + `${n.tags?.length ? `[${n.tags.join(', ')}] ` : ''}${(n.text ?? '').trim().replace(/\s+/g, ' ')}`.trimEnd()
  + (now ? '' : `   (${n.createdAt?.slice(0, 10) ?? 'undated'}${n.on && n.on.spec !== spec ? `, on ${n.on.spec.split('/').slice(2).join('/')}` : ''})`);
const current = notes.filter(n => n.on?.spec === spec && n.on.sha256 === sha), earlier = notes.filter(n => !current.includes(n));
console.log(`\n## On this version: ${current.length} note${current.length === 1 ? '' : 's'}${current.length ? ' (to act on)' : ''}`);
for (const n of current) console.log(line(n, true));
console.log(`\n## On earlier versions or other readings: ${earlier.length} (context: may already be answered; landing numbers no longer valid)`);
for (const n of earlier) console.log(line(n, false));
