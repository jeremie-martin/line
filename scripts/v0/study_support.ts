/**
 * Shared support for the impact-metric study harnesses and the overlay generator.
 *
 * This is the SINGLE SOURCE for:
 *   - the rider topology (sled/body points, constraint sticks) — mirrors
 *     engine-rs/src/lib.rs `ITER`; transcribed in one place instead of N.
 *   - the provisional normalization caps and the canonical impact window.
 *   - track load + simulate, surface geometry, rider-point access, landing/rest
 *     detection, and the stats block — all previously copy-pasted per script.
 *   - the CANONICAL windowed impact-metric definitions (redir / turnNet / dvGrav /
 *     comDecel / deform / jolt). Every harness and `make_overlay_data.ts` computes
 *     a metric through exactly ONE function here, so the video the user judges and
 *     the analysis that defines a metric can never silently disagree.
 *
 * The `point` baseline reuses `normalImpactPxAtLanding` (core/substrate.ts), the
 * same definition the shipped scorer uses — studies are no longer allowed to
 * re-derive it and drift from production.
 */
import { LineRiderEngine, createLineFromJson } from "../lib/_lr_engine.ts";
import { extractRawTrajectory, detect, type Detection } from "../lib/detector.ts";
import { normalImpactPxAtLanding, redirImpactPxAtLanding, contactLineIdsAt, velocityAt } from "./core/substrate.ts";
import { CALIB, IMPACT_WINDOW as IMPACT_WINDOW_CANON, type TrackLine } from "./types.ts";

const hyp = Math.hypot;
export const wrapPi = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

// ── rider topology — single source (engine-rs/src/lib.rs ITER + BASE) ────────
export const SLED_POINTS = ["PEG", "TAIL", "NOSE", "STRING"] as const;
export const BODY_POINTS = ["BUTT", "SHOULDER", "RHAND", "LHAND", "LFOOT", "RFOOT"] as const;
export const ALL_POINTS = [...SLED_POINTS, ...BODY_POINTS] as const;
export type PointName = (typeof ALL_POINTS)[number];
export type StickGroup = "sled" | "body" | "bind";
/** Constraint sticks (kind-0 Stick + kind-1 BindStick from `ITER`; kind-2 repel and
 *  the duplicate SHOULDER-RHAND omitted — they carry no extra deformation signal). */
export const STICKS: { a: PointName; b: PointName; group: StickGroup }[] = [
  { a: "PEG", b: "TAIL", group: "sled" }, { a: "TAIL", b: "NOSE", group: "sled" },
  { a: "NOSE", b: "STRING", group: "sled" }, { a: "STRING", b: "PEG", group: "sled" },
  { a: "PEG", b: "NOSE", group: "sled" }, { a: "STRING", b: "TAIL", group: "sled" },
  { a: "SHOULDER", b: "BUTT", group: "body" }, { a: "SHOULDER", b: "LHAND", group: "body" },
  { a: "SHOULDER", b: "RHAND", group: "body" }, { a: "BUTT", b: "LFOOT", group: "body" },
  { a: "BUTT", b: "RFOOT", group: "body" },
  { a: "PEG", b: "BUTT", group: "bind" }, { a: "TAIL", b: "BUTT", group: "bind" },
  { a: "NOSE", b: "BUTT", group: "bind" }, { a: "SHOULDER", b: "PEG", group: "bind" },
  { a: "STRING", b: "LHAND", group: "bind" }, { a: "STRING", b: "RHAND", group: "bind" },
  { a: "LFOOT", b: "NOSE", group: "bind" }, { a: "RFOOT", b: "NOSE", group: "bind" },
];

// ── window + normalization caps — re-exported from the production single source
//    (types.ts / CALIB) so studies and the scorer never diverge. ───────────────
export const IMPACT_WINDOW = IMPACT_WINDOW_CANON; // = 6 (types.ts: the locked redir window)
export const GRAVITY = 0.175;            // px/frame² (down = +y)
export const IMPACT_CAP = CALIB.IMPACT_CAP; // OLD point-metric cap (px/frame) = 5; for the point baseline
export const REDIR_CAP = CALIB.REDIR_CAP;   // = 8.5; the scored redir impact cap (see CALIB)
export const CAPS = {
  jolt: 6, whip: 6, comDecel: 3, deform: 0.9, rotDeg: 12, turnDeg: 35,
} as const;
export const norm01 = (x: number, cap: number) => Math.min(1, Math.max(0, x / cap));

