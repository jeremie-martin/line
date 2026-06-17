/**
 * produce — the anytime, balanced, multi-song video producer.
 *
 *   LR_ENGINE=wasm node --import tsx scripts/produce/produce.ts \
 *     [--songs=luna_bala_44s,tiki_tiki_48s]   (default: every productions/<song> with a spec.ts)
 *     [--jobs=N]            (compile lanes; default half the cores)
 *     [--render-jobs=1]     (parallel renders; render is the bottleneck)
 *     [--per-song-target=N] (auto-stop each song at N bundles, exit when all done; omit = run until Ctrl-C)
 *     [--seed-base=N | --auto-seed-base]  (disjoint seed block per machine — see below)
 *     [--inbox=generated/bundles] [--project=line]   (project = upload label + inbox root)
 *
 * Seeds: a video is fully determined by (song, seed, budget), so uniqueness = unique
 * (song, seed). A per-host cursor (productions/<song>/.produce-cursor-<host>.json)
 * advances monotonically and persists, so one machine never repeats a seed (across
 * restarts too); the inbox is also checked to skip seeds already bundled. ACROSS
 * machines, give each a disjoint block: --seed-base=N (machine 2 → 1000000, etc.) or
 * --auto-seed-base (hash of hostname). Default 0 = small readable seeds, one machine.
 *
 * Architecture (the plan's producer-consumer, balanced by bundle count):
 *   compile lanes ──pick the song MOST BEHIND on bundles──▶ gate ──▶ render queue ──▶ render lane ──▶ atomic bundle
 * A song with a low qualify rate simply draws more compile attempts to keep its
 * bundle count level — equal output falls out, no per-song tuning. Compile is cheap
 * and in worker_threads; rendering drives Playwright/Remotion children on the main
 * loop. Ctrl-C is safe: in-flight renders finish (atomic commit), cursors persist.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, renameSync, rmSync } from "node:fs";
import { resolve, join, relative } from "node:path";
import { availableParallelism, hostname } from "node:os";
import { execSync } from "node:child_process";
import { spawnSeedWorker } from "./pool.ts";
import { resolveJoltMs } from "./seed.ts";
import { loadSelect, type SelectConfig } from "./config.ts";
import { passesGate } from "./measure.ts";
import type { SeedMetrics } from "./measure.ts";
import { renderBundle, ensureMirror, ensureSpectrum, bundleExistsForSeed } from "./render.ts";

const ROOT = resolve(import.meta.dirname, "..", "..");
const argv = process.argv.slice(2);
const arg = (n: string): string | null => { const m = argv.find((a) => a.startsWith(`--${n}=`)); return m ? m.slice(n.length + 3) : null; };

const PRODUCTIONS = resolve(ROOT, "productions");
const inbox = resolve(arg("inbox") ?? join(ROOT, "generated", "bundles"));
const PROJECT = arg("project") ?? "line"; // upload label + inbox root; song subdivides within
const scratchDir = resolve(ROOT, "generated", "produce", "scratch");
// Each launch writes into its own timestamped run dir — a self-contained batch you
// can copy straight to the downstream processor. --run=<stamp> resumes into one.
function runStampNow(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getFullYear() % 100)}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}
const runStamp = arg("run") ?? runStampNow();
const runDir = join(inbox, runStamp);
const jobs = Math.max(1, arg("jobs") !== null ? Number(arg("jobs")) : Math.floor(availableParallelism() / 2));
const renderJobs = Math.max(1, arg("render-jobs") !== null ? Number(arg("render-jobs")) : 1);
const perSongTarget = arg("per-song-target") !== null ? Number(arg("per-song-target")) : null;
const MAX_ATTEMPTS_PER_BUNDLE = arg("max-attempts") !== null ? Number(arg("max-attempts")) : 500;
const jolt = resolveJoltMs();
const host = hostname();
const gitSha = (() => { try { return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim() || "unknown"; } catch { return "unknown"; } })();

// Disjoint per-machine seed block. makeRng does `seed | 0`, so seeds need only be
// distinct within a 2^32 window: a 14-bit host bucket × a 262144-seed stride keeps
// every host's block separate and inside that window.
function autoSeedBase(name: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < name.length; i++) { h ^= name.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) & 0x3fff) * 0x40000;
}
const seedBase = arg("seed-base") !== null ? Number(arg("seed-base"))
  : argv.includes("--auto-seed-base") ? autoSeedBase(host) : 0;

function discoverSongs(): string[] {
  if (!existsSync(PRODUCTIONS)) return [];
  return readdirSync(PRODUCTIONS, { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(join(PRODUCTIONS, e.name, "spec.ts")))
    .map((e) => e.name).sort();
}
const songNames = arg("songs") ? arg("songs")!.split(",").map((s) => s.trim()).filter(Boolean) : discoverSongs();
if (songNames.length === 0) { console.error("no songs (expected productions/<song>/spec.ts)"); process.exit(1); }

// Existing committed bundles for a song in THIS run dir (0 for a fresh run; nonzero
// only when --run= resumes into an existing dir) — keeps a resumed run balanced.
function countBundles(song: string): number {
  const root = join(runDir, song);
  if (!existsSync(root)) return 0;
  return readdirSync(root, { withFileTypes: true }).filter((e) => e.isDirectory() && e.name.startsWith(`${song}-s`)).length;
}

type SongState = {
  name: string; cfg: SelectConfig; spectrumBase: string;
  cursor: number; cursorPath: string;
  committed: number; inFlight: number;
  attempts: number; attemptsSinceBundle: number; qualified: number;
  parked: boolean;
};

function loadCursor(p: string): number {
  try { return Number(JSON.parse(readFileSync(p, "utf8")).next) || 0; } catch { return 0; }
}
function saveCursor(s: SongState): void {
  const tmp = `${s.cursorPath}.tmp`;
  writeFileSync(tmp, JSON.stringify({ host, next: s.cursor }));
  renameSync(tmp, s.cursorPath);
}

// ── bounded async queue (the compile→render bridge; backpressure + Ctrl-C drop) ──
type RenderItem = { song: SongState; seed: number; trackPath: string; reportPath: string; metrics: SeedMetrics };
class Queue {
  private items: RenderItem[] = [];
  private pulls: ((v: RenderItem | null) => void)[] = [];
  private pushes: (() => void)[] = [];
  private closed = false;
  constructor(private maxDepth: number) {}
  get size() { return this.items.length; }
  async push(it: RenderItem): Promise<void> {
    while (this.items.length >= this.maxDepth && !this.closed) await new Promise<void>((r) => this.pushes.push(r));
    if (this.closed) return;
    const w = this.pulls.shift();
    if (w) w(it); else this.items.push(it);
  }
  async pull(): Promise<RenderItem | null> {
    if (this.items.length) { const it = this.items.shift()!; this.pushes.shift()?.(); return it; }
    if (this.closed) return null;
    return new Promise<RenderItem | null>((r) => this.pulls.push(r));
  }
  closeAndDrop(): void { this.closed = true; this.items = []; this.pulls.forEach((w) => w(null)); this.pulls = []; this.pushes.forEach((w) => w()); this.pushes = []; }
  close(): void { this.closed = true; this.pulls.forEach((w) => w(null)); this.pulls = []; this.pushes.forEach((w) => w()); this.pushes = []; }
}

const songs: SongState[] = [];
const queue = new Queue(Math.max(2, renderJobs * 2));
let stopping = false;
const rel = (p: string) => relative(ROOT, p);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function targetMet(s: SongState): boolean { return perSongTarget !== null && s.committed + s.inFlight >= perSongTarget; }
function active(s: SongState): boolean { return !s.parked && !targetMet(s); }

/** Pick the active song most behind on bundles (committed + in-flight). null if none. */
function pickSong(): SongState | null {
  let best: SongState | null = null;
  for (const s of songs) {
    if (!active(s)) continue;
    if (best === null || (s.committed + s.inFlight) < (best.committed + best.inFlight)) best = s;
  }
  return best;
}
function nextSeed(s: SongState): number {
  // Skip seeds we already have a bundle for (resume / multi-machine idempotence).
  for (;;) {
    const seed = s.cursor++;
    saveCursor(s);
    if (!bundleExistsForSeed(runDir, s.name, seed)) return seed;
  }
}
function cleanupScratch(base: string): void {
  for (const f of [`${base}.track.json`, `${base}.report.json`]) { try { rmSync(f, { force: true }); } catch { /* best-effort */ } }
}
const anyInPipeline = () => songs.some((s) => s.inFlight > 0) || queue.size > 0;

