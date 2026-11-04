import {expect, it} from 'vitest';
import {detect, DetectionContinuation, type RawFrame, type RawTrajectory} from '../scripts/lib/detector.ts';
import {accountContactImpacts} from '../scripts/lib/contact_impact.ts';
import {createArcCompileContext} from '../scripts/v0/optimizer/arc_compile_context.ts';
import {ArcObjectiveContinuation, arcDetectedTrajectoryObjective, arcSelectionObjective} from '../scripts/v0/optimizer/arc_objective.ts';
import type {ImpactAssessment, ImpactObservation} from '../scripts/v0/optimizer/impact_accounts.ts';
import {arcDetectedTrajectoryObjective as referenceAxes, arcSelectionObjective as referenceSelection} from './fixtures/arc_objective_reference.ts';

function row(frame: number, variant = 0): RawFrame {
  const contact = frame % 40 < 12 + variant;
  return {frame, position: {x: frame * 3, y: 20 * Math.sin(frame / 20 + variant)},
    velocity: {x: 3 + Math.sin(frame / 13 + variant), y: Math.cos(frame / 7 + variant)},
    sledContacts: contact ? ['PEG'] : [], contactLineIds: contact ? [1] : [], sledBroken: false, riderEjected: false};
}

for (const motion of [false, true]) for (const account of ['landing', 'valid', 'invalid'] as const) for (const engagementGainWeight of [0, .64]) {
  it(`matches frozen full scoring across prefix boundaries (${motion ? 'motion' : 'axes'}, ${account}, gain ${engagementGainWeight})`, () => {
    const ctx = createArcCompileContext({duration: 5, preroll: 0,
      contacts: [1, 2, 3, 4].map(t => ({t, impact: .4})),
      axes: {air: () => .4, speed: () => .6, amplitude: () => .2}},
    {budget: 200_000, motionQuality: motion ? {burstWeight: .64, calmWeight: 1} : undefined,
      impactSearch: {engagementGainWeight}});
    const impacts: ImpactAssessment | undefined = account === 'landing' ? undefined : {
      contract: 'line.strike.v3', events: [], targets: [], account: accountContactImpacts([], []), valid: account === 'valid'};
    const all = Array.from({length: 221}, (_, frame) => row(frame));
    const observe = (f: RawFrame, variant = 0): ImpactObservation => ({frame: f.frame, contact: !!f.sledContacts.length,
      solverGain: Math.sin(f.frame / 4 + variant), gravityGain: .1, speedBefore: 3});
    const completeScore = (raw: RawTrajectory, physical: ImpactObservation[] | undefined) =>
      referenceSelection(ctx, raw, physical, referenceAxes(detect(raw), ctx.gaps, .37, impacts));
    for (const cut of [0, 1, 2, 10, 38, 39, 40, 41, 79, 80, 159, 160, 199, 200, 219, 220]) {
      const prefix: RawTrajectory = {duration: cut, frames: all.slice(0, cut + 1)};
      const scorer = new ArcObjectiveContinuation(ctx, prefix, .37), detector = new DetectionContinuation(prefix);
      const prefixPhysical = prefix.frames.map(f => observe(f));
      for (const variant of [0, 1, 2, 0]) {
        const raw = {duration: 220, frames: prefix.frames.concat(all.slice(cut + 1).map(f => row(f.frame, variant)))};
        const physical = prefixPhysical.concat(raw.frames.slice(cut + 1).map(f => observe(f, variant)));
        const expected = completeScore(raw, physical);
        if (account === 'valid') expect(Number.isFinite(expected.loss)).toBe(true);
        expect(arcSelectionObjective(ctx, raw, physical, arcDetectedTrajectoryObjective(detect(raw), ctx.gaps, .37, impacts))).toStrictEqual(expected);
        detector.withDetection(raw, det => expect(scorer.score(raw, det, physical, impacts)).toStrictEqual(expected));
        // Physical contact may differ from sled contact. A replaced physical
        // prefix cannot reuse completed engagement sums from the first stream.
        const replacedPhysical = physical.map(f => ({...f, contact: true, solverGain: .1}));
        expect(scorer.score(raw, detect(raw), replacedPhysical, impacts)).toStrictEqual(completeScore(raw, replacedPhysical));
        expect(scorer.score(raw, detect(raw), undefined, impacts)).toStrictEqual(completeScore(raw, undefined));
        // A changed boundary cannot reuse the cached prefix; a later real
        // continuation must still see its original owned reductions.
        const replaced = {...raw, frames: raw.frames.map((f, i) => i <= cut ? row(i, 3) : f)};
        expect(scorer.score(replaced, detect(replaced), physical, impacts)).toStrictEqual(completeScore(replaced, physical));
      }
    }
  });
}

it('keeps an open engagement whole across every prefix boundary and scores only targeted axes', () => {
  const ctx = createArcCompileContext({duration: 5, preroll: 0, contacts: [1, 2, 3, 4].map(t => ({t, impact: .1})),
    axes: {speed: () => .6}}, {budget: 200_000, motionQuality: {burstWeight: .64, calmWeight: 1, calmLanding: true},
    impactSearch: {engagementGainWeight: .64}});
  const impacts: ImpactAssessment = {contract: 'line.strike.v3', events: [], targets: [], account: accountContactImpacts([], []), valid: true};
  const all = Array.from({length: 221}, (_, frame) => row(frame));
  for (const contact of [false, true]) for (const cut of [0, 1, 10, 39, 40, 41, 159, 160, 199, 200, 220]) {
    const prefix = {duration: cut, frames: all.slice(0, cut + 1)}, scorer = new ArcObjectiveContinuation(ctx, prefix, 0);
    const physicalPrefix = prefix.frames.map(f => ({frame: f.frame, contact, solverGain: .125, gravityGain: .1, speedBefore: 3}));
    for (const gain of [.25, -.75, .25]) {
      const raw = {duration: 220, frames: prefix.frames.concat(all.slice(cut + 1))};
      const physical = physicalPrefix.concat(raw.frames.slice(cut + 1).map(f => ({frame: f.frame, contact, solverGain: gain, gravityGain: .1, speedBefore: 3})));
      expect(scorer.score(raw, detect(raw), physical, impacts)).toStrictEqual(
        referenceSelection(ctx, raw, physical, referenceAxes(detect(raw), ctx.gaps, 0, impacts)));
    }
  }
});
