/** Compiler-outcome-blind authoring. Run only when intentionally creating a new catalog identity. */
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { developmentCases, qualificationCases } from '../../benchmark/v2/catalog.ts';
import { policy } from '../../benchmark/v3/policy.ts';
import { caseGaps, caseSpec, sha, targets, type Case } from '../../benchmark/v3/model.ts';
import { applyJolt } from '../produce/seed.ts';
import { keyframes } from '../v0/core/curves.ts';
import { effectiveAxes, sliceTimeline } from '../v0/core/substrate.ts';
import { FPS, type Spec } from '../v0/types.ts';

const output = 'benchmark/v3'; mkdirSync(output, { recursive: true });
const cases: Case[] = [];
function materialize(spec: Spec, metadata: Omit<Case, 'durationFrames' | 'contacts' | 'samples' | 'air' | 'preroll' | 'start'>) {
  const durationFrames = Math.round(spec.duration * FPS);
  const contacts = spec.contacts.map(x => ({ frame: Math.round(x.t * FPS), ...(x.impact === undefined ? {} : { impact: x.impact }) })).sort((a, b) => a.frame - b.frame);
  const gaps = sliceTimeline(contacts.map(c => c.frame), durationFrames);
  const samples: Case['samples'] = {};
  for (const axis of ['speed', 'amplitude'] as const) if (spec.axes[axis]) samples[axis] = Array.from({ length: durationFrames + 1 }, (_, f) => spec.axes[axis]!(f / FPS) ?? null);
  const air: Case['air'] = gaps.map(g => {
    const n = g.endFrame - g.startFrame + 1;
    const requested = effectiveAxes(g, spec).air!;
    assert.ok(Number.isFinite(requested) && requested >= 0 && requested <= 1);
    // A contact after a >6-frame interval needs six airborne frames. The
    // authored upper bound leaves two grounded boundary samples. This is an
    // explicit input change, recorded against its original musical request.
    const min = !g.endsWithContact ? 0 : n - 1 > 6 ? 6 : 1, max = n - 2;
    assert.ok(min <= max, `${metadata.id}: impossible contact interval`);
    const count = Math.max(min, Math.min(max, Math.round(requested * n)));
    return { gap: g.index, airborneFrames: count, samples: n, requested, target: count / n,
      adjustment: requested < min / n ? 'landing_floor' : requested > max / n ? 'contact_support_ceiling' : 'quantization' };
  });
  const c: Case = { ...metadata, durationFrames, contacts, samples, air, preroll: spec.preroll ?? 5, ...(spec.start ? { start: spec.start } : {}) };
  const normalized = caseSpec(c);
  for (const g of caseGaps(c)) assert.ok(Math.abs(effectiveAxes(g, normalized).air! - targets(c, g).air!) < 1e-10);
  cases.push(c);
}

for (const entry of developmentCases) {
  const m = entry.case.metadata;
  materialize(applyJolt(entry.case.spec, -15), { id: 'bridge_' + m.id, title: m.title + ' — V3 bridge',
    parentId: 'bridge_' + (m.variant?.parentId ?? m.id), stratum: m.cohort === 'regression' ? 'legacy_regression' : m.cohort,
    group: m.cohort === 'development_music' ? 'believer' : m.originFamily, phases: m.phases,
    provenance: { kind: 'v2_bridge', source: entry.sourcePath, brief: 'Retain V2 contact frames, impacts, speed/amplitude samples, duration and phases. Author airtime as discrete counts and include the existing ending.' } });
}

