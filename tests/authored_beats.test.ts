import {readdirSync, existsSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {expect, it} from 'vitest';
import {authoredBeats, EARLIEST_CONTACT_S, loadMusicSpec} from '../scripts/produce/music_artifacts.ts';
import type {Spec} from '../scripts/v0/types.ts';

const spec = (times: number[]) => ({duration: 10, contacts: times.map(t => ({t, impact: .5})), axes: {}}) as unknown as Spec;

it('authored beats are the spec’s own times, and only a strictly increasing spec has them', () => {
  expect(authoredBeats(spec([0.5, 1.025, 2.0001]), 'x')).toEqual([0.5, 1.025, 2.0001]);
  expect(() => authoredBeats(spec([1, 0.5]), 'song/spec.ts')).toThrow(/song\/spec.ts: contact 1 at 0.5 s is not after contact 0 at 1 s/);
  expect(() => authoredBeats(spec([1, 1]), 'x')).toThrow(/strictly increasing/);
  expect(() => authoredBeats(spec([1, NaN]), 'x')).toThrow(/strictly increasing/);
  expect(authoredBeats(spec([]), 'x')).toEqual([]);
});

it('a contact before the earliest catchable one is refused, never moved', () => {
  expect(EARLIEST_CONTACT_S).toBe(0.125);
  expect(authoredBeats(spec([0.125, 1]), 'x')).toEqual([0.125, 1]);
  expect(() => authoredBeats(spec([0.1, 1]), 'song/spec.ts')).toThrow(/song\/spec.ts: contact 0 at 0.1 s is earlier than the earliest catchable contact, 0.125 s/);
});

// Every spec and variant in the repository: beat i is target i of the compiled case, at its authored time.
const definitions = readdirSync('productions').flatMap(song => [
  ...existsSync(join('productions', song, 'spec.ts')) ? [{song}] : [],
  ...existsSync(join('productions', song, 'variants')) ? readdirSync(join('productions', song, 'variants'))
    .filter(f => f.endsWith('.ts')).map(f => ({song, variant: f.slice(0, -3)})) : [],
]);

it.each(definitions.map(d => [d.variant ? `${d.song} · ${d.variant}` : d.song, d] as const))('%s: beats belong to their targets', async (_, d) => {
  const definition = {...d, title: d.song, moments: []};
  const loaded = await loadMusicSpec(definition);
  const authored = (await import(pathToFileURL(resolve(loaded.cfg.spec)).href)).default as Spec;
  expect(loaded.beats).toEqual(authored.contacts.map(c => c.t));
  // target i is authored contact i: nothing between the spec and the case moves, reorders, merges or drops a contact
  expect(loaded.musicCase.contacts).toEqual(authored.contacts.map(c => ({frame: Math.round(c.t * 40), impact: c.impact})));
}, 30000);
