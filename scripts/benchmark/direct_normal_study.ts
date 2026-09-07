import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { developmentCases } from "../../benchmark/v2/catalog.ts";
import { benchmarkPolicy } from "../../benchmark/v2/policy.ts";
import { applyJolt } from "../produce/seed.ts";
import { compileNormalMotion } from "../v0/optimizer/normal_motion.ts";
import { buildAxisContract, scoreV2Report } from "../v0/benchmark_v2/evaluator.ts";
import { compilerCandidateIdentity } from "../v0/benchmark_v2/compiler_identity.ts";
const arg = (key: string) => process.argv.find(a => a.startsWith(`--${key}=`))?.slice(key.length + 3);
const sourceId = arg("source"), out = arg("out");
const entry = developmentCases.find(e => e.case.metadata.id === sourceId);
if (!entry || !out) throw new Error("require a development --source and --out");
const budget = Number(arg("budget") ?? 750000), seed = Number(arg("seed") ?? 260907011);
const spec = applyJolt(entry.case.spec, benchmarkPolicy.transform.joltMs);
const identity = compilerCandidateIdentity("wasm");
const started = performance.now();
const diagnostics: unknown[] = [];
const result = compileNormalMotion(spec, seed, { budget, budgetTelemetry: "summary",
  onDiagnostic: value => { if (diagnostics.length < 4) diagnostics.push(value); } });
if (result.track.lines.some(l => l.type !== 0)) throw new Error("acceleration or scenery geometry in normal-only study");
if (result.stats.sim_frames > budget) throw new Error("hard budget overrun");
const suite = JSON.parse(readFileSync("benchmark/v2/compat/suite-manifest.json", "utf8"));
const contract = buildAxisContract(spec, Object.keys(benchmarkPolicy.componentWeights) as any);
const score = scoreV2Report(result.report, spec.contacts.length, contract, suite);
const record = { schema: "line.direct-normal-study.v1", researchOnly: true, sourceId, seed,
  candidateFingerprint: identity.candidateFingerprint, compilerSourceFingerprint: identity.compilerSourceFingerprint,
  elapsedMs: performance.now() - started, score, diagnostics, ...result };
const body = JSON.stringify(record) + "\n";
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, body); writeFileSync(out + ".sha256", createHash("sha256").update(body).digest("hex") + "\n");
console.log(JSON.stringify({ sourceId, score: score.score, valid: score.valid, frames: result.stats.sim_frames,
  contacts: result.stats.gap_commits, authored: spec.contacts.length, lines: result.track.lines.length, elapsedMs: record.elapsedMs }));