// ── load + simulate ──────────────────────────────────────────────────────────
export type Sim = {
  track: any; eng: any; det: Detection;
  lineById: Map<number, TrackLine>;
  vel: Detection["measurements"]["velocity"];
  cids: Detection["measurements"]["contactLineIds"];
  last: number;
};
export function simulateTrack(track: any): Sim {
  let eng: any = new LineRiderEngine().setStart(
    { x: track.startPosition?.x ?? 0, y: track.startPosition?.y ?? 0 },
    { x: track.riders?.[0]?.startVelocity?.x ?? 0.4, y: track.riders?.[0]?.startVelocity?.y ?? 0 },
  );
  const lineById = new Map<number, TrackLine>();
  for (const ln of track.lines ?? []) { eng = eng.addLine(createLineFromJson(ln)); lineById.set(ln.id, ln); }
  const det = detect(extractRawTrajectory(eng, track.duration));
  return { track, eng, det, lineById, vel: det.measurements.velocity, cids: det.measurements.contactLineIds, last: det.terminus.frame };
}

// ── surface geometry ─────────────────────────────────────────────────────────
/** Average unit tangent of the lines contacted at `f` (null if none). */
export function surfaceTangentAt(sim: Sim, f: number): [number, number] | null {
  let tx = 0, ty = 0;
  for (const id of contactLineIdsAt(sim.det, f)) {
    const l = sim.lineById.get(id); if (!l) continue;
    const dx = l.x2 - l.x1, dy = l.y2 - l.y1, len = hyp(dx, dy);
    if (len > 1e-9) { tx += dx / len; ty += dy / len; }
  }
  const tl = hyp(tx, ty); return tl <= 1e-9 ? null : [tx / tl, ty / tl];
}
export function surfaceNormalAt(sim: Sim, f: number): [number, number] | null {
  const t = surfaceTangentAt(sim, f); return t ? [-t[1], t[0]] : null;
}
/** `point` — pre-impact CoM normal closing speed (px/frame). The shipped scorer's
 *  definition (core/substrate.ts), reused so studies cannot drift from production. */
export function pointImpactPx(sim: Sim, lf: number): number | undefined {
  return normalImpactPxAtLanding(sim.det, lf, (id) => sim.lineById.get(id));
}

// ── rider-point access ───────────────────────────────────────────────────────
export function pointPos(sim: Sim, nm: PointName, f: number): [number, number] | null {
  const p = sim.eng.getRider?.(f)?.get?.(nm)?.pos; return p ? [p.x, p.y] : null;
}
/** Per-frame acceleration of a rider point = 2nd difference of position (px/frame²). */
export function pointAccel(sim: Sim, nm: PointName, f: number): [number, number] | null {
  const p0 = pointPos(sim, nm, f), p1 = pointPos(sim, nm, f - 1), p2 = pointPos(sim, nm, f - 2);
  return p0 && p1 && p2 ? [(p0[0] - p1[0]) - (p1[0] - p2[0]), (p0[1] - p1[1]) - (p1[1] - p2[1])] : null;
}
export function comAccel(sim: Sim, f: number): [number, number] | null {
  const v0 = velocityAt(sim.det, f), v1 = velocityAt(sim.det, f - 1);
  return v0 && v1 ? [v0.x - v1.x, v0.y - v1.y] : null;
}
export function sledHeading(sim: Sim, f: number): number | null {
  const n = pointPos(sim, "NOSE", f), pg = pointPos(sim, "PEG", f);
  return n && pg ? Math.atan2(n[1] - pg[1], n[0] - pg[0]) : null;
}

// ── landing / rest-frame detection ───────────────────────────────────────────
/** First contact frame within ±tol of `target` (empty→nonempty transition preferred,
 *  else first contact). Studies anchored to a target beat use this. */
