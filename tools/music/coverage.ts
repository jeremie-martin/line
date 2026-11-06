/** Coverage of a spec's landings against the song's measured events
 * (productions/<song>/events.json, built by tools/music/events.py).
 *
 *   node tools/music/coverage.ts --song=trouble_50s [--variant=NAME] [--contacts-out=FILE.json]
 *
 * Each flag asks the author for a decision, not a fix. The bar is the spec's own
 * choices, so no loudness threshold is assumed:
 *   - no event:  a landing with no measured onset within 60 ms (every onset within
 *                60 ms of a landing counts as landed);
 *   - stronger:  a landing whose event is beaten by an unlanded event within 0.35 s;
 *   - unlanded:  an event stronger than the weakest event the spec lands on within
 *                2 s around it.
 * An event's strength is the largest rise among its instruments: a stem's own jump is
 * audible even over other sustained instruments, which mask it in the mix's rise.
 * --contacts-out writes [{t, impact}] for the sheets (tools/music/events.py --contacts). */
import {readFileSync, writeFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import type {Spec} from '../../scripts/v0/types.ts';

type Source = {t: number; peak: number; rise: number; classes?: string[]};
type Event = {t: number; sources: Record<string, Source>; mix: {peak: number; rise: number}};

const arg = (k: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const MATCH_S = 0.060, NEIGHBOUR_S = 0.35, CONTEXT_S = 2;
const song = arg('song');
if (!song) throw new Error('--song required');
const dir = resolve('productions', song);
const variant = arg('variant');
const spec = (await import(pathToFileURL(join(dir, variant ? `variants/${variant}.ts` : 'spec.ts')).href)).default as Spec;
const events = (JSON.parse(readFileSync(join(dir, 'events.json'), 'utf8')).events as Event[]).sort((a, b) => a.t - b.t);

const describe = (e: Event) => Object.entries(e.sources).sort((a, b) => b[1].rise - a[1].rise)
  .map(([s, v]) => `${s}${v.classes ? `(${v.classes.join('+')})` : ''} ${v.rise.toFixed(2)}`).join(', ');
const strength = (e: Event) => Math.max(...Object.values(e.sources).map(v => v.rise));
const fmt = (e: Event) => `${e.t.toFixed(2)}  strength ${strength(e).toFixed(2)} (mix ${e.mix.rise.toFixed(2)})  [${describe(e)}]`;

const landed = new Map<Event, number>();
const contacts = spec.contacts.map(c => {
  // Every event within the match window is this landing's sound; the sharpest is its event.
  const near = events.filter(e => Math.abs(e.t - c.t) <= MATCH_S);
  for (const e of near) landed.set(e, c.impact ?? NaN);
  const event = near.sort((a, b) => strength(b) - strength(a))[0];
  return {t: c.t, impact: c.impact, event};
});

const lines: string[] = [];
for (const c of contacts) {
  if (!c.event) {lines.push(`${c.t.toFixed(2)}  NO EVENT      landing (impact ${c.impact}) has no onset within ${MATCH_S * 1000} ms`); continue;}
  const rival = events.filter(e => !landed.has(e) && Math.abs(e.t - c.event!.t) <= NEIGHBOUR_S && strength(e) > strength(c.event!))
    .sort((a, b) => strength(b) - strength(a))[0];
  if (rival) lines.push(`${c.t.toFixed(2)}  STRONGER      lands on ${fmt(c.event)}\n${''.padStart(19)}but ${fmt(rival)}`);
}
for (const e of events) {
  if (landed.has(e)) continue;
  const around = contacts.flatMap(c => c.event && Math.abs(c.event.t - e.t) <= CONTEXT_S ? [c.event] : []);
  if (around.length === 0 || strength(e) > Math.min(...around.map(strength)))
    lines.push(`${e.t.toFixed(2)}  UNLANDED      ${fmt(e)}${around.length ? '' : '  (no landing within 2 s)'}`);
}
lines.sort((a, b) => parseFloat(a) - parseFloat(b));
console.log(`${song}: ${spec.contacts.length} landings, ${events.length} events, ${landed.size} landed on; ${lines.length} decisions\n`);
for (const line of lines) console.log(line);
const out = arg('contacts-out');
if (out) writeFileSync(out, JSON.stringify(spec.contacts.map(c => ({t: c.t, impact: c.impact ?? 0.5}))));
