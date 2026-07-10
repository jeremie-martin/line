import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  buildCharacterizationReport,
  characterizeSpec,
  loadSourceManifest,
  loadHeldoutManifest,
  loadSourceSpec,
  renderCharacterizationMarkdown,
  resolveHeldoutSources,
  resolveSources,
} from "./model.ts";

const args = process.argv.slice(2);
const manifestPath = resolve(argument("manifest") ?? "benchmark/v2/compat/source-manifest.json");
const heldoutManifestPath = resolve(argument("heldout-manifest") ?? "benchmark/v2/compat/heldout-manifest.json");
const jsonPath = resolve(argument("json") ?? "benchmark/v2/evidence/characterization.json");
const markdownPath = resolve(argument("markdown") ?? "docs/benchmark-v2-characterization.md");

const manifestContents = readFileSync(manifestPath, "utf8");
const heldoutManifestContents = readFileSync(heldoutManifestPath, "utf8");
const manifest = loadSourceManifest(manifestPath);
const heldoutManifest = loadHeldoutManifest(heldoutManifestPath);
const sources = [];
for (const source of [...resolveSources(manifest), ...resolveHeldoutSources(heldoutManifest)]) {
  const spec = await loadSourceSpec(source);
  sources.push(characterizeSpec(source, spec));
}

const report = buildCharacterizationReport(
  relativeToCwd(manifestPath),
  manifestContents,
  sources,
  { path: relativeToCwd(heldoutManifestPath), contents: heldoutManifestContents },
);
mkdirSync(dirname(jsonPath), { recursive: true });
mkdirSync(dirname(markdownPath), { recursive: true });
writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
writeFileSync(markdownPath, renderCharacterizationMarkdown(report));

const representative = report.sources.filter((source) => source.role === "representative_candidate").length;
const capability = report.sources.filter((source) => source.role === "capability_candidate").length;
const regression = report.sources.filter((source) => source.role === "regression_candidate").length;
const developmentMusic = report.sources.filter((source) => source.role === "development_music_candidate").length;
const qualification = report.sources.filter((source) => source.role === "qualification_reference").length;
console.log(`Benchmark V2 static characterization`);
console.log(
  `  sources: ${report.sources.length} (${representative} representative, ${capability} capability, ` +
  `${regression} regression, ${developmentMusic} development music, ${qualification} qualification)`,
);
console.log(`  exact duplicate groups: ${report.exactContactDuplicates.length}`);
console.log(`  data fingerprint: ${report.dataFingerprint.slice(0, 16)}`);
console.log(`  JSON: ${relativeToCwd(jsonPath)}`);
console.log(`  Markdown: ${relativeToCwd(markdownPath)}`);

function argument(name: string): string | undefined {
  const prefix = `--${name}=`;
  return args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function relativeToCwd(path: string): string {
  const cwd = `${process.cwd()}/`;
  return path.startsWith(cwd) ? path.slice(cwd.length) : path;
}