export function landingNear(sim: Sim, target: number, tol = 6): number {
  const { cids, last } = sim;
  for (let f = Math.max(2, target - tol); f <= Math.min(last - 1, target + tol); f++)
    if ((cids[f] ?? []).length > 0 && (cids[f - 1] ?? []).length === 0) return f;
  for (let f = Math.max(2, target - tol); f <= Math.min(last - 1, target + tol); f++)
    if ((cids[f] ?? []).length > 0) return f;
  return -1;
}
/** First SUSTAINED contact (≥minAir airborne frames, then ≥2 contact frames) — for
 *  synthetic drop rigs. -1 if none. */
export function firstSustainedLanding(sim: Sim, minAir = 4): number {
  const { cids, last } = sim;
  let air = 0;
  for (let f = 2; f <= last - 1; f++) {
    const c = (cids[f] ?? []).length > 0;
    if (!c) { air++; continue; }
    if (air >= minAir && (cids[f + 1] ?? []).length > 0) return f;
  }
  return -1;
}
/** Deepest of ≥minAir consecutive contact-free frames ending before `lf` (the
 *  airborne "rest" pose). -1 if none within `back`. */
export function restFrameBefore(sim: Sim, lf: number, minAir = 4, back = 30): number {
  const { cids } = sim;
  let air = 0;
  for (let f = lf - 1; f >= Math.max(2, lf - back); f--) {
    if ((cids[f] ?? []).length === 0) { air++; if (air >= minAir) return f; } else air = 0;
  }
  return -1;
}
/** Last contact-free frame strictly before `lf` (the pose carried in from flight),
 *  used as the deformation Δ baseline — NOT blindly `lf-1`, which may be a grazing
 *  contact frame. Falls back to lf-1 only if no airborne frame is found nearby. */
export function lastAirborneBefore(sim: Sim, lf: number, back = 10): number {
  const { cids } = sim;
  for (let f = lf - 1; f >= Math.max(2, lf - back); f--) if ((cids[f] ?? []).length === 0) return f;
  return lf - 1;
}

// ── stats ────────────────────────────────────────────────────────────────────
export const mean = (xs: number[]) => xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : NaN;
export function pct(xs: number[], p: number): number { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : NaN; }
export function pearson(xs: number[], ys: number[]): number {
  const n = Math.min(xs.length, ys.length); if (n === 0) return NaN;
  const mx = mean(xs), my = mean(ys); let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { const dx = xs[i] - mx, dy = ys[i] - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy; }
  const d = Math.sqrt(sxx * syy); return d <= 1e-12 ? 0 : sxy / d;
}
export function rank(xs: number[]): number[] { const idx = xs.map((_, i) => i).sort((a, b) => xs[a] - xs[b]); const r = new Array(xs.length); idx.forEach((id, i) => (r[id] = i)); return r; }
export const spearman = (xs: number[], ys: number[]) => pearson(rank(xs), rank(ys));
export const cv = (xs: number[]) => { const m = mean(xs); return m <= 1e-9 ? 0 : Math.sqrt(mean(xs.map((x) => (x - m) ** 2))) / m; };

// ── CANONICAL windowed impact metrics ────────────────────────────────────────
/** Incoming CoM velocity for a landing (the frame `point` reads). */
function incoming(sim: Sim, lf: number) { return velocityAt(sim.det, lf - 1) ?? velocityAt(sim.det, lf); }

/** redir — peak lateral speed acquired ⊥ the incoming heading over the window
 *  (= speed·sin(turn)); the perpendicular (redirection) component of Δv. px/frame.
 *  DELEGATES to the production definition `redirImpactPxAtLanding` (core/substrate.ts)
 *  so studies and the scorer share one source. (Study sims are offset-0, so this is
 *  behaviour-identical to the former inline loop.) */
