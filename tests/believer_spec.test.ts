import {readFileSync} from 'node:fs';
import {expect, it} from 'vitest';
import spec, {landings} from '../productions/believer_78s/variants/stomp-voice.ts';

it('lands Believer only on measured sources, in order, inside the excerpt', () => {
  const events = JSON.parse(readFileSync('productions/believer_78s/events.json', 'utf8')).events;
  const measured = (source: string) => events.flatMap((e: any) => e.sources[source] ? [e.sources[source].t] : []);
  for (const {t, source} of landings) expect(measured(source).some((m: number) => Math.abs(m - t) <= 0.002), `${t} ${source}`).toBe(true);
  const times = spec.contacts.map(c => c.t);
  expect(times).toEqual([...times].sort((a, b) => a - b));
  expect(times[0]).toBeGreaterThanOrEqual(0.2);
  expect(times.at(-1)!).toBeLessThan(spec.duration - 0.2);
  expect(Math.max(...spec.contacts.map(c => c.impact))).toBe(1);  // "Pain!"
});
