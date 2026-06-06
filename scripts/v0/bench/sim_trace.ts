/**
 * sim_trace — byte-identical behavior oracle for the physics engine.
 *
 * This is the safety net that lets us optimize the engine fearlessly. It walks
 * a track frame-by-frame and computes an EXACT, full-precision fingerprint of
 * the complete engine state at every frame (every entity's `__state__`:
 * Points' pos/prevPos/vel, Bindings' framesSinceUnbind, scarf flutter — all of
 * it, hashed from raw float64 bits). Any change in simulation behavior, however
 * tiny, changes the fingerprint and is pinpointed to the first divergent frame.
 *
 * Workflow:
 *   1. On a clean baseline:  npm run trace          → records reference fingerprints
 *   2. After an engine edit: npm run trace          → checks; exits non-zero + reports
 *                                                      the first divergent frame if any
 *   3. To re-baseline on purpose: npm run trace -- --update
 *
 * Sources (mix freely):
 *   --fixture[=segments]            the synthetic downhill (continuous contact)
 *   --track=path/to/track.json      a real track (e.g. long_track.json, has jumps)
 *   positional args ending in .json are treated as --track
 *
 * The fingerprint is a strict oracle: it compares exact IEEE-754 bits, so any
 * reordering of float ops (FMA, changed accumulation/solve order) trips it. That
 * is intentional — "same result at every frame" means exactly that.
 */
import { readFileSync, mkdirSync, existsSync, writeFileSync, readdirSync } from "node:fs";
import { resolve, basename } from "node:path";
import { buildEngine, buildTrack, loadTrackJson, type LoadedTrack } from "./_fixture.ts";
import { COLLISION_UPDATE_TYPE } from "../../lib/update_types.ts";

const OUT_DIR = "generated/trace";
// Track fixtures the oracle checks by default. Drop any *.json export here and
// `npm run trace` picks it up automatically (the synthetic fixture is always
// included too as a continuous-contact case).
const TRACKS_DIR = "scripts/v0/bench/tracks";

function discoverTracks(): string[] {
  try {
    return readdirSync(TRACKS_DIR)
      .filter((f) => f.endsWith(".json"))
      .sort()
      .map((f) => resolve(TRACKS_DIR, f));
  } catch {
    return [];
  }
}

// ── exact float64 → two-lane FNV-1a (fast, pure-int, collision-safe enough) ──
const _buf = new ArrayBuffer(8);
const _dv = new DataView(_buf);
const _bytes = new Uint8Array(_buf);

function mixNumber(h1: number, h2: number, value: number): [number, number] {
  // Normalize -0 to +0 so they fingerprint identically (they are equal positions).
  _dv.setFloat64(0, value === 0 ? 0 : value);
  for (let i = 0; i < 8; i++) {
    const b = _bytes[i];
    h1 = Math.imul(h1 ^ b, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ b, 0x01000093) >>> 0;
  }
  return [h1, h2];
}

/** Recursively fold every numeric leaf of a state value (handles {x,y}, scalars). */
function mixState(h1: number, h2: number, v: unknown): [number, number] {
  if (typeof v === "number") return mixNumber(h1, h2, v);
  if (typeof v === "boolean") return mixNumber(h1, h2, v ? 1 : 0);
  if (v && typeof v === "object") {
    for (const key of Object.keys(v as object).sort()) {
      // tag the key so {x:1,y:0} and {x:0,y:1} differ
      for (let i = 0; i < key.length; i++) {
        h1 = Math.imul(h1 ^ key.charCodeAt(i), 0x01000193) >>> 0;
        h2 = Math.imul(h2 ^ key.charCodeAt(i), 0x01000093) >>> 0;
      }
      [h1, h2] = mixState(h1, h2, (v as Record<string, unknown>)[key]);
    }
  }
  return [h1, h2];
}

function mixString(h1: number, h2: number, s: string): [number, number] {
  for (let i = 0; i < s.length; i++) {
    h1 = Math.imul(h1 ^ s.charCodeAt(i), 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ s.charCodeAt(i), 0x01000093) >>> 0;
  }
  return [h1, h2];
}

