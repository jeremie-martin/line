/** Offline comparison on an already declared panel and verified native traces.
 * No new compilation, benchmark scoring, authoring or perceptual calibration.
 */
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {gunzipSync, gzipSync} from 'node:zlib';
import {contactEpisodes, responsePulses, matchInteractions, DEFAULT_PULSE, type Interaction} from './interaction_candidates.ts';
const arg = (k: string, d: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const out = arg('out', 'generated/interaction-candidates-20261002');
const panelPath = arg('panel', 'docs/evidence/interaction-panel-20261002.json');
const sha = (b: Buffer | string) => createHash('sha256').update(b).digest('hex');
const checked = (p: string) => {const b = readFileSync(p); assert.equal(sha(b), readFileSync(p + '.sha256', 'utf8').trim(), p); return b;};
const read = (p: string) => JSON.parse((p.endsWith('.gz') ? gunzipSync(checked(p)) : checked(p)).toString());
const panel = read(panelPath), audit = read('generated/beat-salience-20261001/audit.json');
assert.equal(panel.sourceAuditSha256, sha(checked('generated/beat-salience-20261001/audit.json')));
const raw = read('generated/beat-salience-20261001/frames.json.gz');
const accent = read('generated/ride-accents-20261002/frames.json.gz');
const results: any[] = [], clips: any[] = [];
const contactSettings = [0, 1, 2], pulseFloors = [.25, .5, 1], valleys = [.25, .4, .6, .85];
mkdirSync(out, {recursive: true});
for (const run of audit.runs.filter((r: any) => r.version === 'current')) {
  const record = read(run.path); assert.equal(sha(JSON.stringify(record.track)), run.trackHash);
  assert.ok(record.track.lines.every((l: any) => l.type === 0));
  const prior = raw.runs.find((r: any) => r.version === 'current' && r.song === run.song && r.seed === run.seed);
  const kinematics = accent.series.find((r: any) => r.id === `current-${run.song}-${run.seed}`);
  assert.equal(prior.trackHash, run.trackHash); assert.equal(kinematics.trackHash, run.trackHash);
  // Preserve the saved post-song grace too: a final landing's response window
  // may extend beyond the nominal music duration.
  const observations = prior.frames.map((f: any) => ({frame: f.f, correction: f.solverImpulse, contact: f.contacts.length > 0}));
  const contact = contactEpisodes(observations), pulse = responsePulses(observations);
  const beats = run.beats.map((b: any) => ({index: b.index, frame: b.t * 40, time: b.t, target: b.targetImpact, actualFrame: b.actualFrame, impact: b.impact}));
  const landings: Interaction[] = run.beats.map((b: any) => {
    const window = observations.slice(b.actualFrame, b.actualFrame + 7), peak = window.reduce((a: any, f: any) => f.correction > a.correction ? f : a);
    assert.equal(window.length, 7, 'complete original landing window required');
    assert.ok(Math.abs(peak.correction - b.peaks.solverImpulse.landingPeak) < 1e-8);
    return {start: b.actualFrame, end: b.actualFrame + 6, peakFrame: peak.frame, peak: peak.correction,
      responseSum: window.reduce((s: number, f: any) => s + f.correction, 0)};
  });
  const matching = (events: Interaction[]) => matchInteractions(events, beats.map((b: any) => b.frame), 4);
  const variants = [
    ...contactSettings.map(holes => ({method: 'contact', parameters: {holes}, events: contactEpisodes(observations, holes)})),
    ...pulseFloors.flatMap(floor => valleys.map(valleyFraction => ({method: 'pulse', parameters: {floor, valleyFraction, edgeFraction: .2},
      events: responsePulses(observations, {floor, valleyFraction, edgeFraction: .2})}))),
  ];
  const enriched = (events: Interaction[]) => events.map(e => ({...e,
    contacts: [...new Set(prior.frames.slice(e.start, e.end + 1).flatMap((f: any) => f.contacts))],
    scoredPeak: !prior.frames[e.peakFrame + 1]?.airborne && landings.some(l => e.peakFrame + 1 >= l.start && e.peakFrame + 1 <= l.end),
    overlappingLandingWindows: landings.flatMap((l, i) => e.start <= l.end && e.end >= l.start ? [i] : []),
  }));
  const full = {song: run.song, seed: run.seed, trackHash: run.trackHash, durationFrames: run.durationFrames,
    observationLastFrame: observations.at(-1).frame, beats, contact: enriched(contact), pulse: enriched(pulse), landings,
    matching: {contact: matching(contact), pulse: matching(pulse)},
    matchingSensitivity: ['start', 'peakFrame'].flatMap(clock => [2, 4, 6, 8].flatMap(tolerance =>
      [['contact', contact], ['pulse', pulse]].map(([method, events]) => ({method, ...matchInteractions(events as Interaction[], beats.map((b: any) => b.frame), tolerance, clock as 'start' | 'peakFrame')})))),
    variants: variants.map(v => ({...v, matching: matching(v.events)})),
  };
  results.push(full);
  for (const clip of panel.clips.filter((c: any) => c.song === run.song && c.seed === run.seed)) {
    assert.equal(clip.trackHash, run.trackHash); assert.equal(clip.artifactSha256, sha(checked(clip.record)));
    const [lo, hi] = clip.range.map((t: number) => t * 40), [flo, fhi] = clip.focus.map((t: number) => t * 40);
    const within = (e: Interaction) => e.end >= lo && e.start <= hi;
    const focusing = (e: Interaction) => e.end >= flo && e.start <= fhi;
    const annotate = (events: any[], method: 'contact' | 'pulse') => events.flatMap((e, i) => {
      if (!within(e)) return [];
      const match = full.matching[method].pairs.find(p => p.event === i);
      return [{...e, index: i, match: match ? {...match, beatTime: beats[match.beat].time} : null,
        eligibleBeats: full.matching[method].eligible[i].map(b => beats[b].time)}];
    });
    const frames = prior.frames.filter((f: any) => f.f >= Math.floor(lo) && f.f <= Math.ceil(hi)).map((f: any) => ({
      frame: f.f, correction: f.solverImpulse, pointRms: kinematics.frames[f.f].pointRmsImpulse,
      heading: kinematics.frames[f.f].headingDegrees, contacts: f.contacts, scoreStep: f.scoredStep,
      scored: landings.some(l => f.f >= l.start && f.f <= l.end), airborne: f.airborne,
    }));
    clips.push({...clip, frames, beats: beats.filter((b: any) => b.frame >= lo && b.frame <= hi),
      methods: {landing: landings.flatMap((e, i) => within(e) ? [{...e, index: i, impact: beats[i].impact, beatTime: beats[i].time}] : []),
        contact: annotate(full.contact, 'contact'), pulse: annotate(full.pulse, 'pulse')},
      counts: {landing: landings.filter(focusing).length, contact: contact.filter(focusing).length, pulse: pulse.filter(focusing).length},
      sensitivity: variants.map(v => ({method: v.method, parameters: v.parameters, count: v.events.filter(focusing).length,
        peaks: v.events.filter(focusing).map(e => e.peakFrame / 40)})),
    });
  }
}
clips.sort((a, b) => panel.clips.findIndex((c: any) => c.id === a.id) - panel.clips.findIndex((c: any) => c.id === b.id));
assert.equal(clips.length, panel.clips.length);
const methods = {
  landing: {title: 'A · Current landing windows', description: 'Unchanged scored landings. The whole-ride pulse observations additionally expose peaks not directly captured by the scoring gate; they do not change this impact number.'},
  contact: {title: 'B · Contact episodes', description: 'Consecutive contact by any rider point, without a strength floor. No construction IDs or support/guide labels enter grouping. One frame without contact separates episodes.'},
  pulse: {title: 'C · Response pulses', description: 'Body-mean response peaks of at least 0.5 world units/frame, near current or previous-frame contact. Peaks join unless the trough falls below 40% of the weaker peak. Extent uses a 20% response edge. These are provisional parameters, not perceptual thresholds.'},
};
const result = {schema: 'line.interaction-candidates.v1', panelSha256: sha(checked(panelPath)),
  harnessSha256: sha(readFileSync(import.meta.filename)), candidatesSha256: sha(readFileSync('scripts/gallery/interaction_candidates.ts')),
  sourceFramesSha256: sha(checked('generated/beat-salience-20261001/frames.json.gz')),
  kinematicsSha256: sha(checked('generated/ride-accents-20261002/frames.json.gz')),
  methods, defaults: {contactHoles: 0, pulse: DEFAULT_PULSE, match: {clock: 'start', toleranceFrames: 4}},
  notes: ['Known development examples plus predeclared contextual controls; not a blind validation or calibrated perceptual metric.',
    'All candidates read the same previously native-verified observations including 20 frames of post-song grace, preserving complete final landing windows; clipping happens after detection and matching.',
    'A uses the unchanged landing measure with supplementary C pulse observations, not a third independent event detector.',
    'B observes quiet and sustained engagement; C has a response floor. Counts describe different interpretations, not competing scores.',
    'The current 0–1 impact scale is not applied to raw episode or pulse responses.',
    'Four-frame matching is provisional; one-to-one matching preserves extras, missing targets and alternative eligible assignments. Both onset and peak clocks are swept at 50/100/150/200 ms.',
    'Pulse association with contact includes the immediately preceding frame; this is diagnostic proximity, not independent force attribution.',
    'Changing the grouping parameters must not be mistaken for changing the physical ride.'], clips, runs: results};
for (const [name, bytes] of [['audit.json.gz', gzipSync(JSON.stringify(result) + '\n')],
  ['review.json', Buffer.from(JSON.stringify({...result, runs: undefined}) + '\n')]] as const) {
  writeFileSync(join(out, name), bytes); writeFileSync(join(out, name + '.sha256'), sha(bytes) + '\n');
}
console.log(JSON.stringify({runs: results.length, beats: results.reduce((s, r) => s + r.beats.length, 0), clips: clips.map(c => ({id: c.id, ...c.counts,
  contactRange: c.sensitivity.filter((s: any) => s.method === 'contact').map((s: any) => s.count),
  pulseRange: [...new Set(c.sensitivity.filter((s: any) => s.method === 'pulse').map((s: any) => s.count))]}))}));
