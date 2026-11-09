// Freeze a set of themes to judge: node generated/concept-lab/rate/freeze.mjs DRAFT.json
// DRAFT: {set: "2026-11-09-themes", title, round, created, include?: [earlier set], schemes?: {name: scheme}, drops?: {scheme: partner},
//         retire?: [themeId], themes: [{label, look: {scheme, …choices}, group?, parents?: [themeId]}]}
// A retired theme (from an earlier set) is kept in the set, so the judgments that involved it still inform the fit, but it is
// never shown again (set.json retired; model.js).
// Each theme is resolved to its full specification: every look option (resolveLook, so no V1 default is implied) and the
// colours of its scheme and of its drop partner (so no named scheme is referred to). Its id is the hash of that specification:
// change one colour and it is another theme. The registry (rate/themes.jsonl, committed: these are designs, not answers) binds
// each label to one id, for good: a label already bound to another theme is refused, so a changed theme needs a new name.
// Writes rate/sets/<set>/set.json once (a frozen set is never rewritten: the server refuses events if it changes) and renders
// its stills from the specifications themselves (stills/<id>-<n>.jpg; not committed, keep them: they are what was judged).
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {appendFileSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {resolveLook} from '../../../scripts/video/look.js';
import {SCHEMES, DROP_SCHEMES} from '../../../scripts/video/palettes.js';

export const MOMENTS = [{label: 'Verse', t: 18}, {label: 'Inside the drop', t: 44.65}];  // Circus Minimus, no hit in progress
const HERE = import.meta.dirname, REGISTRY = join(HERE, 'themes.jsonl');

/** JSON with sorted keys and lower-case colours: one text per specification. */
export function canonical(v) {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`;
  return JSON.stringify(typeof v === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(v) ? v.toLowerCase() : v);
}
export const themeId = spec => 't-' + createHash('sha256').update(canonical(spec)).digest('hex').slice(0, 12);

/** The full specification of a look whose scheme is named in `schemes` (palettes plus the draft's own). */
export function specOf(look, schemes, drops) {
  const full = resolveLook(null, look), {scheme, ...options} = full;
  if (!schemes[scheme]) throw new Error(`unknown scheme ${scheme}`);
  const partner = drops[scheme];
  return JSON.parse(canonical({look: options, colours: schemes[scheme], drop: partner ? schemes[partner] : null}));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const draft = JSON.parse(readFileSync(process.argv[2], 'utf8'));
  if (!/^[a-z0-9-]{1,80}$/.test(draft.set ?? '')) throw new Error('the set needs a name: a date and a slug, e.g. 2026-11-09-themes');
  const dir = join(HERE, 'sets', draft.set), file = join(dir, 'set.json');
  Object.assign(SCHEMES, draft.schemes); Object.assign(DROP_SCHEMES, draft.drops);  // the draft's own schemes, for resolveLook too
  const schemes = SCHEMES, drops = DROP_SCHEMES;
  let set;
  if (existsSync(file)) {
    set = JSON.parse(readFileSync(file, 'utf8'));
    console.log(`${draft.set} is frozen: ${process.argv.includes("--rerender") ? "its stills are rendered again" : "only its missing stills are rendered"}`);
  } else {
    const registry = existsSync(REGISTRY) ? readFileSync(REGISTRY, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)) : [];
    const byLabel = new Map(registry.map(r => [r.label, r.id])), byId = new Map(registry.map(r => [r.id, r.label]));
    // the sets it builds on, with theirs in turn: a judgment made in any of them still counts here
    const builds = [];
    const chain = name => {if (builds.includes(name)) return; builds.push(name); for (const s of JSON.parse(readFileSync(join(HERE, 'sets', name, 'set.json'), 'utf8')).buildsOn ?? []) chain(s);};
    (draft.include ?? []).forEach(chain);
    const themes = [], problems = [], fresh = [];
    // a set may build on earlier ones: their themes come along unchanged (same ids, same stills) and so do their judgments
    for (const s of builds) {
      const prev = JSON.parse(readFileSync(join(HERE, 'sets', s, 'set.json'), 'utf8'));
      for (const t of prev.themes) if (!themes.some(x => x.id === t.id)) themes.push(t);
    }
    for (const t of draft.themes) {
      const spec = specOf(t.look, schemes, drops), id = themeId(spec);
      if (byLabel.has(t.label) && byLabel.get(t.label) !== id) {problems.push(`"${t.label}" already names another theme (${byLabel.get(t.label)}): give this one a new name`); continue;}
      if (themes.some(x => x.id === id)) {problems.push(`"${t.label}" is the same theme as "${themes.find(x => x.id === id).label}"`); continue;}
      const label = byId.get(id) ?? t.label;  // a theme met before keeps its first name
      if (label !== t.label) console.log(`"${t.label}" is "${label}" (${id}), kept under that name`);
      if (themes.some(x => x.label === label)) {problems.push(`two themes named "${label}"`); continue;}
      themes.push({id, label, group: t.group ?? null, parents: t.parents ?? [], spec});
      if (!byId.has(id)) fresh.push({id, label, spec, parents: t.parents ?? [], round: draft.round ?? null, set: draft.set});
    }
    const retired = draft.retire ?? [];
    for (const id of retired) if (!themes.some(t => t.id === id)) problems.push(`cannot retire ${id}: not a theme of the sets it builds on`);
    if (problems.length) throw new Error(`not frozen:\n  ${problems.join('\n  ')}`);
    let renderer = 'unknown';
    try {renderer = execFileSync('git', ['describe', '--always', '--dirty'], {cwd: HERE, encoding: 'utf8'}).trim();} catch {}
    set = {set: draft.set, title: draft.title, round: draft.round ?? null, created: draft.created, song: 'circus', renderer, moments: MOMENTS,
      ...(builds.length ? {buildsOn: builds} : {}), ...(retired.length ? {retired} : {}), themes};
    mkdirSync(dir, {recursive: true});
    writeFileSync(file, JSON.stringify(set, null, 1) + '\n');
    for (const r of fresh) appendFileSync(REGISTRY, JSON.stringify(r) + '\n');
    console.log(`${draft.set}: ${themes.length} themes frozen, ${fresh.length} new to the registry`);
  }
  // the stills, rendered from the frozen specifications (each theme's colours under its own id)
  // the stills of themes from earlier sets are those judged there: copied, never rendered again
  for (const s of set.buildsOn ?? []) for (const t of set.themes) set.moments.forEach((_, i) => {
    const from = join(HERE, 'sets', s, 'stills', `${t.id}-${i + 1}.jpg`), to = join(dir, 'stills', `${t.id}-${i + 1}.jpg`);
    if (existsSync(from) && !existsSync(to)) {mkdirSync(join(dir, 'stills'), {recursive: true}); copyFileSync(from, to);}
  });
  // at the video's own resolution, lightly compressed (a desktop shows them ~720 px high, on a dense screen ~1440 real pixels).
  // --rerender renders every still again from the frozen specifications (the set and its judgments are untouched): only
  // with the renderer the set was frozen with, which stills.json records with the size and quality
  const STILLS = {width: 1080, quality: 0.92}, out = join(dir, 'stills'), again = process.argv.includes('--rerender');
  const missing = set.themes.filter(t => !(set.retired ?? []).includes(t.id) || again).filter(t => again || set.moments.some((_, i) => !existsSync(join(out, `${t.id}-${i + 1}.jpg`))));
  if (missing.length) {
    const tmp = mkdtempSync(join(tmpdir(), 'freeze-')), jobs = join(tmp, 'jobs.json');
    const sc = {}, dr = {};
    for (const t of missing) {sc[t.id] = t.spec.colours; if (t.spec.drop) {sc[`${t.id}-drop`] = t.spec.drop; dr[t.id] = `${t.id}-drop`;}}
    writeFileSync(jobs, JSON.stringify({...STILLS, schemes: sc, drops: dr, jobs: missing.map(t => ({name: t.id, song: set.song, look: {...t.spec.look, scheme: t.id}, times: set.moments.map(m => m.t)}))}));
    try {execFileSync(process.execPath, [join(HERE, '..', 'stills.mjs'), `jobs=${jobs}`, `out=${out}`], {stdio: 'inherit'});}
    finally {rmSync(tmp, {recursive: true, force: true});}
    let renderer = 'unknown';
    try {renderer = execFileSync('git', ['describe', '--always', '--dirty'], {cwd: HERE, encoding: 'utf8'}).trim();} catch {}
    writeFileSync(join(dir, 'stills.json'), JSON.stringify({...STILLS, renderer, rendered: new Date().toISOString()}, null, 1) + '\n');
  } else console.log('all stills present');
}
