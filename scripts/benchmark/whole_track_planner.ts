/** Exact physical prefix beam with state-conditioned catch and release synthesis.
 * Saved tracks are warm starts; all search work is additional research compute.
 */
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { developmentCases } from "../../benchmark/v2/catalog.ts";
import { benchmarkPolicy } from "../../benchmark/v2/policy.ts";
import { applyJolt } from "../produce/seed.ts";
import { LineRiderEngine, createLineFromJson } from "../lib/_lr_engine.ts";
import { disposeAllWasmEnginesForStudy } from "../lib/_lr_engine_wasm.ts";
import { detect, extractRawTrajectory, getRiderMetered, getPhysicsFrameCount } from "../lib/detector.ts";
import { buildDriftReport, findAuthoredContactNearFrame, contactLineIdsAt } from "../v0/core/substrate.ts";
import { detectWindow } from "../v0/core/candidate.ts";
import { measureGapAxes } from "../v0/core/measure.ts";
import { readTargetStateFromRider, sampleArcPlacementGeometry } from "../v0/arc_placement.ts";
import { arcProposalTargetsForGap } from "../v0/optimizer/arc_proposal.ts";
import { makeRng } from "../lib/rng.ts";
import { buildAxisContract, scoreV2Report, summarizeDevelopmentBudget } from "../v0/benchmark_v2/evaluator.ts";
import { shapeCatch, transportCatch, setCatchEnergy, type ArrivalFrame } from "./whole_track_controls.ts";
import { releaseProgram } from "./contact_program.ts";
import { nativeRailLayers } from "./native_rail_layers.ts";
import { contactPulse } from "./contact_pulse.ts";
import { collectiveContactPulse } from "./collective_contact_pulse.ts";
import { PLANNER_FEATURE_VERSION, plannerContextFeatures, plannerCandidateFeatures } from "./planner_features.ts";
import { predictPlannerCandidate } from "./planner_student.ts";
import { authoredSpeedToPx, speedPxToAuthored, impactToRawPx, normImpact, type TrackLine } from "../v0/types.ts";

const arg = (key: string) => process.argv.slice(2).find(a => a.startsWith(`--${key}=`))?.slice(key.length + 3);
const input = resolve(arg("input") ?? "generated/benchmark-v2/impact-delivery-650-new/interrupted-support-capture");
const out = resolve(arg("out") ?? "generated/benchmark-v2/unrestricted-650/physical-prefix-beam");
const warmStart = arg("warm-start") ? resolve(arg("warm-start")!) : null;
const modelPath = arg("model") ? resolve(arg("model")!) : null;
const script = fileURLToPath(import.meta.url);
const hash = (v: string | Buffer) => createHash("sha256").update(v).digest("hex");
const implementation = [script, resolve("scripts/benchmark/whole_track_controls.ts"), resolve("scripts/benchmark/contact_program.ts"),
  resolve("scripts/benchmark/native_rail_layers.ts")]
  .concat(resolve("scripts/benchmark/contact_pulse.ts"))
  .concat(resolve("scripts/benchmark/collective_contact_pulse.ts"))
  .concat(resolve("scripts/benchmark/planner_features.ts"))
  .concat(resolve("scripts/benchmark/planner_student.ts"))
  .map(p => hash(readFileSync(p))).join(":");
const baseline = JSON.parse(readFileSync("benchmark/v2/campaign-baseline.json", "utf8"));
const suite = JSON.parse(readFileSync("benchmark/v2/compat/suite-manifest.json", "utf8"));
const suiteHash = hash(readFileSync("benchmark/v2/compat/suite-manifest.json"));
const engineHash = hash(readFileSync("engine-rs/target/wasm32-unknown-unknown/release/lr_engine.wasm"));
if (process.env.LR_ENGINE !== "wasm" || engineHash !== baseline.engine_artifact_fingerprint) throw new Error("frozen exact engine required");
mkdirSync(out, { recursive: true });
const read = (p: string) => {
  const b = readFileSync(p);
  if (readFileSync(`${p}.sha256`, "utf8").split(/\s/)[0] !== hash(b)) throw new Error(`checksum mismatch: ${p}`);
  return JSON.parse(b.toString());
};
const write = (p: string, v: any) => {
  const b = `${JSON.stringify(v)}\n`;
  writeFileSync(p, b); writeFileSync(`${p}.sha256`, `${hash(b)}  ${basename(p)}\n`);
};
const student = modelPath ? read(modelPath) : null;
if (student && (student.schema !== "line.physical-planner-model.v1" ||
    student.featureVersion !== PLANNER_FEATURE_VERSION || student.inputDtype !== "float32")) throw new Error("unsupported planner model");
const lineKey = (lines: readonly TrackLine[]) => JSON.stringify(lines.map(l => [l.id, l.type, l.x1, l.y1, l.x2, l.y2,
  !!l.flipped, !!l.leftExtended, !!l.rightExtended]));
const freshEngine = (track: any) => new LineRiderEngine().setStart(track.startPosition, track.riders[0].startVelocity);
const frameAt = (engine: any, frame: number): ArrivalFrame => {
  const rider = getRiderMetered(engine, frame);
  return readTargetStateFromRider(rider, rider.position.x, rider.position.y);
};
const packetAt = (engine: any, frame: number) => JSON.stringify(getRiderMetered(engine, frame).ballisticState());
const weights = benchmarkPolicy.componentWeights as Record<string, number>;