async function compileLane(): Promise<void> {
  while (!stopping) {
    const song = pickSong();
    if (!song) {
      if (anyInPipeline()) { await sleep(150); continue; } // wait out the last renders
      break;                                               // all songs done/parked, nothing in flight
    }
    const seed = nextSeed(song);
    song.attempts++; song.attemptsSinceBundle++;
    const base = join(scratchDir, `${song.name}-s${seed}`);
    const msg = await spawnSeedWorker({
      specPath: song.cfg.spec, seed, budget: song.cfg.budget, jolt,
      trackOutPath: `${base}.track.json`, reportOutPath: `${base}.report.json`,
    });
    if (stopping) { cleanupScratch(base); break; }
    if (msg.ok && passesGate(msg.metrics, song.cfg.floors)) {
      song.qualified++; song.attemptsSinceBundle = 0;
      // Reserve atomically (no await between check and inFlight++): once enough are in
      // the pipeline for the target, drop the extra qualifier instead of overshooting.
      if (perSongTarget !== null && song.committed + song.inFlight >= perSongTarget) {
        cleanupScratch(base);
      } else {
        song.inFlight++;
        await queue.push({ song, seed, trackPath: msg.trackPath!, reportPath: msg.reportPath!, metrics: msg.metrics });
      }
    } else {
      cleanupScratch(base);
      if (song.attemptsSinceBundle >= MAX_ATTEMPTS_PER_BUNDLE) {
        song.parked = true;
        console.log(`! park ${song.name}: ${song.attemptsSinceBundle} attempts, no qualifier — floors likely too high (score≥${song.cfg.floors.score}, stand≥${song.cfg.floors.standTimePctMin}%)`);
      }
    }
  }
}