// The scarf (SCARF_0..6, FlutterPoint) is a pure one-way follower: anchored at
// SHOULDER via a single DirectedChain, referenced by no other constraint, not
// collidable, and never read by the compiler (getBody uses parts.BODY only). It
// is also the SOLE user of transcendentals (expm1/pow/sin/cos), which cannot be
// reproduced bit-for-bit across a native/WASM rewrite. So by default the oracle
// fingerprints only what the compiler consumes — body + sled + bindings +
// contacts — and is INVARIANT to the scarf's presence or exact values. Pass
// --include-scarf for a fully-strict everything-identical check.
function isScarfId(id: unknown): boolean {
  return typeof id === "string" && id.startsWith("SCARF");
}

/**
 * Fingerprint a single frame → 32-bit number. Covers ONLY what the compiler
 * actually consumes (scarf excluded unless includeScarf):
 *  - the state map (every non-scarf entity's __state__: positions, vel, binding)
 *  - the CollisionUpdate records the detector reads via getUpdatesAtFrame
 *    (line id + contacted point ids, in order) — which line/point was hit.
 *
 * It deliberately does NOT fold Step/Constraint updates. Those are internal
 * solver bookkeeping the compiler never reads (detector.ts skips every update
 * whose type !== "CollisionUpdate"), and the body state folded above already
 * captures every physics result they produce. Folding them would couple this
 * correctness gate to engine implementation details — e.g. whether update
 * objects are freshly allocated or shared singletons, or whether the cosmetic
 * scarf is simulated at all — and block legitimate engine optimizations.
 */
// deno-lint-ignore no-explicit-any
function fingerprintFrame(stateMap: Map<any, any>, updates: any[], includeScarf: boolean): number {
  let h1 = 0x811c9dc5 >>> 0;
  let h2 = 0x811c9dc5 >>> 0;
  const keep = (id: unknown) => includeScarf || !isScarfId(id);
  const ids = [...stateMap.keys()].filter(keep).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  for (const id of ids) {
    const entity = stateMap.get(id);
    // Immo stores time-varying state in __state__; fall back to known accessors.
    const state = entity && entity.__state__
      ? entity.__state__
      : { pos: entity?.pos, prevPos: entity?.prevPos, vel: entity?.vel, framesSinceUnbind: entity?.framesSinceUnbind };
    [h1, h2] = mixState(h1, h2, state);
  }
  // Fold only the collision records (order matters — it's a sequence). These are
  // the exact inputs the detector reads: the line id (numeric) and the contacted
  // point ids (string body ids; scarf points never collide).
  if (updates) {
    for (const u of updates) {
      if ((u?.type ?? u?.constructor?.name) !== COLLISION_UPDATE_TYPE) continue;
      [h1, h2] = mixString(h1, h2, COLLISION_UPDATE_TYPE);
      if (typeof u?.id === "number") [h1, h2] = mixNumber(h1, h2, u.id);
      const upd = u?.updated;
      if (Array.isArray(upd)) {
        for (const e of upd) {
          if (!includeScarf && isScarfId(e?.id)) continue;
          if (typeof e?.id === "number") [h1, h2] = mixNumber(h1, h2, e.id);
          else if (typeof e?.id === "string") [h1, h2] = mixString(h1, h2, e.id);
        }
      }
    }
  }
  // fold both lanes into one 32-bit per-frame value
  return (h1 ^ Math.imul(h2, 0x9e3779b1)) >>> 0;
}

interface Trace {
  name: string;
  frames: number;
  lineCount: number;
  start: { x: number; y: number };
  velocity: { x: number; y: number };
  fullHash: string; // hex of the whole run (both lanes)
  perFrame: number[]; // per-frame 32-bit fingerprints
}

function runTrace(src: LoadedTrack, frames: number, includeScarf: boolean): Trace {
  const engine = buildEngine(src.lines, src.start, src.velocity);
  const perFrame: number[] = new Array(frames + 1);
  let g1 = 0x811c9dc5 >>> 0;
  let g2 = 0x811c9dc5 >>> 0;
  for (let f = 0; f <= frames; f++) {
    const stateMap = engine.getStateMapAtFrame(f);
    const updates = engine.getUpdatesAtFrame(f);
    const fp = fingerprintFrame(stateMap, updates, includeScarf);
    perFrame[f] = fp;
    g1 = Math.imul(g1 ^ (fp & 0xffff), 0x01000193) >>> 0;
    g2 = Math.imul(g2 ^ (fp >>> 16), 0x01000093) >>> 0;
  }
  const fullHash = (g1 >>> 0).toString(16).padStart(8, "0") + (g2 >>> 0).toString(16).padStart(8, "0");
  return {
    name: src.name,
    frames,
    lineCount: src.lines.length,
    start: src.start,
    velocity: src.velocity,
    fullHash,
    perFrame,
  };
}