type Node = { engine: any; fits: any[]; sse: Record<string, number>; value: number;
  original: boolean; id: number; parent: number; action: any; preview?: any; embedding?: number[] };

function worker(source: any, plan: any, planSha256: string): void {
  const started = performance.now(), framesStart = getPhysicsFrameCount(), sourceId = source.sourceId;
  const corpusPath = resolve(out, `${sourceId}.training.jsonl.gz`);
  if (plan.collect) writeFileSync(corpusPath, "");
  const paths = ["capture", "track", "report"].map(kind => resolve(input, `${sourceId}.${kind}.json`));
  paths.forEach((p, i) => { if (hash(readFileSync(p)) !== source.inputHashes[i]) throw new Error("frozen input changed"); });
  const [capture, capturedTrack, capturedReport] = paths.map(read);
  let track = capturedTrack, savedReport = capturedReport;
  if (plan.warmStart) {
    const warmPaths = ["track", "report"].map(kind => resolve(plan.warmStart, `${sourceId}.${kind}.json`));
    warmPaths.forEach((p, i) => { if (hash(readFileSync(p)) !== source.warmHashes[i]) throw new Error("warm start changed"); });
    [track, savedReport] = warmPaths.map(read);
  }
  if (capture.candidateFingerprint !== baseline.candidate_fingerprint) throw new Error("wrong captured compiler");
  const spec = applyJolt(developmentCases.find(e => e.case.metadata.id === sourceId)!.case.spec, benchmarkPolicy.transform.joltMs);
  const contract = buildAxisContract(spec, Object.keys(weights) as any);
  const ctx = capture.context;
  let originals = capture.snapshot.node.search.prefixFits;
  const startLines = capture.snapshot.node.startLines;
  if (plan.warmStart) {
    const owners = new Map<number, number>();
    originals.forEach((fit: any, i: number) => fit?.lines.forEach((l: TrackLine) => owners.set(l.id, i)));
    const grouped: TrackLine[][] = originals.map(() => []);
    const startIds = new Set(startLines.map((l: TrackLine) => l.id));
    for (const line of track.lines as TrackLine[]) {
      if (startIds.has(line.id)) continue;
      const owner = owners.get(line.id) ?? (line.id >= 1000000 ? Math.floor((line.id - 1000000) / 1000) : -1);
      if (!originals[owner]) throw new Error("unowned warm-start geometry");
      grouped[owner].push(line);
    }
    originals = originals.map((fit: any, i: number) => fit === null ? null : { ...fit, lines: grouped[i] });
  }
  if (lineKey([...startLines, ...originals.flatMap((f: any) => f?.lines ?? [])]) !== lineKey(track.lines)) throw new Error("incomplete geometry ownership");
  const originalScore = scoreV2Report(savedReport, spec.contacts.length, contract, suite);
  const capturedScore = scoreV2Report(capturedReport, spec.contacts.length, contract, suite);
  const scoreFits = (engine: any, fits: any[]) => {
    const report = buildDriftReport(detect(extractRawTrajectory(engine, track.duration)), spec,
      ctx.gaps, ctx.allContactFrames, ctx.durationFrames, [], fits, ctx.gapAxisTargets);
    return { report, score: scoreV2Report(report, spec.contacts.length, contract, suite) };
  };
  const references: Array<ArrivalFrame | null> = [], baselineLocal: any[] = [];
  let serial = 0;
  const counts: Record<string, number> = {}, totalSse: Record<string, number> = {};
  for (const g of savedReport.gaps) for (const [axis, a] of Object.entries(g.axes) as Array<[string, any]>) {
    if (!weights[axis]) continue;
    counts[axis] = (counts[axis] ?? 0) + 1;
    totalSse[axis] = (totalSse[axis] ?? 0) + a.error ** 2;
  }
  // The fixed scorer takes the square root AFTER combining per-axis MSEs.
  // Combining per-axis RMSs instead would underweight a large remaining error.
  const value = (sse: Record<string, number>) => Math.sqrt(Object.keys(counts)
    .reduce((s, a) => s + weights[a] * Math.max(0, sse[a]) / counts[a], 0));
  const nextFor = (i: number) => ctx.gaps.slice(i + 1).find((g: any) => g.endsWithContact);
  const endFor = (i: number) => nextFor(i)?.endFrame - 2 || track.duration;
  const local = (engine: any, i: number, lines: TrackLine[]) => {
    const gap = ctx.gaps[i], end = endFor(i);
    const det = detectWindow(engine, Math.max(0, gap.startFrame - 8), end);
    const event = findAuthoredContactNearFrame(det, gap.endFrame, 1, gap.endFrame - gap.startFrame);
    const offbeat = det.events.filter(e => e.type === "landing" && e.frame >= gap.startFrame &&
      !ctx.allContactFrames.some((f: number) => Math.abs(f - e.frame) <= 1));
    const next = nextFor(i);
    return { valid: det.terminus.reason === "endOfSpec" && !!event && offbeat.length === 0,
      reason: det.terminus.reason !== "endOfSpec" ? det.terminus.reason : !event ? "missed_contact" : offbeat.length ? "offbeat" : null,
      achieved: measureGapAxes(det, gap, lines, gap.endFrame),
      impactLineIds: plan.pulses ? [...new Set(Array.from({ length: Math.max(0, Math.min(7, end - gap.endFrame + 1)) },
        (_, k) => contactLineIdsAt(det, gap.endFrame + k)).flat())] : undefined,
      preview: next && det.terminus.reason === "endOfSpec" ? measureGapAxes(det, next, [], end) : null };
  };
  let winner: any, calibrationFrames = 0;
  try {
    let engine = freshEngine(track).addLine(startLines.map(createLineFromJson));
    for (let i = 0; i < originals.length; i++) {
      const fit = originals[i];
      references.push(fit === null ? null : frameAt(engine, ctx.gaps[i].endFrame));
      if (fit !== null) engine = engine.addLine(fit.lines.map(createLineFromJson));
      baselineLocal.push(fit === null ? null : local(engine, i, fit.lines));
    }
    const neutral = scoreFits(engine, originals);
    if (!neutral.score.valid || JSON.stringify(neutral.score) !== JSON.stringify(originalScore) ||
        JSON.stringify(neutral.report) !== JSON.stringify(savedReport)) {
      write(resolve(out, `${sourceId}.neutral-failure.json`), { neutral, originalScore, savedReport,
        frames: getPhysicsFrameCount() - framesStart });
      throw new Error("neutral exact replay mismatch");
    }
    winner = { ...neutral, fits: originals, actions: [] };
  } finally { disposeAllWasmEnginesForStudy(); }
  calibrationFrames = getPhysicsFrameCount() - framesStart;
  const steps: any[] = [], nodes = new Map<number, any>();
  const failures: Record<string, number> = {};
  let trials = 0, validTrials = 0, filteredProposals = 0, generationFrames = 0, rebaseFrames = 0;
  try {
    const engine = freshEngine(track).addLine(startLines.map(createLineFromJson));
    let beam: Node[] = [{ engine, fits: [], sse: { ...totalSse }, value: value(totalSse), original: true, id: serial++, parent: -1, action: null }];
    for (let i = 0; i < originals.length; i++) {
      const fit = originals[i], gap = ctx.gaps[i];
      if (plan.rebaseEvery > 0 && i > 0 && i % plan.rebaseEvery === 0) {
        // The native lineage retains all historical patch nodes until every
        // handle is released. Cold reconstruction bounds that research memory;
        // it is ordinary, charged simulation, never an injected rider state.
        const started = getPhysicsFrameCount(), frame = Math.max(0, gap.endFrame - 2);
        const packets = beam.map(n => packetAt(n.engine, frame));
        disposeAllWasmEnginesForStudy();
        beam = beam.map((n, j) => {
          const engine = freshEngine(track).addLine([...startLines, ...n.fits.flatMap(f => f?.lines ?? [])].map(createLineFromJson));
          if (packetAt(engine, frame) !== packets[j]) throw new Error("rebased physical prefix mismatch");
          return { ...n, engine };
        });
        rebaseFrames += getPhysicsFrameCount() - started;
      }
      if (fit === null) { beam = beam.map(n => ({ ...n, fits: [...n.fits, null] })); continue; }
      const pool: Node[] = [], stepTrials: any[] = [];
      for (const parent of beam) {
        const generationStart = getPhysicsFrameCount();
        const actual = frameAt(parent.engine, gap.endFrame);
        const unchanged = packetAt(parent.engine, Math.max(0, gap.endFrame - 2));
        const corpus: any[] = [];
        const contextFeatures = plan.collect || student ? plannerContextFeatures(actual,
          getRiderMetered(parent.engine, gap.endFrame).ballisticState(), gap, nextFor(i)) : null;
        // Reserve a disjoint ID range per contact. Incumbent lines keep their
        // original IDs so its entire physical history remains bit-identical.
        const idStart = 1000000 + i * 1000;
        const candidates: Array<{ lines: TrackLine[]; action: any; original?: boolean; preserve?: { frame: number; packet: string } }> = [];
        if (parent.original) candidates.push({ lines: fit.lines, action: { family: "incumbent" }, original: true });
        for (const mode of ["translate", "similarity"] as const) {
          const base = transportCatch(fit.lines, references[i]!, actual, mode);
          candidates.push({ lines: base, action: { family: "transport", mode } });
          for (const turn of [-0.035, -0.01, 0.01, 0.035]) candidates.push({
            lines: shapeCatch(base, actual, { turn, logScale: 0, energy: 0 }), action: { family: "turn", mode, turn } });
          for (const logScale of [-0.12, -0.04, 0.04, 0.12]) candidates.push({
            lines: shapeCatch(base, actual, { turn: 0, logScale, energy: 0 }), action: { family: "scale", mode, logScale } });
          if (plan.materials) for (const energy of [-1, 1] as const) candidates.push({
            lines: setCatchEnergy(base, actual.velocity, energy), action: { family: "material", mode, energy } });
          if (plan.railLayers && mode === "translate") for (const layers of [2, 4]) for (const spacing of [0.005, 0.05]) for (const energy of [-1, 1] as const) {
            const lines = nativeRailLayers(base, actual.velocity, layers, spacing, energy);
            if (lines.length < 1000) candidates.push({ lines, action: { family: "rail_layers", mode, layers, spacing, energy } });
          }
          const originalGap = savedReport.gaps.find((g: any) => g.gap_index === i);
          if (plan.pulses && mode === "translate" && originalGap?.axes.impact &&
              originalGap.axes.impact.target - originalGap.axes.impact.achieved > 0.03) {
            const seedLines = base.map((l, j) => ({ ...l, id: idStart + j }));
            const seedEngine = parent.engine.addLine(seedLines.map(createLineFromJson));
            const preserve = { frame: gap.endFrame, packet: packetAt(seedEngine, gap.endFrame) };
            for (const phase of [2, 4]) {
              if (gap.endFrame + phase >= endFor(i)) continue;
              const rider = getRiderMetered(seedEngine, gap.endFrame + phase), packet = rider.ballisticState();
              if (!packet.riderMounted || !packet.sledIntact) continue;
              for (const pointId of ["TAIL", "NOSE"]) for (const normalTurn of [-1, 1]) for (const depth of [0.5, 1.5, 3]) {
                const point = packet.points[pointId];
                const pulse = contactPulse(point, normalTurn, depth, Math.max(4, actual.speed * 0.6), idStart + seedLines.length);
                candidates.push({ lines: [...seedLines, pulse], preserve,
                  action: { family: "contact_pulse", phase, pointId, normalTurn, depth } });
                if (plan.pulsePairs && phase === 2 && gap.endFrame + 4 < endFor(i)) {
                  const firstEngine = seedEngine.addLine(createLineFromJson(pulse));
                  if (packetAt(firstEngine, gap.endFrame) !== preserve.packet) continue;
                  const later = getRiderMetered(firstEngine, gap.endFrame + 4).ballisticState();
                  if (!later.riderMounted || !later.sledIntact) continue;
                  const pairPreserve = { frame: gap.endFrame + 3, packet: packetAt(firstEngine, gap.endFrame + 3) };
                  for (const secondPoint of ["TAIL", "NOSE"]) for (const ratio of [0.5, 1, 1.5]) {
                    const second = contactPulse(later.points[secondPoint], -normalTurn, depth * ratio,
                      Math.max(4, actual.speed * 0.6), idStart + seedLines.length + 1);
                    candidates.push({ lines: [...seedLines, pulse, second], preserve: pairPreserve,
                      action: { family: "contact_pulse_pair", phase, pointId, normalTurn, depth, secondPoint, ratio } });
                  }
                }
              }
              if (plan.collective) for (const normalTurn of [-1, -0.6, 0.6, 1]) for (const depth of [0.5, 1.5, 3]) for (const maxWidth of [0.5, 2]) {
                const pulses = collectiveContactPulse(Object.values(packet.points) as Array<{ x: number; y: number }>,
                  rider.velocity, normalTurn, depth, maxWidth, idStart + seedLines.length);
                candidates.push({ lines: [...seedLines, ...pulses], preserve,
                  action: { family: "contact_pulse_collective", phase, normalTurn, depth, maxWidth, pulseLineCount: pulses.length } });
                if (plan.collectivePairs && phase === 2 && gap.endFrame + 4 < endFor(i)) {
                  const firstEngine = seedEngine.addLine(pulses.map(createLineFromJson));
                  if (packetAt(firstEngine, gap.endFrame) !== preserve.packet) continue;
                  const laterRider = getRiderMetered(firstEngine, gap.endFrame + 4), later = laterRider.ballisticState();
                  if (!later.riderMounted || !later.sledIntact) continue;
                  const pairPreserve = { frame: gap.endFrame + 3, packet: packetAt(firstEngine, gap.endFrame + 3) };
                  for (const ratio of [0.5, 1, 1.5]) {
                    const second = collectiveContactPulse(Object.values(later.points) as Array<{ x: number; y: number }>,
                      laterRider.velocity, -normalTurn, depth * ratio, maxWidth, idStart + seedLines.length + pulses.length);
                    if (seedLines.length + pulses.length + second.length >= 1000) continue;
                    candidates.push({ lines: [...seedLines, ...pulses, ...second], preserve: pairPreserve,
                      action: { family: "contact_pulse_collective", phase, normalTurn, depth, maxWidth, ratio,
                        paired: true, pulseLineCount: pulses.length + second.length } });
                  }
                }
              }
              if (plan.collectiveEnergy) for (const normalTurn of [-1.4, -1, 1, 1.4]) for (const layers of [4, 16, 32]) for (const energy of [-1, 1] as const) {
                const depth = 0.1, maxWidth = 0.5;
                const points = collectiveContactPulse(Object.values(packet.points) as Array<{ x: number; y: number }>,
                  rider.velocity, normalTurn, depth, maxWidth, idStart + seedLines.length);
                const pulses = nativeRailLayers(points, rider.velocity, layers, 0.001, energy);
                if (seedLines.length + pulses.length >= 1000) continue;
                candidates.push({ lines: [...seedLines, ...pulses], preserve,
                  action: { family: "contact_pulse_collective", phase, normalTurn, depth, maxWidth, layers, energy,
                    spacing: 0.001, pulseLineCount: pulses.length } });
              }
            }
          }
          if (plan.programs && mode === "translate") {
            const next = nextFor(i), frames = next ? next.endFrame - gap.endFrame : 20;
            const targetLength = Math.max(actual.speed * 2, actual.speed * frames * (1 - (next?.targets.air ?? 0.6)));
            for (const scale of [0.7, 1, 1.3]) for (const exitTurn of [-0.3, -0.15, 0, 0.15]) {
              const program = { length: targetLength * scale, exitTurn, bend: 0, energy: 0 as const };
              const lines = releaseProgram(base, actual, program);
              if (lines) candidates.push({ lines, action: { family: "program", ...program } });
            }
            for (const bend of [-0.12, 0.12]) for (const energy of (plan.materials ? [-1, 0, 1] : [0]) as Array<-1 | 0 | 1>) {
              const program = { length: targetLength, exitTurn: -0.15, bend, energy };
              const lines = releaseProgram(base, actual, program);
              if (lines) candidates.push({ lines, action: { family: "program", ...program } });
            }
            if (plan.targetPrograms) {
              const speed = next?.targets.speed === undefined ? (fit.releaseSpeed ?? actual.speed) : authoredSpeedToPx(next.targets.speed);
              const targetSupport = Math.max(speed * 1.5, speed * frames * (1 - (next?.targets.air ?? 0.6)));
              for (const scale of [0.7, 1, 1.3]) for (const exitAngle of [-0.35, -0.15, 0, 0.15]) {
                const program = { length: targetSupport * scale, exitAngle, exitTurn: 0, bend: 0, energy: 0 as const };
                const lines = releaseProgram(base, actual, program);
                if (lines) candidates.push({ lines, action: { family: "target_program", ...program } });
              }
              for (const bend of [-0.5, -0.25, 0.25, 0.5]) for (const bendFrames of [1.5, 3, 6]) {
                const program = { length: targetSupport, exitAngle: 0, exitTurn: 0, bend,
                  bendLength: speed * bendFrames, energy: 0 as const };
                const lines = releaseProgram(base, actual, program);
                if (lines) candidates.push({ lines, action: { family: "target_program", ...program } });
              }
              if (plan.materials) for (const energy of [-1, 1] as const) for (const exitAngle of [-0.15, 0, 0.15]) {
                const program = { length: targetSupport, exitAngle, exitTurn: 0, bend: 0, energy };
                const lines = releaseProgram(base, actual, program);
                if (lines) candidates.push({ lines, action: { family: "target_program", ...program } });
              }
            }
          }
        }
        if (plan.reuse > 0) {
          const next = nextFor(i);
          const rankedTemplates = originals.map((template: any, j: number) => {
            if (!template || j === i || !references[j] || !baselineLocal[j]?.valid) return null;
            const ratio = actual.speed / Math.max(1e-6, references[j]!.speed);
            const measured = baselineLocal[j], preview = measured.preview;
            let distance = 0.02 * Math.log(ratio) ** 2;
            if (gap.targets.impact !== undefined && measured.achieved.impact !== undefined) {
              const expected = normImpact(impactToRawPx(measured.achieved.impact) * ratio);
              distance += weights.impact * (gap.targets.impact - expected) ** 2;
            }
            for (const axis of ["air", "speed", "amplitude"]) {
              const target = next?.targets[axis], observed = preview?.[axis];
              if (target === undefined || observed === undefined) continue;
              const expected = axis === "speed" ? speedPxToAuthored(authoredSpeedToPx(observed) * ratio) : observed;
              distance += weights[axis] * (target - expected) ** 2;
            }
            return { j, distance };
          }).filter((x: any) => x !== null).sort((a: any, b: any) => a.distance - b.distance || a.j - b.j).slice(0, plan.reuse);
          for (const { j } of rankedTemplates) for (const mode of ["translate", "similarity"] as const) {
            candidates.push({ lines: transportCatch(originals[j].lines, references[j]!, actual, mode),
              action: { family: "self_reuse", template: j, mode } });
          }
        }
        if (plan.nativeDraws > 0) {
          const rng = makeRng((capture.seed ^ Math.imul(i + 1, 65537) ^ parent.id) | 0);
          const targets = arcProposalTargetsForGap(gap, ctx.gaps);
          for (let attempt = 0; attempt < plan.nativeDraws; attempt++) {
            const geometry = sampleArcPlacementGeometry(rng, actual.sledX, actual.sledY, targets,
              actual, attempt, gap, idStart, "normal", ctx.allContactFrames);
            candidates.push({ lines: geometry.lines, action: { family: "native_sample", attempt } });
          }
        }
        generationFrames += getPhysicsFrameCount() - generationStart;
        if (student) {
          const unique = new Set<string>();
          const ranked = candidates.map((candidate, order) => {
            const canonical = candidate.lines.length === fit.lines.length
              ? candidate.lines.map((l, j) => ({ ...l, id: fit.lines[j].id }))
              : candidate.lines.map((l, j) => ({ ...l, id: idStart + j }));
            const key = lineKey(canonical);
            if (unique.has(key)) return null;
            unique.add(key);
            const prediction = predictPlannerCandidate(student, [...contextFeatures!, ...plannerCandidateFeatures(canonical, actual, candidate.action)]);
            return { candidate, order, priority: prediction.priority,
              reserved: candidate.original || candidate.action.family === "transport" };
          }).filter((x): x is NonNullable<typeof x> => x !== null);
          const selected = [...ranked.filter(r => r.reserved), ...ranked.filter(r => !r.reserved)
            .sort((a, b) => a.priority - b.priority || a.order - b.order).slice(0, plan.keep)].map(r => r.candidate);
          filteredProposals += ranked.length - selected.length;
          candidates.splice(0, candidates.length, ...selected);
        }
        const seen = new Set<string>();
        for (const candidate of candidates) {
          // Equal segment count can preserve the original IDs and ordering.
          const lines = candidate.lines.length === fit.lines.length
            ? candidate.lines.map((l, j) => ({ ...l, id: fit.lines[j].id }))
            : candidate.lines.map((l, j) => ({ ...l, id: idStart + j }));
          const key = lineKey(lines);
          if (seen.has(key)) continue;
          seen.add(key); trials++;
          const training = plan.collect ? { features: plannerCandidateFeatures(lines, actual, candidate.action),
            valid: false, loss: null as number | null } : null;
          if (training) corpus.push(training);
          const child = parent.engine.addLine(lines.map(createLineFromJson));
          if (!candidate.original && packetAt(child, Math.max(0, gap.endFrame - 2)) !== unchanged) {
            failures.prefix_changed = (failures.prefix_changed ?? 0) + 1; continue;
          }
          if (candidate.preserve && packetAt(child, candidate.preserve.frame) !== candidate.preserve.packet) {
            failures.capture_changed = (failures.capture_changed ?? 0) + 1; continue;
          }
          const measured = local(child, i, lines);
          if (!measured.valid && !candidate.original) {
            failures[measured.reason!] = (failures[measured.reason!] ?? 0) + 1; continue;
          }
          if (plan.tailEnergy && (candidate.original || candidate.action.family.startsWith("contact_pulse")) &&
              measured.valid && measured.preview && gap.endFrame + 6 < endFor(i)) {
            const next = nextFor(i), target = next?.targets.speed, achieved = measured.preview.speed;
            if (target !== undefined && achieved !== undefined && Math.abs(target - achieved) > 0.01) {
              const used = new Set<number>();
              for (let f = Math.max(0, gap.endFrame - 2); f <= gap.endFrame + 6; f++) {
                for (const update of child.getUpdatesAtFrame(f)) if (update.type === "CollisionUpdate") used.add(update.id);
              }
              const direction = target > achieved ? 1 : -1;
              const energized = lines.map(l => used.has(l.id) ? { ...l } : setCatchEnergy([l], actual.velocity, direction)[0]);
              if (lineKey(energized) !== key) candidates.push({ lines: energized,
                preserve: { frame: gap.endFrame + 6, packet: packetAt(child, gap.endFrame + 6) },
                action: { family: "tail_energy", direction, base: candidate.action } });
            }
          }
          validTrials++;
          const sse = { ...parent.sse };
          const originalGap = savedReport.gaps.find((g: any) => g.gap_index === i);
          for (const axis of Object.keys(counts)) {
            const a = originalGap?.axes[axis];
            if (!a) continue;
            const achieved = candidate.original ? a.achieved : measured.achieved[axis as keyof typeof measured.achieved];
            if (achieved === undefined || !Number.isFinite(achieved)) { sse[axis] = Infinity; continue; }
            sse[axis] += (a.target - achieved) ** 2 - a.error ** 2;
          }
          const projected = { ...sse }, next = nextFor(i);
          if (measured.preview && next && plan.preview) {
            const baseNext = savedReport.gaps.find((g: any) => g.gap_index === next.index);
            for (const axis of ["air", "speed", "amplitude"]) {
              const a = baseNext?.axes[axis], achieved = measured.preview[axis as keyof typeof measured.preview];
              if (a && achieved !== undefined) projected[axis] += (a.target - achieved) ** 2 - a.error ** 2;
            }
          }
          let future: any = null;
          if (plan.lookahead === 2 && next && originals[next.index]) {
            const nextFit = originals[next.index];
            const nextActual = frameAt(child, next.endFrame);
            const nextPacket = packetAt(child, next.endFrame - 2);
            for (const mode of ["translate", "similarity"] as const) {
              const nextLines = transportCatch(nextFit.lines, references[next.index]!, nextActual, mode);
              const nextEngine = child.addLine(nextLines.map(createLineFromJson));
              if (packetAt(nextEngine, next.endFrame - 2) !== nextPacket) continue;
              const look = local(nextEngine, next.index, nextLines);
              if (!look.valid) continue;
              const fullNext = { ...sse };
              const nextReport = savedReport.gaps.find((g: any) => g.gap_index === next.index);
              for (const axis of Object.keys(counts)) {
                const a = nextReport?.axes[axis], achieved = look.achieved[axis as keyof typeof look.achieved];
                if (a && achieved !== undefined) fullNext[axis] += (a.target - achieved) ** 2 - a.error ** 2;
              }
              const v = value(fullNext);
              if (future === null || v < future.value) future = { value: v, sse: fullNext, mode };
            }
            if (future) Object.assign(projected, future.sse);
            else {
              const axis = counts.impact ? "impact" : Object.keys(counts)[0];
              projected[axis] += 0.25;
            }
          }
          const node: Node = { engine: child, fits: [...parent.fits, { ...fit, lines }], sse, value: value(projected),
            original: !!candidate.original, id: serial++, parent: parent.id, action: candidate.action, preview: measured.preview };
          if (training) {
            training.valid = measured.valid;
            if (measured.valid) {
              let loss = 0;
              for (const axis of Object.keys(counts)) {
                const a = originalGap?.axes[axis], observed = measured.achieved[axis as keyof typeof measured.achieved];
                if (a && observed !== undefined) loss += weights[axis] * (a.target - observed) ** 2;
              }
              const nextReport = next && savedReport.gaps.find((g: any) => g.gap_index === next.index);
              for (const axis of ["air", "speed", "amplitude"]) {
                const a = nextReport?.axes[axis], observed = measured.preview?.[axis as keyof typeof measured.preview];
                if (a && observed !== undefined) loss += weights[axis] * (a.target - observed) ** 2;
              }
              training.loss = loss;
            }
          }
          if (plan.selection === "state") {
            const rider = getRiderMetered(child, endFor(i)), packet = rider.ballisticState();
            node.embedding = Object.keys(packet.points).sort().flatMap(key => {
              const p = packet.points[key];
              return [(p.x - rider.position.x) / 10, (p.y - rider.position.y) / 10, p.vx / 10, p.vy / 10];
            });
          }
          pool.push(node);
          stepTrials.push({ id: node.id, parent: node.parent, action: node.action, value: node.value,
            future: plan.lookahead === 2 ? future : undefined, original: node.original,
            achieved: plan.pulses ? measured.achieved : undefined,
            pulseContacts: candidate.action.family.startsWith("contact_pulse")
              ? lines.slice(-(candidate.action.pulseLineCount ?? (candidate.action.family === "contact_pulse_pair" ? 2 : 1)))
                .map(l => measured.impactLineIds?.includes(l.id)) : undefined });
        }
        if (plan.collect) appendFileSync(corpusPath, gzipSync(`${JSON.stringify({ featureVersion: PLANNER_FEATURE_VERSION,
          sourceId, gap: i, parent: parent.id, context: contextFeatures, candidates: corpus })}\n`, { level: 1 }));
      }
      const original = pool.find(n => n.original);
      if (!original) throw new Error("lost incumbent path");
      const ranked = pool.filter(n => !n.original).sort((a, b) => a.value - b.value || a.id - b.id);
      // Preserve alternative parent histories before filling with siblings.
      const selected: Node[] = [], selectedParents = new Set<number>();
      for (const n of ranked) if (plan.selection === "parent" && !selectedParents.has(n.parent) && selected.length < plan.width - 1) {
        selected.push(n); selectedParents.add(n.parent);
      }
      if (plan.selection === "state") for (const n of ranked) {
        if (selected.length >= plan.width - 1) break;
        const distinct = selected.every(other => Math.sqrt(n.embedding!.reduce((sum, x, j) =>
          sum + (x - other.embedding![j]) ** 2, 0) / n.embedding!.length) >= plan.stateDistance);
        if (distinct) selected.push(n);
      }
      for (const n of ranked) if (selected.length < plan.width - 1 && !selected.includes(n)) selected.push(n);
      beam = [original, ...selected];
      for (const n of beam) nodes.set(n.id, { gap: i, parent: n.parent, action: n.action });
      steps.push({ gap: i, trials: stepTrials, retained: beam.map(n => n.id) });
    }
    const completions: any[] = [];
    for (const n of beam) {
      const measured = scoreFits(n.engine, n.fits);
      const realizedSse = Object.fromEntries(Object.keys(counts).map(axis => [axis,
        measured.report.gaps.reduce((sum, g) => sum + (g.axes[axis as keyof typeof g.axes]?.error ?? 0) ** 2, 0)]));
      completions.push({ id: n.id, original: n.original, score: measured.score,
        estimatedSse: n.sse, realizedSse,
        maxSseDifference: Math.max(...Object.keys(counts).map(a => Math.abs(n.sse[a] - realizedSse[a]))) });
      if (measured.score.valid && measured.score.score > winner.score.score) {
        const actions: any[] = []; let at = n.id;
        while (nodes.has(at)) { const item = nodes.get(at); actions.push({ gap: item.gap, action: item.action }); at = item.parent; }
        winner = { ...measured, fits: n.fits, actions: actions.reverse() };
      }
    }
    write(resolve(out, `${sourceId}.search.json`), { steps, completions, baselineLocal });
  } finally { disposeAllWasmEnginesForStudy(); }
  const bestTrack = { ...track, lines: [...startLines, ...winner.fits.flatMap((f: any) => f?.lines ?? [])] };
  try {
    const replay = scoreFits(freshEngine(track).addLine(bestTrack.lines.map(createLineFromJson)), winner.fits);
    if (JSON.stringify(replay) !== JSON.stringify({ report: winner.report, score: winner.score })) throw new Error("winner exact replay mismatch");
  } finally { disposeAllWasmEnginesForStudy(); }
  write(resolve(out, `${sourceId}.track.json`), bestTrack);
  write(resolve(out, `${sourceId}.report.json`), winner.report);
  if (plan.collect) writeFileSync(`${corpusPath}.sha256`, `${hash(readFileSync(corpusPath))}  ${basename(corpusPath)}\n`);
  const result = { schema: "line.whole-track-planner-source.v1", implementation, planSha256, sourceId, seed: capture.seed,
    originalScore, capturedScore, score: winner.score, delta: winner.score.score - originalScore.score,
    cumulativeDelta: winner.score.score - capturedScore.score, actions: winner.actions,
    trials, validTrials, failures, filteredProposals, generationFrames, rebaseFrames, calibrationFrames,
    frames: getPhysicsFrameCount() - framesStart, elapsedMs: performance.now() - started };
  write(resolve(out, `${sourceId}.json`), result);
  process.stderr.write(`${sourceId}: ${result.delta >= 0 ? "+" : ""}${result.delta.toFixed(4)}, ${validTrials}/${trials} local fits, ${result.frames} frames\n`);
}

