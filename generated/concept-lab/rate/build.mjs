// Stills for a set of the ratings site: node generated/concept-lab/rate/build.mjs <set>
// Reads rate/sets/<set>/manifest.json ({title, created, song, moments: [[label, s]…], schemes, drops, items: [{id, name, look}]})
// and writes rate/sets/<set>/stills/<id>-<i>.jpg, one per moment (i from 1), for every item that lacks them. The stills are
// regenerable and not committed (.gitignore); the manifest is the set. Needs the review server (:8770); see stills.mjs.
import {existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
import {tmpdir} from 'node:os';

const set = process.argv[2];
if (!/^[a-z0-9-]{1,80}$/.test(set ?? '')) throw new Error('usage: build.mjs <set>');
const dir = join(import.meta.dirname, 'sets', set), m = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));
const out = join(dir, 'stills'), times = m.moments.map(([, s]) => s);
const missing = m.items.filter(it => times.some((_, i) => !existsSync(join(out, `${it.id}-${i + 1}.jpg`))));
if (!missing.length) {console.log('all stills present'); process.exit(0);}
const tmp = mkdtempSync(join(tmpdir(), 'rate-')), jobs = join(tmp, 'jobs.json');
try {
  writeFileSync(jobs, JSON.stringify({schemes: m.schemes, drops: m.drops, jobs: missing.map(it => ({name: it.id, song: m.song, look: it.look, times}))}));
  execFileSync(process.execPath, [join(import.meta.dirname, '..', 'stills.mjs'), `jobs=${jobs}`, `out=${out}`], {stdio: 'inherit'});
} finally {rmSync(tmp, {recursive: true, force: true});}
