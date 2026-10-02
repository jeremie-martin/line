import {describe, expect, it} from 'vitest';
import {CONTACT_IMPACT_CONTRACT as contract, observeContactImpacts, detectContactImpacts,
  accountContactImpacts, contactSpeedGains, contactImpactPrefix, continueContactImpacts, type ContactImpactFrame} from '../scripts/lib/contact_impact.ts';

function series(response: number[], contact = response.map(() => true)): ContactImpactFrame[] {
  return response.map((value, frame) => ({frame: frame + 10, contact: contact[frame], bend: value,
    response: value, solverGain: 0, gravityGain: 0, speedBefore: 10}));
}
const event = (onset: number, strength: number) => ({contactStart: onset, onset, end: onset + 1, peakFrame: onset,
  raw: strength * contract.veryStrong, strength: Math.min(1, strength), responsePeak: strength, complete: true});

describe('physical impact observations', () => {
  it('places the native correction on its physical frame and keeps support separate from path bending', () => {
    const frames = [1, 2, 3].map(frame => ({frame, velocity: {x: 10, y: .175}}));
    const observed = observeContactImpacts(frames, () => true, {x: 10, y: 0});
    expect(observed.every(f => f.bend === 0 && f.response > .17 && f.response < .18)).toBe(true);
    expect(detectContactImpacts(observed)[0].raw).toBe(0);
    const hit = observeContactImpacts([{frame: 9, velocity: {x: 10, y: 3.175}}, {frame: 10, velocity: {x: 10, y: .175}}],
      frame => frame === 9, {x: 10, y: 0});
    expect(detectContactImpacts(hit)[0].onset).toBe(9);
    expect(detectContactImpacts(hit)[0].raw).toBeGreaterThan(2.9);
  });
  it('is invariant to observation-coordinate rotation when gravity rotates too', () => {
    const frames = [{frame: 8, velocity: {x: 7, y: 3}}, {frame: 9, velocity: {x: 7.2, y: .7}}, {frame: 10, velocity: {x: 6.5, y: -.4}}];
    const terminal = {x: 6.2, y: -.5}, g = {x: 0, y: .175};
    const rot = (v: {x: number; y: number}) => ({x: -v.y, y: v.x});
    const a = observeContactImpacts(frames, () => true, terminal, g);
    const b = observeContactImpacts(frames.map(f => ({...f, velocity: rot(f.velocity)})), () => true, rot(terminal), rot(g));
    expect(b).toEqual(a);
  });
  it('rejects a truncated velocity observation and non-contiguous inputs', () => {
    expect(() => observeContactImpacts([{frame: 1, velocity: {x: 1, y: 0}}], () => true)).toThrow(/terminal/);
    expect(() => detectContactImpacts([series([1])[0], {...series([1])[0], frame: 12}])).toThrow(/invalid/);
  });
});
describe('one physical impact account', () => {
  it('preserves a coherent multi-peak strike but separates an immediate distinct receiver', () => {
    const clean = series([.7, 1.2, 1, .9, 1.3, .3, .1, 0], [true, true, true, true, true, true, true, false]);
    expect(detectContactImpacts(clean)).toHaveLength(1);
    const separate = series([.5, 2, 1, 0, 1, 1.4, 1.7, .7, 0], [true, true, true, false, true, true, true, true, false]);
    const events = detectContactImpacts(separate);
    expect(events.map(e => e.onset)).toEqual([10, 14]);
    expect(events[0].raw).toBeCloseTo(3.5);
    expect(events[1].raw).toBeCloseTo(4.8);
  });
  it('recognizes a brief contact without demanding sled persistence or a magnitude floor', () => {
    const events = detectContactImpacts(series([0, 3, 0], [false, true, false]));
    expect(events).toHaveLength(1); expect(events[0].raw).toBe(3); expect(events[0].complete).toBe(true);
    const quiet = detectContactImpacts(series([0, 0, 0], [false, true, false]));
    expect(quiet).toHaveLength(1); expect(quiet[0].strength).toBe(0);
    expect(accountContactImpacts(quiet, [{frame: 11, impact: 0}]).complete).toBe(true);
  });
  it('does not count continuous steady steering repeatedly, but recognizes renewed response', () => {
    expect(detectContactImpacts(series(Array(40).fill(.3)))).toHaveLength(1);
    const values = [1, 2, 1, .5, .3, .2, .1, .1, .1, .2, 1, 2, 1, .4, .1];
    expect(detectContactImpacts(series(values))).toHaveLength(2);
  });
  it('has no impact in unsupported flight even when the internal velocity changes', () => {
    expect(detectContactImpacts(series([5, 4, 6], [false, false, false]))).toEqual([]);
  });
  it('agrees with cold full observation at every possible prefix boundary', () => {
    const values = [0, .1, .5, 2, 1, .3, .1, .1, .2, 2, 1, 0, .1, 3, 2, 0, 0];
    const frames = series(values, values.map(v => v > 0)), whole = detectContactImpacts(frames);
    for (let at = 1; at < frames.length; at++) expect(continueContactImpacts(contactImpactPrefix(frames.slice(0, at)), frames.slice(at))).toEqual(whole);
  });
  it('accounts for the larger nearby response instead of letting a tiny touch steal its beat', () => {
    const account = accountContactImpacts([event(10, .01), event(12, .8)], [{frame: 10, impact: .8}]);
    expect(account.matches[0].event).toBe(1); expect(account.unmatchedEvents).toEqual([0]);
    expect(account.extraMse).toBeCloseTo(.0001);
  });
  it('does not let one event fulfill two targets or silently match outside its declared tolerance', () => {
    const account = accountContactImpacts([event(11, .5)], [{frame: 10, impact: .5}, {frame: 12, impact: .5}]);
    expect(account.matches).toHaveLength(1); expect(account.missingTargets).toHaveLength(1); expect(account.complete).toBe(false);
    expect(accountContactImpacts([event(15, .5)], [{frame: 10, impact: .5}]).matches).toHaveLength(0);
  });
  it('preserves every unmatched response and is consistent under an absolute frame offset', () => {
    const a = [event(10, .5), event(30, .7), event(60, .2)], targets = [{frame: 10, impact: .5}, {frame: 60, impact: .3}];
    const first = accountContactImpacts(a, targets);
    const moved = accountContactImpacts(a.map(e => ({...e, onset: e.onset + 100})), targets.map(t => ({...t, frame: t.frame + 100})));
    expect(moved).toEqual(first); expect(first.extraMse).toBeCloseTo(.7 ** 2 / 2);
  });
  it('reports both sustained gain and a later burst hidden by net deceleration', () => {
    const frames = series(Array(8).fill(.2)).map((f, i) => ({...f, solverGain: [-3, -2, .3, .3, .3, .3, .3, .3][i]}));
    const gains = contactSpeedGains(frames);
    expect(gains[0].solverGain).toBeCloseTo(-3.2);
    expect(gains[0].strongest.gain).toBeCloseTo(1.8);
    expect(gains[0].strongest.start).toBe(12);
  });
});