const planPath = resolve(out, "plan.json");
if (process.argv.includes("--plan")) {
  if (existsSync(planPath)) throw new Error("plan exists");
  const requested = arg("sources")?.split(",");
  const members = developmentCases.filter(e => !requested || requested.includes(e.case.metadata.id));
  if (!members.length || (requested && members.length !== requested.length)) throw new Error("unknown sources");
  const width = Number(arg("width") ?? 6);
  if (!Number.isSafeInteger(width) || width < 2) throw new Error("invalid width");
  const sources = members.map(e => ({ sourceId: e.case.metadata.id,
    warmHashes: warmStart ? ["track", "report"].map(kind => {
      const p = resolve(warmStart, `${e.case.metadata.id}.${kind}.json`); read(p); return hash(readFileSync(p));
    }) : null,
    inputHashes: ["capture", "track", "report"].map(kind => {
      const p = resolve(input, `${e.case.metadata.id}.${kind}.json`); read(p); return hash(readFileSync(p));
    }) }));
  write(planPath, { schema: "line.whole-track-planner-plan.v1", implementation, engineHash, suiteHash,
    candidateFingerprint: baseline.candidate_fingerprint, researchOnly: true, input, warmStart, width,
    materials: arg("materials") !== "off", programs: arg("programs") !== "off", preview: arg("preview") !== "off",
    selection: arg("selection") ?? "parent",
    targetPrograms: arg("target-programs") === "on",
    lookahead: Number(arg("lookahead") ?? 1),
    railLayers: arg("rail-layers") === "on",
    reuse: Number(arg("reuse") ?? 0),
    nativeDraws: Number(arg("native-draws") ?? 0), stateDistance: Number(arg("state-distance") ?? 0.01),
    pulses: arg("pulses") === "on",
    pulsePairs: arg("pulse-pairs") === "on",
    tailEnergy: arg("tail-energy") === "on",
    collective: arg("collective") === "on",
    collectivePairs: arg("collective-pairs") === "on",
    collectiveEnergy: arg("collective-energy") === "on",
    rebaseEvery: Number(arg("rebase-every") ?? 0),
    collect: arg("collect") === "on",
    modelPath, modelHash: modelPath ? hash(readFileSync(modelPath)) : null, keep: Number(arg("keep") ?? 16),
    law: "physical prefix beam; preserve exact incumbent; compare native release programs and state-conditioned templates; measure actual next interval; reserve parent diversity; final fixed V2 score and cold replay", sources });
  console.log(JSON.stringify({ plannedSources: sources.length, planSha256: hash(readFileSync(planPath)) }));
} else {
  const plan = read(planPath), planSha256 = hash(readFileSync(planPath));
  if (plan.implementation !== implementation || plan.engineHash !== engineHash || plan.input !== input ||
      plan.warmStart !== warmStart || plan.suiteHash !== suiteHash || plan.modelPath !== modelPath ||
      plan.modelHash !== (modelPath ? hash(readFileSync(modelPath)) : null)) throw new Error("frozen experiment changed");
  if (arg("worker")) {
    try { worker(plan.sources.find((s: any) => s.sourceId === arg("worker")), plan, planSha256); }
    catch (error) {
      write(resolve(out, `${arg("worker")}.failure.json`), { planSha256, sourceId: arg("worker"),
        frames: getPhysicsFrameCount(), error: error instanceof Error ? error.stack : String(error) });
      throw error;
    }
  }
  else {
    const queue = plan.sources.filter((s: any) => {
      const p = resolve(out, `${s.sourceId}.json`);
      if (!existsSync(p)) return true;
      if (read(p).planSha256 !== planSha256) throw new Error("checkpoint identity mismatch");
      return false;
    });
    const jobs = Number(arg("jobs") ?? 4), failures: string[] = [];
    if (!Number.isSafeInteger(jobs) || jobs < 1) throw new Error("invalid jobs");
    await Promise.all(Array.from({ length: Math.min(jobs, queue.length) }, async () => {
      while (queue.length) {
        const s = queue.shift()!;
        const code = await new Promise<number | null>((done, reject) => {
          const child = spawn(process.execPath, ["--import", "tsx", script, `--worker=${s.sourceId}`, `--input=${input}`, `--out=${out}`,
            ...(warmStart ? [`--warm-start=${warmStart}`] : []), ...(modelPath ? [`--model=${modelPath}`] : [])],
            { env: process.env, stdio: ["ignore", "ignore", "inherit"] });
          child.on("error", reject); child.on("exit", done);
        });
        if (code !== 0) failures.push(s.sourceId);
      }
    }));
    if (failures.length) throw new Error(`failed workers: ${failures.join(", ")}`);
    const sources = plan.sources.map((s: any) => read(resolve(out, `${s.sourceId}.json`)));
    const aggregate = (key: string) => sources.length === 44 ? summarizeDevelopmentBudget(sources.map((s: any) => ({
      sourceId: s.sourceId, budget: 750000, seedSlot: 0, actualSeed: s.seed, score: s[key],
    })), 750000, suite) : null;
    const summary = { schema: "line.whole-track-planner-summary.v1", planSha256, implementation, researchOnly: true,
      sources: sources.length, baseline: aggregate("originalScore"), capturedBaseline: aggregate("capturedScore"), candidate: aggregate("score"),
      positiveSources: sources.filter((s: any) => s.delta > 0).length,
      meanDelta: sources.reduce((s: number, r: any) => s + r.delta, 0) / sources.length,
      maxDelta: Math.max(...sources.map((s: any) => s.delta)),
      frames: sources.reduce((s: number, r: any) => s + r.frames, 0), workerMs: sources.reduce((s: number, r: any) => s + r.elapsedMs, 0) };
    write(resolve(out, "summary.json"), summary); console.log(JSON.stringify(summary));
  }
}
