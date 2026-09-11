import {expect, it} from 'vitest';
import {arcControlsSimilar} from '../scripts/v0/optimizer/arc_motion_control.ts';
import {arcControlProposals, ARC_POLICY_SCHEMA} from '../scripts/v0/optimizer/arc_control_policy.ts';
import {ArcControlMemory} from '../scripts/v0/optimizer/arc_memory.ts';
import {compileArcMotion} from '../scripts/v0/optimizer/arc_motion.ts';
import type {Spec} from '../scripts/v0/types.ts';

const control = {entry: 5, turn: -20, exit: -10, support: 12, bias: 0, offset: .1};
it('keeps guide topology and expressive shape alternatives in both proposal sources', () => {
  const controls = [control, {...control, bend: 20}, {...control, guideEnd: 0},
    {...control, turnFraction: .7}, {...control, bias: 1}, {...control, offset: 1}];
  const features = Array(57).fill(0), memory = new ArcControlMemory();
  const exemplars = controls.map(control => {
    const reference = {control, incoming: 5, span: 20};
    memory.rememberControl({...reference, features});
    return {features, controlReference: reference};
  });
  const model = {featureSchema: ARC_POLICY_SCHEMA, featureCount: 57, exemplars};
  expect(arcControlProposals(features, 5, 20, model, 6, 'inherited')).toHaveLength(1);
  expect(arcControlProposals(features, 5, 20, model, 6, 'geometry')).toEqual(controls);
  expect(memory.proposeControls(features, 5, 20, 6, 'geometry')).toEqual(controls);
  expect(arcControlsSimilar(control, {...control})).toBe(true);
  expect(arcControlsSimilar(control, {...control, guideEnd: 1})).toBe(false);
});

it('reuses a measured trajectory without forcing a demonstration or losing field absence', () => {
  const spec: Spec = {duration: 4, preroll: 5, jitter: 0,
    contacts: [.6, 1.2, 1.8, 2.4, 3, 3.6].map(t => ({t, impact: .4})),
    axes: {air: () => .5, speed: () => .5}};
  const options = {budget: 100000, samples: 80, channel: 12, radius: 24,
    bidirectional: true, impactWeight: 1, amplitudeWeight: 1 / 3,
    arrivalMode: 'speed', arrivalWeight: .3, headingWeight: .3, pruneGuidance: true};
  const original = compileArcMotion(spec, 17, options);
  expect(original.failure).toBeNull();
  const replay = compileArcMotion(spec, 17, {...options, samples: 8, memorySamples: 2,
    controlExamples: original.rows.map(r => ({control: r.control, incoming: r.incoming, span: r.span, features: r.features}))});
  expect(replay.failure).toBeNull();
  expect(replay.report.contacts.every(c => c.status === "hit")).toBe(true);
  expect(replay.stats.sim_frames).toBeLessThan(original.stats.sim_frames);

  expect(replay.track.lines.every(l => l.type === 0)).toBe(true);
});

it('rejects unsupported model behavior and invalid mixtures instead of silently ignoring them', () => {
  const features = Array(57).fill(0);
  const base = {featureSchema: ARC_POLICY_SCHEMA, featureCount: 57, exemplars: []};
  expect(() => arcControlProposals(features, 0, 20, {...base, proximityCorrection: .5}, 1)).toThrow('archived analogy runtime');
  for (const proposalWeights of [[1], [0, 0], [1, NaN], [1, -1]]) {
    expect(() => arcControlProposals(features, 0, 20, {...base, models: [base, base], proposalWeights}, 1)).toThrow('mixture weights');
  }
});

it('preserves exact local-memory controls at the same physical boundary', () => {
  const features = Array(57).fill(0), memory = new ArcControlMemory();
  const reference = {control: {...control, entry: .123456789, exit: -.987654321, support: 12.3456789}, incoming: 51.234567, span: 37.12345};
  memory.rememberControl({...reference, features});
  expect(memory.proposeControls(features, reference.incoming, reference.span, 1)[0]).toEqual(reference.control);
});

it('accepts a one-tree policy without requiring an odd-tree ensemble', () => {
  const target = [0, -.2, -.3, .5, 0, .1, 1, .4, 0, 0];
  const tree = {left: [-1], right: [-1], feature: [-2], threshold: [-2], value: [target]};
  const model = {featureSchema: ARC_POLICY_SCHEMA, featureCount: 57, trees: [tree]};
  const proposals = arcControlProposals(Array(57).fill(0), 20, 30, model, 3);
  expect(proposals).toHaveLength(3);
  expect(proposals[0]).toEqual(proposals[1]); expect(proposals[1]).toEqual(proposals[2]);
  expect(Object.values(proposals[0]).every(Number.isFinite)).toBe(true);
});
