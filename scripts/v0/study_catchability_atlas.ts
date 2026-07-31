/**
 * Catchability Atlas (2026-07-30, docs/impact_definition.md Phase 1 / Study 1).
 *
 * The empirical foundation for the cArc [0,1] scale: sweep the real determinants
 * of catchability and measure, per cell, whether the engine CATCHES the landing
 * and how much redirection impulse (cArc) it delivers. From-scratch replacement
 * for the staircase rig and the inherited asin(CATCHABLE_REDIR_FRACTION) ceiling.
 *
 * Families:
 *   flat  — single straight catch surface. entering speed s × arrival angle α
 *           (velocity vs surface) × surface absolute angle φ (uphill/flat/downhill).
 *   scoop — tangential entry onto a circular arc of radius R (curvature is the
 *           redirector), facet step ∈ {3°, 10°} (smooth vs coarse polyline).
 *
 * Every cell runs at several CONTACT-PHASE variants (different free-fall lengths
 * k with the launch velocity adjusted so the contact velocity is identical) —
 * the rider's internal pose/wobble phase at contact differs, which June measured
 * as ~17% jolt variance. The catchability boundary is defined UNDER that
 * variance: a cell is RELIABLE only if ≥80% of phases catch.
 *
 * Outcome classification (detector events + contact persistence):
 *   caught  — landing event and ≥10 contacted frames in [lf, lf+14]
 *   bouncy  — a contact event but only 3–9 contacted frames
 *   eject   — <3 contacted frames, flyThrough, or no contact at all
 *
 * All analysis bins use MEASURED contact quantities (incoming speed, measured
 * arrival angle vs the contacted line), not the constructed targets.
 *
 *   LR_ENGINE=wasm npx tsx scripts/v0/study_catchability_atlas.ts [--smoke]
 *
 * Writes generated/atlas/catchability_atlas.json (one row per run) and prints
 * the reliable-catch frontier, ceiling(speed), and the VSTRONG candidate.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import * as SS from "./impact_support.ts";

const SMOKE = process.argv.includes("--smoke");
const G = SS.GRAVITY;
const RAD = Math.PI / 180;

// ── sweep grids ───────────────────────────────────────────────────────────────
const SPEEDS = SMOKE ? [5, 11] : [3, 5, 7, 9, 11, 13, 15];    // px/frame at contact (SPEED_RULER envelope 5.4–12.6 + headroom)
const PHASES = SMOKE ? [14, 20] : [12, 15, 18, 21, 24];        // free-fall frames (pose phase)
const FLAT_ALPHA = SMOKE ? [15, 45, 75] : [5, 15, 25, 35, 45, 55, 65, 75, 85]; // deg, velocity vs surface
const FLAT_PHI = SMOKE ? [0] : [-20, 0, 20];                   // deg, surface absolute angle (+ = downhill)
const SCOOP_R = SMOKE ? [60, 190] : [25, 30, 40, 60, 90, 130, 190, 280, 400]; // px, arc radius
const SCOOP_FACET = SMOKE ? [3] : [3, 10];                     // deg per polyline facet
const SCOOP_ENTRY = 35;                                        // deg, entry direction (down-right)
const SCOOP_SWEEP = 115;                                       // deg of arc turn (ends at −80°: steep uphill,
                                                               // not overhanging; enough for the 6-frame window
                                                               // to consume full curvature at envelope speeds)

type Ln = { id: number; type: 0; x1: number; y1: number; x2: number; y2: number; flipped: false; leftExtended: false; rightExtended: false };
type Row = {
  family: "flat" | "scoop";
  // constructed cell parameters
  s: number; k: number; alpha?: number; phi?: number; R?: number; facet?: number;
  // outcome
  outcome: "caught" | "bouncy" | "eject" | "none"; lf: number; contact14: number;
  // measured at contact
  mSpeed: number; mAlpha: number; cArc: number; redirArc: number;
};

function makeTrack(lines: Ln[], v0: { x: number; y: number }, durationFrames: number) {
  return {
    label: "atlas", creator: "catchability-atlas", description: "", version: "6.2", audio: null,
    duration: durationFrames,
    startPosition: { x: 0, y: 0 },
    riders: [{ startPosition: { x: 0, y: 0 }, startVelocity: v0, remountable: 1 }],
    layers: [{ id: 0, name: "main", visible: true, editable: true }],
    script: "", lines,
  };
}

/** Ballistic CoM displacement after k frames launched at v0 (screen coords, +y down). */
function drop(v0: { x: number; y: number }, k: number): { x: number; y: number } {
  // per-frame Euler-ish (engine is Verlet; small constant offset is fine — we measure)
  let x = 0, y = 0;
  for (let i = 1; i <= k; i++) { x += v0.x; y += v0.y + G * i; }
  return { x, y };
}

