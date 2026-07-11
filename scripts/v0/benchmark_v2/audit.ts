import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { CharacterizationReport } from "./model.ts";
import { buildAuditReport, renderAuditMarkdown } from "./audit_model.ts";
import { relativeToCwd } from "./util.ts";

const args = process.argv.slice(2);
const characterizationPath = resolve(argument("characterization") ?? "benchmark/v2/evidence/characterization.json");
const jsonPath = resolve(argument("json") ?? "benchmark/v2/evidence/audit.json");
const markdownPath = resolve(argument("markdown") ?? "docs/benchmark-v2-audit.md");
const characterization = JSON.parse(readFileSync(characterizationPath, "utf8")) as CharacterizationReport;
const report = buildAuditReport(characterization);

mkdirSync(dirname(jsonPath), { recursive: true });
mkdirSync(dirname(markdownPath), { recursive: true });
writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
writeFileSync(markdownPath, renderAuditMarkdown(report));

console.log(`Benchmark V2 static audit`);
console.log(`  hard failures: ${report.hardFailures.length}`);
console.log(`  review warnings: ${report.warnings.length}`);
console.log(`  audit fingerprint: ${report.auditFingerprint.slice(0, 16)}`);
console.log(`  JSON: ${relativeToCwd(jsonPath)}`);
console.log(`  Markdown: ${relativeToCwd(markdownPath)}`);
if (report.hardFailures.length > 0) process.exitCode = 1;

function argument(name: string): string | undefined {
  const prefix = `--${name}=`;
  return args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}