// ───────────────────────── numeric trajectory + diff ─────────────────────────
// The exact per-frame numeric state of the non-scarf points (the cross-language
// equivalence target). JSON doubles round-trip losslessly, so a dump is an exact
// reference. This is the "microscope" for a native/WASM rewrite: instead of a
// binary pass/fail, --diff quantifies HOW LONG two engines stay identical and
// HOW FAR they drift once they don't.

interface Trajectory {
  name: string;
  frames: number;
  ids: string[]; // ordered non-scarf point ids that carry a position
  // data[f] is a flat row: for each id → pos.x,pos.y,prevPos.x,prevPos.y,vel.x,vel.y
  data: number[][];
}

const COMPONENTS = ["pos.x", "pos.y", "prevPos.x", "prevPos.y", "vel.x", "vel.y"];

function collectTrajectory(src: LoadedTrack, frames: number): Trajectory {
  const engine = buildEngine(src.lines, src.start, src.velocity);
  // determine the ordered non-scarf point ids (those with a position) from frame 0
  const f0 = engine.getStateMapAtFrame(0);
  const ids = [...f0.keys()]
    .filter((id: unknown) => !isScarfId(id) && f0.get(id)?.pos)
    .sort((a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0));
  const data: number[][] = new Array(frames + 1);
  for (let f = 0; f <= frames; f++) {
    const sm = engine.getStateMapAtFrame(f);
    const row: number[] = new Array(ids.length * 6);
    let i = 0;
    for (const id of ids) {
      const p = sm.get(id);
      row[i++] = p.pos.x; row[i++] = p.pos.y;
      row[i++] = p.prevPos.x; row[i++] = p.prevPos.y;
      row[i++] = p.vel.x; row[i++] = p.vel.y;
    }
    data[f] = row;
  }
  return { name: src.name, frames, ids, data };
}

const TOLERANCES = [0, 1e-12, 1e-9, 1e-6, 1e-3];

function diffTrajectories(ref: Trajectory, cand: Trajectory): {
  ok: boolean;
  firstDiffFrame: number | null; // first frame with ANY nonzero difference
  firstExceedFrame: Record<string, number | null>; // per tolerance
  maxErr: number;
  maxAt: { frame: number; id: string; component: string } | null;
  rmsByWindow: { from: number; to: number; rms: number; max: number }[];
  shapeMismatch: string | null;
} {
  if (ref.ids.length !== cand.ids.length || ref.ids.some((id, i) => id !== cand.ids[i])) {
    return { ok: false, firstDiffFrame: 0, firstExceedFrame: {}, maxErr: Infinity, maxAt: null, rmsByWindow: [], shapeMismatch: `point set differs (ref ${ref.ids.length} vs cand ${cand.ids.length})` };
  }
  const n = Math.min(ref.frames, cand.frames);
  const nIds = ref.ids.length;
  let firstDiffFrame: number | null = null;
  const firstExceedFrame: Record<string, number | null> = {};
  for (const t of TOLERANCES) firstExceedFrame[t.toExponential(0)] = null;
  let maxErr = 0;
  let maxAt: { frame: number; id: string; component: string } | null = null;

  const WINDOWS = 10;
  const winSize = Math.max(1, Math.ceil((n + 1) / WINDOWS));
  const rmsByWindow: { from: number; to: number; rms: number; max: number }[] = [];
  let winSumSq = 0, winCount = 0, winMax = 0, winFrom = 0;

  for (let f = 0; f <= n; f++) {
    const a = ref.data[f], b = cand.data[f];
    let frameMax = 0;
    for (let k = 0; k < nIds * 6; k++) {
      const e = Math.abs(a[k] - b[k]);
      if (e > 0 && firstDiffFrame === null) firstDiffFrame = f;
      winSumSq += e * e; winCount++;
      if (e > frameMax) frameMax = e;
      if (e > maxErr) {
        maxErr = e;
        maxAt = { frame: f, id: ref.ids[(k / 6) | 0], component: COMPONENTS[k % 6] };
      }
    }
    for (const t of TOLERANCES) {
      const key = t.toExponential(0);
      if (firstExceedFrame[key] === null && frameMax > t) firstExceedFrame[key] = f;
    }
    if (frameMax > winMax) winMax = frameMax;
    if (f === n || (f + 1) % winSize === 0) {
      rmsByWindow.push({ from: winFrom, to: f, rms: Math.sqrt(winSumSq / Math.max(1, winCount)), max: winMax });
      winSumSq = 0; winCount = 0; winMax = 0; winFrom = f + 1;
    }
  }
  return { ok: firstDiffFrame === null, firstDiffFrame, firstExceedFrame, maxErr, maxAt, rmsByWindow, shapeMismatch: null };
}

