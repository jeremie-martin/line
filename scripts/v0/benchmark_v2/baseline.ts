import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { freezeBaseline } from "../../benchmark/freeze_baseline.ts";
import { runCanonicalBenchmark, retainBenchmarkArchive } from "./canonical.ts";
import { runBenchmarkV2 } from "./runner.ts";

export async function runBaselineBenchmark(args = process.argv.slice(2)): Promise<string> {
  const argument = (name: string): string | undefined => {
    const prefix = `--${name}=`;
    return args.find((value) => value.startsWith(prefix))?.slice(prefix.length);
  };
  const label = argument("label") ?? new Date().toISOString().replaceAll(":", "-").replace(/\.\d{3}Z$/, "Z");
  const outDir = resolve(argument("out-dir") ?? "generated/benchmark-v2/baseline-runs");
  const archiveDir = resolve(argument("archive-dir") ?? "benchmark/v2/runs");
  const forwarded = args.filter((arg) =>
    !arg.startsWith("--label=") && !arg.startsWith("--out-dir=") &&
    !arg.startsWith("--archive-dir=") && !arg.startsWith("--out=") &&
    !arg.startsWith("--profile=") && !arg.startsWith("--checkpoint=")
  );
  mkdirSync(outDir, { recursive: true });
  mkdirSync(archiveDir, { recursive: true });

  const probePath = resolve(outDir, `${label}-probe.json`);
  const probe = await runBenchmarkV2("development", [
    "--profile=probe",
    `--out=${probePath}`,
    ...forwarded,
  ]);
  if (probe.workerFailures > 0) throw new Error(`baseline probe has worker failures`);
  const retainedProbe = retainBenchmarkArchive(probe, archiveDir, `${label}-probe`);

  const canonical = await runCanonicalBenchmark([
    `--label=${label}`,
    `--out-dir=${outDir}`,
    `--archive-dir=${archiveDir}`,
    ...forwarded,
  ]);
  if (canonical.qualification.workerFailures > 0) throw new Error(`baseline qualification has worker failures`);
  const canonicalBundle = JSON.parse(readFileSync(canonical.bundlePath, "utf8"));
  const bundlePath = resolve(archiveDir, `${label}-baseline.json`);
  writeFileSync(bundlePath, `${JSON.stringify({
    schema: "line.benchmark-v2.baseline-bundle.v1",
    label,
    generatedAt: new Date().toISOString(),
    probe: {
      archive: probe.outputPath,
      summary: probe.summaryPath,
      sha256: probe.archiveSha256,
      compressedSha256: probe.compressedArchiveSha256,
      retainedCompressedArchive: retainedProbe.archive,
      retainedSummary: retainedProbe.summary,
      headline: probe.headline,
    },
    development: canonicalBundle.development,
    qualification: canonicalBundle.qualification,
  }, null, 2)}\n`);
  freezeBaseline(bundlePath);
  console.log(`Baseline bundle: ${relativeToCwd(bundlePath)}`);
  return bundlePath;
}

function relativeToCwd(path: string): string {
  const cwd = `${process.cwd()}/`;
  return path.startsWith(cwd) ? path.slice(cwd.length) : path;
}

if (resolve(process.argv[1] ?? "") === resolve(fileURLToPath(import.meta.url))) {
  await runBaselineBenchmark();
}
