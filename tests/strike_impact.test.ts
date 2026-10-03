import {expect, it} from 'vitest';
import {detectStrikes, observeStrikes, strikePrefix, continueStrikes, accountStrikes, STRIKE_CONTRACT, type StrikeFrame} from '../scripts/lib/strike_impact.ts';

const frames = (J: number[], contact: boolean[] = J.map(j => j > 0), bend = J.map(j => j)): StrikeFrame[] =>
  J.map((j, i) => ({frame: 100 + i, contact: contact[i], J: j, bend: bend[i], solverGain: 0, gravityGain: 0, speedBefore: 1}));
const air = (n: number) => Array(n).fill(0);

it('measures nothing in free flight: the centre of mass is ballistic', () => {
  const v = Array.from({length: 12}, (_, k) => ({x: 3, y: -2 + k * STRIKE_CONTRACT.gravity}));
  const observed = observeStrikes(50, v, () => false);
  expect(observed.every(f => Math.abs(f.J) < 1e-12)).toBe(true);
  expect(detectStrikes(observed)).toEqual([]);
});

it('a touchdown is an event timed at its half-rise, with strength from its own frames', () => {
  const e = detectStrikes(frames([...air(3), 0.4, 1.6, 2.0, 1.0, 0.3, 0.2, ...air(3)]));
  expect(e).toHaveLength(1);
  expect(e[0]).toMatchObject({kind: 'touchdown', onset: 104, peakFrame: 105, contactStart: 103});
  expect(e[0].raw).toBeCloseTo(0.4 + 1.6 + 2.0 + 1.0 + 0.3 + 0.2);
});

it('fuses frame-to-frame contact chatter into one strike', () => {
  expect(detectStrikes(frames([...air(2), 0.9, 1.46, 0.88, 2.31, 0.5, 0.2, 0.2, 0.2, ...air(2)]))).toHaveLength(1);
});

it('never hides a strike that follows a weak touch inside continuous contact', () => {
  const e = detectStrikes(frames([...air(2), 0.3, 0.25, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 1.8, 2.6, 0.9, 0.2, 0.2, ...air(2)]));
  expect(e.map(x => x.kind)).toEqual(['touchdown', 'strike']);
  expect(e[1].peakFrame).toBe(111);
});

it('separates engagements at any contact-free frame', () => {
  expect(detectStrikes(frames([...air(2), 2.4, 0.9, 0.0, 1.8, 1.6, ...air(2)]))).toHaveLength(2);
});

it('treats sustained low contact force as steering, not as strikes', () => {
  const e = detectStrikes(frames([...air(2), 0.6, ...Array(40).fill(0).map((_, i) => 0.3 + 0.2 * Math.sin(i)), ...air(2)]));
  expect(e).toHaveLength(1);
  expect(e[0].kind).toBe('touchdown');
});

it('incremental detection agrees with a cold full detection at any split', () => {
  const all = frames([...air(2), 0.4, 1.6, 2.0, 1.0, 0.3, ...air(2), 0.5, 0.3, 0.2, 0.2, 0.2, 0.2, 2.2, 1.0, 0.3, ...air(2)]);
  const cold = detectStrikes(all);
  for (let split = 1; split < all.length; split++)
    expect(continueStrikes(strikePrefix(all.slice(0, split)), all.slice(split))).toEqual(cold);
});

it('matches events to beats and charges unmatched strikes by strength squared', () => {
  const e = detectStrikes(frames([...air(2), 0.4, 1.6, 2.0, 1.0, 0.3, ...air(4), 3.0, 2.5, ...air(2)]));
  const account = accountStrikes(e, [{frame: 103, impact: 0.7}]);
  expect(account.matches).toHaveLength(1);
  expect(account.unmatchedEvents).toEqual([1]);
  expect(account.extraMse).toBeCloseTo((e[1].raw / 7.55) ** 2);
});