export function redirPx(sim: Sim, lf: number, W = IMPACT_WINDOW): number {
  return redirImpactPxAtLanding(sim.det, lf, W) ?? 0;
}
/** Net CoM heading change (deg) at the final valid in-window frame. */
export function turnNetDeg(sim: Sim, lf: number, W = IMPACT_WINDOW): number {
  const v0 = incoming(sim, lf); if (!v0) return 0; const aIn = Math.atan2(v0.y, v0.x); let out = 0;
  for (let k = lf; k <= Math.min(sim.last, lf + W); k++) { const v = sim.vel[k]; if (v) out = Math.abs(wrapPi(Math.atan2(v.y, v.x) - aIn)) * 180 / Math.PI; }
  return out;
}
/** Velocity-change decomposition over the window, gravity-corrected. `perp`=redir,
 *  `par`=peak along-heading slowdown, `dvTotal`=peak PER-FRAME |Δv| (not hyp of
 *  separately-maxed components). All px/frame. */
export function velChange(sim: Sim, lf: number, W = IMPACT_WINDOW): { perp: number; par: number; dvTotal: number; dvGrav: number } {
  const v0 = incoming(sim, lf); if (!v0) return { perp: 0, par: 0, dvTotal: 0, dvGrav: 0 };
  const s = hyp(v0.x, v0.y), hx = s > 1e-9 ? v0.x / s : 0, hy = s > 1e-9 ? v0.y / s : 0;
  let perp = 0, par = 0, dvTotal = 0, dvGrav = 0;
  for (let k = lf; k <= Math.min(sim.last, lf + W); k++) {
    const v = sim.vel[k]; if (!v) continue;
    const p = Math.abs(hx * v.y - hy * v.x);          // perpendicular (redirection)
    const q = s - (v.x * hx + v.y * hy);              // along-heading slowdown
    perp = Math.max(perp, p); par = Math.max(par, q);
    dvTotal = Math.max(dvTotal, hyp(v.x - v0.x, v.y - v0.y));            // true per-frame |Δv|
    const dt = k - (lf - 1);
    dvGrav = Math.max(dvGrav, hyp(v.x - v0.x, (v.y - v0.y) - GRAVITY * dt)); // gravity removed
  }
  return { perp, par, dvTotal, dvGrav };
}
export const dvGravPx = (sim: Sim, lf: number, W = IMPACT_WINDOW) => velChange(sim, lf, W).dvGrav;

/** Peak CoM deceleration INTO the surface (px/frame²). The surface normal is
 *  anchored at the FIRST in-window frame that actually has a contact tangent, so a
 *  landing whose contact registers at lf+1 is not silently zeroed. */
export function comDecelNormalPx(sim: Sim, lf: number, W = IMPACT_WINDOW): number {
  let n: [number, number] | null = null;
  for (let k = lf; k <= Math.min(sim.last, lf + W) && !n; k++) n = surfaceNormalAt(sim, k);
  if (!n) return 0;
  let m = 0;
  for (let k = lf; k <= Math.min(sim.last, lf + W); k++) { const a = comAccel(sim, k); if (a) m = Math.max(m, Math.abs(a[0] * n[0] + a[1] * n[1])); }
  return m;
}

/** Body jolt over the window: `jolt` = peak |accel| of any body point; `whip` =
 *  peak |accel_point − accel_CoM| (internal limb redistribution). px/frame². */
export function bodyJolt(sim: Sim, lf: number, W = IMPACT_WINDOW): { jolt: number; whip: number } {
  let jolt = 0, whip = 0;
  for (let k = lf; k <= Math.min(sim.last, lf + W); k++) {
    const ca = comAccel(sim, k);
    for (const nm of BODY_POINTS) {
      const a = pointAccel(sim, nm, k); if (!a) continue;
      jolt = Math.max(jolt, hyp(a[0], a[1]));
      if (ca) whip = Math.max(whip, hyp(a[0] - ca[0], a[1] - ca[1]));
    }
  }
  return { jolt, whip };
}

/** The (rejected) decayed-peak windowed normal-speed proposal, kept as a labeled
 *  candidate read-out for the overlay. px/frame. */
