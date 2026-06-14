/**
 * Build the per-track IMPACT STUDY bundle for the dashboard at `/impact/`:
 *   - every landing's full candidate-metric vector (point/redir/snap/turn/dv/jolt/…),
 *     computed through the canonical study_support.ts definitions (one window, one set
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
import { FPS, secToFrame, type DriftReport } from "./types.ts";
import * as SS from "./study_support.ts";

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
// Live contenders only — the rejected/outdated metrics (point, dv, jolt, whip, deform,
// rot, window) were pruned 2026-06-14 per user feedback to keep the board clean. They
// remain in study_support.ts if ever needed for a diagnostic.
const METRICS: MetricDef[] = [
  { key: "redir",   label: "REDIR",   group: "com",  cap: SS.REDIR_CAP,     sub: "how MUCH redirected (locked metric)", fn: (s, f) => SS.redirPx(s, f) },
  { key: "redirArc",label: "REDIRarc",group: "com",  cap: SS.REDIR_CAP,     sub: "v·Δθ speed-weighted redirection (LEAD)", fn: (s, f) => SS.redirArcPx(s, f) },
  { key: "redirDec",label: "REDIR·on",group: "com",  cap: SS.REDIR_CAP,     sub: "redir, landing-weighted τ4", fn: (s, f) => SS.redirDecayPx(s, f) },
  { key: "snap",    label: "SNAP",    group: "com",  cap: SS.CAPS.snap,     sub: "suddenness · peak per-frame ⊥ change", fn: (s, f) => SS.snapPx(s, f) },
  { key: "turn",    label: "TURN",    group: "com",  cap: SS.CAPS.turnDeg,  sub: "net heading change (deg)", fn: (s, f) => SS.turnNetDeg(s, f) },
  { key: "comDecel",label: "DECEL",   group: "com",  cap: SS.CAPS.comDecel, sub: "peak decel into surface (force, LEAD)", fn: (s, f) => SS.comDecelNormalPx(s, f) },
  { key: "decelDec",label: "DECEL·on",group: "com",  cap: SS.CAPS.comDecel, sub: "decel into surface, landing-weighted τ4", fn: (s, f) => SS.comDecelDecayPx(s, f) },
];

// ── corpus percentile map (apples-to-apples [0,1]) if calibrated; else raw/cap ──
// study_impact_corpus.ts writes corpus_percentiles.json (per-metric sorted corpus values).
// When present, each lane value = fraction of corpus landings ≤ this raw value (median
// landing = 0.5, p95 = 0.95) — one comparable scale across metrics, no hand-picked cap.
// --scale picks how raw → [0,1]: p99 (default, 1.0 = top-1% hardest landing in the corpus,
// linear below — normal hits mid-scale), p95, max, or pctile (corpus percentile, median=0.5).
const SCALE = arg("scale") ?? "p99";
let CORPUS: { metrics: Record<string, { sorted: number[]; capP95: number; capP99: number }> } | null = null;
const corpusPath = resolve(outRoot, "corpus_percentiles.json");
if (existsSync(corpusPath)) { CORPUS = JSON.parse(readFileSync(corpusPath, "utf8")); console.log(`(normalizing lanes by corpus ${SCALE})`); }
function normVal(key: string, raw: number, cap: number): number {
  const m = CORPUS?.metrics[key]; const s = m?.sorted;
  if (!m || !s?.length) return Math.min(1, Math.max(0, raw / cap));
  if (SCALE === "pctile") { let lo = 0, hi = s.length; while (lo < hi) { const k = (lo + hi) >> 1; if (s[k] <= raw) lo = k + 1; else hi = k; } return lo / s.length; }
  const anchor = SCALE === "max" ? s[s.length - 1] : SCALE === "p95" ? m.capP95 : m.capP99;
  return anchor > 0 ? Math.min(1, raw / anchor) : 0;
}

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
  // ENS — mean of the two leads (REDIR·on + DECEL) on the calibrated [0,1] scale.
  values["ens"] = r3((values["redirDec"] + values["comDecel"]) / 2); raw["ens"] = values["ens"];
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
  scale: CORPUS ? `corpus-${SCALE}` : "raw/cap",
  metrics: [
    ...METRICS.map((m) => ({ key: m.key, label: m.label, group: m.group, sub: m.sub, cap: m.cap })),
    { key: "ens", label: "ENS", group: "com" as const, sub: "ensemble · mean of REDIR·on + DECEL", cap: 1 },
  ],
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
  `${beats.length} landings. Values are normalized [0,1] (per-metric cap). Reference an impact by **#** or **t(s)**.`,
  `Clips: \`generated/impact-study/${name}/clips/beat_<frame>.mp4\`. Dashboard: \`/impact/?data=/generated/impact-study/${name}.bundle.json\`.`,
  ``,
  head, sep, ...rows, ``,
].join("\n");
writeFileSync(resolve(outRoot, `${name}.index.md`), md);
console.log(`wrote ${resolve(outRoot, `${name}.index.md`)}`);
console.log(`\nDashboard → http://127.0.0.1:8767/impact/?data=/generated/impact-study/${name}.bundle.json`);
