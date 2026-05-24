/**
 * Bench v2 worker — runs one (spec × strategy) pair at a time.
 *
 * Lives in a node:worker_threads Worker spawned by `bench/v2/run.ts` when
 * --parallel=N is given. The worker loads its own copy of the strategies +
 * spec registry once on startup, then handles jobs as messages arrive.
 *
 * Protocol:
 *   Worker → main:  { type: "ready" }                          (once, on init)
 *   Worker → main:  { type: "result", ...RunRecordPayload }    (per job)
 *   Main   → worker: { specId, strategyId, trackOutDir }        (per job)
 *
 * Writing the generated track file is done inside the worker (filesystem IO
 * is cheap and parallel-safe with unique paths per job) so we don't post
 * large track JSON across the worker boundary.
 */
import { parentPort } from "node:worker_threads";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { STRATEGIES } from "../../scripts/bench_music.ts";
import { buildSpecRegistry } from "./specs/index.ts";
import { perBeatAttribution } from "./attribution.ts";
import {
  geometricMetrics,
  behavioralMetrics,
  coolScore,
} from "../../scripts/lib/metrics.ts";

if (!parentPort) throw new Error("bench/v2/worker.ts must run under worker_threads");

const specs = buildSpecRegistry();
const stratMap = new Map(STRATEGIES.map((s) => [s.id, s]));

parentPort.postMessage({ type: "ready" });

parentPort.on("message", (msg: { specId: string; strategyId: string; trackOutDir: string }) => {
  const spec = specs.find((s) => s.id === msg.specId);
  const strat = stratMap.get(msg.strategyId);
  const t0 = Date.now();

  if (!spec || !strat) {
    parentPort!.postMessage({
      type: "result",
      specId: msg.specId,
      strategyId: msg.strategyId,
      elapsedMs: 0,
      threwMessage: `unknown spec (${msg.specId}) or strategy (${msg.strategyId})`,
      perBeat: [],
      geom: null,
      behav: null,
      cool: null,
    });
    return;
  }

  try {
    const result = strat.run({
      onsets: spec.beatFrames.map((f) => ({ t: f / 40 })),
      fps: 40,
    });
    const elapsedMs = Date.now() - t0;
    const perBeat = perBeatAttribution(result.detection, spec.beatFrames);
    const geom = geometricMetrics(result.track);
    const behav = behavioralMetrics(result.detection);
    const cool = coolScore({ ...geom, ...behav });

    const trackPath = resolve(msg.trackOutDir, `${msg.specId}__${msg.strategyId}.track.json`);
    writeFileSync(trackPath, JSON.stringify(result.track, null, 2));

    parentPort!.postMessage({
      type: "result",
      specId: msg.specId,
      strategyId: msg.strategyId,
      elapsedMs,
      threwMessage: null,
      perBeat,
      geom,
      behav,
      cool,
    });
  } catch (e) {
    parentPort!.postMessage({
      type: "result",
      specId: msg.specId,
      strategyId: msg.strategyId,
      elapsedMs: Date.now() - t0,
      threwMessage: String(e).slice(0, 200),
      perBeat: [],
      geom: null,
      behav: null,
      cool: null,
    });
  }
});
