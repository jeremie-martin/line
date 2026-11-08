import {readdirSync, existsSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {expect, it} from 'vitest';
import {authoredBeats, loadMusicSpec} from '../scripts/produce/music_artifacts.ts';
import {applyJolt, JOLT_DEFAULT_MS} from '../scripts/produce/jolt.ts';
import type {Spec} from '../scripts/v0/types.ts';

const spec = (times: number[]) => ({duration: 10, contacts: times.map(t => ({t, impact: .5})), axes: {}}) as unknown as Spec;

it('authored beats are the spec’s own times, and only a strictly increasing spec has them', () => {
  expect(authoredBeats(spec([0.5, 1.025, 2.0001]), 'x')).toEqual([0.5, 1.025, 2.0001]);
  expect(() => authoredBeats(spec([1, 0.5]), 'song/spec.ts')).toThrow(/song\/spec.ts: contact 1 at 0.5 s is not after contact 0 at 1 s/);
  expect(() => authoredBeats(spec([1, 1]), 'x')).toThrow(/strictly increasing/);
  expect(() => authoredBeats(spec([1, NaN]), 'x')).toThrow(/strictly increasing/);
  expect(authoredBeats(spec([]), 'x')).toEqual([]);
});

// Every spec and variant in the repository: beat i is target i of the compiled case, whatever the jolt.
const definitions = readdirSync('productions').flatMap(song => [
  ...existsSync(join('productions', song, 'spec.ts')) ? [{song}] : [],
  ...existsSync(join('productions', song, 'variants')) ? readdirSync(join('productions', song, 'variants'))
    .filter(f => f.endsWith('.ts')).map(f => ({song, variant: f.slice(0, -3)})) : [],
]);

it.each(definitions.map(d => [d.variant ? `${d.song} · ${d.variant}` : d.song, d] as const))('%s: beats belong to their targets', async (_, d) => {
  const definition = {...d, title: d.song, moments: []};
  const [jolted, unjolted] = await Promise.all([loadMusicSpec(definition, JOLT_DEFAULT_MS), loadMusicSpec(definition, 0)]);
  const authored = (await import(pathToFileURL(resolve(jolted.cfg.spec)).href)).default as Spec;
  expect(jolted.beats).toEqual(authored.contacts.map(c => c.t));
  expect(unjolted.beats).toEqual(jolted.beats);
  // target i is authored contact i, shifted: nothing between the spec and the case reorders, merges or drops a contact
  const shifted = applyJolt(authored, JOLT_DEFAULT_MS).contacts;
  expect(jolted.musicCase.contacts).toEqual(shifted.map(c => ({frame: Math.round(c.t * 40), impact: c.impact})));
}, 30000);
