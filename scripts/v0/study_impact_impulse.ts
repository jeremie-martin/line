/**
 * Redirection-impulse campaign (2026-07-30, docs/impact_definition.md): validate the
 * contacted-frame accumulated candidates against EVERY felt-label set at once, plus
 * the two zero-label checks (soft-end resolution, prod↔candidate divergence).
 *
 * Candidates (all CoM-based, px/frame, window = IMPACT_WINDOW unless noted):
 *   redirArc  v·Δθ_net             — the PRE-PROMOTION metric (baseline; LEGACY since 2026-07-31)
 *   cArc      Σ v̄·|Δθ| contacted   — accumulated, contacted frames only, raw velocities
 *                                     (PROMOTED 2026-07-31: this is now the scored metric)
 *   cArcG     Σ v̄·|Δθ| contacted   — per-step gravity subtracted (Codex dashboard lane;
 *                                     carries a ~GRAVITY px/f/frame support artifact)
 *   cArcOn    cArc with exp(-dt/4) — onset-weighted (perceptual attribution arm)
 *   redir     peak v·sinΔθ          — historical continuity
 *   turn      Δθ_net (deg)          — historical continuity
 *
 * Reads tracks from generated/<n>.track.json and labels from
 * generated/impact-study/<n>.labels.json, falling back to the tracked backups in
 * labels/impact/. Labels were pinned to June trajectories; a labeled frame with no
 * landing within ±6 of today's re-simulation is counted as DRIFT and skipped.
 *
 *   LR_ENGINE=wasm npx tsx scripts/v0/study_impact_impulse.ts
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import * as SS from "./impact_support.ts";
import { FPS, IMPACT_RULER, normImpact } from "./types.ts";

const W = SS.IMPACT_WINDOW;

/** Pre-promotion `IMPACT_RULER.VERY_STRONG`, frozen. `normImpact` now anchors the SCORED
 *  impulse (7.55); running it over a legacy `redirArc` raw value would print a hybrid
 *  that is neither metric on its own scale. Legacy readouts normalize by this instead. */
const OLD_VSTRONG = 7.29;
const legacyNorm = (px: number) => Math.max(0, Math.min(1, px / OLD_VSTRONG));

/** Discriminating sets (the 2026-06-14 adjudication) first; reference sets after. */
const DISCRIMINATING = ["impact_lab_v2", "climb_terrace", "rolling_drop", "staircase"] as const;
const REFERENCE = ["shelter_impact_2m", "believer_impact_2m"] as const;
const SETS = [...DISCRIMINATING, ...REFERENCE];

const firstExisting = (...paths: string[]): string | undefined => paths.map((p) => resolve(p)).find(existsSync);

type Cand = "redirArc" | "cArc" | "cArcG" | "cArcOn" | "redir" | "turn";
const CANDS: Cand[] = ["redirArc", "cArc", "cArcG", "cArcOn", "redir", "turn"];
function candidates(sim: SS.Sim, lf: number): Record<Cand, number> {
  return {
    redirArc: SS.legacyNetRedirArcPx(sim, lf, W),
    cArc: SS.contactRedirArcPx(sim, lf, W),
    cArcG: SS.contactRedirArcPx(sim, lf, W, { stepGravity: true }),
    cArcOn: SS.contactRedirArcPx(sim, lf, W, { tau: 4 }),
    redir: SS.legacyPerpendicularRedirectionPx(sim, lf, W),
    turn: SS.turnNetDeg(sim, lf, W),
  };
}

type LabeledRow = { set: string; frame: number; felt: number; m: Record<Cand, number> };
type LandingRow = { set: string; frame: number; m: Record<Cand, number> };
const labeled: LabeledRow[] = [];
const landings: LandingRow[] = [];
const perSetRho: Record<string, Partial<Record<Cand, number>>> = {};
const sims = new Map<string, SS.Sim>();
const annotatedFrames = new Map<string, number[]>(); // frames with ANY annotation (ordinal/tags/note)

