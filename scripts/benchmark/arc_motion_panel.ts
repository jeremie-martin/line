import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, openSync, closeSync, readFileSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { developmentCases } from "../../benchmark/v2/catalog.ts";
import { compilerCandidateIdentity } from "../v0/benchmark_v2/compiler_identity.ts";
import { summarizeDevelopmentBudget } from "../v0/benchmark_v2/evaluator.ts";
const arg = (key: string) => process.argv.find(a => a.startsWith(`--${key}=`))?.slice(key.length + 3);
const controls = {headingWeight:Number(arg("heading-weight")??0),qualityRetries:Number(arg("quality-retries")??0),channel:Number(arg("channel")??12),radius:Number(arg("radius")??24),arrivalMode:arg("arrival-mode")??"speed",arrivalWeight:Number(arg("arrival-weight")??.3),samples:Number(arg("samples")??160),
  bidirectional:arg("bidirectional")==="on",impactWeight:Number(arg("impact-weight")??2),amplitudeWeight:Number(arg("amplitude-weight")??1),poseWeight:Number(arg("pose-weight")??0)};
const flags = Object.entries(controls).map(([k,v])=>`--${k.replace(/[A-Z]/g,c=>"-"+c.toLowerCase())}=${typeof v==="boolean"?(v?"on":"off"):v}`);
const out = resolve(arg("out")!), reuse = arg("reuse-prefix"), jobs = Number(arg("jobs") ?? 16);
const hash = (b: string | Buffer) => createHash("sha256").update(b).digest("hex");
const files = ["scripts/benchmark/arc_motion_study.ts", "scripts/v0/optimizer/arc_motion.ts", "scripts/v0/optimizer/native_motion_schedule.ts"];
const identity = compilerCandidateIdentity("wasm");
const implementation = files.map(p => hash(readFileSync(p)));
const read = (p: string) => {
  const b = readFileSync(p);
  if (hash(b) !== readFileSync(p + ".sha256", "utf8").split(/\s/)[0]) throw new Error(`checksum: ${p}`);
  return JSON.parse(b.toString());
};
const write = (p: string, value: any) => {
  const body = JSON.stringify(value) + "\n"; writeFileSync(p, body); writeFileSync(p + ".sha256", hash(body) + "\n");
};
const baseline = JSON.parse(readFileSync("benchmark/v2/campaign-baseline.json", "utf8"));
const judgeEngineSha256 = hash(readFileSync("engine-rs/target/wasm32-unknown-unknown/release/lr_engine.wasm"));
if (judgeEngineSha256 !== baseline.engine_artifact_fingerprint) throw new Error("judge changed");
const suiteBytes = readFileSync("benchmark/v2/compat/suite-manifest.json"), suite = JSON.parse(suiteBytes.toString());
const sources = developmentCases.map(e => e.case.metadata.id).sort();
const plan = { schema: "line.arc-motion-panel-plan.v1", researchOnly: true, implementation,
  publicCompilerFingerprint: identity.candidateFingerprint, researchImplementationFingerprint:hash(JSON.stringify(implementation)), judgeEngineSha256, suiteSha256: hash(suiteBytes), sources, budget: 750000, seed: 260908011, normalLinesOnly: true, controls,
  note: "Connected physical arc rails with measured feedback; all actual physics and frozen-engine replay charged. Discovery, not canonical evaluation." };
mkdirSync(out, { recursive: true });
if (existsSync(resolve(out, "plan.json"))) {
  if (JSON.stringify(read(resolve(out, "plan.json"))) !== JSON.stringify(plan)) throw new Error("plan changed");
} else write(resolve(out, "plan.json"), plan);
const compatible = (record: any, sourceId: string) => record.sourceId === sourceId && record.seed === 260908011 &&
  record.budget === 750000 && Object.entries(controls).every(([k,v])=>typeof v==="number"?Number(record.options[k])===v:record.options[k]===v) && record.implementation[files[1]] === implementation[1] && record.track.lines.every((l: any) => l.type === 0);

for (const sourceId of sources) {
  const dest = resolve(out, `${sourceId}.json`), src = reuse ? `${reuse}${sourceId}.json` : null;
  if (!existsSync(dest) && src && existsSync(src)) {
    if (!compatible(read(src), sourceId)) throw new Error("incompatible reuse");
    copyFileSync(src, dest); copyFileSync(src + ".sha256", dest + ".sha256");
  }
  if (existsSync(dest) && !compatible(read(dest), sourceId)) throw new Error("incompatible checkpoint");
}
const queue = sources.filter(s => !existsSync(resolve(out, `${s}.json`))), failures: string[] = [];
await Promise.all(Array.from({ length: Math.min(jobs, queue.length) }, async () => {
  while (queue.length) {
    if (files.some((p, i) => hash(readFileSync(p)) !== implementation[i])) throw new Error("worker implementation changed");
    const sourceId = queue.shift()!, log = openSync(resolve(out, `${sourceId}.log`), "w");
    try {
      const code = await new Promise<number | null>((done, reject) => {
        const child = spawn(process.execPath, ["--import", "tsx", files[0], `--source=${sourceId}`, "--seed=260908011", ...flags,
          `--out=${resolve(out, `${sourceId}.json`)}`], { env: process.env, stdio: ["ignore", log, log] });
        child.on("error", reject); child.on("exit", done);
      });
      if (code !== 0) failures.push(sourceId);
      else {
        const r = read(resolve(out, `${sourceId}.json`));
        if (!compatible(r, sourceId)) throw new Error("worker result changed");
        process.stderr.write(`${sourceId}: ${r.score.score}, valid ${r.score.valid}, ${r.stats.sim_frames} frames\n`);
      }
    } finally { closeSync(log); }
  }
}));
if (failures.length) throw new Error(`workers failed: ${failures.join(", ")}`);
const rows = sources.map(sourceId => read(resolve(out, `${sourceId}.json`)));
const score = summarizeDevelopmentBudget(rows.map(r => ({ sourceId: r.sourceId, budget: 750000, seedSlot: 0, actualSeed: 260908011, score: r.score })), 750000, suite);
const summary = { schema: "line.arc-motion-panel-summary.v1", planSha256: hash(readFileSync(resolve(out, "plan.json"))),
  sources: rows.length, valid: rows.filter(r => r.score.valid).length, score,
  frames: rows.reduce((s, r) => s + r.stats.sim_frames, 0), workerMs: rows.reduce((s, r) => s + r.elapsedMs, 0),
  maxFrames: Math.max(...rows.map(r => r.stats.sim_frames)), perSource: rows.map(r => ({ sourceId: r.sourceId, score: r.score.score, valid: r.score.valid,
    frames: r.stats.sim_frames, failure: r.failure, artifactSha256: hash(readFileSync(resolve(out, `${r.sourceId}.json`))) })) };
write(resolve(out, "summary.json"), summary); console.log(JSON.stringify(summary));
