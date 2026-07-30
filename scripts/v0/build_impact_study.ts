/**
 * Build the per-track IMPACT STUDY bundle for the dashboard at `/impact/`:
 *   - every landing's full candidate-metric vector (point/redir/snap/turn/dv/jolt/…),
 *     computed through the canonical impact_support.ts definitions (one window, one set
 *     of caps) so the dashboard and the scorer can never silently diverge;
 *   - a short looping mini-CLIP cut from the ride video around each landing, so a felt
 *     judgment needs one click, not scrubbing;
 *   - a plain markdown reference INDEX (t · beat# · phase · every metric · clip path) so
 *     impacts are easy to reference even away from the dashboard.
 *
 * The point is the feedback-driven metric search: the user labels impacts here, and
 * study_impact_labels.ts --labels=<this name> ranks every candidate metric against those
 * labels. Analysis-only; the production scorer/fingerprint are untouched.
 *
 *   LR_ENGINE=wasm npx tsx scripts/v0/build_impact_study.ts \
 *     --name=shelter_impact_2m \
 *     --track=shakedown/shelter_impact_2m/track.json \
 *     --video=shakedown/shelter_impact_2m/video_with_audio.mp4 \
 *     [--detect=shakedown/shelter_impact_2m/detection.json]  # validate vs the WATCHED run \
 *     [--report=generated/shelter_impact_2m.report.json] [--spec=scripts/v0/specs/shelter_impact.ts] \
 *     [--pre=0.7 --post=0.7]   # clip seconds before/after the landing
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { pathToFileURL } from "node:url";
import { FPS, REDIRARC, secToFrame, type DriftReport } from "./types.ts";
import * as SS from "./impact_support.ts";

const argv = process.argv.slice(2);
const arg = (name: string): string | undefined => argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const need = (name: string): string => {
  const v = arg(name);
  if (v === undefined) { console.error(`missing --${name}=`); process.exit(1); }
  return v;
};

const name = need("name");
const trackPath = resolve(need("track"));
const videoPath = resolve(need("video"));
const detectArg = arg("detect");
const reportArg = arg("report");
const specArg = arg("spec");
const pre = Number(arg("pre") ?? "0.7");
const post = Number(arg("post") ?? "0.7");
const skipClips = argv.includes("--skip-clips"); // rewrite bundle/index, keep existing clips

if (!existsSync(trackPath)) { console.error(`track not found: ${trackPath}`); process.exit(1); }
if (!existsSync(videoPath)) { console.error(`video not found: ${videoPath}`); process.exit(1); }

const outRoot = resolve("generated/impact-study");
const clipsDir = resolve(outRoot, name, "clips");
mkdirSync(clipsDir, { recursive: true });

// ── candidate metric registry — one entry per lane. `fn` returns the RAW value
//    (its own units); `cap` normalizes to [0,1] for the bars. group orders the lanes. ──
type MetricDef = { key: string; label: string; group: "com" | "body"; cap: number; sub: string; fn: (sim: SS.Sim, f: number) => number };
// Two-lane decision board (2026-07-30, docs/impact_definition.md): the SCORED
// production metric vs the ONE standing challenger, both on the production felt
// scale (raw / VERY_STRONG; SOFT = 0). The 2026-06-14 seven-candidate board and its
// corpus-percentile scale were retired with the metric zoo — the page's divergence
// (stdev over lanes) is now exactly |current − carc|/2, so "next divergent" walks
// the beats whose labels decide the promotion.
const METRICS: MetricDef[] = [
  { key: "current", label: "CURRENT", group: "com", cap: REDIRARC.VERY_STRONG,
    sub: "production · redirArc = v·Δθ_net over W6 (normImpact scale)", fn: (s, f) => SS.redirArcPx(s, f) },
  { key: "carc",    label: "CARC",    group: "com", cap: REDIRARC.VERY_STRONG,
    sub: "challenger · Σ v̄·|Δθ| contacted frames only (same scale, provisional cap)", fn: (s, f) => SS.contactRedirArcPx(s, f) },
];
const normVal = (_key: string, raw: number, cap: number): number => Math.min(1, Math.max(0, raw / cap));

// ── simulate (or load the watched detection) ──────────────────────────────────
const track = JSON.parse(readFileSync(trackPath, "utf8"));
const sim = detectArg !== undefined
  ? SS.simFromDetection(track, JSON.parse(readFileSync(resolve(detectArg), "utf8")))
  : SS.simulateTrack(track);
console.log(detectArg ? `(metrics from saved detection ${detectArg} — the watched run)` : "(metrics from re-simulation)");

// ── optional phase labels (spec overlayMeta) + authored target/achieved (report) ──
type Phase = { name: string; t0: number; t1: number };
let phases: Phase[] = [];
if (specArg) {
  try {
    const mod = await import(pathToFileURL(resolve(specArg)).href);
    phases = (mod.overlayMeta?.phases ?? []).map((p: any) => ({ name: p.name, t0: p.t0, t1: p.t1 }));
  } catch (e) { console.warn(`could not read phases from ${specArg}: ${e}`); }
}
const phaseAt = (t: number): string | null => phases.find((p) => t >= p.t0 && t < p.t1)?.name ?? null;

const scoreByFrame = new Map<number, { target: number; achieved: number }>();
if (reportArg) {
  const report: DriftReport = JSON.parse(readFileSync(resolve(reportArg), "utf8"));
  for (const g of report.gaps) {
    const impact = (g.axes as any).impact;
    if (impact !== undefined) scoreByFrame.set(secToFrame(g.t_end), { target: impact.target, achieved: impact.achieved });
  }
}

// ── per-landing metric vectors + clips ─────────────────────────────────────────
const r3 = (x: number) => Math.round(x * 1000) / 1000;
const landings = sim.det.events.filter((e) => e.type === "landing" && e.frame >= 2 && e.frame <= sim.last - 1).map((e) => e.frame);
console.log(`${landings.length} landings · cutting clips (pre ${pre}s / post ${post}s) …`);

type Beat = {
  i: number; frame: number; t: number; phase: string | null; clip: string; clipStart: number;
  values: Record<string, number>; raw: Record<string, number>;
  target: number | null; achieved: number | null;
};
const beats: Beat[] = [];
let cut = 0;
for (let i = 0; i < landings.length; i++) {
  const frame = landings[i];
  const t = frame / FPS;
  const values: Record<string, number> = {}, raw: Record<string, number> = {};
  for (const m of METRICS) { const v = m.fn(sim, frame); raw[m.key] = r3(v); values[m.key] = r3(normVal(m.key, v, m.cap)); }
  const clipName = `beat_${frame}.mp4`;
  const start = Math.max(0, t - pre);
  if (!skipClips) {
    try {
      execFileSync("ffmpeg", [
        "-y", "-loglevel", "error", "-ss", String(start), "-i", videoPath, "-t", String(pre + post),
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p", "-c:a", "aac",
        resolve(clipsDir, clipName),
      ], { stdio: ["ignore", "ignore", "pipe"] });
      cut++;
    } catch (e) { console.warn(`clip cut failed @${frame}: ${String(e).slice(0, 120)}`); }
  }
  const sc = scoreByFrame.get(frame) ?? scoreByFrame.get(frame - 1) ?? scoreByFrame.get(frame + 1) ?? null;
  beats.push({
    i, frame, t: r3(t), phase: phaseAt(t),
    clip: `/generated/impact-study/${name}/clips/${clipName}`, clipStart: r3(start),
    values, raw, target: sc ? r3(sc.target) : null, achieved: sc ? r3(sc.achieved) : null,
  });
  if ((i + 1) % 16 === 0) console.log(`  …${i + 1}/${landings.length}`);
}
console.log(`cut ${cut}/${landings.length} clips`);

// ── bundle JSON ────────────────────────────────────────────────────────────────
const videoUrl = "/" + resolve(videoPath).slice(resolve(".").length + 1);
const bundle = {
  name, fps: FPS, durationS: r3(sim.last / FPS), video: videoUrl, pre, post,
  scale: "felt-normImpact",
  metrics: METRICS.map((m) => ({ key: m.key, label: m.label, group: m.group, sub: m.sub, cap: m.cap })),
  beats,
};
const bundlePath = resolve(outRoot, `${name}.bundle.json`);
writeFileSync(bundlePath, JSON.stringify(bundle));
console.log(`wrote ${bundlePath}`);

// ── markdown reference index ─────────────────────────────────────────────────────
const cols = METRICS.map((m) => m.label);
const head = `| # | t(s) | phase | ${cols.join(" | ")} | clip |`;
const sep = `|---|---|---|${cols.map(() => "---").join("|")}|---|`;
const rows = beats.map((b) =>
  `| ${b.i} | ${b.t.toFixed(2)} | ${b.phase ?? ""} | ${METRICS.map((m) => b.values[m.key].toFixed(2)).join(" | ")} | beat_${b.frame} |`
);
const md = [
  `# Impact study reference — ${name}`,
  ``,
  `${beats.length} landings. Values on the production felt scale [0,1] (raw px/frame ÷ ${REDIRARC.VERY_STRONG}). Reference an impact by **#** or **t(s)**.`,
  `Clips: \`generated/impact-study/${name}/clips/beat_<frame>.mp4\`. Dashboard: \`/impact/?data=/generated/impact-study/${name}.bundle.json\`.`,
  ``,
  head, sep, ...rows, ``,
].join("\n");
writeFileSync(resolve(outRoot, `${name}.index.md`), md);
console.log(`wrote ${resolve(outRoot, `${name}.index.md`)}`);
console.log(`\nDashboard → http://127.0.0.1:8767/impact/?data=/generated/impact-study/${name}.bundle.json`);