for (const name of SETS) {
  const trackPath = firstExisting(`generated/${name}.track.json`, `labels/impact/${name}.track.json`);
  const labelPath = firstExisting(`generated/impact-study/${name}.labels.json`, `labels/impact/${name}.labels.json`);
  if (!trackPath || !labelPath) { console.log(`[${name}] SKIPPED (track or labels missing)`); continue; }
  const sim = SS.simulateTrack(JSON.parse(readFileSync(trackPath, "utf8")));
  sims.set(name, sim);

  for (const e of sim.det.events) {
    if (e.type !== "landing" || e.frame < 2 || e.frame > sim.last - 1) continue;
    landings.push({ set: name, frame: e.frame, m: candidates(sim, e.frame) });
  }

  const raw = (JSON.parse(readFileSync(labelPath, "utf8")).labels ?? {}) as
    Record<string, { ordinal?: string | null; tags?: string[]; note?: string }>;
  annotatedFrames.set(name, Object.entries(raw)
    .filter(([, a]) => a && (a.ordinal || a.tags?.length || a.note?.trim()))
    .map(([f]) => Number(f)));
  // Three June sets carry intensity only in free-text voice notes (the dashboard
  // ordinal was never filled). labels/impact/<n>.levels.json is the persisted
  // interpretation of those notes (numeric, FELT_ORDINAL scale) — per-beat fallback.
  const levelsPath = firstExisting(`labels/impact/${name}.levels.json`);
  const overlay = levelsPath
    ? (JSON.parse(readFileSync(levelsPath, "utf8")).levels ?? {}) as Record<string, { felt: number }>
    : {};
  let drift = 0;
  const rows: LabeledRow[] = [];
  for (const [frameKey, a] of Object.entries(raw)) {
    // An ordinal outside FELT_ORDINAL (or an empty one) carries no level — fall back to the
    // levels.json overlay rather than silently dropping the beat.
    const felt = (a?.ordinal ? SS.FELT_ORDINAL[a.ordinal] : undefined) ?? overlay[frameKey]?.felt;
    if (felt === undefined) continue;
    const lf = SS.landingNear(sim, Number(frameKey));
    if (lf < 0) { drift++; continue; }
    rows.push({ set: name, frame: lf, felt, m: candidates(sim, lf) });
  }
  labeled.push(...rows);
  const felt = rows.map((r) => r.felt);
  perSetRho[name] = Object.fromEntries(
    CANDS.map((k) => [k, rows.length >= 3 ? SS.spearman(rows.map((r) => r.m[k]), felt) : NaN]),
  );
  console.log(`[${name}] ${rows.length} leveled beats (${drift} drifted), ${landings.filter((l) => l.set === name).length} landings total`);
}

// ── 1. felt Spearman per set + pooled mean over the discriminating sets ────────
console.log(`\n=== Spearman(candidate, felt) per label set ===`);
console.log(`  ${"set".padEnd(20)}  n ` + CANDS.map((k) => k.padStart(9)).join(""));
for (const name of SETS) {
  const rho = perSetRho[name]; if (!rho) continue;
  const n = labeled.filter((r) => r.set === name).length;
  const ref = (REFERENCE as readonly string[]).includes(name) ? " (ref)" : "";
  console.log(`  ${(name + ref).padEnd(20)} ${String(n).padStart(2)} ` +
    CANDS.map((k) => (rho[k] ?? NaN).toFixed(3).padStart(9)).join(""));
}
const pooled = CANDS.map((k) => ({
  k,
  mean: SS.mean(DISCRIMINATING.map((n) => perSetRho[n]?.[k]).filter((x): x is number => Number.isFinite(x))),
})).sort((a, b) => b.mean - a.mean);
console.log(`  ${"MEAN (discriminating)".padEnd(23)} ` + CANDS.map((k) => pooled.find((p) => p.k === k)!.mean.toFixed(3).padStart(9)).join(""));
console.log(`  ranking: ` + pooled.map((p) => `${p.k} ${p.mean.toFixed(3)}`).join(" > "));