/** Launch velocity so the contact velocity after k free-fall frames is s at angle psi (deg). */
function launchFor(s: number, psiDeg: number, k: number): { x: number; y: number } {
  return { x: s * Math.cos(psiDeg * RAD), y: s * Math.sin(psiDeg * RAD) - G * k };
}

let nextId = 1;
const mkLine = (x1: number, y1: number, x2: number, y2: number): Ln =>
  ({ id: nextId++, type: 0, x1, y1, x2, y2, flipped: false, leftExtended: false, rightExtended: false });

/** Flat family: one straight surface through the contact point at angle phi. */
function flatLines(C: { x: number; y: number }, phiDeg: number): Ln[] {
  const t = { x: Math.cos(phiDeg * RAD), y: Math.sin(phiDeg * RAD) };
  // short back-extension (avoid intersecting the incoming ballistic path), long ride-out
  return [mkLine(C.x - 40 * t.x, C.y - 40 * t.y, C.x + 900 * t.x, C.y + 900 * t.y)];
}

/** Scoop family: polyline arc entered tangentially at angle entryDeg, radius R,
 *  curving UP (decreasing angle) through sweepDeg, then a straight ride-out. */
function scoopLines(C: { x: number; y: number }, entryDeg: number, R: number, facetDeg: number, sweepDeg: number): Ln[] {
  const lines: Ln[] = [];
  let x = C.x - 40 * Math.cos(entryDeg * RAD), y = C.y - 40 * Math.sin(entryDeg * RAD); // small tangent lead-in
  let a = entryDeg;
  lines.push(mkLine(x, y, C.x, C.y));
  x = C.x; y = C.y;
  const steps = Math.ceil(sweepDeg / facetDeg);
  const seg = (sweepDeg / steps) * RAD * R; // chord ≈ arc length per facet
  for (let i = 0; i < steps; i++) {
    a -= sweepDeg / steps;
    const nx = x + seg * Math.cos(a * RAD), ny = y + seg * Math.sin(a * RAD);
    lines.push(mkLine(x, y, nx, ny));
    x = nx; y = ny;
  }
  lines.push(mkLine(x, y, x + 500 * Math.cos(a * RAD), y + 500 * Math.sin(a * RAD)));
  return lines;
}

