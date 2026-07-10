import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runBenchmarkV2 } from "./runner.ts";

export async function runCanonicalBenchmark(args = process.argv.slice(2)): Promise<{
  bundlePath: string;
  development: Awaited<ReturnType<typeof runBenchmarkV2>>;
  qualification: Awaited<ReturnType<typeof runBenchmarkV2>>;
}> {
const argument = (name: string): string | undefined => {
  const prefix = `--${name}=`;
  return args.find((value) => value.startsWith(prefix))?.slice(prefix.length);
};
const label = argument("label") ?? new Date().toISOString().replaceAll(":", "-").replace(/\.\d{3}Z$/, "Z");
const outDir = resolve(argument("out-dir") ?? "generated/benchmark-v2/canonical-runs");
const archiveDir = resolve(argument("archive-dir") ?? "benchmark/v2/runs");
const forwarded = args.filter((arg) =>
  !arg.startsWith("--label=") && !arg.startsWith("--out-dir=") && !arg.startsWith("--archive-dir=") &&
  !arg.startsWith("--out=") && !arg.startsWith("--profile=") &&
  !arg.startsWith("--development-archive=") && !arg.startsWith("--checkpoint=")
);
mkdirSync(outDir, { recursive: true });
mkdirSync(archiveDir, { recursive: true });
const developmentPath = resolve(outDir, `${label}-development.json`);
const qualificationPath = resolve(outDir, `${label}-qualification.json`);
const development = await runBenchmarkV2("development", [
  "--profile=canonical",
  `--out=${developmentPath}`,
  ...forwarded,
]);
if (development.workerFailures > 0) {
  throw new Error(`canonical development run has worker failures; qualification was not executed`);
}
const qualification = await runBenchmarkV2("qualification", [
  "--profile=canonical",
  `--out=${qualificationPath}`,
  `--development-archive=${developmentPath}`,
  ...forwarded,
]);
const retainedDevelopment = retainCompressed(development, archiveDir, `${label}-development`);
const retainedQualification = retainCompressed(qualification, archiveDir, `${label}-qualification`);
const bundlePath = resolve(archiveDir, `${label}-canonical.json`);
writeFileSync(bundlePath, `${JSON.stringify({
  schema: "line.benchmark-v2.canonical-bundle.v1",
  label,
  generatedAt: new Date().toISOString(),
  development: {
    archive: development.outputPath,
    summary: development.summaryPath,
    sha256: development.archiveSha256,
    compressedSha256: development.compressedArchiveSha256,
    retainedCompressedArchive: retainedDevelopment.archive,
    retainedSummary: retainedDevelopment.summary,
    headline: development.headline,
  },
  qualification: {
    archive: qualification.outputPath,
    summary: qualification.summaryPath,
    sha256: qualification.archiveSha256,
    compressedSha256: qualification.compressedArchiveSha256,
    retainedCompressedArchive: retainedQualification.archive,
    retainedSummary: retainedQualification.summary,
    monitorScore: qualification.qualificationMonitorScore,
  },
}, null, 2)}\n`);
console.log(`Canonical bundle: ${bundlePath}`);
return { bundlePath, development, qualification };
}

function retainCompressed(
  run: Awaited<ReturnType<typeof runBenchmarkV2>>,
  archiveDir: string,
  stem: string,
): { archive: string; summary: string } {
  const archivePath = resolve(archiveDir, `${stem}.json.gz`);
  const summaryPath = resolve(archiveDir, `${stem}.summary.json`);
  copyFileSync(`${run.outputPath}.gz`, archivePath);
  writeFileSync(`${archivePath}.sha256`, `${run.compressedArchiveSha256}  ${relativeToCwd(archivePath)}\n`);
  const summary = JSON.parse(readFileSync(run.summaryPath, "utf8"));
  writeFileSync(summaryPath, `${JSON.stringify({
    ...summary,
    retainedCompressedArchive: relativeToCwd(archivePath),
    retainedCompressedArchiveSha256: run.compressedArchiveSha256,
  }, null, 2)}\n`);
  return { archive: relativeToCwd(archivePath), summary: relativeToCwd(summaryPath) };
}

function relativeToCwd(path: string): string {
  const cwd = `${process.cwd()}/`;
  return path.startsWith(cwd) ? path.slice(cwd.length) : path;
}

if (resolve(process.argv[1] ?? "") === resolve(fileURLToPath(import.meta.url))) {
  await runCanonicalBenchmark();
}