// ── 1b. window-neighbor robustness: W is a perceptual constant (~150 ms), so the
//        question is W5/6/7 stability, not W3-vs-12 (which SHOULD differ). ───────
console.log(`\n=== pooled mean Spearman (discriminating sets) vs window W ===`);
console.log(`   W   redirArc     cArc`);
for (const w of [4, 5, 6, 7, 8]) {
  const rhoAt = (k: "redirArc" | "cArc") => SS.mean(DISCRIMINATING.map((n) => {
    const rs = labeled.filter((r) => r.set === n); if (rs.length < 3) return NaN;
    const sim = sims.get(n)!;
    const xs = rs.map((r) => k === "redirArc" ? SS.legacyNetRedirArcPx(sim, r.frame, w) : SS.contactRedirArcPx(sim, r.frame, w));
    return SS.spearman(xs, rs.map((r) => r.felt));
  }).filter((x) => Number.isFinite(x)));
  console.log(`  ${String(w).padStart(2)}${w === W ? "*" : " "} ` + [rhoAt("redirArc"), rhoAt("cArc")].map((x) => x.toFixed(3).padStart(9)).join(""));
}

// ── 2. soft-end resolution: median raw value per felt level (all leveled beats) ─
console.log(`\n=== median raw px/frame per felt level (soft-end resolution check) ===`);
const bucket = (felt: number) => Math.round(felt * 2) / 2; // quarter-step relative levels → 0.5 buckets
const levels = [...new Set(labeled.map((r) => bucket(r.felt)))].sort((a, b) => a - b);
console.log(`  felt   n ` + CANDS.map((k) => k.padStart(9)).join(""));
for (const lv of levels) {
  const rs = labeled.filter((r) => bucket(r.felt) === lv);
  console.log(`  ${String(lv).padStart(4)} ${String(rs.length).padStart(3)} ` +
    CANDS.map((k) => SS.pct(rs.map((r) => r.m[k]), 0.5).toFixed(2).padStart(9)).join(""));
}
const gap = (k: Cand, lo: number, hi: number) => {
  const a = labeled.filter((r) => bucket(r.felt) === lo), b = labeled.filter((r) => bucket(r.felt) === hi);
  return a.length && b.length ? SS.pct(b.map((r) => r.m[k]), 0.5) - SS.pct(a.map((r) => r.m[k]), 0.5) : NaN;
};
console.log(`  soft(1)→medium(2) median gap (want > 0, June redirArc was ~0): ` +
  CANDS.map((k) => `${k} ${gap(k, 1, 2).toFixed(2)}`).join("  "));

// ── 3. provisional normalization anchors ───────────────────────────────────────
console.log(`\n=== raw envelope across ${landings.length} landings (provisional caps; real cap = calibrate_corpus) ===`);
console.log(`  cand        p50     p90     p95     p99     max`);
for (const k of CANDS) {
  const xs = landings.map((l) => l.m[k]);
  console.log(`  ${k.padEnd(8)}` + [0.5, 0.9, 0.95, 0.99].map((p) => SS.pct(xs, p).toFixed(2).padStart(8)).join("") +
    Math.max(...xs).toFixed(2).padStart(8));
}

