/**
 * Impact-signal DIVERGENCE harness (analysis-only).
 *
 * The survey concluded that the v1 measure (pre-impact CoM velocity ⊥ catch line)
 * misses the perceptually-dominant cues — striking-point velocity (not CoM),
 * rotation arrest, and contact configuration (nose/tail-first vs flat). This
 * harness TESTS, on the landings the compiler actually produces, HOW MUCH those
 * richer signals diverge from CoM-normal — the data that decides whether to
 * redefine impact now (H1–H4):
 *   H1 proxy-sufficient: strikeNormal ≈ comNormal (body reaction monotonic in it)
 *   H2 rotation matters: meaningful angular tip-speed at landings
 *   H3 config matters: nose/tail-first landings exist (not just flat)
 *   H4 it's the body: body-fold / near-eject add info comNormal lacks
 *
 * Per landing (full re-sim, windowed per-point extraction):
 *   comNormal    |v_CoM(lf-1) ⊥ tangent|              (current measure)
 *   strikeNormal max contacting-sled-point |v ⊥ tangent| (rotation+config aware)
 *   tipSpeed     |ω|·R just before contact, px/frame   (rotational closing speed)
 *   dOmega       rotation arrested across the landing
 *   config       which sled corners contact (flat vs nose/tail-first)
 *   bodyFold     SHOULDER–BUTT compression vs airborne baseline, px
 *   offScale     contacts that registered as bounce/flyThrough, not landing
 *
 *   LR_ENGINE=wasm npx tsx scripts/v0/study_impact_signals.ts [--budget=N]
 */
import { compileHandoff } from "./optimizer/handoff.ts";
import { LineRiderEngine, createLineFromJson } from "../lib/_lr_engine.ts";
import { extractRawTrajectory, detect, getSledPointPositionsMetered } from "../lib/detector.ts";
import { constant } from "./core/curves.ts";
import { secToFrame, type Spec, type Contact } from "./types.ts";

const argv = process.argv.slice(2);
const budget = Number((argv.find((a) => a.startsWith("--budget=")) ?? "--budget=120000").split("=")[1]);

// Sweep: gap × speed × amplitude, plus high-air variants (more likely to rotate).
const CELLS: { gap: number; speed: number; amp: number; air: number }[] = [];
for (const gap of [0.5, 1.0, 2.0]) for (const speed of [0.3, 0.6, 0.9]) for (const amp of [0.3, 0.9]) {
  CELLS.push({ gap, speed, amp, air: 0.6 });
}
for (const gap of [1.0, 1.5, 2.0]) for (const speed of [0.5, 0.9]) CELLS.push({ gap, speed, amp: 0.85, air: 0.85 });

const R = 9; // sled half-length proxy (px), to put angular tip-speed in px/frame
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const hyp = Math.hypot;

function buildSpec(c: { gap: number; speed: number; amp: number; air: number }): Spec {
  const dur = 16;
  const contacts: Contact[] = [];
  for (let t = c.gap; t < dur - c.gap; t += c.gap) contacts.push({ t: Number(t.toFixed(3)) });
  return { duration: dur, contacts, jitter: 0, axes: { air: constant(c.air), speed: constant(c.speed), amplitude: constant(c.amp) } };
}

type Row = {
  comNormal: number; strikeNormal: number; tipSpeed: number; dOmega: number;
  nCorners: number; config: string; bodyFold: number; speedIn: number;
};

function sledPts(eng: any, f: number): { peg: [number, number]; tail: [number, number]; nose: [number, number]; string: [number, number] } {
  const a = getSledPointPositionsMetered(eng, f);
  return { peg: [a[0], a[1]], tail: [a[2], a[3]], nose: [a[4], a[5]], string: [a[6], a[7]] };
}
const heading = (eng: any, f: number) => { const p = sledPts(eng, f); return Math.atan2(p.nose[1] - p.peg[1], p.nose[0] - p.peg[0]); };
const bodyDist = (eng: any, f: number) => {
  const r = eng.getRider(f); const s = r.get?.("SHOULDER")?.pos, b = r.get?.("BUTT")?.pos;
  return s && b ? hyp(s.x - b.x, s.y - b.y) : NaN;
};

