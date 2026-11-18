/** What changed in a reading, in its author's words to the owner: the spec dashboard shows it beside his verdict ("What
 * changed") and its points on the timeline.
 *   node tools/music/revision.ts --song=<song> [--variant=<name>] --by=<name> --file=<path to a json {summary, points?}>
 * An author runs it after the last edit of a revision, before committing: it stamps the reading's present version
 * (specSha256, scripts/gallery/spec_api.ts), so a later edit of the song's files makes the note one on an earlier version.
 * `summary`: one to four plain sentences (what of his feedback was applied, what was extended beyond the places he named,
 * what was left and why); `points`: a few places worth looking at, [{from, to, text}] in seconds, `to` null for a moment.
 * Appended to productions/<song>/revisions.json ({revisions: [...]}, oldest first); run again for the same reading and
 * version, it replaces that entry. */
import {existsSync, readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {specSha256} from '../../scripts/gallery/spec_api.ts';
import type {Revision} from '../../scripts/gallery/spec_review_api.ts';

const arg = (name: string) => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const song = arg('song'), variant = arg('variant'), by = arg('by')?.trim(), input = arg('file');
const fail = (why: string): never => {console.error(why); process.exit(1);};
if (!song || !by || !input) fail('usage: node tools/music/revision.ts --song=<song> [--variant=<name>] --by=<name> --file=<path to a json {summary, points?}>');
const root = process.cwd(), spec = variant ? `productions/${song}/variants/${variant}.ts` : `productions/${song}/spec.ts`;
if (!existsSync(join(root, spec))) fail(`no reading ${spec}`);

const body = JSON.parse(readFileSync(input!, 'utf8'));
const summary = typeof body?.summary === 'string' ? body.summary.trim() : '';
if (!summary) fail('summary: plain sentences of what changed, required');
if (summary.length > 1200) fail(`summary: ${summary.length} characters, at most 1200`);
if (body.points !== undefined && !Array.isArray(body.points)) fail('points: a list of {from, to, text}');
const duration = await import(pathToFileURL(join(root, spec)).href).then(m => m.default?.duration, () => undefined);
const within = (t: unknown) => typeof t === 'number' && Number.isFinite(t) && t >= 0 && !(Number.isFinite(duration) && t > duration);
const points = (body.points ?? []).map((p: any, i: number) => {
  const text = typeof p?.text === 'string' ? p.text.trim() : '', to = p?.to ?? null;
  if (!within(p?.from)) fail(`point ${i + 1}: from must be a time in the piece (0 to ${duration} s)`);
  if (to !== null && (!within(to) || to < p.from)) fail(`point ${i + 1}: to must be null (a moment) or a time after from, in the piece`);
  if (!text) fail(`point ${i + 1}: text required`);
  if (text.length > 400) fail(`point ${i + 1}: ${text.length} characters, at most 400`);
  return {from: p.from, to, text};
});

const file = join(root, 'productions', song!, 'revisions.json');
const revisions: Revision[] = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')).revisions ?? [] : [];
const sha256 = specSha256(join(root, spec));
const entry: Revision = {spec, sha256, at: new Date().toISOString(), by: by!, summary, ...(points.length ? {points} : {})};
const at = revisions.findIndex(r => r.spec === spec && r.sha256 === sha256);
if (at >= 0) revisions[at] = entry; else revisions.push(entry);
writeFileSync(file, JSON.stringify({revisions}, null, 2) + '\n');
console.log(`${at >= 0 ? 'replaced' : 'added'} the note on ${spec} at ${sha256.slice(0, 12)} (${points.length} point${points.length === 1 ? '' : 's'}) in productions/${song}/revisions.json`);