async function renderLane(): Promise<void> {
  for (;;) {
    const item = await queue.pull();
    if (item === null) return;
    const { song, seed } = item;
    try {
      const dir = await renderBundle({
        specPath: song.cfg.spec, trackPath: item.trackPath, reportPath: item.reportPath,
        audioPath: song.cfg.audio, spectrumBase: song.spectrumBase, seed, song: song.name, project: PROJECT,
        metrics: item.metrics, render: song.cfg.render, budget: song.cfg.budget, outDir: runDir,
        workDir: scratchDir, gitSha, host,
      });
      song.committed++; song.attemptsSinceBundle = 0;
      console.log(`✓ ${song.name} s${seed}  score ${item.metrics.score.toFixed(0)} stand ${item.metrics.standTimePct.toFixed(1)}%  →  ${rel(dir)}   [${song.name}: ${song.committed}${perSongTarget ? "/" + perSongTarget : ""}]`);
    } catch (e) {
      console.log(`✗ render failed ${song.name} s${seed}: ${String(e).slice(0, 160)}`);
    } finally {
      song.inFlight--;
      cleanupScratch(join(scratchDir, `${song.name}-s${seed}`));
      if (perSongTarget !== null && songs.every((s) => s.committed >= perSongTarget)) requestStop("per-song target reached");
    }
  }
}

let stopReason = "";
function requestStop(reason: string): void {
  if (stopping) return;
  stopping = true; stopReason = reason;
  queue.closeAndDrop(); // drop not-yet-started renders; in-flight ones finish their atomic commit
}

async function main(): Promise<void> {
  mkdirSync(scratchDir, { recursive: true });
  mkdirSync(runDir, { recursive: true });

  console.log(`produce → ${rel(runDir)}   project "${PROJECT}"\n  songs: ${songNames.join(", ")}\n  jobs ${jobs}  render-jobs ${renderJobs}  ${perSongTarget !== null ? `target ${perSongTarget}/song` : "anytime (Ctrl-C to stop)"}  jolt ${jolt}ms${seedBase ? `  seed-base ${seedBase}` : ""}\n`);

  const mirror = await ensureMirror();
  for (const name of songNames) {
    const dir = join(PRODUCTIONS, name);
    const cfg = loadSelect(dir);
    const spectrumBase = await ensureSpectrum(cfg.audio, name, join(scratchDir, `${name}.spectrum.log`));
    const cursorPath = join(dir, `.produce-cursor-${host}.json`);
    const committed = countBundles(name);
    const startCursor = Math.max(loadCursor(cursorPath), seedBase); // resume, but never below this machine's block
    songs.push({ name, cfg, spectrumBase, cursor: startCursor, cursorPath, committed, inFlight: 0, attempts: 0, attemptsSinceBundle: 0, qualified: 0, parked: false });
    console.log(`  ${name}: floors score≥${cfg.floors.score} stand≥${cfg.floors.standTimePctMin}% rot≥${cfg.floors.rotationsMin}  · cursor @ ${startCursor}`);
  }
  console.log("");

  process.on("SIGINT", () => {
    if (stopping) { console.log("\nforce quit"); process.exit(130); }
    console.log("\n⏹  stopping — letting in-flight renders finish (Ctrl-C again to force)...");
    requestStop("SIGINT");
  });

  const compilers = Array.from({ length: jobs }, () => compileLane());
  const renderers = Array.from({ length: renderJobs }, () => renderLane());
  await Promise.all(compilers);
  queue.close(); // compile lanes are done; let renderers drain the queue then exit
  await Promise.all(renderers);

  // sweep disposable scratch inputs (qualifiers dropped on stop leave track/report behind)
  for (const f of readdirSync(scratchDir)) {
    if (f.endsWith(".track.json") || f.endsWith(".report.json")) { try { rmSync(join(scratchDir, f)); } catch { /* best-effort */ } }
  }
  mirror?.kill();
  console.log(`\ndone${stopReason ? ` (${stopReason})` : ""}:`);
  for (const s of songs) console.log(`  ${s.name}: ${s.committed} bundles  (${s.qualified} qualified / ${s.attempts} compiled${s.parked ? ", PARKED" : ""})`);
  console.log(`run dir → ${rel(runDir)}`);
}

await main();
