import {readFileSync} from 'node:fs';
import {expect, it} from 'vitest';
import draft, {hookEvidence} from '../productions/circus_minimus_77s/variants/voice-drums.ts';
import previous from '../productions/circus_minimus_77s/variants/voice-led.ts';

it('traces authored hook times to the declared measured source, including percussion-only events', () => {
  const events = JSON.parse(readFileSync('productions/circus_minimus_77s/events.json', 'utf8')).events;
  const sung = JSON.parse(readFileSync('productions/circus_minimus_77s/sung.json', 'utf8'));
  for (const beat of hookEvidence) {
    const times: number[] = beat.source === 'sung' ? [...sung.notes, ...sung.unpitched].map(x => x.t)
      : events.flatMap((e: {sources: Record<string, {t: number}>}) => e.sources[beat.source] ? [e.sources[beat.source].t] : []);
    expect(times.some(t => Math.abs(t - beat.t) < .000001), `${beat.source} at ${beat.t}`).toBe(true);
  }
  expect(hookEvidence.some(b => b.role === 'drum')).toBe(true);
  expect(hookEvidence.some(b => b.role === 'voice')).toBe(true);
  expect(draft.contacts.every((c, i, all) => i === 0 || c.t > all[i - 1].t)).toBe(true);
  expect(draft.contacts.every(c => c.impact !== undefined && c.impact >= 0 && c.impact <= 1)).toBe(true);
});

it('preserves the previous draft outside the repeated hook and all other musical axes', () => {
  const outside = (c: {t: number}) => c.t < 38.4 || c.t >= 47.5;
  expect(draft.contacts.filter(outside)).toEqual(previous.contacts.filter(outside));
  expect(draft.axes).toEqual(previous.axes);
  expect(draft.music).toEqual(previous.music);
  expect(draft.camera).toEqual(previous.camera);
});
