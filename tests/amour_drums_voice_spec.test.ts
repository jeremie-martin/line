import {expect, it} from 'vitest';
import spec from '../productions/amour_de_ma_vie_44s/variants/drums-voice.ts';
import {DRUM_HITS, FLAM_SECOND, REENTRY} from '../productions/amour_de_ma_vie_44s/music.ts';

it("L'amour de ma vie drums-voice: every drum hit lands, the re-entry is the hardest, rests float", () => {
  const times = spec.contacts.map(c => c.t);
  for (const t of DRUM_HITS.filter(t => t !== FLAM_SECOND)) expect(times.some(x => Math.abs(x - t) < 0.02), String(t)).toBe(true);
  expect(times).toEqual([...times].sort((a, b) => a - b));
  const hardest = spec.contacts.reduce((a, b) => b.impact > a.impact ? b : a);
  expect(hardest.t).toBeCloseTo(REENTRY, 2);
  expect(spec.axes.air!(6.75)).toBeGreaterThan(spec.axes.air!(5.4) + 0.15);  // a float in the rest, a low ride in the run
});