/** Simulate one cell and classify. */
function runCell(base: Omit<Row, "outcome" | "lf" | "contact14" | "mSpeed" | "mAlpha" | "cArc" | "redirArc">, lines: Ln[], v0: { x: number; y: number }, k: number): Row {
  const sim = SS.simulateTrack(makeTrack(lines, v0, k + 90));
  const ev = sim.det.events.find((e) => (e.type === "landing" || e.type === "bounce") && e.frame >= 3);
  const none: Row = { ...base, outcome: "none", lf: -1, contact14: 0, mSpeed: 0, mAlpha: 0, cArc: 0, redirArc: 0 };
  if (!ev) return none;
  const lf = ev.frame;
  let contact14 = 0;
  for (let f = lf; f <= Math.min(sim.last, lf + 14); f++) if ((sim.cids[f] ?? []).length > 0) contact14++;
  const outcome = ev.type === "landing" && contact14 >= 10 ? "caught" : contact14 >= 3 ? "bouncy" : "eject";
  const v = sim.vel[lf - 1] ?? sim.vel[lf];
  const mSpeed = v ? Math.hypot(v.x, v.y) : 0;
  let mAlpha = 0;
  const t = SS.surfaceTangentAt(sim, lf);
  if (v && t) {
    const dv = Math.atan2(v.y, v.x), dt = Math.atan2(t[1], t[0]);
    let d = Math.abs(SS.wrapPi(dv - dt)) / RAD;
    if (d > 90) d = 180 - d; // tangent sign fold
    mAlpha = d;
  }
  return {
    ...base, outcome, lf, contact14, mSpeed, mAlpha,
    cArc: SS.contactRedirArcPx(sim, lf), redirArc: SS.legacyNetRedirArcPx(sim, lf),
  };
}

// ── sweep ─────────────────────────────────────────────────────────────────────
const rows: Row[] = [];
let done = 0, planned = 0;
const t0 = Date.now();

