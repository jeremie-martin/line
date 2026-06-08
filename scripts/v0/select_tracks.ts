/**
 * Generate-many → evaluate → SELECT pipeline for picking which tracks are worth
 * rendering to video (rendering via the mirror is the expensive step, so we only
 * want the good ones).
 *
 * For each (spec × seed × budget): compile, re-simulate for the true trajectory,
 * and compute two things:
 *   1. VALIDITY ("useful beats") — survived to endOfSpec AND ≥ MIN_HIT of contacts
 *      landed within ±1 frame. Broken-sync tracks are not worth rendering.
 *   2. INTEREST — is it fun to WATCH (not a flat glide)? Ported from
 *      analyze_track_shape.py: airborne %, per-arc pop above the takeoff→landing
 *      chord (big airs), detrended vertical relief, longest air, speed variety.
 *
 * Valid candidates are ranked by a transparent interest composite; ALL raw metrics
 * are printed so the final pick is an informed aesthetic call. `--write` copies the
 * top picks (track.json + detection.json) into <out>/<label>/ for the dashboard /
 * `inspect.ts --render`.
 *
 *   LR_ENGINE=wasm npx tsx scripts/v0/select_tracks.ts \
 *     [--specs=a,b] [--seeds=0,1,2] [--budgets=200000,300000] [--top=6]
 *     [--minHit=0.97] [--out=shakedown] [--write]
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { compileHandoff } from "./optimizer/handoff.ts";
import { LineRiderEngine, createLineFromJson } from "../lib/_lr_engine.ts";
import { extractRawTrajectory, detect } from "../lib/detector.ts";
import { scoreDriftReport } from "./score.ts";
import { FPS, type Spec } from "./types.ts";

const argv = process.argv.slice(2);
const arg = (n: string, d: string) => (argv.find((a) => a.startsWith(`--${n}=`)) ?? `--${n}=${d}`).split("=").slice(1).join("=");
const has = (n: string) => argv.includes(`--${n}`);
const SPECS = arg("specs", "shelter_curves,believer_curves,shelter_amp,drums_aerial,drums_chunky,drums_0_56s_creative").split(",");
const SEEDS = arg("seeds", "0,1,2,3,4,5").split(",").map(Number);
const BUDGETS = arg("budgets", "200000").split(",").map(Number);
const TOP = Number(arg("top", "6"));
const MIN_HIT = Number(arg("minHit", "0.97"));
const OUT = arg("out", "shakedown");
const WRITE = has("write");

function trackStart(track: any) {
  const r = track.riders?.[0];
  return { position: { x: track.startPosition?.x ?? 0, y: track.startPosition?.y ?? 0 }, velocity: { x: r?.startVelocity?.x ?? 0.4, y: r?.startVelocity?.y ?? 0 } };
}
const slope = (ys: number[]) => { const n = ys.length; let sx = 0, sy = 0, sxx = 0, sxy = 0; for (let i = 0; i < n; i++) { sx += i; sy += ys[i]; sxx += i * i; sxy += i * ys[i]; } const d = n * sxx - sx * sx; return d === 0 ? 0 : (n * sxy - sx * sy) / d; };
const med = (xs: number[]) => { if (!xs.length) return 0; const s = [...xs].sort((a, b) => a - b); return s[s.length >> 1]; };
const pctl = (xs: number[], p: number) => { if (!xs.length) return 0; const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };

type Metrics = {
  spec: string; seed: number; budget: number; score: number; valid: boolean;
  hits: number; nContacts: number; survived: boolean;
  airPct: number; popMed: number; popP90: number; popMax: number; bigAirs: number;
  relief: number; longestAir: number; speedStd: number; speedRangeMean: number;
  interest: number; track: any;
};

function evalOne(specName: string, spec: Spec, seed: number, budget: number): Metrics {
  const { track, report } = compileHandoff(spec, seed, { budget });
  const sc = scoreDriftReport(report, { totalFrames: track.duration });
  const start = trackStart(track);
  let eng: any = new LineRiderEngine().setStart(start.position, start.velocity);
  for (const ln of track.lines ?? []) eng = eng.addLine(createLineFromJson(ln));
  const det = detect(extractRawTrajectory(eng, track.duration));
  const pos = det.measurements.position, air = det.measurements.airborne, spd = det.measurements.speed;
  const F = Math.min(pos.length, det.terminus.frame + 1);

  // up = -sign(trend); yu increases upward.
  const ys = pos.slice(0, F).map((p) => p.y);
  const up = -Math.sign(slope(ys)) || 1;
  const yu = ys.map((y) => y * up);
  // per airborne-arc pop above the takeoff→landing chord
  const pops: number[] = []; let longestAir = 0;
  for (let i = 0; i < F;) {
    if (!air[i]) { i++; continue; }
    let j = i; while (j < F && air[j]) j++;
    const a = Math.max(0, i - 1), b = Math.min(F - 1, j);
    longestAir = Math.max(longestAir, j - i);
    if (b - a >= 2) { let mx = 0; for (let k = a; k <= b; k++) { const chord = yu[a] + (yu[b] - yu[a]) * ((k - a) / (b - a)); mx = Math.max(mx, yu[k] - chord); } pops.push(mx); }
    i = j;
  }
  // detrended vertical relief
  const m = slope(yu), b0 = yu.reduce((s, v) => s + v, 0) / F - m * (F - 1) / 2;
  let rlo = Infinity, rhi = -Infinity; for (let i = 0; i < F; i++) { const r = yu[i] - (b0 + m * i); rlo = Math.min(rlo, r); rhi = Math.max(rhi, r); }
  const relief = rhi - rlo;
  const airPct = air.slice(0, F).filter(Boolean).length / F;
  const sMean = spd.slice(0, F).reduce((s, v) => s + v, 0) / F;
  const sStd = Math.sqrt(spd.slice(0, F).reduce((s, v) => s + (v - sMean) ** 2, 0) / F);
  const sRange = (Math.max(...spd.slice(0, F)) - Math.min(...spd.slice(0, F))) / Math.max(1e-6, sMean);
  const bigAirs = pops.filter((p) => p > 40).length;

  const hits = report.contacts.filter((c) => c.status === "hit").length;
  const survived = det.terminus.reason === "endOfSpec";
  const valid = survived && hits / report.contacts.length >= MIN_HIT;
  // transparent interest composite (drama + variety), gated to valid below.
  const interest = bigAirs * 2 + relief / 80 + pctl(pops, 0.9) / 8 + sRange + longestAir / FPS;

  return {
    spec: specName, seed, budget, score: sc.score, valid, hits, nContacts: report.contacts.length, survived,
    airPct, popMed: med(pops), popP90: pctl(pops, 0.9), popMax: pops.length ? Math.max(...pops) : 0, bigAirs,
    relief, longestAir, speedStd: sStd, speedRangeMean: sRange, interest, track,
  };
}

const results: Metrics[] = [];
console.log(`select — ${SPECS.length} specs × ${SEEDS.length} seeds × ${BUDGETS.length} budgets = ${SPECS.length * SEEDS.length * BUDGETS.length} compiles, minHit ${MIN_HIT}\n`);
for (const name of SPECS) {
  const spec: Spec = (await import(resolve(`scripts/v0/specs/${name}.ts`))).default;
  for (const seed of SEEDS) for (const budget of BUDGETS) {
    try { results.push(evalOne(name, spec, seed, budget)); }
    catch (e) { console.error(`!! ${name} seed=${seed} b=${budget}: ${(e as Error).message}`); }
  }
}

const valid = results.filter((r) => r.valid).sort((a, b) => b.interest - a.interest);
const invalid = results.filter((r) => !r.valid);
console.log(`valid (useful beats): ${valid.length}/${results.length}   (rejected ${invalid.length}: broken sync / died)\n`);
console.log(`rank  spec                 seed  bud   score  hit    air%  popMed popP90 popMax bigAir relief longAir spdRng  INTEREST`);
valid.forEach((r, i) => {
  console.log(
    `${String(i + 1).padStart(3)}  ${r.spec.padEnd(20)} ${String(r.seed).padStart(4)} ${(r.budget / 1000).toFixed(0).padStart(4)}k ${r.score.toFixed(0).padStart(5)}  ${r.hits}/${r.nContacts}  ` +
    `${(r.airPct * 100).toFixed(0).padStart(3)}  ${r.popMed.toFixed(0).padStart(5)} ${r.popP90.toFixed(0).padStart(6)} ${r.popMax.toFixed(0).padStart(6)} ${String(r.bigAirs).padStart(6)} ${r.relief.toFixed(0).padStart(6)} ${(r.longestAir / FPS).toFixed(1).padStart(6)}s ${r.speedRangeMean.toFixed(2).padStart(5)}  ${r.interest.toFixed(1).padStart(6)}`,
  );
});

if (WRITE && valid.length) {
  const picks = valid.slice(0, TOP);
  console.log(`\nwriting top ${picks.length} → ${OUT}/<label>/track.json (+report)`);
  for (const r of picks) {
    const label = `${r.spec}_s${r.seed}_b${(r.budget / 1000).toFixed(0)}k`;
    const dir = resolve(`${OUT}/${label}`); mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/track.json`, JSON.stringify(r.track, null, 2));
    console.log(`  ${label}  (interest ${r.interest.toFixed(1)}, ${r.bigAirs} big airs, relief ${r.relief.toFixed(0)}px)`);
  }
  console.log(`\nnext: render a pick with\n  npx tsx scripts/inspect.ts --track=${OUT}/<label>/track.json --out=${OUT}/<label> --render`);
}
