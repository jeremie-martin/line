/** Exact saved-track experiment: impulse authority with release-state control.
 * No compiler search, invented state splice, or evaluator modification.
 * --plan freezes two baseline-only selections per source before interventions.
 */
import { createHash } from "node:crypto";
import { spawn, execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { developmentCases } from "../../benchmark/v2/catalog.ts";
import { LineRiderEngine, createLineFromJson } from "../lib/_lr_engine.ts";
import { disposeAllWasmEnginesForStudy } from "../lib/_lr_engine_wasm.ts";
import { detect, extractRawTrajectory, getRiderMetered, getPhysicsFrameCount } from "../lib/detector.ts";
import { buildDriftReport, contactRedirArcPxAtLanding, findAuthoredContactNearFrame } from "../v0/core/substrate.ts";
import { scoreDriftReport } from "../v0/score.ts";
import { FPS, IMPACT_WINDOW, impactToRawPx, type TrackLine, type Gap, type AxisValues } from "../v0/types.ts";

const arg = (key: string) => process.argv.slice(2).find(a => a.startsWith(`--${key}=`))?.slice(key.length + 3);
const input = resolve(arg("input") ?? "generated/benchmark-v2/impact-delivery-650-new/selected-fit-trace");
const out = resolve(arg("out") ?? "generated/benchmark-v2/impact-delivery-650-new/release-response");
const hash = (v: Buffer | string) => createHash("sha256").update(v).digest("hex");
const script = fileURLToPath(import.meta.url);
const solver = resolve("scripts/benchmark/impact_release_solve.py");
const implementation = hash(readFileSync(script)) + ":" + hash(readFileSync(solver));
const baseline = JSON.parse(readFileSync("benchmark/v2/campaign-baseline.json", "utf8"));
const engineHash = hash(readFileSync("engine-rs/target/wasm32-unknown-unknown/release/lr_engine.wasm"));
if (engineHash !== baseline.engine_artifact_fingerprint || process.env.LR_ENGINE !== "wasm") throw new Error("exact optimized WASM engine required");
const catalog = new Map(developmentCases.map(entry => [entry.case.metadata.id, entry.case.spec]));
mkdirSync(out, { recursive: true });

function read(path: string): any {
  const bytes = readFileSync(path);
  if (readFileSync(`${path}.sha256`, "utf8").split(/\s/)[0] !== hash(bytes)) throw new Error(`checksum mismatch: ${path}`);
  return JSON.parse(bytes.toString());
}
function write(path: string, value: unknown): void {
  const bytes = `${JSON.stringify(value)}\n`;
  writeFileSync(path, bytes);
  writeFileSync(`${path}.sha256`, `${hash(bytes)}  ${basename(path)}\n`);
}
type Coordinate = { left: number; right: number; x: number; y: number; nx: number; ny: number };
const connected = (a: TrackLine, b: TrackLine) => a.x2 === b.x1 && a.y2 === b.y1;

function geometry(track: any, row: any): Coordinate[] {
  const lines: TrackLine[] = track.lines;
  const owned = new Set<number>(row.frames.flatMap((f: any) => f.lineIds));
  const indices = lines.flatMap((line, index) => owned.has(line.id) ? [index] : []);
  if (!indices.length) return [];
  let first = Math.min(...indices), last = Math.max(...indices);
  while (first > 0 && connected(lines[first - 1], lines[first])) first--;
  while (last + 1 < lines.length && connected(lines[last], lines[last + 1])) last++;
  if (lines.slice(first, last + 1).some(line => line.type !== 0)) return [];
  const all: Coordinate[] = [];
  for (let i = first; i < last; i++) {
    const a = lines[i], b = lines[i + 1];
    if (!connected(a, b)) return [];
    const dx = b.x2 - a.x1, dy = b.y2 - a.y1, length = Math.hypot(dx, dy);
    if (length > 1e-9) all.push({ left: i, right: i + 1, x: a.x2, y: a.y2, nx: -dy / length, ny: dx / length });
  }
  // Uniform joint coverage, fixed before any perturbed result. Endpoints stay
  // fixed and both incident segments share each moved vertex exactly.
  return all.length <= 12 ? all : Array.from({ length: 12 }, (_, i) => all[Math.round(i * (all.length - 1) / 11)]);
}

function makePlan(): any {
  const summary = read(resolve(input, "summary.json"));
  if (summary.sources !== 44 || summary.candidateFingerprint !== baseline.candidate_fingerprint) throw new Error("wrong baseline census");
  const sources = summary.perSource.map((source: any) => {
    const recordPath = resolve(input, `${source.sourceId}.json`);
    const trackPath = resolve(input, `${source.sourceId}.track.json`);
    const record = read(recordPath), track = read(trackPath);
    const eligible = record.rows.filter((row: any) => row.geometryMatches && row.actualFrame !== null &&
      row.finalAxes.impact.target - row.finalImpact >= 0.05 && row.nextGapFrames !== null &&
      row.targetFrame + row.nextGapFrames - 2 > row.actualFrame + IMPACT_WINDOW && geometry(track, row).length >= 3);
    const selected: any[] = [];
    for (const fraction of [1 / 3, 2 / 3]) {
      const candidates = eligible.filter((row: any) => !selected.some(s => s.gapIndex === row.gapIndex));
      candidates.sort((a: any, b: any) => Math.abs(a.targetFrame / track.duration - fraction) - Math.abs(b.targetFrame / track.duration - fraction) || a.gapIndex - b.gapIndex);
      if (candidates.length) {
        const row = candidates[0];
        selected.push({ gapIndex: row.gapIndex, impactFrame: row.actualFrame, targetFrame: row.targetFrame, gapFrames: row.gapFrames,
          releaseFrame: Math.min(row.actualFrame + 12, row.targetFrame + row.nextGapFrames - 2),
          speed: Math.hypot(row.incomingVelocity.x, row.incomingVelocity.y),
          requestedRawGain: 0.25 * (impactToRawPx(row.finalAxes.impact.target) - row.rawImpulse),
          coordinates: geometry(track, row) });
      }
    }
    return { sourceId: source.sourceId, recordSha256: hash(readFileSync(recordPath)),
      trackSha256: hash(readFileSync(trackPath)), eligible: eligible.length, selected };
  });
  return { schema: "line.impact-release-response-plan.v1", implementation, engineHash,
    candidateFingerprint: baseline.candidate_fingerprint, input,
    law: { requestResidualFraction: 0.25, finiteDifferenceSteps: [0.001, 0.0005],
      maximumVertexDisplacementInSpeedFrames: 0.1, maximumRelativeDerivativeDisagreement: 0.25,
      releaseRidge: 1e-6, iterations: 1, arms: ["impulse_only", "release_constrained"] }, sources };
}

function state(engine: any, frame: number): { key: string; values: number[]; intact: boolean } {
  const packet = getRiderMetered(engine, frame).ballisticState();
  const values = Object.keys(packet.points).sort().flatMap(id => {
    const p = packet.points[id];
    return [p.x, p.y, p.prevX, p.prevY, p.vx, p.vy];
  });
  return { key: JSON.stringify(packet), values, intact: packet.riderMounted && packet.sledIntact };
}
function buildEngine(track: any): any {
  let engine = new LineRiderEngine().setStart(track.startPosition, track.riders[0].startVelocity);
  engine = engine.addLine(track.lines.map((line: TrackLine) => createLineFromJson(line)));
  return engine;
}
function deform(track: any, selection: any, controls: number[]): any {
  const lines: TrackLine[] = track.lines.map((line: TrackLine) => ({ ...line }));
  selection.coordinates.forEach((coordinate: Coordinate, index: number) => {
    if (controls[index] === 0) return;
    const displacement = selection.speed * controls[index];
    const x = coordinate.x + displacement * coordinate.nx;
    const y = coordinate.y + displacement * coordinate.ny;
    lines[coordinate.left].x2 = x; lines[coordinate.left].y2 = y;
    lines[coordinate.right].x1 = x; lines[coordinate.right].y1 = y;
  });
  return { ...track, lines };
}
function probe(track: any, selection: any): any {
  try {
    const engine = buildEngine(track);
    const prefix = state(engine, selection.impactFrame - 1);
    const det = detect(extractRawTrajectory(engine, selection.releaseFrame));
    const release = state(engine, selection.releaseFrame);
    const event = findAuthoredContactNearFrame(det, selection.targetFrame, 1, selection.gapFrames);
    const impulse = contactRedirArcPxAtLanding(det, selection.impactFrame);
    return { prefix: prefix.key, release: release.values, intact: release.intact,
      contact: event?.frame === selection.impactFrame, impulse: impulse ?? null };
  } finally { disposeAllWasmEnginesForStudy(); }
}
function scoreTrack(track: any, record: any): any {
  try {
    const engine = buildEngine(track);
    const det = detect(extractRawTrajectory(engine, track.duration));
    const spec = catalog.get(record.sourceId)!;
    const gaps: Gap[] = record.rows.map((row: any, index: number) => ({ index: row.gapIndex,
      startFrame: index === 0 ? 0 : record.rows[index - 1].targetFrame, endFrame: row.targetFrame,
      endsWithContact: true, targets: Object.fromEntries(Object.entries(row.finalAxes).map(([axis, value]: [string, any]) => [axis, value.target])) }));
    const contacts = gaps.map(gap => ({ t: gap.endFrame / FPS, impact: gap.targets.impact }));
    const fits = gaps.map(() => ({ arc: null, geometry: "lines" as const, lines: [], achieved: {}, cost: 0 }));
    const report = buildDriftReport(det, { ...spec, contacts }, gaps, gaps.map(gap => gap.endFrame),
      Math.round(spec.duration * FPS), [], fits, gaps.map(gap => gap.targets));
    const score = scoreDriftReport(report, { totalFrames: Math.round(spec.duration * FPS) });
    return { valid: score.contract_passed, score: score.contract_passed ? score.score : 0,
      terminus: report.terminus, missing: report.contacts.filter(c => c.status !== "hit").length,
      offBeat: report.off_beat_landings.length, gaps: report.gaps.map(gap => ({ gapIndex: gap.gap_index, axes: gap.axes })) };
  } finally { disposeAllWasmEnginesForStudy(); }
}
const norm = (a: number[]) => Math.hypot(...a);

export { read, write, probe, scoreTrack, deform, geometry, state, buildEngine };

function runSource(plan: any, source: any): void {
  const started = performance.now(), frameStart = getPhysicsFrameCount();
  const record = read(resolve(input, `${source.sourceId}.json`)), track = read(resolve(input, `${source.sourceId}.track.json`));
  if (hash(readFileSync(resolve(input, `${source.sourceId}.json`))) !== source.recordSha256 ||
      hash(readFileSync(resolve(input, `${source.sourceId}.track.json`))) !== source.trackSha256) throw new Error("plan input changed");
  const baselineScore = scoreTrack(track, record);
  if (!baselineScore.valid || Math.abs(baselineScore.score - record.score) > 1e-9) throw new Error(`${source.sourceId}: baseline full-score replay mismatch`);
  for (const row of record.rows) {
    const replay = baselineScore.gaps.find((g: any) => g.gapIndex === row.gapIndex);
    for (const [axis, value] of Object.entries(row.finalAxes) as Array<[string, any]>) {
      if (replay?.axes[axis]?.achieved !== value.achieved) throw new Error(`${source.sourceId}: baseline axis mismatch`);
    }
  }
  const states = source.selected.map((selection: any) => {
    const zero = Array(selection.coordinates.length).fill(0);
    if (JSON.stringify(deform(track, selection, zero)) !== JSON.stringify(track)) throw new Error("zero geometry is not exact");
    const base = probe(track, selection);
    const row = record.rows.find((row: any) => row.gapIndex === selection.gapIndex);
    if (!base.contact || !base.intact || Math.abs(base.impulse - row.rawImpulse) > 1e-9) throw new Error("base local replay mismatch");
    const columns = selection.coordinates.map((_: any, index: number) => {
      const stencil = [0.001, -0.001, 0.0005, -0.0005].map(step => {
        const controls = zero.slice(); controls[index] = step;
        const measured = probe(deform(track, selection, controls), selection);
        return { step, ...measured };
      });
      if (stencil.some(value => !value.intact || !value.contact || value.prefix !== base.prefix || value.impulse === null)) {
        return { index, eligible: false, reason: "contact_or_prefix_changed" };
      }
      const derivative = (plus: any, minus: any, span: number) => [
        (plus.impulse - minus.impulse) / (selection.speed * span),
        ...plus.release.map((value: number, i: number) => (value - minus.release[i]) / (selection.speed * span)),
      ];
      const broad = derivative(stencil[0], stencil[1], 0.002), fine = derivative(stencil[2], stencil[3], 0.001);
      const disagreement = norm(broad.map((value, i) => value - fine[i])) / Math.max(norm(fine), 1e-12);
      return { index, eligible: disagreement <= 0.25 && norm(fine) > 1e-9,
        reason: disagreement > 0.25 ? "unstable_derivative" : norm(fine) <= 1e-9 ? "inactive_coordinate" : null,
        disagreement, impulseDerivative: fine[0], releaseDerivative: fine.slice(1) };
    });
    const stable = columns.filter((c: any) => c.eligible);
    const solved = stable.length ? JSON.parse(execFileSync("python", [solver], {
      input: JSON.stringify({ gradient: stable.map((c: any) => c.impulseDerivative),
        jacobian: base.release.map((_: any, i: number) => stable.map((c: any) => c.releaseDerivative[i])),
        request: selection.requestedRawGain / selection.speed }), encoding: "utf8",
      env: { ...process.env, OPENBLAS_NUM_THREADS: "1", OMP_NUM_THREADS: "1" },
    })) : { arms: {}, reason: "no_stable_coordinates" };
    const arms = Object.entries(solved.arms).map(([name, solution]: [string, any]) => {
      if (!solution.controls) return { name, ...solution };
      const controls = zero.slice(); stable.forEach((c: any, i: number) => controls[c.index] = solution.controls[i]);
      const changed = deform(track, selection, controls);
      const measured = probe(changed, selection);
      // Keep every outcome, including broken prefixes and failed complete
      // continuations. An unchanged fallback is not an intervention success.
      const full = scoreTrack(changed, record);
      const prefixExact = measured.prefix === base.prefix;
      const rawImpulseGain = measured.impulse - base.impulse;
      const releaseL2 = norm(measured.release.map((value: number, i: number) => (value - base.release[i]) / selection.speed));
      const result = { name, ...solution, controls, prefixExact, contact: measured.contact, intact: measured.intact,
        rawImpulseGain, releaseL2, valid: full.valid, score: full.score, scoreDelta: full.score - baselineScore.score,
        missing: full.missing, offBeat: full.offBeat, terminus: full.terminus,
        currentAxes: full.gaps.find((g: any) => g.gapIndex === selection.gapIndex)?.axes ?? null,
        nextAxes: full.gaps.find((g: any) => g.gapIndex === selection.gapIndex + 1)?.axes ?? null };
      if (prefixExact && measured.contact && measured.intact && rawImpulseGain > 0 && full.valid && result.scoreDelta > 0) {
        write(resolve(out, `${source.sourceId}-g${selection.gapIndex}-${name}.track.json`), changed);
      }
      return result;
    });
    return { gapIndex: selection.gapIndex, impactFrame: selection.impactFrame, releaseFrame: selection.releaseFrame,
      dimensions: zero.length, stableDimensions: stable.length, requestedRawGain: selection.requestedRawGain,
      columns, singularValues: solved.singularValues ?? [], rank: solved.rank ?? 0, condition: solved.condition ?? null, arms };
  });
  write(resolve(out, `${source.sourceId}.json`), { schema: "line.impact-release-response.v1", implementation,
    planSha256: hash(readFileSync(resolve(out, "plan.json"))), sourceId: source.sourceId,
    baselineScore: baselineScore.score, baselineAxesExact: true, states,
    physicsFrames: getPhysicsFrameCount() - frameStart, elapsedMs: performance.now() - started });
}

if (resolve(process.argv[1] ?? "") === script) {
if (process.argv.includes("--plan")) {
  const path = resolve(out, "plan.json");
  if (existsSync(path)) throw new Error("plan already exists; retain it instead of replacing a frozen experiment");
  const plan = makePlan(); write(path, plan);
  console.log(JSON.stringify({ sources: plan.sources.length, states: plan.sources.reduce((n: number, source: any) => n + source.selected.length, 0), implementation }));
} else {
  const plan = read(resolve(out, "plan.json"));
  if (plan.implementation !== implementation || plan.engineHash !== engineHash || plan.input !== input) throw new Error("frozen experiment identity changed");
  const worker = arg("worker");
  if (worker) {
    const source = plan.sources.find((source: any) => source.sourceId === worker);
    if (!source) throw new Error("unknown worker source");
    runSource(plan, source);
  } else {
    const jobs = Number(arg("jobs") ?? "8");
    if (!Number.isSafeInteger(jobs) || jobs < 1 || jobs > 48) throw new Error("invalid jobs");
    const queue = plan.sources.filter((source: any) => {
      const path = resolve(out, `${source.sourceId}.json`);
      if (!existsSync(path)) return true;
      const result = read(path);
      if (result.implementation !== implementation || result.planSha256 !== hash(readFileSync(resolve(out, "plan.json")))) throw new Error("incompatible checkpoint");
      return false;
    });
    const failures: string[] = [];
    await Promise.all(Array.from({ length: Math.min(jobs, queue.length) }, async () => {
      while (queue.length) {
        const source = queue.shift();
        const code = await new Promise<number | null>((done, reject) => {
          const child = spawn(process.execPath, ["--import", "tsx", script, `--worker=${source.sourceId}`, `--input=${input}`, `--out=${out}`], { stdio: ["ignore", "ignore", "inherit"] });
          child.on("error", reject); child.on("exit", done);
        });
        if (code !== 0) failures.push(`${source.sourceId}: ${code}`);
        else process.stderr.write(`${source.sourceId}: complete\n`);
      }
    }));
    if (failures.length) throw new Error(failures.join("\n"));
    const results = plan.sources.map((source: any) => read(resolve(out, `${source.sourceId}.json`)));
    const states = results.flatMap((source: any) => source.states);
    const summary = { schema: "line.impact-release-response-summary.v1", implementation,
      planSha256: hash(readFileSync(resolve(out, "plan.json"))), sources: results.length, states: states.length,
      baselineAxesExact: results.every((r: any) => r.baselineAxesExact),
      physicsFrames: results.reduce((s: number, r: any) => s + r.physicsFrames, 0),
      workerSeconds: results.reduce((s: number, r: any) => s + r.elapsedMs / 1000, 0),
      arms: Object.fromEntries(plan.law.arms.map((name: string) => {
        const arms = states.flatMap((state: any) => state.arms.filter((arm: any) => arm.name === name && arm.controls));
        const viable = arms.filter((a: any) => a.prefixExact && a.contact && a.intact && a.valid);
        return [name, { attempted: arms.length, unchangedPrefix: arms.filter((a: any) => a.prefixExact).length,
          validSuffixes: viable.length, positiveImpulse: viable.filter((a: any) => a.rawImpulseGain > 0).length,
          positiveComplete: viable.filter((a: any) => a.rawImpulseGain > 0 && a.scoreDelta > 0).length,
          scoreDeltaSum: arms.reduce((s: number, a: any) => s + a.scoreDelta, 0),
          validScoreDeltaSum: viable.reduce((s: number, a: any) => s + a.scoreDelta, 0) }];
      })) };
    write(resolve(out, "summary.json"), summary); console.log(JSON.stringify(summary, null, 2));
  }
}
}