const cells: (() => Row)[] = [];
for (const s of SPEEDS) for (const alpha of FLAT_ALPHA) for (const phi of FLAT_PHI) {
  const psi = phi + alpha; // velocity absolute angle
  if (psi < 2 || psi > 88) continue;
  for (const k of PHASES) {
    cells.push(() => {
      const v0 = launchFor(s, psi, k);
      const C = drop(v0, k);
      return runCell({ family: "flat", s, k, alpha, phi }, flatLines(C, phi), v0, k);
    });
  }
}
for (const s of SPEEDS) for (const R of SCOOP_R) for (const facet of SCOOP_FACET) for (const k of PHASES) {
  cells.push(() => {
    const v0 = launchFor(s, SCOOP_ENTRY, k);
    const C = drop(v0, k);
    return runCell({ family: "scoop", s, k, R, facet }, scoopLines(C, SCOOP_ENTRY, R, facet, SCOOP_SWEEP), v0, k);
  });
}
planned = cells.length;
console.log(`${planned} runs planned (${SMOKE ? "SMOKE" : "full"})`);
for (const cell of cells) {
  rows.push(cell());
  if (++done % 100 === 0) console.log(`  …${done}/${planned} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
}
console.log(`swept ${done} runs in ${((Date.now() - t0) / 1000).toFixed(0)}s`);

mkdirSync(resolve("generated/atlas"), { recursive: true });
const outPath = resolve("generated/atlas/catchability_atlas.json");
writeFileSync(outPath, JSON.stringify({ generated: "study_catchability_atlas.ts", smoke: SMOKE, rows }));
console.log(`wrote ${outPath}`);

// ── analysis ──────────────────────────────────────────────────────────────────
const med = (xs: number[]) => SS.pct(xs, 0.5);
const byKey = new Map<string, Row[]>();
for (const r of rows) {
  const key = r.family === "flat" ? `flat|s${r.s}|a${r.alpha}|p${r.phi}` : `scoop|s${r.s}|R${r.R}|f${r.facet}`;
  (byKey.get(key) ?? byKey.set(key, []).get(key)!).push(r);
}
type Group = { key: string; family: string; s: number; alpha?: number; phi?: number; R?: number; facet?: number; n: number; catchRate: number; cArcMed: number; redirArcMed: number; mAlphaMed: number; mSpeedMed: number };
const groups: Group[] = [];
for (const [key, rs] of byKey) {
  const caught = rs.filter((r) => r.outcome === "caught");
  groups.push({
    key, family: rs[0].family, s: rs[0].s, alpha: rs[0].alpha, phi: rs[0].phi, R: rs[0].R, facet: rs[0].facet,
    n: rs.length, catchRate: caught.length / rs.length,
    cArcMed: caught.length ? med(caught.map((r) => r.cArc)) : 0,
    redirArcMed: caught.length ? med(caught.map((r) => r.redirArc)) : 0,
    mAlphaMed: caught.length ? med(caught.map((r) => r.mAlpha)) : 0,
    mSpeedMed: caught.length ? med(caught.map((r) => r.mSpeed)) : 0,
  });
}
const RELIABLE = 0.8;

console.log(`\n=== FLAT family: catch rate by (speed × arrival angle), pooled over φ ===`);
console.log(`  s\\α   ` + FLAT_ALPHA.map((a) => String(a).padStart(6)).join(""));
for (const s of SPEEDS) {
  const cells = FLAT_ALPHA.map((a) => {
    const gs = groups.filter((g) => g.family === "flat" && g.s === s && g.alpha === a);
    if (!gs.length) return "     -";
    const rate = gs.reduce((acc, g) => acc + g.catchRate * g.n, 0) / gs.reduce((acc, g) => acc + g.n, 0);
    return (rate >= RELIABLE ? "  " : " ·") + Math.round(rate * 100).toString().padStart(3) + "%";
  });
  console.log(`  ${String(s).padStart(3)}  ` + cells.join(""));
}

console.log(`\n=== SCOOP family: catch rate by (speed × radius), pooled over facet ===`);
console.log(`  s\\R   ` + SCOOP_R.map((r) => String(r).padStart(6)).join(""));
for (const s of SPEEDS) {
  const cells = SCOOP_R.map((R) => {
    const gs = groups.filter((g) => g.family === "scoop" && g.s === s && g.R === R);
    if (!gs.length) return "     -";
    const rate = gs.reduce((acc, g) => acc + g.catchRate * g.n, 0) / gs.reduce((acc, g) => acc + g.n, 0);
    return (rate >= RELIABLE ? "  " : " ·") + Math.round(rate * 100).toString().padStart(3) + "%";
  });
  console.log(`  ${String(s).padStart(3)}  ` + cells.join(""));
}

console.log(`\n=== ceiling(speed): max median cArc over RELIABLE (≥${RELIABLE * 100}% catch) groups ===`);
console.log(`   s   ceil-cArc  (family that achieves it)          ceil-redirArc   absolute-max cArc (any outcome)`);
for (const s of SPEEDS) {
  const rel = groups.filter((g) => g.s === s && g.catchRate >= RELIABLE && g.cArcMed > 0);
  const top = rel.sort((a, b) => b.cArcMed - a.cArcMed)[0];
  const topR = [...rel].sort((a, b) => b.redirArcMed - a.redirArcMed)[0];
  const absMax = Math.max(0, ...rows.filter((r) => r.s === s).map((r) => r.cArc));
  const desc = top ? (top.family === "flat" ? `flat α${top.alpha} φ${top.phi}` : `scoop R${top.R} f${top.facet}`) : "—";
  console.log(`  ${String(s).padStart(3)}   ${top ? top.cArcMed.toFixed(2).padStart(7) : "      —"}  ${desc.padEnd(36)} ${topR ? topR.redirArcMed.toFixed(2).padStart(9) : "        —"}   ${absMax.toFixed(2).padStart(8)}`);
}
const reliableTop = groups.filter((g) => g.catchRate >= RELIABLE).sort((a, b) => b.cArcMed - a.cArcMed).slice(0, 8);
console.log(`\n=== top reliable groups overall (VSTRONG candidates) ===`);
for (const g of reliableTop) {
  const desc = g.family === "flat" ? `flat s${g.s} α${g.alpha} φ${g.phi}` : `scoop s${g.s} R${g.R} f${g.facet}`;
  console.log(`  ${desc.padEnd(28)} catch ${(g.catchRate * 100).toFixed(0)}%  cArc med ${g.cArcMed.toFixed(2)}  redirArc med ${g.redirArcMed.toFixed(2)}  (measured α ${g.mAlphaMed.toFixed(0)}°, v ${g.mSpeedMed.toFixed(1)})`);
}
