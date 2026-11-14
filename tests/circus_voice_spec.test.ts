import {readFileSync} from 'node:fs';
import {expect, it} from 'vitest';
import draft, {vocalHook, hookBass} from '../productions/circus_minimus_77s/variants/voice-led.ts';
import preferred from '../productions/circus_minimus_77s/variants/pairs3.ts';

it('keeps the vocal attacks at their measured vocal times, including the fast pitch turns', () => {
  const sung = JSON.parse(readFileSync('productions/circus_minimus_77s/sung.json', 'utf8'));
  for (const c of vocalHook) expect(sung.notes.some((n: {t: number}) => Math.abs(n.t - c.t) < .001)).toBe(true);
  for (const t of [40.519, 40.716, 40.948, 46.928, 47.102]) expect(draft.contacts.some(c => c.t === t)).toBe(true);
  expect(draft.contacts.every((c, i, all) => i === 0 || c.t > all[i - 1].t)).toBe(true);
  expect(draft.contacts.every(c => c.impact !== undefined && c.impact >= 0 && c.impact <= 1)).toBe(true);
});

it('keeps structural bass anchors without rewriting the rest of the preferred song', () => {
  const events = JSON.parse(readFileSync('productions/circus_minimus_77s/events.json', 'utf8')).events;
  for (const c of hookBass) expect(events.some((e: {t: number; sources: Record<string, unknown>}) => Math.abs(e.t - c.t) < .003 && e.sources.bass)).toBe(true);
  const outside = (c: {t: number}) => c.t < 38 || c.t >= 51.15;
  expect(draft.contacts.filter(outside)).toEqual(preferred.contacts.filter(outside));
  expect(draft.axes).toEqual(preferred.axes);
});
