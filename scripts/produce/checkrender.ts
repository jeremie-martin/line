/**
 * Parity / smoke harness for render.ts: compile+measure one seed (the produce
 * path), then render it into a throwaway inbox and confirm a well-formed bundle.
 *
 *   LR_ENGINE=wasm node --import tsx scripts/produce/checkrender.ts [song] [seed]
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join, resolve, basename } from "node:path";
import { hostname } from "node:os";
import { runSeed, resolveJoltMs } from "./seed.ts";
import { loadSelect } from "./config.ts";
import { renderBundle, ensureMirror, ensureSpectrum } from "./render.ts";

const song = process.argv[2] ?? "productions/luna_bala_44s";
const seed = Number(process.argv[3] ?? 96);
const cfg = loadSelect(song);
const project = basename(resolve(song));
const work = resolve("generated/produce/_paritycheck");
const inbox = resolve("generated/_parity_inbox");
mkdirSync(work, { recursive: true });

console.log(`[1] compile+measure ${cfg.spec} seed ${seed} @ ${cfg.budget}`);
const { track, report, metrics } = await runSeed({ specPath: cfg.spec, seed, budget: cfg.budget, jolt: resolveJoltMs() });
console.log(`    score ${metrics.score.toFixed(0)}  stand ${metrics.standTimePct.toFixed(1)}%  rot ${metrics.rotations.toFixed(1)}  end=${metrics.reachedEnd}`);
const trackPath = join(work, `s${seed}.track.json`);
const reportPath = join(work, `s${seed}.report.json`);
writeFileSync(trackPath, JSON.stringify(track));
writeFileSync(reportPath, JSON.stringify(report));

console.log("[2] ensureMirror");
const mirror = await ensureMirror();
console.log("[3] ensureSpectrum");
const spectrumBase = await ensureSpectrum(cfg.audio, project, join(work, "spectrum.log"));
console.log("[4] renderBundle (ride → mux → overlay → remotion → bundle)");
try {
  const dir = await renderBundle({
    specPath: cfg.spec, trackPath, reportPath, audioPath: cfg.audio, spectrumBase,
    seed, song: project, project: "line", metrics, render: cfg.render, budget: cfg.budget, jolt: resolveJoltMs(), outDir: inbox,
    workDir: work, gitSha: "paritytest", host: hostname(), keepIntermediates: false,
  });
  console.log(`\nBUNDLE → ${dir}`);
} finally {
  mirror?.kill();
}
