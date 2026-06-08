/**
 * Impact calibration harness (analysis-only; no compiler change, no rendering).
 *
 * v1 has no impact steering, so we can't author "land hard here" — instead we SWEEP
 * the conditions that physically produce hard landings (gap length, speed, amplitude)
 * and measure the resulting **normal impact speed** (px/frame) at every landing, RAW
 * (unclamped — so values above the current IMPACT_CAP aren't hidden). This answers
 * the two calibration questions:
 *   1. IMPACT_CAP — what normal-impact-px should map to authored 1.0? = the hardest
 *      *reliably catchable* landing (the envelope's upper edge among hits).
 *   2. impactCeiling — how does the max catchable normal impact scale with entering
 *      speed? (replaces the guessed IMPACT.CATCHABLE_NORMAL_FRACTION.)
 * We also watch the FOLD: as we push amplitude/gap up, where do contacts start
 * missing / the ride die — that's the physical catchability boundary.
 *
 * Replicates measureImpact's placed-line method on a FULL re-sim (so we have track
 * geometry + true trajectory): landing event → fired catch line(s) → unit tangent →
 * |pre-impact velocity ⊥ tangent|.
 *
 *   LR_ENGINE=wasm npx tsx scripts/v0/calibrate_impact.ts [--budget=N]
 */
import { compileHandoff } from "./optimizer/handoff.ts";
import { LineRiderEngine, createLineFromJson } from "../lib/_lr_engine.ts";
import { extractRawTrajectory, detect } from "../lib/detector.ts";
import { constant } from "./core/curves.ts";
import { FPS, secToFrame, CALIB, IMPACT, impactCeiling, type Spec, type Contact } from "./types.ts";

const argv = process.argv.slice(2);
const budget = Number((argv.find((a) => a.startsWith("--budget=")) ?? "--budget=150000").split("=")[1]);

const GAP_SECS = [0.5, 0.75, 1.0, 1.5, 2.0];
const SPEEDS = [0.3, 0.5, 0.7, 0.9];
const AMPS = [0.3, 0.6, 0.9];

type Vec = { x: number; y: number };
const hyp = (x: number, y: number) => Math.hypot(x, y);

function trackStart(track: any) {
  const r = track.riders?.[0];
  return {
    position: { x: track.startPosition?.x ?? 0, y: track.startPosition?.y ?? 0 },
    velocity: { x: r?.startVelocity?.x ?? 0.4, y: r?.startVelocity?.y ?? 0 },
  };
}

function buildSpec(gapSec: number, speed: number, amp: number): Spec {
  const contacts: Contact[] = [];
  const dur = 16;
  for (let t = gapSec; t < dur - gapSec; t += gapSec) contacts.push({ t: Number(t.toFixed(3)) });
  return {
    duration: dur,
    contacts,
    jitter: 0,
    axes: { air: constant(0.6), speed: constant(speed), amplitude: constant(amp) },
  };
}

type Landing = { speedIn: number; normalPx: number; hit: boolean };

function measureOne(gapSec: number, speed: number, amp: number) {
  const spec = buildSpec(gapSec, speed, amp);
  const { track, report } = compileHandoff(spec, 0, { budget });
  const start = trackStart(track);
  let engine: any = new LineRiderEngine().setStart(start.position, start.velocity);
  const lineById = new Map<number, any>();
  for (const ln of track.lines ?? []) { engine = engine.addLine(createLineFromJson(ln)); lineById.set(ln.id, ln); }
  const det = detect(extractRawTrajectory(engine, track.duration));
  const vel = det.measurements.velocity;
  const cids = det.measurements.contactLineIds;
  const lastF = det.terminus.frame;
  const contactFrames = spec.contacts.map((c) => secToFrame(c.t));

  const landings: Landing[] = [];
  for (const e of det.events) {
    if (e.type !== "landing" || e.frame < 1 || e.frame > lastF) continue;
    const vIn: Vec | undefined = vel[e.frame - 1];
    if (!vIn) continue;
    // placed-line tangent from the fired lines at the landing frame
    let tx = 0, ty = 0;
    for (const id of cids[e.frame] ?? []) {
      const ln = lineById.get(id);
      if (!ln) continue;
      const dx = ln.x2 - ln.x1, dy = ln.y2 - ln.y1, len = hyp(dx, dy);
      if (len > 1e-9) { tx += dx / len; ty += dy / len; }
    }
    const tlen = hyp(tx, ty);
    if (tlen <= 1e-9) continue;
    tx /= tlen; ty /= tlen;
    const normalPx = Math.abs(tx * vIn.y - ty * vIn.x);
    const hit = contactFrames.some((cf) => Math.abs(cf - e.frame) <= 1);
    landings.push({ speedIn: hyp(vIn.x, vIn.y), normalPx, hit });
  }
  const hits = report.contacts.filter((c) => c.status === "hit").length;
  const survived = det.terminus.reason === "endOfSpec";
  return { gapSec, speed, amp, landings, hits, nContacts: report.contacts.length, survived };
}

