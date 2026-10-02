import {expect, it} from 'vitest';
import {contactEpisodes, responsePulses, matchInteractions, type InteractionFrame} from '../scripts/gallery/interaction_candidates.ts';
const frames = (values: number[], contacts = values.map(x => x > 0)): InteractionFrame[] => values.map((correction, frame) => ({frame, correction, contact: contacts[frame]}));
it('does not split a continuous contact when response has several peaks', () => {
  const f = frames([0, .7, 1.34, 1.15, 1.06, 1.43, .38, .28, 0]);
  expect(contactEpisodes(f)).toHaveLength(1); expect(responsePulses(f)).toHaveLength(1);
  expect(responsePulses(f)[0].peakFrame).toBe(5);
});
it('exposes how bridging one frame merges separate engagements', () => {
  const f = frames([0, .57, 2.49, 1.32, .31, 1.1, 1.42, 1.78, .7, 0], [false, true, true, true, false, true, true, true, true, false]);
  expect(contactEpisodes(f, 0)).toHaveLength(2); expect(contactEpisodes(f, 1)).toHaveLength(1);
  expect(responsePulses(f)).toHaveLength(2);
});
it('does not require support/guide identities and retains quiet contacts', () => {
  const original = frames([0, .2, .3, .2, 0]);
  const relabeled = original.map((f, i) => ({...f, segmentIds: [1000 + i], role: 'arbitrary'}));
  expect(contactEpisodes(relabeled)).toEqual(contactEpisodes(original));
  expect(contactEpisodes(original)).toHaveLength(1); expect(responsePulses(original)).toHaveLength(0);
  expect(responsePulses(original, {floor: .25, valleyFraction: .4, edgeFraction: .2})).toHaveLength(1);
});
it('does not call a contact-free body response a contact-associated pulse', () => {
  expect(responsePulses(frames([0, 1, 0, 0], [false, false, false, false]))).toEqual([]);
});
it('keeps two impacts competing for one beat visible', () => {
  const events = contactEpisodes(frames([0, 1, 0, 2, 0]));
  const m = matchInteractions(events, [1.2], 3);
  expect(m.pairs).toHaveLength(1);expect(m.pairs[0]).toMatchObject({event: 0, beat: 0});expect(m.pairs[0].offsetFrames).toBeCloseTo(-.2);
  expect(m.unmatchedEvents).toEqual([1]);expect(m.eligible).toEqual([[0], [0]]);
  expect(matchInteractions(events, [20], 3).unmatchedBeats).toEqual([0]);
});
it('maximizes ordered matches before timing error, without a greedy nearest-beat loss', () => {
  const e = (start: number) => ({start, end: start, peakFrame: start, peak: 1, responseSum: 1});
  const m = matchInteractions([e(3), e(5)], [1, 4], 2);
  expect(m.pairs.map(p => [p.event, p.beat])).toEqual([[0, 0], [1, 1]]);
});
it('rejects missing frames and invalid parameters; handles empty observations', () => {
  expect(() => contactEpisodes([{frame: 1, correction: 1, contact: true}, {frame: 3, correction: 0, contact: false}])).toThrow();
  expect(() => responsePulses(frames([0, 1, 0]), {floor: .5, valleyFraction: 0, edgeFraction: .2})).toThrow();
  expect(contactEpisodes([])).toEqual([]);expect(responsePulses([])).toEqual([]);
  expect(matchInteractions([], [2], 1).unmatchedBeats).toEqual([0]);
});
