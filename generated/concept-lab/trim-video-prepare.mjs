// env -C <repo> node generated/concept-lab/trim-video-prepare.mjs RIDES_DIR
// Data for the trim video page (and the trim map): each song's ride with nothing trimmed, and the ids of the lines each trimmed
// version keeps. RIDES_DIR holds <version>/<song>/<...>-production.json, every version compiled from one commit with the same
// seed (TRIM_KEEP, branch exp/trim-support-ends); <version>.<song>.log holds the compile's last line (complete, valid, qualified).
// Before writing, it checks that every version has the same score and the same rider path (the production's `trace`).
import {readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {buildScene} from '../../scripts/video/scene.ts';

const rides = process.argv[2], out = 'generated/trim/data'; mkdirSync(out, {recursive: true});
// version on disk → key in the data (trim, one, exact keep the names the trim map reads)
const VERSIONS = {keep2: 'trim', end: 'end', one: 'one', startone: 'startone', min: 'min', exact: 'exact'};
const SONGS = [['petrunko', 'petrunko_selection'], ['trouble', 'trouble_50s'], ['tiki', 'tiki_tiki_48s'], ['circus', 'circus_minimus_77s'],
  ['amor', 'amor_na_praia_46s'], ['bones', 'bones_selection'], ['valhalla', 'valhalla_40s']];
const load = (version, key) => {const dir = `${rides}/${version}/${key}`; return JSON.parse(readFileSync(`${dir}/${readdirSync(dir).find(n => n.endsWith('-production.json'))}`));};
const compile = (version, key) => {const log = `${rides}/${version}.${key}.log`; if (!existsSync(log)) return null;
  try {return JSON.parse(readFileSync(log, 'utf8').trim().split('\n').at(-1));} catch {return null;}};
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 16);
let problems = 0;
for (const [key, song] of SONGS) {
  if (!existsSync(`${rides}/none/${key}`)) {console.log(key, 'skipped: no ride'); continue;}
  const base = load('none', key), scene = buildScene(song, base), kept = {}, checks = {};
  for (const version of ['none', ...Object.keys(VERSIONS)]) {
    const ride = version === 'none' ? base : load(version, key), c = compile(version, key);
    checks[version] = {score: ride.score?.score ?? null, trace: hash(ride.trace), lines: ride.track.lines.length,
      complete: c?.complete ?? null, valid: c?.valid ?? ride.valid ?? null, qualified: c?.qualified ?? null};
    if (version !== 'none') kept[VERSIONS[version]] = ride.track.lines.map(l => l.id);
  }
  const b = checks.none, bad = Object.entries(checks).filter(([, c]) => c.score !== b.score || c.trace !== b.trace || !c.complete || !c.valid || !c.qualified);
  problems += bad.length;
  writeFileSync(`${out}/${key}.json`, JSON.stringify({scene, kept, checks}));
  console.log(key, `score ${b.score} path ${b.trace}`, Object.entries(checks).map(([v, c]) => `${v} ${c.lines}`).join(', '), bad.length ? `DIFFERS: ${bad.map(([v]) => v).join(' ')}` : 'all identical, complete, valid, qualified');
}
if (problems) process.exitCode = 1;
