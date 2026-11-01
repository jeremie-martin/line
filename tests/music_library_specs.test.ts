import {createHash} from 'node:crypto';
import {existsSync, readFileSync} from 'node:fs';
import {expect, it} from 'vitest';
import {repertoireSongs} from '../scripts/gallery/repertoire_catalog.ts';

const read = (path: string) => JSON.parse(readFileSync(path, 'utf8'));
const library = read('productions/music-library.json') as {id: string; duration: number}[];
it('keeps all 22 source recordings independently identifiable', () => {
  expect(library).toHaveLength(22);
  expect(new Set(library.map(x => x.id)).size).toBe(22);
  const sources = library.map(({id}) => read(`productions/${id}/source.json`));
  expect(new Set(sources.map(s => s.sha256)).size).toBe(22);
});
for (const entry of library) it(`${entry.id}: explicit, sourced gestures and a valid excerpt`, async () => {
  const base = `productions/${entry.id}`;
  const {default: spec, evidence} = await import(`../productions/${entry.id}/spec.ts`);
  const source = read(`${base}/source.json`), composition = read(`${base}/composition.json`);
  const events = read(`${base}/events.json`).events, sung = read(`${base}/sung.json`);
  expect(spec.duration).toBeGreaterThanOrEqual(40);
  expect(spec.duration).toBeLessThanOrEqual(60);
  expect(spec.duration).toBeCloseTo(source.sourceEndSeconds - source.sourceStartSeconds, 3);
  expect(repertoireSongs.find(x => x.id === entry.id)?.duration).toBe(spec.duration);
  expect(source.reviewStatus).toContain('pending');
  expect(spec.contacts.length).toBeGreaterThan(0);
  for (const [i, c] of evidence.entries()) {
    const times = c.source === 'sung' ? [...sung.notes, ...sung.unpitched].map(x => x.t)
      : events.flatMap(x => x.sources[c.source] ? [x.sources[c.source].t] : []);
    expect(times.some(t => Math.abs(t - c.t) < 1e-6), `${c.source} at ${c.t}`).toBe(true);
    expect(c.t).toBeGreaterThan(0);
    expect(c.t).toBeLessThan(spec.duration);
    expect(c.impact).toBeGreaterThan(0);
    expect(c.impact).toBeLessThanOrEqual(1);
    expect(c.reason.length).toBeGreaterThan(20);
    if (i) expect(Math.round(c.t * 40)).toBeGreaterThan(Math.round(evidence[i - 1].t * 40));
  }
  for (const [i, phase] of composition.phases.entries()) {
    expect(phase.t).toBeGreaterThanOrEqual(0);
    expect(phase.t).toBeLessThan(spec.duration);
    if (i) expect(phase.t).toBeGreaterThan(composition.phases[i - 1].t);
  }
  for (let t = 0; t <= spec.duration; t += .1) for (const axis of ['air', 'speed']) {
    expect(spec.axes[axis](t)).toBeGreaterThanOrEqual(0);
    expect(spec.axes[axis](t)).toBeLessThanOrEqual(1);
  }
  // Music is intentionally untracked. Verify identity when the excerpt is present.
  if (existsSync(spec.music.audio)) expect(createHash('sha256').update(readFileSync(spec.music.audio)).digest('hex')).toBe(source.audioSha256);
});
