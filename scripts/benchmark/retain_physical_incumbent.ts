/** Retain the best already-replayed research track per source. No new physics
 * is performed, and the combined artifact is never a fixed-budget result. */
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, basename } from "node:path";
import { summarizeDevelopmentBudget } from "../v0/benchmark_v2/evaluator.ts";

const arg = (key: string) => process.argv.slice(2).find(a => a.startsWith(`--${key}=`))?.slice(key.length + 3);
const hash = (data: Buffer | string) => createHash("sha256").update(data).digest("hex");
const read = (path: string) => {
  const bytes = readFileSync(path);
  if (hash(bytes) !== readFileSync(`${path}.sha256`, "utf8").split(/\s/)[0]) throw new Error(`checksum mismatch: ${path}`);
  return JSON.parse(bytes.toString());
};
const write = (path: string, value: any) => {
  const body = `${JSON.stringify(value)}\n`;
  writeFileSync(path, body); writeFileSync(`${path}.sha256`, `${hash(body)}  ${basename(path)}\n`);
};
const inputs = arg("inputs")!.split(",").map(p => resolve(p)), out = resolve(arg("out")!);
if (existsSync(out)) throw new Error("incumbent output already exists");
const plans = inputs.map(p => read(resolve(p, "plan.json")));
inputs.forEach(p => read(resolve(p, "summary.json")));
if (plans.some(p => p.sources.length !== 44)) throw new Error("complete 44-source arms required");
mkdirSync(out, { recursive: true });
const selections = plans[0].sources.map((source: any) => {
  const choices = inputs.map(input => ({ input, result: read(resolve(input, `${source.sourceId}.json`)) }));
  if (choices.some(c => c.result.sourceId !== source.sourceId || !c.result.score.valid)) throw new Error("invalid source choice");
  const best = choices.reduce((a, b) => b.result.score.score > a.result.score.score ? b : a);
  const hashes: Record<string, string> = {};
  for (const kind of ["track", "report"]) {
    const path = resolve(best.input, `${source.sourceId}.${kind}.json`);
    read(path); hashes[kind] = hash(readFileSync(path));
    copyFileSync(path, resolve(out, basename(path)));
    copyFileSync(`${path}.sha256`, resolve(out, `${basename(path)}.sha256`));
  }
  return { sourceId: source.sourceId, input: best.input, seed: best.result.seed, score: best.result.score,
    capturedScore: best.result.capturedScore, hashes };
});
const suite = JSON.parse(readFileSync("benchmark/v2/compat/suite-manifest.json", "utf8"));
const aggregate = (key: "score" | "capturedScore") => summarizeDevelopmentBudget(selections.map((s: any) => ({
  sourceId: s.sourceId, budget: 750000, seedSlot: 0, actualSeed: s.seed, score: s[key],
})), 750000, suite);
write(resolve(out, "plan.json"), { schema: "line.physical-planner-incumbent.v1", inputs,
  planHashes: inputs.map(p => hash(readFileSync(resolve(p, "plan.json")))), researchOnly: true,
  sources: selections, physicsFrames: 0, note: "Best of previously executed and cold-replayed research arms; previous compute is not free or reassigned to 750k." });
const summary = { researchOnly: true, capturedBaseline: aggregate("capturedScore"), candidate: aggregate("score"), selections };
write(resolve(out, "summary.json"), summary);
console.log(JSON.stringify({ captured: summary.capturedBaseline.score, retained: summary.candidate.score, sources: selections.length }));
