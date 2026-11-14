import {readFileSync} from 'node:fs';
import {expect, it} from 'vitest';
import full, {marked, continued} from '../productions/circus_minimus_77s/variants/voice-full.ts';
import approved from '../productions/circus_minimus_77s/variants/voice-drums.ts';
import preferred from '../productions/circus_minimus_77s/spec.ts';

it('carries the approved hook unchanged and lands only on measured sources after it', () => {
  expect(preferred).toBe(full);
  const before = (s: typeof full) => s.contacts.filter(c => c.t < 48).map(c => [c.t, c.impact]);
  expect(before(full)).toEqual(before(approved));
  const events = JSON.parse(readFileSync('productions/circus_minimus_77s/events.json', 'utf8')).events;
  const measured = (source: string) => events.flatMap((e: any) => e.sources[source] ? [e.sources[source].t] : []);
  for (const {t, source} of [...marked, ...continued])
    expect(measured(source).some((m: number) => Math.abs(m - t) <= 0.012), `${t} ${source}`).toBe(true);
  const times = full.contacts.map(c => c.t);
  expect(times).toEqual([...times].sort((a, b) => a - b));
  expect(full.contacts.filter(c => c.t >= 48)).toHaveLength(marked.length + continued.length);
  expect(times.at(-1)).toBeCloseTo(76.881, 2);
});
