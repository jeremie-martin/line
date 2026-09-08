/** Causal guidance study. Every changed track is fully replayed in the frozen judge. */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { developmentCases } from '../../benchmark/v2/catalog.ts';
import { benchmarkPolicy } from '../../benchmark/v2/policy.ts';
import { applyJolt } from '../produce/seed.ts';
import { LineRiderEngine as Engine, disposeAllWasmEnginesForStudy } from '../lib/_lr_engine_wasm.ts';
import { extractRawTrajectory, detect, getPhysicsFrameCount, resetFrameCount, setPhysicsFrameLimit } from '../lib/detector.ts';
import { sliceTimeline, effectiveAxes, buildDriftReport } from '../v0/core/substrate.ts';
import { buildAxisContract, scoreV2Report } from '../v0/benchmark_v2/evaluator.ts';
import type { TrackLine } from '../v0/types.ts';

const arg = (name: string) => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const input = arg('input')!, output = arg('out')!;
const hash = (b: string | Buffer) => createHash('sha256').update(b).digest('hex');
const inputBytes = readFileSync(input);
if (hash(inputBytes) !== readFileSync(input + '.sha256', 'utf8').trim()) throw new Error('input checksum mismatch');
const saved = JSON.parse(inputBytes.toString()), track = saved.track;
const entry = developmentCases.find(e => e.case.metadata.id === saved.sourceId);
if (!entry || !output) throw new Error('require a development track and --out');
const spec = applyJolt(entry.case.spec, benchmarkPolicy.transform.joltMs);
const suite = JSON.parse(readFileSync('benchmark/v2/compat/suite-manifest.json', 'utf8'));
const baseline = JSON.parse(readFileSync('benchmark/v2/campaign-baseline.json', 'utf8'));
const judgeSha256 = hash(readFileSync('engine-rs/target/wasm32-unknown-unknown/release/lr_engine.wasm'));
if (judgeSha256 !== baseline.engine_artifact_fingerprint) throw new Error('judge identity mismatch');
const duration = Math.round(spec.duration * 40), frames = spec.contacts.map(c => Math.round(c.t * 40));
const gaps = sliceTimeline(frames, duration);
for (const g of gaps) { g.targets = effectiveAxes(g, spec); if (g.endsWithContact && spec.contacts[g.index].impact !== undefined) g.targets.impact = spec.contacts[g.index].impact; }
const groups = new Map<number, TrackLine[][]>();
for (const line of track.lines as TrackLine[]) {
  if (line.type !== 0) throw new Error('non-normal line');
  const id = Math.floor((line.id - 1000) / 10000), chains = groups.get(id) ?? [[]];
  const last = chains.at(-1)!.at(-1);
  if (last && (last.x2 !== line.x1 || last.y2 !== line.y1)) chains.push([]);
  chains.at(-1)!.push(line); groups.set(id, chains);
}
const roofs = [...groups].map(([id, chains]) => {
  if (chains.length > 2) throw new Error('disconnected geometry');
  return { id, lines: (chains[1] ?? []).slice().reverse() };
});
const roofIds = new Set(roofs.flatMap(g => g.lines.map(l => l.id)));
const write = (path: string, value: unknown) => { const body = JSON.stringify(value) + '\n'; mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, body); writeFileSync(path + '.sha256', hash(body) + '\n'); };
resetFrameCount(); setPhysicsFrameLimit(null);
try {
  const fullEngine = new Engine().setStart(track.startPosition, track.riders[0].startVelocity).addLine(track.lines);
  const full = extractRawTrajectory(fullEngine, track.duration), fullHash = hash(JSON.stringify(full));
  const contacts = new Map<number, { frames: Set<number>; bodies: Set<string>; updates: number }>();
  for (let f = 1; f <= track.duration; f++) for (const u of fullEngine.getUpdatesAtFrame(f)) {
    if (u.type !== 'CollisionUpdate' || !roofIds.has(u.id)) continue;
    const row = contacts.get(u.id) ?? { frames: new Set<number>(), bodies: new Set<string>(), updates: 0 };
    row.frames.add(f); row.updates++; for (const p of u.updated) row.bodies.add(p.id); contacts.set(u.id, row);
  }
  disposeAllWasmEnginesForStudy();
  const replay = (removed: Set<number>) => {
    const lines = (track.lines as TrackLine[]).filter(l => !removed.has(l.id));
    try {
      const raw = extractRawTrajectory(new Engine().setStart(track.startPosition, track.riders[0].startVelocity).addLine(lines), track.duration);
      const trajectorySha256 = hash(JSON.stringify(raw)), identical = trajectorySha256 === fullHash;
      const report = buildDriftReport(detect(raw), spec, gaps, frames, duration, [], gaps.map(g => ({ lines: lines.filter(l => Math.floor((l.id - 1000) / 10000) === g.index + 1) })) as any, gaps.map(g => g.targets));
      const score = scoreV2Report(report, spec.contacts.length, buildAxisContract(spec, Object.keys(benchmarkPolicy.componentWeights) as any), suite);
      return { removedSegments: removed.size, trajectorySha256, identical, firstDifference: identical ? null : raw.frames.findIndex((f, i) => JSON.stringify(f) !== JSON.stringify(full.frames[i])), terminus: report.terminus, score, missed: report.contacts.filter(c => c.status !== 'hit').length, offBeat: report.off_beat_landings.length };
    } finally { disposeAllWasmEnginesForStudy(); }
  };
  const reference = replay(new Set());
  if (!reference.identical || reference.score.score !== saved.score.score) throw new Error('reference replay/score mismatch');
  const rows: any[] = [], combined = new Set<number>();
  for (const roof of roofs) {
    const used = roof.lines.map((l, i) => contacts.has(l.id) ? i : -1).filter(i => i >= 0);
    // Keep one contiguous span, including a two-segment margin at both ends.
    const lo = used.length ? Math.max(0, Math.min(...used) - 2) : roof.lines.length;
    const hi = used.length ? Math.min(roof.lines.length, Math.max(...used) + 3) : roof.lines.length;
    const trimmed = new Set(roof.lines.filter((_, i) => i < lo || i >= hi).map(l => l.id));
    for (const id of trimmed) combined.add(id);
    const variants: Record<string, ReturnType<typeof replay>> = { absent: replay(new Set(roof.lines.map(l => l.id))) };
    if (used.length) {
      variants.earlyHalf = replay(new Set(roof.lines.slice(Math.ceil(roof.lines.length / 2)).map(l => l.id)));
      variants.lateHalf = replay(new Set(roof.lines.slice(0, Math.floor(roof.lines.length / 2)).map(l => l.id)));
      variants.contactSpan = replay(trimmed);
    }
    rows.push({ group: roof.id, segments: roof.lines.length, length: roof.lines.reduce((s, l) => s + Math.hypot(l.x2 - l.x1, l.y2 - l.y1), 0), contactedSegments: used.length, contactUpdates: used.reduce((s, i) => s + contacts.get(roof.lines[i].id)!.updates, 0), retainedSpan: [lo, hi], variants });
  }
  const combinedTrim = replay(combined);
  const record = { schema: 'line.arc-guidance-ablation.v1', researchOnly: true, sourceId: saved.sourceId, inputSha256: hash(inputBytes), implementationSha256: hash(readFileSync(import.meta.filename)), judgeSha256, reference, rows, combinedTrim, auditPhysicsFrames: getPhysicsFrameCount() };
  write(output, record);
  if (combinedTrim.identical) write(output.replace(/\.json$/, '.trimmed-track.json'), { ...track, lines: track.lines.filter((l: TrackLine) => !combined.has(l.id)) });
  console.log(JSON.stringify({ source: saved.sourceId, rails: rows.length, unused: rows.filter(r => r.contactedSegments === 0).length, individuallyRemovable: rows.filter(r => r.variants.absent.identical).length, combinedTrim, auditPhysicsFrames: record.auditPhysicsFrames }));
} finally { disposeAllWasmEnginesForStudy(); setPhysicsFrameLimit(null); }