function studyCell(c: { gap: number; speed: number; amp: number; air: number }) {
  const spec = buildSpec(c);
  const { track, report } = compileHandoff(spec, 0, { budget });
  let eng: any = new LineRiderEngine().setStart(
    { x: track.startPosition?.x ?? 0, y: track.startPosition?.y ?? 0 },
    { x: track.riders?.[0]?.startVelocity?.x ?? 0.4, y: track.riders?.[0]?.startVelocity?.y ?? 0 });
  const lineById = new Map<number, any>();
  for (const ln of track.lines ?? []) { eng = eng.addLine(createLineFromJson(ln)); lineById.set(ln.id, ln); }
  const det = detect(extractRawTrajectory(eng, track.duration));
  const vel = det.measurements.velocity;
  const cids = det.measurements.contactLineIds;
  const scon = det.measurements.sledContacts;
  const lastF = det.terminus.frame;
  const contactFrames = spec.contacts.map((cc) => secToFrame(cc.t));

  // off-scale: contacts whose only nearby event is a bounce/flyThrough (hard hit
  // that the landing detector rejected → current measure would read undefined).
  let offScale = 0;
  for (const cf of contactFrames) {
    const near = det.events.filter((e) => Math.abs(e.frame - cf) <= 1);
    if (near.length && !near.some((e) => e.type === "landing") && near.some((e) => e.type === "bounce" || e.type === "flyThrough")) offScale++;
  }

  const rows: Row[] = [];
  for (const e of det.events) {
    if (e.type !== "landing" || e.frame < 3 || e.frame > lastF - 1) continue;
    const lf = e.frame;
    const vIn = vel[lf - 1]; if (!vIn) continue;
    // tangent from fired catch lines
    let tx = 0, ty = 0;
    for (const id of cids[lf] ?? []) { const ln = lineById.get(id); if (!ln) continue; const dx = ln.x2 - ln.x1, dy = ln.y2 - ln.y1, l = hyp(dx, dy); if (l > 1e-9) { tx += dx / l; ty += dy / l; } }
    const tl = hyp(tx, ty); if (tl <= 1e-9) continue; tx /= tl; ty /= tl;
    const normalOf = (vx: number, vy: number) => Math.abs(tx * vy - ty * vx);
    const comNormal = normalOf(vIn.x, vIn.y);

    // striking-point normal: per-sled-point velocity (pos diff) for contacting corners
    const p1 = sledPts(eng, lf - 1), p0 = sledPts(eng, lf - 2);
    const cornerV: Record<string, [number, number]> = {
      PEG: [p1.peg[0] - p0.peg[0], p1.peg[1] - p0.peg[1]],
      TAIL: [p1.tail[0] - p0.tail[0], p1.tail[1] - p0.tail[1]],
      NOSE: [p1.nose[0] - p0.nose[0], p1.nose[1] - p0.nose[1]],
      STRING: [p1.string[0] - p0.string[0], p1.string[1] - p0.string[1]],
    };
    const contacting = (scon[lf] ?? []).filter((n) => n in cornerV);
    const corners = contacting.length ? contacting : Object.keys(cornerV);
    const strikeNormal = Math.max(...corners.map((n) => normalOf(cornerV[n][0], cornerV[n][1])));
    const nCorners = contacting.length;
    const config = nCorners >= 2 ? "flat" : (contacting[0] ?? "?");

    // rotation
    const wB = Math.max(Math.abs(wrap(heading(eng, lf - 1) - heading(eng, lf - 2))), Math.abs(wrap(heading(eng, lf - 2) - heading(eng, lf - 3))));
    const wA = (Math.abs(wrap(heading(eng, lf + 1) - heading(eng, lf))) + Math.abs(wrap(heading(eng, Math.min(lastF, lf + 2)) - heading(eng, lf + 1)))) / 2;
    const tipSpeed = wB * R;
    const dOmega = (wB - wA) * R;

    // body fold: airborne baseline (lf-5) minus min compressed distance in [lf, lf+5]
    const base = bodyDist(eng, Math.max(0, lf - 5));
    let minD = Infinity; for (let f = lf; f <= Math.min(lastF, lf + 5); f++) minD = Math.min(minD, bodyDist(eng, f));
    const bodyFold = Number.isFinite(base) && Number.isFinite(minD) ? Math.max(0, base - minD) : NaN;

    rows.push({ comNormal, strikeNormal, tipSpeed, dOmega, nCorners, config, bodyFold, speedIn: hyp(vIn.x, vIn.y) });
  }
  return { c, rows, offScale, nContacts: report.contacts.length };
}