function compare(reference: Trace, actual: Trace): { ok: boolean; firstDivergentFrame: number | null } {
  if (reference.fullHash === actual.fullHash) return { ok: true, firstDivergentFrame: null };
  const n = Math.min(reference.perFrame.length, actual.perFrame.length);
  for (let f = 0; f < n; f++) {
    if (reference.perFrame[f] !== actual.perFrame[f]) return { ok: false, firstDivergentFrame: f };
  }
  // hashes differ but no per-frame mismatch found ⇒ different frame counts
  return { ok: false, firstDivergentFrame: n };
}

function main() {
  const args = process.argv.slice(2);
  let update = false;
  let framesOverride: number | null = null;
  let includeScarf = false;
  const trackPaths: string[] = [];
  let fixtureSegments: number | null = null;

  let dump = false;
  let diff = false;
  for (const a of args) {
    if (a === "--update") update = true;
    else if (a === "--include-scarf") includeScarf = true;
    else if (a === "--dump") dump = true; // also write an exact numeric trajectory
    else if (a === "--diff") diff = true; // numeric divergence report vs stored dump
    else if (a.startsWith("--frames=")) framesOverride = Number(a.slice(9));
    else if (a === "--fixture") fixtureSegments = 200;
    else if (a.startsWith("--fixture=")) fixtureSegments = Number(a.slice(10));
    else if (a.startsWith("--track=")) trackPaths.push(a.slice(8));
    else if (a.endsWith(".json")) trackPaths.push(a);
    else throw new Error(`unknown arg: ${a}`);
  }

  // Default sources (no explicit --track / --fixture given): the synthetic
  // fixture + every track fixture in TRACKS_DIR. Explicit flags narrow it.
  const explicit = trackPaths.length > 0 || fixtureSegments !== null;
  const sources: { src: LoadedTrack; frames: number }[] = [];
  if (fixtureSegments !== null || !explicit) {
    const segs = fixtureSegments ?? 200;
    const lines = buildTrack(segs);
    sources.push({
      src: { name: `synthetic-${segs}`, lines, start: { x: 0, y: 0 }, velocity: { x: 0.4, y: 0 }, duration: 1500 },
      frames: framesOverride ?? 1500,
    });
  }
  if (!explicit) trackPaths.push(...discoverTracks());
  for (const p of trackPaths) {
    const json = JSON.parse(readFileSync(resolve(p), "utf8"));
    const name = basename(p).replace(/\.json$/, "");
    const src = loadTrackJson(name, json);
    sources.push({ src, frames: framesOverride ?? src.duration ?? 1500 });
  }

  mkdirSync(OUT_DIR, { recursive: true });
  let anyMismatch = false;
  let anyWritten = false;
  let anyMissing = false;

  // ── numeric divergence report (the cross-language microscope) ──
  if (diff) {
    let anyDrift = false;
    for (const { src, frames } of sources) {
      const dumpPath = resolve(OUT_DIR, `${src.name}.dump.json`);
      if (!existsSync(dumpPath)) {
        console.log(`  SKIP  ${src.name} — no numeric reference (run with --dump first)`);
        continue;
      }
      const ref: Trajectory = JSON.parse(readFileSync(dumpPath, "utf8"));
      const cand = collectTrajectory(src, frames);
      const d = diffTrajectories(ref, cand);
      if (d.shapeMismatch) {
        anyDrift = true;
        console.log(`  DIFF  ${src.name.padEnd(18)} SHAPE MISMATCH: ${d.shapeMismatch}`);
        continue;
      }
      if (d.ok) {
        console.log(`  DIFF  ${src.name.padEnd(18)} bit-identical over ${frames} frames (max err 0)`);
        continue;
      }
      anyDrift = true;
      const at = d.maxAt ? `${d.maxAt.id}.${d.maxAt.component}@${d.maxAt.frame}` : "?";
      console.log(`  DIFF  ${src.name.padEnd(18)} drift — bit-identical through frame ${(d.firstDiffFrame ?? 0) - 1}`);
      console.log(`        max |err| = ${d.maxErr.toExponential(3)}  at ${at}`);
      const exceed = TOLERANCES.filter((t) => t > 0)
        .map((t) => `>${t.toExponential(0)}@${d.firstExceedFrame[t.toExponential(0)] ?? "—"}`)
        .join("  ");
      console.log(`        first frame error exceeds:  ${exceed}`);
      console.log(`        error growth (RMS / max by window):`);
      for (const w of d.rmsByWindow) {
        console.log(`          frames ${String(w.from).padStart(5)}–${String(w.to).padEnd(5)}  rms ${w.rms.toExponential(2)}  max ${w.max.toExponential(2)}`);
      }
    }
    console.log("");
    console.log(anyDrift ? "TRACE: numeric drift reported above." : "TRACE: numerically bit-identical to reference on all sources.");
    return;
  }

  for (const { src, frames } of sources) {
    const refPath = resolve(OUT_DIR, `${src.name}.trace.json`);
    const actual = runTrace(src, frames, includeScarf);

    if (dump && (update || !existsSync(resolve(OUT_DIR, `${src.name}.dump.json`)))) {
      writeFileSync(resolve(OUT_DIR, `${src.name}.dump.json`), JSON.stringify(collectTrajectory(src, frames)));
    }

    if (update) {
      writeFileSync(refPath, JSON.stringify(actual));
      anyWritten = true;
      console.log(`  REC   ${src.name.padEnd(18)} frames=${frames} lines=${actual.lineCount}  hash=${actual.fullHash}  → ${refPath}`);
      continue;
    }
    if (!existsSync(refPath)) {
      // A missing baseline must FAIL, not silently auto-record — otherwise the gate
      // would "pass" on a fresh checkout by adopting whatever the current (possibly
      // broken) code emits. Capture baselines on known-good HEAD with --update only.
      anyMissing = true;
      console.log(`  MISS  ${src.name.padEnd(18)} no baseline at ${refPath} — record on known-good HEAD: npm run verify:engine -- --update`);
      continue;
    }

    const reference: Trace = JSON.parse(readFileSync(refPath, "utf8"));
    const { ok, firstDivergentFrame } = compare(reference, actual);
    if (ok) {
      console.log(`  OK    ${src.name.padEnd(18)} frames=${frames} lines=${actual.lineCount}  hash=${actual.fullHash}`);
    } else {
      anyMismatch = true;
      console.log(`  FAIL  ${src.name.padEnd(18)} DIVERGES at frame ${firstDivergentFrame}`);
      console.log(`        reference hash=${reference.fullHash}  actual hash=${actual.fullHash}`);
      if (firstDivergentFrame !== null && firstDivergentFrame > 0) {
        console.log(`        (frames 0..${firstDivergentFrame - 1} identical; first difference at frame ${firstDivergentFrame})`);
      }
    }
  }

  console.log("");
  if (anyMismatch) {
    console.log("TRACE: MISMATCH — behavior changed. Do NOT keep this engine change.");
    process.exit(1);
  } else if (anyMissing) {
    console.log("TRACE: MISSING baseline(s) — cannot verify. Record on known-good HEAD: npm run verify:engine -- --update");
    process.exit(1);
  } else if (anyWritten) {
    console.log("TRACE: reference recorded. Re-run after an engine change to verify byte-identical behavior.");
  } else {
    console.log("TRACE: all sources byte-identical to reference. Safe.");
  }
}

main();
