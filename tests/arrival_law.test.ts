import {expect, it} from 'vitest';
import {arrivalLawHeading} from '../scripts/v0/optimizer/arc_evaluate.ts';
import {impactToRawPx, authoredSpeedToPx} from '../scripts/v0/types.ts';

const law = {gain: 2.4};   // the production law (repertoire_search.ts)
const at = (ask: number, speed: number) => arrivalLawHeading(law, impactToRawPx(ask), authoredSpeedToPx(speed));

it('the arrival law: level for a whisper, steeper for a stronger ask, shallower for a faster rider, never past vertical', () => {
  expect(at(0, .55)).toBeCloseTo(0, 6);
  for (const speed of [.3, .55, .8]) {
    const asks = [0, .1, .3, .5, .7, .9, 1].map(a => at(a, speed));
    asks.slice(1).forEach((h, k) => expect(h).toBeGreaterThan(asks[k]));
    expect(asks.at(-1)!).toBeLessThan(95);
  }
  for (const ask of [.1, .5, .9]) expect(at(ask, .8)).toBeLessThan(at(ask, .3));
  // a typical speed: about 44° at ask 0.5 and 59° at ask 0.9 (REWORK.md, November 15)
  expect(at(.5, .55)).toBeGreaterThan(40); expect(at(.5, .55)).toBeLessThan(48);
  expect(at(.9, .55)).toBeGreaterThan(54); expect(at(.9, .55)).toBeLessThan(64);
});