const all = CELLS.map(studyCell);
const allRows = all.flatMap((a) => a.rows);
const pct = (xs: number[], p: number) => { if (!xs.length) return NaN; const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const corr = (xs: number[], ys: number[]) => { const n = xs.length; if (n < 2) return NaN; const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n; let sxy = 0, sxx = 0, syy = 0; for (let i = 0; i < n; i++) { const dx = xs[i] - mx, dy = ys[i] - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy; } return sxy / Math.sqrt(sxx * syy); };

console.log(`impact-signal divergence — ${CELLS.length} cells, ${allRows.length} landings @ budget ${budget}\n`);

// H1 — does strikeNormal diverge from comNormal?
const ratios = allRows.filter((r) => r.comNormal > 0.2).map((r) => r.strikeNormal / r.comNormal);
console.log(`H1 strikeNormal vs comNormal:`);
console.log(`  corr ${corr(allRows.map(r => r.comNormal), allRows.map(r => r.strikeNormal)).toFixed(3)}`);
console.log(`  strike/com ratio  p50 ${pct(ratios, 0.5).toFixed(2)}  p90 ${pct(ratios, 0.9).toFixed(2)}  p99 ${pct(ratios, 0.99).toFixed(2)}  max ${Math.max(...ratios).toFixed(2)}`);
console.log(`  landings where strike > 1.3× com: ${(100 * ratios.filter(r => r > 1.3).length / ratios.length).toFixed(0)}%   > 2×: ${(100 * ratios.filter(r => r > 2).length / ratios.length).toFixed(0)}%`);

// H2 — rotation present at landings?
const tips = allRows.map((r) => r.tipSpeed);
console.log(`\nH2 rotation (tip speed |ω|·R px/frame, R=${R}):`);
console.log(`  tipSpeed p50 ${pct(tips, 0.5).toFixed(2)}  p90 ${pct(tips, 0.9).toFixed(2)}  max ${Math.max(...tips).toFixed(2)}   (vs comNormal p50 ${pct(allRows.map(r=>r.comNormal),0.5).toFixed(2)})`);
console.log(`  landings with tipSpeed > comNormal: ${(100 * allRows.filter(r => r.tipSpeed > r.comNormal).length / allRows.length).toFixed(0)}%`);

// H3 — configuration distribution
const cfg: Record<string, number> = {};
for (const r of allRows) cfg[r.config] = (cfg[r.config] ?? 0) + 1;
console.log(`\nH3 contact config: ${Object.entries(cfg).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${(100 * v / allRows.length).toFixed(0)}%`).join("  ")}`);
console.log(`  (flat = ≥2 corners simultaneously; single-corner = nose/tail/etc-first)`);

// H4 — body fold info vs comNormal
const fr = allRows.filter((r) => Number.isFinite(r.bodyFold));
console.log(`\nH4 body fold (SHOULDER-BUTT compression px):`);
console.log(`  bodyFold p50 ${pct(fr.map(r => r.bodyFold), 0.5).toFixed(2)}  p90 ${pct(fr.map(r => r.bodyFold), 0.9).toFixed(2)}  max ${Math.max(...fr.map(r => r.bodyFold)).toFixed(2)}`);
console.log(`  corr(comNormal, bodyFold) ${corr(fr.map(r => r.comNormal), fr.map(r => r.bodyFold)).toFixed(3)}   corr(strikeNormal, bodyFold) ${corr(fr.map(r => r.strikeNormal), fr.map(r => r.bodyFold)).toFixed(3)}`);

// off-scale hard hits
const totalOff = all.reduce((s, a) => s + a.offScale, 0);
const totalContacts = all.reduce((s, a) => s + a.nContacts, 0);
console.log(`\noff-scale (contact registered as bounce/flyThrough, not landing → current measure=undefined): ${totalOff}/${totalContacts}`);

// worst divergence examples
console.log(`\ntop strike≫com divergences (rotation/nose-first the CoM measure misses):`);
const sorted = [...allRows].filter(r => r.comNormal > 0.2).sort((a, b) => (b.strikeNormal / b.comNormal) - (a.strikeNormal / a.comNormal)).slice(0, 8);
console.log(`  com  strike  ratio  tipSpd  dOmega  config   fold`);
for (const r of sorted) console.log(`  ${r.comNormal.toFixed(2).padStart(4)} ${r.strikeNormal.toFixed(2).padStart(6)} ${(r.strikeNormal / r.comNormal).toFixed(2).padStart(5)}  ${r.tipSpeed.toFixed(2).padStart(5)}  ${r.dOmega.toFixed(2).padStart(6)}  ${r.config.padEnd(6)}  ${Number.isFinite(r.bodyFold) ? r.bodyFold.toFixed(1) : "—"}`);
