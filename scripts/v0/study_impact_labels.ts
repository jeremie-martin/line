/**
 * Validate impact-metric candidates against the USER'S felt labels on Shelter beats
 * (the only ground truth we have). The user's "claquage / slams into the arc"
 * framing suggests a slam is a SUDDEN redirection, so we test rate/onset variants
 * of the perpendicular (redirection) velocity change alongside the totals.
 *
 * Candidates (all CoM-based, rotation-immune):
 *   point      one-frame normal closing (current)                     /IMPACT_CAP
 *   redir      peak ⊥ velocity acquired over window (total redirect)   /IMPACT_CAP
 *   turn       net heading change (deg)                                /turnDeg cap
 *   dv         total gravity-corrected |Δv| (impulse)                  /IMPACT_CAP
 *   redirRate  PEAK per-frame ⊥ acceleration = how FAST the path bends = the "slam"
 *   redirDecay onset-weighted ⊥ velocity (exp decay, emphasize the first frames)
 *
 *   LR_ENGINE=wasm npx tsx scripts/v0/study_impact_labels.ts --track=path/to/shelter.track.json
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as SS from "./study_support.ts";

const argv = process.argv.slice(2);
const arg = (name: string): string | undefined => {
  const prefix = `--${name}=`;
  return argv.find((a) => a.startsWith(prefix))?.slice(prefix.length);
};

function usage(exitCode = 1): never {
  console.error("usage: LR_ENGINE=wasm npx tsx scripts/v0/study_impact_labels.ts --track=path/to/shelter.track.json");
  console.error("  The label fixture is intentionally explicit: shakedown/ outputs are ignored and absent in clean checkouts.");
  process.exit(exitCode);
}

if (argv.includes("--help") || argv.includes("-h")) usage(0);
const trackArg = arg("track");
if (trackArg === undefined) usage();
const trackPath = resolve(trackArg);
if (!existsSync(trackPath)) {
  console.error(`track not found: ${trackPath}`);
  usage();
}

// The labels are pinned to the EXACT trajectory the user watched. The engine/aim code
// has changed since, so re-simulating the track yields different landing physics. Pass
// --detect=<detection.json> (the saved trajectory rendered into the video) to validate
// against what was actually labeled; otherwise we re-simulate (only valid pre-drift).
const detectArg = arg("detect");
const track = JSON.parse(readFileSync(trackPath, "utf8"));
const sim = detectArg !== undefined
  ? SS.simFromDetection(track, JSON.parse(readFileSync(resolve(detectArg), "utf8")))
  : SS.simulateTrack(track);
if (detectArg !== undefined) console.log(`(using saved detection ${detectArg} — matched to the watched video)`);
const W = SS.IMPACT_WINDOW;
const hyp = Math.hypot;

// User's rough felt ordinal (5 = very strong slam … 1 = soft). Honest-vibe labels.
// Default = the original 8 hand-typed Shelter labels; --labels=<name> loads the
// dashboard annotations from generated/impact-study/<name>.labels.json instead.
const ORD: Record<string, number> = { soft: 1, soft_medium: 1.5, medium: 2, medium_strong: 2.5, strong: 3, strong_very_strong: 3.5, very_strong: 4 };
const labelsName = arg("labels");
let LABELS: { t: number; score: number; note: string; tags?: string[] }[] = [
  { t: 72.33, score: 5, note: "very strong" },
  { t: 41.13, score: 4, note: "pretty strong" },
  { t: 71.13, score: 4, note: "hard (anchor)" },
  { t: 51.93, score: 4, note: "hard (anchor)" },
  { t: 49.53, score: 3, note: "a bit less" },
  { t: 63.93, score: 3, note: "a bit less" },
  { t: 74.13, score: 3, note: "a bit less (bounce→2 small)" },
  { t: 48.33, score: 1, note: "soft (rotation)" },
];
if (labelsName !== undefined) {
  const lp = resolve(`generated/impact-study/${labelsName}.labels.json`);
  if (!existsSync(lp)) { console.error(`dashboard labels not found: ${lp}`); process.exit(1); }
  const raw = (JSON.parse(readFileSync(lp, "utf8")).labels ?? {}) as Record<string, { ordinal?: string; tags?: string[]; note?: string }>;
  LABELS = Object.entries(raw)
    .filter(([, a]) => a && a.ordinal != null && ORD[a.ordinal] !== undefined) // need an ordinal to rank
    .map(([frame, a]) => ({ t: Number(frame) / 40, score: ORD[a.ordinal!], note: (a.tags ?? []).join(",") || (a.note ?? "").slice(0, 28), tags: a.tags ?? [] }))
    .sort((x, y) => y.score - x.score);
  console.log(`(loaded ${LABELS.length} ordinal-labeled beats from ${lp})`);
  if (LABELS.length < 3) { console.error("need ≥3 beats with an INTENSITY ordinal set in the dashboard"); process.exit(1); }
}

function metrics(lf: number) {
  const v0 = sim.vel[lf - 1] ?? sim.vel[lf];
  const s = v0 ? hyp(v0.x, v0.y) : 0, hx = s > 1e-9 ? v0!.x / s : 0, hy = s > 1e-9 ? v0!.y / s : 0;
  const point = SS.pointImpactPx(sim, lf) ?? 0;
  const redir = SS.redirPx(sim, lf, W);
  const turn = SS.turnNetDeg(sim, lf, W);
  const dv = SS.velChange(sim, lf, W).dvGrav;
  const snap = SS.snapPx(sim, lf, W); // touchdown-INCLUSIVE force/suddenness (shared source)
  let redirRate = 0, redirDecay = 0, prevPerp = 0;
  for (let k = lf; k <= Math.min(sim.last, lf + W); k++) {
    const v = sim.vel[k]; if (!v) continue;
    const perp = Math.abs(hx * v.y - hy * v.x);
    if (k > lf) redirRate = Math.max(redirRate, Math.abs(perp - prevPerp)); // ⊥ accel, post-contact only
    prevPerp = perp;
    redirDecay = Math.max(redirDecay, Math.exp(-(k - lf) / 2) * perp);       // onset-weighted
  }
  return { point, redir, turn, dv, snap, redirRate, redirDecay };
}

const KEYS = ["point", "redir", "turn", "dv", "snap", "redirRate", "redirDecay"] as const;
const rows = LABELS.map((L) => {
  const lf = SS.landingNear(sim, Math.round(L.t * 40));
  return { ...L, lf, m: metrics(lf) };
});

const src = labelsName ?? "Shelter default";
console.log(`\n=== candidate metrics vs USER felt labels (${src}, ${rows.length} beats) ===`);
console.log(`  t      felt  note                      ` + KEYS.map((k) => k.padStart(10)).join(""));
for (const r of [...rows].sort((a, b) => b.score - a.score)) {
  console.log(`  ${r.t.toFixed(2)}  ${r.score}   ${r.note.padEnd(24)} ` + KEYS.map((k) => (r.m as any)[k].toFixed(2).padStart(10)).join(""));
}

// Spearman of each candidate vs the user's felt scores (higher = better match).
const felt = rows.map((r) => r.score);
console.log(`\n  Spearman(metric, felt) — how well each ranks the beats like the user (n=${rows.length}):`);
const ranked = KEYS.map((k) => ({ k, rho: SS.spearman(rows.map((r) => (r.m as any)[k]), felt) }))
  .sort((a, b) => b.rho - a.rho);
for (const { k, rho } of ranked) console.log(`    ${k.padEnd(11)} ${rho.toFixed(3)}`);

// Tag contrast (dashboard mode): a good FELT metric reads soft-tags low and
// hard-tags high. Mean candidate value over beats carrying each tag.
if (labelsName !== undefined) {
  const SOFT = ["smooth", "rotation-only", "slowdown", "nothing-felt"], HARD = ["slam", "snappy"];
  const withTag = (ts: string[]) => rows.filter((r) => (r.tags ?? []).some((g) => ts.includes(g)));
  const soft = withTag(SOFT), hard = withTag(HARD);
  if (soft.length && hard.length) {
    console.log(`\n  Tag contrast — mean metric over HARD-tagged (${hard.length}) minus SOFT-tagged (${soft.length}) beats (want > 0):`);
    const mean = (rs: typeof rows, k: string) => rs.reduce((a, r) => a + (r.m as any)[k], 0) / rs.length;
    KEYS.map((k) => ({ k, d: mean(hard, k) - mean(soft, k) })).sort((a, b) => b.d - a.d)
      .forEach(({ k, d }) => console.log(`    ${k.padEnd(11)} ${d >= 0 ? "+" : ""}${d.toFixed(3)}`));
  } else {
    console.log(`\n  (tag contrast skipped — tag some beats smooth/slowdown/rotation-only vs slam/snappy)`);
  }
}

if (labelsName !== undefined) process.exit(0); // the blocks below are Shelter-default specific

// Pairwise check on the key discriminations the user made.
console.log(`\n  Key user discriminations — does the metric agree?`);
const at = (t: number) => rows.find((r) => Math.abs(r.t - t) < 0.5)!.m;
const cmp = (k: typeof KEYS[number], hi: number, lo: number, label: string) => {
  const a = (at(hi) as any)[k], b = (at(lo) as any)[k];
  return `${k}:${a > b ? "✓" : "✗"}`;
};
console.log(`    72.33 > 49.53 (very strong > a bit less): ` + KEYS.map((k) => cmp(k, 72.33, 49.53, "")).join("  "));
console.log(`    41.13 > 49.53 (pretty > a bit less):       ` + KEYS.map((k) => cmp(k, 41.13, 49.53, "")).join("  "));
console.log(`    72.33 > 63.93 (very strong > a bit less):  ` + KEYS.map((k) => cmp(k, 72.33, 63.93, "")).join("  "));

// Window sweep for `redir`: does a SHORTER window (only sudden redirection counts)
// sharpen the felt match — esp. the 41.13 (sudden) > 63.93 (gradual) call?
console.log(`\n  redir window sweep — Spearman(redir_W, felt) and the 41.13>63.93 (sudden>gradual) call:`);
const lf41 = rows.find((r) => Math.abs(r.t - 41.13) < 0.5)!.lf, lf63 = rows.find((r) => Math.abs(r.t - 63.93) < 0.5)!.lf;
for (const w of [4, 5, 6, 7, 8, 10, 12]) {
  const rd = rows.map((r) => SS.redirPx(sim, r.lf, w)), tn = rows.map((r) => SS.turnNetDeg(sim, r.lf, w));
  const a = SS.redirPx(sim, lf41, w), b = SS.redirPx(sim, lf63, w);
  console.log(`    W=${String(w).padStart(2)}  redir ρ ${SS.spearman(rd, felt).toFixed(3)}  turn ρ ${SS.spearman(tn, felt).toFixed(3)}   41.13=${a.toFixed(2)} vs 63.93=${b.toFixed(2)}  ${a > b ? "✓" : "✗"}`);
}