type Recipe = { group: string; names: string[]; pulse: number; air: number; motif: number[]; brief: string; amplitude?: boolean };
const recipes: Recipe[] = [
  { group: 'regular_exceptions', names: ['harbor_return', 'crossing_lights', 'afterglow_turn'], pulse: .59, air: .53, motif: [1, 1, 1, 1.75, .75, .5, 1, 1], brief: 'Ordinary pulse, displaced answer and a spacious return.' },
  { group: 'subdivision_pickup', names: ['woven_pickups', 'pickup_answers', 'broken_triplets'], pulse: .64, air: .52, motif: [1, .5, .5, 1, 1.5, .5, 1, 1], brief: 'Short anticipations alternate with whole-pulse answers and recovery.' },
  { group: 'irregular_microtimed', names: ['late_letters', 'swing_exchange', 'offbeat_echoes'], pulse: .61, air: .54, motif: [.88, 1.12, .94, 1.06, 1.18, .82, 1, 1], brief: 'Played offsets and unequal subdivisions preserve a recognizable pulse.' },
  { group: 'cadence_transition', names: ['gear_changes', 'half_time_return', 'accelerando_reply'], pulse: .62, air: .53, motif: [1, 1, .75, 1.25, 1, 1, 1.5, .5], brief: 'Phrase-scale tempo changes meet independently changing energy targets.' },
  { group: 'spacious_amplitude', names: ['archipelago', 'wide_arc_dialogue', 'terraced_skies'], pulse: .66, air: .63, motif: [1.75, 1.25, 2, 1, 1.5, 1], amplitude: true, brief: 'Broad gaps alternate arc-height programs, restrained replies and controlled endings.' },
  { group: 'dense_musical', names: ['woven_pulse', 'density_release', 'compact_dialogue'], pulse: .61, air: .55, motif: [.5, .5, .75, .5, .75, 1.5, 1, 1.5], brief: 'Compact figures remain bounded and resolve into ordinary cadence.' },
  { group: 'high_air_energy', names: ['lifted_refrain', 'flight_and_return', 'open_canopy'], pulse: .64, air: .75, motif: [1, 1.25, 1.5, .75, 1.5, 1], brief: 'High flight occupancy with softer responses and a supported release.' },
  { group: 'sparse_transition', names: ['quiet_current', 'support_then_lift', 'rest_and_return'], pulse: .66, air: .28, motif: [1, 1.5, 1, 2, 1, 1.5], brief: 'Supported travel gives way to a lifted answer and settles again.' },
  { group: 'rapid_pickup_frontier', names: ['pickup_staircase', 'pickup_interruptions', 'pickup_recovery'], pulse: .61, air: .58, motif: [1, .5, .5, 1, 1, 1], brief: '200–300ms pickups occur in different incoming states, with ordinary recoveries.' },
  { group: 'dense_recovery_frontier', names: ['dense_short_then_long', 'interleaved_recovery', 'three_note_returns'], pulse: .62, air: .59, motif: [.4, .4, 1.2, 1, 1, 1], brief: 'Two- and three-contact clusters change placement; recovery remains part of the task.' },
  { group: 'low_air_frontier', names: ['supported_bridge', 'supported_speed_change', 'endurance_and_return'], pulse: .63, air: .25, motif: [1, 1, 1.25, .75, 1, 1], brief: 'Three extended supported passages with 2.5–7.5s gaps, speed changes and reentry.' },
  { group: 'legacy_transition_regression', names: ['energy_weave', 'alternating_intentions', 'recovery_mosaic'], pulse: .62, air: .52, motif: [1, 1.5, .5, .75, 1.25, 1], brief: 'Recompose useful supported/dense/open transitions instead of copying a short probe.' },
  { group: 'legacy_amplitude_regression', names: ['amplitude_reply', 'restrained_then_wide', 'arches_at_new_tempos'], pulse: .72, air: .61, motif: [1, 1.5, 1.25, 1, 1.75, 1], amplitude: true, brief: 'Height contrast is not locked to maximum speed or maximum flight occupancy.' },
];
const pulseOffsets = [-.025, .015, .045];
const forms = [[0, 1, 2, 3, 1, 4], [0, 2, 1, 4, 3, 1], [0, 3, 1, 2, 4, 2]];
for (const recipe of recipes) for (let variant = 0; variant < 3; variant++) {
  const id = recipe.names[variant], pulse = recipe.pulse + pulseOffsets[variant];
  const phaseEnds = variant === 0 ? [8, 18, 30, 40, 52, 60] : variant === 1 ? [9, 20, 29, 42, 51, 59] : [8, 19, 31, 40, 53, 62];
  const core = phaseEnds.at(-1)!, ending = [2.5, 3.5, 4.5][variant], duration = core + ending;
  const form = forms[variant];
  const phaseAt = (t: number) => Math.min(5, phaseEnds.findIndex(end => t < end) < 0 ? 5 : phaseEnds.findIndex(end => t < end));
  const contacts: Spec['contacts'] = [];
  const rideoutStarts = [12.5, 27.5, 44], rideoutDurations = [[2.5, 4.5, 6.5], [3, 5, 7], [3.5, 5.5, 7.5]][variant];
  let t = .55 + variant * .025, note = 0;
  const usedRideouts = new Set<number>();
  while (t < core - .2) {
    const phase = phaseAt(t), section = form[phase];
    const accents = [.64, .32, .53, .80, .38, .59, .28, .72];
    contacts.push({ t, impact: Math.max(.12, Math.min(.94, accents[(note + section + variant) % accents.length] + (phase === 3 ? .06 : 0))) });
    const motifIndex = (note + section * (variant + 1)) % recipe.motif.length;
    let gap = pulse * recipe.motif[motifIndex];
    if (recipe.group === 'cadence_transition') gap *= [1, .82, 1.22, .93, 1.08, 1][section];
    if (recipe.group === 'rapid_pickup_frontier' && (motifIndex === 1 || motifIndex === 2)) {
      const pickup = [.30, .275, .25, .225, .20][section]; gap = motifIndex === 1 ? pickup : pulse - pickup;
    }
    if (recipe.group === 'dense_recovery_frontier' && motifIndex < 2) gap = [.30, .275, .25, .225, .25][section];
    if (recipe.group === 'legacy_transition_regression' && phase % 3 === 1) gap *= 1.3;
    if (recipe.group === 'low_air_frontier') {
      const rideout = rideoutStarts.findIndex((start, i) => t >= start && !usedRideouts.has(i));
      if (rideout >= 0) { gap = rideoutDurations[rideout]; usedRideouts.add(rideout); }
    }
    t = Math.round((t + Math.max(.2, gap)) * 10000) / 10000; note++;
  }
  const knots = [0, ...phaseEnds.slice(0, -1), core, duration];
  const airLevels = [recipe.air - .06, recipe.air + .04, recipe.air - .09, recipe.air + .07, recipe.air, recipe.air - .04, recipe.air - .08, Math.max(.12, recipe.air - .15)];
  const speedLevels = [.57, .70, .62, .78, .67, .73, .60, .52].map(v => v + (variant - 1) * .025);
  const amplitudeLevels = [.15, .34, .22, .46, .28, .40, .25, .18].map(v => v + (variant - 1) * .035);
  const curve = (values: number[]) => keyframes(knots.map((at, i) => ({ t: at, v: values[(i + (variant === 1 && i > 0 && i < 6 ? 1 : 0)) % values.length], ease: 'smooth' as const })));
  const ordinaryAir = curve(airLevels);
  const longSpans = contacts.slice(1).flatMap((c, i) => c.t - contacts[i].t >= 2 ? [{ start: contacts[i].t, end: c.t }] : []);
  const spec: Spec = { duration, contacts, jitter: 0, preroll: 5,
    axes: { air: recipe.group === 'low_air_frontier' ? (time => longSpans.some(g => time > g.start && time < g.end) ? .045 + .01 * variant : ordinaryAir(time)) : ordinaryAir,
      speed: curve(speedLevels), ...(recipe.amplitude ? { amplitude: curve(amplitudeLevels) } : {}) } };
  const stratum = policy.strata.find(s => s.groups.some(g => g.id === recipe.group))!.id;
  const phases = phaseEnds.map((end, i) => ({ id: `phrase_${i + 1}`, start: i ? phaseEnds[i - 1] : 0, end, intent: `Phrase form ${form[i]}: ${recipe.brief}` }));
  phases.push({ id: 'ending', start: core, end: duration, intent: 'Controlled release through the actual end of the authored program.' });
  materialize(applyJolt(spec, -15), { id, title: id.replaceAll('_', ' '), parentId: id, group: recipe.group, stratum, phases,
    provenance: { kind: 'new_program', source: 'scripts/benchmark/v3_author.ts', grammar: recipe.group,
      brief: `${recipe.brief} Authored form ${form.join('-')}; pulse ${pulse.toFixed(3)}s; ending ${ending}s. The three programs share a family grammar and are not independent musical works.` } });
}
const works = ['amor_na_praia', 'luna_bala', 'tiki_tiki', 'shelter', 'amour_de_ma_vie'];
for (const [i, entry] of qualificationCases.entries()) {
  const m = entry.case.metadata;
  materialize(applyJolt(entry.case.spec, -15), { id: 'music_' + m.id, title: m.title, parentId: 'music_' + m.id,
    group: works[i], stratum: 'development_music', phases: m.phases,
    provenance: { kind: 'exposed_music_reference', source: entry.sourcePath,
      brief: 'Existing production work, already exposed through V2 monitoring. Broader music coverage, not a fresh holdout. V2 qualification remains unchanged.' } });
}
assert.equal(cases.length, 88);
assert.equal(new Set(cases.map(c => c.id)).size, 88);
const raw = Buffer.from(JSON.stringify(cases) + '\n'), compressed = gzipSync(raw, { level: 9 });
writeFileSync(output + '/specifications.json.gz', compressed);
const lock = { schema: 'line.benchmark-v3.catalog-lock.v1', status: 'authored-before-compiler-evaluation', specifications: cases.length,
  aggregationParents: new Set(cases.map(c => c.parentId)).size, specificationsSha256: sha(raw), compressedSha256: sha(compressed),
  authoringSourceSha256: sha(readFileSync(import.meta.filename)), policySha256: sha(readFileSync('benchmark/v3/policy.ts')),
  inputTransform: 'Materialized production jolt -15ms once, 40fps contact frames; original speed/amplitude samples retained. Airtime frozen as discrete per-gap counts.',
  noVisualAttestation: 'No new owner listening or video approval claimed. Conservative reuse of V2 musical families and exposed production material.',
};
writeFileSync(output + '/catalog.lock.json', JSON.stringify(lock, null, 2) + '\n');
const summary = cases.map(c => ({ id: c.id, parentId: c.parentId, stratum: c.stratum, group: c.group, provenance: c.provenance,
  seconds: c.durationFrames / 40, contacts: c.contacts.length, endingSeconds: (c.durationFrames - c.contacts.at(-1)!.frame) / 40,
  minimumGapSeconds: Math.min(...caseGaps(c).filter(g => g.endsWithContact).map(g => (g.endFrame - g.startFrame) / 40)),
  longestContactGapSeconds: Math.max(...caseGaps(c).filter(g => g.endsWithContact).map(g => (g.endFrame - g.startFrame) / 40)),
  airChanges: Object.fromEntries(['quantization', 'landing_floor', 'contact_support_ceiling'].map(reason => [reason, c.air.filter(a => a.adjustment === reason).length])),
  maximumAirAdjustment: Math.max(...c.air.map(a => Math.abs(a.requested - a.target))), phases: c.phases }));
writeFileSync(output + '/catalog-summary.json', JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify(lock, null, 2));
