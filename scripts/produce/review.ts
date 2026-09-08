/** Render one preserved example of every production specification through the
 * full production renderer. This is a visual review, so creative selection
 * floors are recorded rather than used to suppress requested examples.
 * Survival/contact validity remains required. Resumes completed compiles/videos.
 *
 * LR_ENGINE=wasm node --import tsx scripts/produce/review.ts --out=generated/reviews/NAME
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { hostname } from "node:os";
import { basename, join, relative, resolve } from "node:path";
import { compilerCandidateIdentity } from "../v0/benchmark_v2/compiler_identity.ts";
import { loadSelect } from "./config.ts";
import { passesGate } from "./measure.ts";
import { ensureMirror, ensureSpectrum, renderBundle } from "./render.ts";
import { resolveJoltMs, runSeed } from "./seed.ts";

const arg = (key: string) => process.argv.find(a => a.startsWith(`--${key}=`))?.slice(key.length + 3);
const out = resolve(arg("out") ?? "generated/reviews/production-review");
const project = arg("project") ?? "production-review";
const seed = Number(arg("seed") ?? 260907010);
if (!Number.isSafeInteger(seed)) throw new Error("seed must be an integer");
const root = resolve("productions"), jolt = resolveJoltMs();
const songs = (arg("songs")?.split(",") ?? readdirSync(root).filter(s => existsSync(join(root, s, "spec.ts")))).sort();
const identity = compilerCandidateIdentity("wasm");
const gitSha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const hash = (p: string) => createHash("sha256").update(readFileSync(p)).digest("hex");
const writeJson = (p: string, value: unknown) => {
  writeFileSync(p, JSON.stringify(value, null, 2) + "\n");
  writeFileSync(p + ".sha256", hash(p) + "\n");
};
mkdirSync(out, { recursive: true });
const index: any = { schema: "line.production-video-review.v1", generatedAt: new Date().toISOString(),
  gitSha, candidateFingerprint: identity.candidateFingerprint, compilerSourceFingerprint: identity.compilerSourceFingerprint,
  engineArtifactFingerprint: identity.engineArtifactFingerprint, project, seed, songs: [],
  purpose: "Local visual review requested by the owner; no upload or publication. Creative selection floors are recorded, not enforced; physical validity is required." };
const save = () => {
  writeJson(join(out, "review.json"), index);
  writeFileSync(join(out, "README.md"), `# Production video review\n\nCompiler: ${index.candidateFingerprint}\n\n` +
    `Full production renderer: vertical 1080×1920, 60 fps, music, camera, beat punch, overlays and locked post-processing.\n\n` +
    index.songs.map((s: any) => `- [${s.song}](${s.video ?? s.compileDir + "/compile.json"}) — ${s.video ? "complete" : "compiled, render pending"}`).join("\n") + "\n");
};

// Preserve all compiler outputs before starting the browser pipeline.
for (const song of songs) {
  if (basename(song) !== song) throw new Error("song must name a production directory");
  const cfg = loadSelect(join(root, song)), work = join(out, "inputs", song);
  mkdirSync(work, { recursive: true });
  const recordPath = join(work, "compile.json");
  let record: any;
  if (existsSync(recordPath)) {
    record = JSON.parse(readFileSync(recordPath, "utf8"));
    if (record.candidateFingerprint !== identity.candidateFingerprint || record.seed !== seed ||
        record.budget !== cfg.budget || record.jolt !== jolt || record.specSha256 !== hash(cfg.spec)) {
      throw new Error(`saved compile identity differs for ${song}; use a new output directory`);
    }
    for (const [name, digest] of Object.entries(record.outputs)) if (hash(join(work, name)) !== digest) throw new Error(`corrupt ${song}/${name}`);
  } else {
    console.log(`compile ${song}, seed ${seed}, budget ${cfg.budget}`);
    const result = await runSeed({ specPath: cfg.spec, seed, budget: cfg.budget, jolt });
    if (!result.metrics.contractPassed || !result.metrics.reachedEnd || result.metrics.offBeat !== 0 || !result.budgetTelemetry) {
      throw new Error(`physical production contract failed for ${song}: ${JSON.stringify(result.metrics)}`);
    }
    writeJson(join(work, "track.json"), result.track);
    writeJson(join(work, "report.json"), result.report);
    writeJson(join(work, "budget-telemetry.json"), result.budgetTelemetry);
    const lineTypes: Record<string, number> = {};
    for (const line of result.track.lines) lineTypes[String(line.type)] = (lineTypes[String(line.type)] ?? 0) + 1;
    record = { song, seed, budget: cfg.budget, jolt, candidateFingerprint: identity.candidateFingerprint,
      specSha256: hash(cfg.spec), audioSha256: hash(cfg.audio), metrics: result.metrics, lineTypes,
      originalSelectionFloors: cfg.floors, passesOriginalSelectionFloors: passesGate(result.metrics, cfg.floors),
      outputs: Object.fromEntries(["track.json", "report.json", "budget-telemetry.json"].map(n => [n, hash(join(work, n))])) };
    writeJson(recordPath, record);
  }
  index.songs.push({ song, compileDir: relative(out, work), metrics: record.metrics, lineTypes: record.lineTypes,
    passesOriginalSelectionFloors: record.passesOriginalSelectionFloors });
  console.log(`${song}: score ${record.metrics.score}, types ${JSON.stringify(record.lineTypes)}, creative gate ${record.passesOriginalSelectionFloors}`);
  save();
}

const mirror = await ensureMirror();
try {
  for (const entry of index.songs) {
    const cfg = loadSelect(join(root, entry.song)), work = join(out, entry.compileDir);
    const final = join(out, entry.song, `${entry.song}-s${seed}`), video = join(final, "video.mp4");
    if (!existsSync(join(final, "review-validation.json"))) {
      const spectrumBase = await ensureSpectrum(cfg.audio, entry.song, join(work, "spectrum.log"));
      await renderBundle({ specPath: cfg.spec, trackPath: join(work, "track.json"), reportPath: join(work, "report.json"),
        budgetTelemetryPath: join(work, "budget-telemetry.json"), audioPath: cfg.audio, spectrumBase, seed,
        song: entry.song, project, metrics: entry.metrics, render: cfg.render,
        budget: cfg.budget, jolt, outDir: out, workDir: work, gitSha, host: hostname() });
      const probe = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_streams", "-show_format", "-of", "json", video], { encoding: "utf8" }));
      const v = probe.streams.find((s: any) => s.codec_type === "video"), a = probe.streams.find((s: any) => s.codec_type === "audio");
      if (!a || v?.width !== 1080 || v?.height !== 1920 || v?.avg_frame_rate !== "60/1") throw new Error(`unexpected video format for ${entry.song}`);
      execFileSync("ffmpeg", ["-v", "error", "-i", video, "-f", "null", "-"], { stdio: ["ignore", "ignore", "pipe"] });
      for (const name of ["track.json", "report.json", "compile.json"]) copyFileSync(join(work, name), join(final, name));
      writeJson(join(final, "review-validation.json"), { videoSha256: hash(video), decodedWithoutErrors: true, probe });
    }
    const validation = JSON.parse(readFileSync(join(final, "review-validation.json"), "utf8"));
    if (hash(video) !== validation.videoSha256) throw new Error(`saved video hash mismatch for ${entry.song}`);
    entry.video = relative(out, video); entry.videoSha256 = validation.videoSha256;
    save();
    console.log(`complete ${video}`);
  }
} finally { mirror?.kill(); }
