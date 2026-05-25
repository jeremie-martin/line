/**
 * Rapid-iteration mini-bench. Five drums slices (first 10 contacts of the
 * real drums onset data) × the five benchmark axes, run in parallel via
 * worker_threads. ~30s wall time on a 12-core box.
 *
 * The point: get a SIGNAL (regression / improvement) in seconds, not minutes,
 * before paying for the full pbench. Same scoring formula as benchmark.ts.
 *
 * Specs are sliced from the same drums data the official benchmark uses, so
 * the failure modes that matter (specific hard gaps) are represented as long
 * as those gaps fall within the first N contacts. If a change passes here
 * AND on full pbench, it's solid. If it fails here, no point running pbench.
 *
 *   npx tsx scripts/v0/_qbench.ts
 *   npx tsx scripts/v0/_qbench.ts --json
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import { fileURLToPath } from "node:url";
import type { Spec, Contact, Section } from "./types.ts";

const SEED = 0;
const SLICE_CONTACTS = 10;

const __filename = fileURLToPath(import.meta.url);

const raw = JSON.parse(
  readFileSync(resolve("beats/drums_0_30s_60_125.json"), "utf8"),
) as { range_s: [number, number]; onsets: { t: number; votes: number }[] };

// Same filter as scripts/v0/specs/_drums.ts so the slices align with the
// official benchmark's workload.
function filteredContacts(): Contact[] {
  const out: Contact[] = [];
  let last = -Infinity;
  for (const o of raw.onsets) {
    if (o.t < 0.5) continue;
    if (o.t - last < 0.4) continue;
    out.push({ t: o.t });
    last = o.t;
  }
  return out;
}

function slicedSpec(n: number, axes: Partial<Section>): Spec {
  const contacts = filteredContacts().slice(0, n);
  const lastT = contacts[contacts.length - 1].t;
  const duration = Math.ceil(lastT * 10) / 10 + 0.5;
  return {
    duration,
    contacts,
    sections: [{ t0: 0, t1: duration, ...axes } as Section],
  };
}

const SPECS: Array<[string, Spec]> = [
  ["base", slicedSpec(SLICE_CONTACTS, { air: 0.7 })],
  ["aer",  slicedSpec(SLICE_CONTACTS, { air: 0.85 })],
  ["chnk", slicedSpec(SLICE_CONTACTS, { air: 0.7, grain: 0.8 })],
  ["grnd", slicedSpec(SLICE_CONTACTS, { air: 0.45 })],
  ["spd",  slicedSpec(SLICE_CONTACTS, { speed: 0.5 })],
];

type Result = {
  name: string; hits: number; contacts: number; off: number;
  died: number; axErr: number; score: number; elapsed: number;
};

if (!isMainThread) {
  const { name, spec } = workerData as { name: string; spec: Spec };
  const { compile } = await import("./compile.ts");
  const t = Date.now();
  const { report } = compile(spec, SEED);
  const elapsed = Date.now() - t;
  const hits = report.contacts.filter((c: any) => c.status === "hit").length;
  const off = report.off_beat_landings.length;
  const died = report.terminus.reason !== "endOfSpec" ? 1 : 0;
  let axErr = 0;
  for (const sec of report.sections) {
    for (const ax of Object.values(sec.axes) as any[]) axErr += ax.error;
  }
  const score = hits - 5 * axErr - 100 * off - 100 * died;
  const out: Result = {
    name, hits, contacts: report.contacts.length,
    off, died,
    axErr: Number(axErr.toFixed(4)),
    score: Number(score.toFixed(2)),
    elapsed,
  };
  parentPort!.postMessage(out);
} else {
  const t0 = Date.now();
  const results: Result[] = await Promise.all(
    SPECS.map(([name, spec]) => new Promise<Result>((res, rej) => {
      const w = new Worker(__filename, {
        workerData: { name, spec },
        execArgv: process.execArgv,
      });
      w.on("message", res);
      w.on("error", rej);
      w.on("exit", (c) => c !== 0 && rej(new Error(`worker exited ${c}`)));
    })),
  );
  results.sort((a, b) =>
    SPECS.findIndex(([n]) => n === a.name) - SPECS.findIndex(([n]) => n === b.name),
  );
  const total = results.reduce((s, r) => s + r.score, 0);
  const elapsed = Date.now() - t0;
  const jsonOnly = process.argv.includes("--json");
  if (jsonOnly) {
    process.stdout.write(JSON.stringify({ total, results, elapsed }, null, 2) + "\n");
  } else {
    for (const r of results) {
      console.log(
        `${r.name.padEnd(5)} hits=${r.hits}/${r.contacts} off=${r.off} died=${r.died} ` +
        `axErr=${r.axErr.toFixed(3)} → ${r.score.toFixed(2).padStart(6)} (${r.elapsed}ms)`,
      );
    }
    console.log(`TOTAL ${total.toFixed(2)}  (${elapsed}ms wall)`);
  }
}
