import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { developmentCases } from "../../benchmark/v2/catalog.ts";
import { benchmarkPolicy } from "../../benchmark/v2/policy.ts";
import { applyJolt } from "../produce/seed.ts";
import { compileHandoff } from "../v0/optimizer/handoff.ts";
import { compilerCandidateIdentity } from "../v0/benchmark_v2/compiler_identity.ts";
import { buildAxisContract, scoreV2Report } from "../v0/benchmark_v2/evaluator.ts";
const arg = (key: string) => process.argv.find(a => a.startsWith(`--${key}=`))?.slice(key.length + 3);
const sourceId = arg("source")!, out = arg("out")!;
const spec = applyJolt(developmentCases.find(e => e.case.metadata.id === sourceId)!.case.spec, benchmarkPolicy.transform.joltMs);
const identity = compilerCandidateIdentity("wasm"), rows: any[] = [];
const suite = JSON.parse(readFileSync("benchmark/v2/compat/suite-manifest.json", "utf8"));
const contract = buildAxisContract(spec, Object.keys(benchmarkPolicy.componentWeights) as any);
const hash = (b: string) => createHash("sha256").update(b).digest("hex");
for (const budget of [150000, 750000, 1000000, 3000000]) {
  const started = performance.now(), result = compileHandoff(spec, 260907004, { budget, budgetTelemetry: "summary" });
  if (result.stats.sim_frames > budget) throw new Error("budget overrun");
  if (result.track.lines.some(l => l.type !== 0)) throw new Error("non-normal geometry");
  const score = scoreV2Report(result.report, spec.contacts.length, contract, suite);
  rows.push({ budget, frames: result.stats.sim_frames, elapsedMs: performance.now() - started, budgetExhausted: result.stats.budget_exhausted,
    trackSha256: hash(JSON.stringify(result.track)), reportSha256: hash(JSON.stringify(result.report)), score });
  process.stderr.write(`${sourceId}: ${budget}, score ${score.score}, valid ${score.valid}, frames ${result.stats.sim_frames}\n`);
}
const largeBudgetParity = rows.slice(2).every(r => r.trackSha256 === rows[1].trackSha256 && r.reportSha256 === rows[1].reportSha256 && r.frames === rows[1].frames);
// A budget-exhausted search may continue improving at larger budgets; record parity without requiring it.
const body = JSON.stringify({ schema: "line.normal-budget-range-audit.v1", researchOnly: true,
  candidateFingerprint: identity.candidateFingerprint, sourceId, largeBudgetParity, rows }) + "\n";
writeFileSync(out, body); writeFileSync(out + ".sha256", hash(body) + "\n");