export function windowedNormalPx(sim: Sim, lf: number, W = IMPACT_WINDOW): number {
  let m = pointImpactPx(sim, lf) ?? 0;
  for (let k = lf; k <= Math.min(sim.last, lf + W); k++) {
    const t = surfaceTangentAt(sim, k), vin = velocityAt(sim.det, k - 1) ?? velocityAt(sim.det, k);
    if (t && vin) { const np = Math.abs(t[0] * vin.y - t[1] * vin.x); const w = 1 - 0.5 * Math.min(W, k - lf) / W; m = Math.max(m, w * np); }
  }
  return m;
}
/** Peak per-frame sled heading change over the window (deg) — rotation diagnostic. */
export function sledRotDeg(sim: Sim, lf: number, W = IMPACT_WINDOW): number {
  let m = 0;
  for (let k = lf; k <= Math.min(sim.last, lf + W); k++) { const h = sledHeading(sim, k), hp = sledHeading(sim, k - 1); if (h != null && hp != null) m = Math.max(m, Math.abs(wrapPi(h - hp)) * 180 / Math.PI); }
  return m;
}

/** Rider elastic deformation over the window vs the airborne rest shape. `peak`=peak
 *  RMS stick strain; `delta`=peak − strain at the last airborne frame (impact-
 *  induced, baseline is a real contact-free frame, not blindly lf-1); `rate`=peak
 *  per-frame strain increase; `bindCompr`=peak rider↔sled bind compression;
 *  `byGroup`=peak RMS per group. All px. Returns null if no clean rest frame. */
export function deformStats(sim: Sim, lf: number, W = IMPACT_WINDOW):
  { peak: number; delta: number; rate: number; bindCompr: number; byGroup: Record<StickGroup, number> } | null {
  const restF = restFrameBefore(sim, lf); if (restF < 0) return null;
  const lenAt = (f: number): Record<string, number> | null => {
    const pos: Partial<Record<PointName, [number, number]>> = {};
    for (const nm of ALL_POINTS) { const p = pointPos(sim, nm, f); if (p) pos[nm] = p; }
    const out: Record<string, number> = {};
    for (const s of STICKS) { const a = pos[s.a], b = pos[s.b]; if (!a || !b) continue; out[`${s.a}-${s.b}`] = hyp(a[0] - b[0], a[1] - b[1]); }
    return out;
  };
  const rest = lenAt(restF); if (!rest) return null;
  const devAt = (f: number) => {
    const L = lenAt(f); if (!L) return null;
    let ss = 0, n = 0, bind = 0; const g: Record<StickGroup, { ss: number; n: number }> = { sled: { ss: 0, n: 0 }, body: { ss: 0, n: 0 }, bind: { ss: 0, n: 0 } };
    for (const s of STICKS) { const k = `${s.a}-${s.b}`; if (L[k] === undefined || rest[k] === undefined) continue; const d = L[k] - rest[k]; ss += d * d; n++; g[s.group].ss += d * d; g[s.group].n++; if (s.group === "bind") bind = Math.max(bind, -d); }
    return { rms: n ? Math.sqrt(ss / n) : 0, bind, byGroup: { sled: g.sled.n ? Math.sqrt(g.sled.ss / g.sled.n) : 0, body: g.body.n ? Math.sqrt(g.body.ss / g.body.n) : 0, bind: g.bind.n ? Math.sqrt(g.bind.ss / g.bind.n) : 0 } };
  };
  const pre = devAt(lastAirborneBefore(sim, lf));
  let peak = 0, bindCompr = 0, rate = 0, prev = pre ? pre.rms : 0;
  const byGroup: Record<StickGroup, number> = { sled: 0, body: 0, bind: 0 };
  for (let f = lf; f <= Math.min(sim.last, lf + W); f++) {
    const d = devAt(f); if (!d) continue;
    peak = Math.max(peak, d.rms); bindCompr = Math.max(bindCompr, d.bind); rate = Math.max(rate, d.rms - prev); prev = d.rms;
    for (const g of ["sled", "body", "bind"] as const) byGroup[g] = Math.max(byGroup[g], d.byGroup[g]);
  }
  return { peak, delta: Math.max(0, peak - (pre ? pre.rms : 0)), rate, bindCompr, byGroup };
}