// ── 4. divergence shortlist: where the candidate most disagrees with production ─
// Percentile-rank both within the pooled landing population (scale-free), rank |Δ|.
const pctRank = (xs: number[]) => {
  const sorted = [...xs].sort((a, b) => a - b);
  return xs.map((x) => sorted.findIndex((s) => s >= x) / Math.max(1, sorted.length - 1));
};
const prodPct = pctRank(landings.map((l) => l.m.redirArc));
// The labeling shortlist: beats where the challenger most rank-disagrees with
// production are the ONLY informative ones to label next (agreeing beats carry no
// signal for the promote-or-keep decision). Written with dashboard deep links.
{
  const candPct = pctRank(landings.map((l) => l.m.cArc));
  const ranked = landings
    .map((l, i) => ({ ...l, d: candPct[i] - prodPct[i] }))
    .sort((a, b) => Math.abs(b.d) - Math.abs(a.d))
    .slice(0, 16);
  // ✓ only when the beat actually yielded a FELT LEVEL (ordinal or levels.json overlay) — an
  // annotation that is note-only carries no level and contributes nothing to the adjudication,
  // so it must not read as done (shelter_impact_2m / believer_impact_2m are entirely note-only).
  const isLeveled = (r: LandingRow) => labeled.some((l) => l.set === r.set && Math.abs(l.frame - r.frame) <= 6);
  const hasNote = (r: LandingRow) => (annotatedFrames.get(r.set) ?? []).some((f) => Math.abs(f - r.frame) <= 6);
  const md = [
    `# Impact labeling shortlist — SCORED (cArc) ↔ LEGACY (redirArc) divergence`,
    ``,
    `The ${ranked.length} landings (of ${landings.length}) where the challenger most rank-disagrees with the`,
    `production metric. Label THESE in the dashboard (set the INTENSITY ordinal!), then rerun`,
    `\`LR_ENGINE=wasm npx tsx scripts/v0/study_impact_impulse.ts\`. Regenerate this file the same way.`,
    ``,
    `NOTE the two [0,1] columns use each metric's OWN anchor (SCORED ÷ ${IMPACT_RULER.VERY_STRONG}, LEGACY ÷ ${OLD_VSTRONG},`,
    `the pre-promotion value). The dashboard board deliberately puts BOTH lanes on the shipped`,
    `anchor so the bars are directly comparable, so its LEGACY bar reads slightly lower than this column.`,
    ``,
    `| open | set | frame | t(s) | Δpct | SCORED [0,1] | LEGACY [0,1] | cArc raw | leveled? |`,
    `|---|---|---|---|---|---|---|---|---|`,
    ...ranked.map((r) =>
      `| [▶](http://127.0.0.1:8767/impact/?data=/generated/impact-study/${r.set}.bundle.json&frame=${r.frame}) ` +
      `| ${r.set} | ${r.frame} | ${(r.frame / FPS).toFixed(2)} | ${r.d >= 0 ? "+" : ""}${r.d.toFixed(2)} ` +
      `| ${normImpact(r.m.cArc).toFixed(2)} | ${legacyNorm(r.m.redirArc).toFixed(2)} ` +
      `| ${r.m.cArc.toFixed(2)} | ${isLeveled(r) ? "✓" : hasNote(r) ? "note only" : "**no**"} |`),
    ``,
  ].join("\n");
  // The study reads its inputs from the tracked labels/impact/ fallback, so it must run on a
  // fresh checkout where generated/ was never built — create the output directory ourselves.
  mkdirSync(resolve("generated/impact-study"), { recursive: true });
  writeFileSync(resolve("generated/impact-study/shortlist.md"), md);
  console.log(`\n(wrote generated/impact-study/shortlist.md — ${ranked.filter((r) => !isLeveled(r)).length}/${ranked.length} still unlabeled)`);
}
for (const cand of ["cArc", "cArcOn"] as const) {
  const candPct = pctRank(landings.map((l) => l.m[cand]));
  const ranked = landings
    .map((l, i) => ({ ...l, d: candPct[i] - prodPct[i] }))
    .sort((a, b) => Math.abs(b.d) - Math.abs(a.d));
  console.log(`\n=== top divergence redirArc ↔ ${cand} (label these first; Δ = ${cand}pct − prodpct) ===`);
  for (const r of ranked.slice(0, 12)) {
    console.log(`  ${r.set.padEnd(20)} frame ${String(r.frame).padStart(5)}  t=${(r.frame / FPS).toFixed(2).padStart(7)}s` +
      `  Δ ${r.d >= 0 ? "+" : ""}${r.d.toFixed(2)}  redirArc ${r.m.redirArc.toFixed(2).padStart(5)} (${legacyNorm(r.m.redirArc).toFixed(2)} legacy-norm)` +
      `  ${cand} ${r.m[cand].toFixed(2).padStart(5)}`);
  }
}

// ── 5. the shelter attribution pair (2894 felt strong, 2845 felt smooth) ───────
const shelter = sims.get("shelter_impact_2m");
if (shelter) {
  console.log(`\n=== shelter attribution pair — want: metric(2894) > metric(2845) ===`);
  const rows = [2894, 2845].map((f) => ({ f, lf: SS.landingNear(shelter, f) }));
  for (const { f, lf } of rows) {
    if (lf < 0) { console.log(`  frame ${f}: no landing within ±6 (drift)`); continue; }
    const m = candidates(shelter, lf);
    console.log(`  frame ${f} (landing ${lf}): ` + CANDS.map((k) => `${k} ${m[k].toFixed(2)}`).join("  "));
  }
  const a = rows[0], b = rows[1];
  if (a.lf >= 0 && b.lf >= 0) {
    const ma = candidates(shelter, a.lf), mb = candidates(shelter, b.lf);
    console.log(`  verdict: ` + CANDS.map((k) => `${k}:${ma[k] > mb[k] ? "✓" : "✗"}`).join("  "));
  }
}