const all: Awaited<ReturnType<typeof measureOne>>[] = [];
for (const g of GAP_SECS) for (const s of SPEEDS) for (const a of AMPS) all.push(measureOne(g, s, a));

const pct = (xs: number[], p: number) => {
  if (!xs.length) return NaN;
  const srt = [...xs].sort((a, b) => a - b);
  return srt[Math.min(srt.length - 1, Math.floor(p * srt.length))];
};

// Per-cell summary, flagging folds (missed contacts / death).
console.log(`impact calibration — ${all.length} cells @ budget ${budget}\n`);
console.log(`gap   spd  amp  hit/N  surv  landings  normalPx(med/p90/max)  hardestHit  FOLD?`);
for (const c of all) {
  const hitLandings = c.landings.filter((l) => l.hit);
  const npx = c.landings.map((l) => l.normalPx);
  const hardestHit = hitLandings.length ? Math.max(...hitLandings.map((l) => l.normalPx)) : NaN;
  const fold = c.hits < c.nContacts || !c.survived;
  console.log(
    `${c.gapSec.toFixed(2)} ${c.speed.toFixed(1)} ${c.amp.toFixed(1)}  ${String(c.hits).padStart(2)}/${String(c.nContacts).padStart(2)}  ` +
    `${c.survived ? "yes" : "NO "}  ${String(c.landings.length).padStart(3)}     ` +
    `${pct(npx, 0.5).toFixed(2).padStart(5)}/${pct(npx, 0.9).toFixed(2).padStart(5)}/${(npx.length ? Math.max(...npx) : NaN).toFixed(2).padStart(5)}  ` +
    `${hardestHit.toFixed(2).padStart(6)}     ${fold ? "FOLD" : ""}`,
  );
}

// Envelope by entering-speed bucket: the hardest catchable (HIT, in a surviving
// ride) normal impact at each speed — this is what IMPACT_CAP / impactCeiling fit to.
console.log(`\n=== catchable envelope (HIT landings in surviving rides) ===`);
const goodLandings: { speedIn: number; normalPx: number }[] = [];
for (const c of all) if (c.survived) for (const l of c.landings) if (l.hit) goodLandings.push(l);
const buckets: [number, number][] = [[5, 7], [7, 9], [9, 11], [11, 13], [13, 16], [16, 25]];
console.log(`speedPx     n   normalPx p50/p90/max   maxFrac(max/speedMid)   ceil(model)`);
for (const [lo, hi] of buckets) {
  const inB = goodLandings.filter((l) => l.speedIn >= lo && l.speedIn < hi);
  if (!inB.length) continue;
  const npx = inB.map((l) => l.normalPx);
  const mx = Math.max(...npx);
  const mid = (lo + hi) / 2;
  console.log(
    `${lo}-${hi}  ${String(inB.length).padStart(4)}   ` +
    `${pct(npx, 0.5).toFixed(2)}/${pct(npx, 0.9).toFixed(2)}/${mx.toFixed(2)}        ` +
    `${(mx / mid).toFixed(2)}                    ${impactCeiling(mid).toFixed(2)}`,
  );
}

const allHitNpx = goodLandings.map((l) => l.normalPx);
console.log(`\noverall catchable normalPx: p50 ${pct(allHitNpx, 0.5).toFixed(2)}  p90 ${pct(allHitNpx, 0.9).toFixed(2)}  p99 ${pct(allHitNpx, 0.99).toFixed(2)}  max ${Math.max(...allHitNpx).toFixed(2)}`);
console.log(`current CALIB.IMPACT_CAP=${CALIB.IMPACT_CAP}  IMPACT.CATCHABLE_NORMAL_FRACTION=${IMPACT.CATCHABLE_NORMAL_FRACTION}`);
console.log(`\nFold cells (missed contacts or death) signal the catchability boundary; the`);
console.log(`p90/p99 of catchable normalPx is a robust IMPACT_CAP candidate (1.0 = hardest`);
console.log(`reliably catchable, not the single freak max).`);
