/**
 * Feasibility re-measurements from an existing golden run (no compiles):
 *  1) real-context achieved air & speed by gap duration (duration-aware bands);
 *  2) infeasibility audit — fraction of current spec targets that fall outside
 *     the achievable band per axis (and contact_style's bimodal dead zone).
 *
 * Usage: npx tsx scripts/v0/analyze_feasibility.ts [/path/to/golden.json]
 */
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { sliceTimeline } from "./core/substrate.ts";
import { FPS, secToFrame, type Spec } from "./types.ts";

const jsonPath = process.argv[2] ?? "/tmp/base_full2.json";
const j = JSON.parse(readFileSync(jsonPath, "utf8"));

async function loadSpec(name: string): Promise<Spec> {
  return (await import(resolve("specs/golden", `${name}.ts`))).default as Spec;
}

// gap_index -> duration(frames), per spec (durations are prefix-independent geometry).
async function gapDurations(name: string): Promise<Map<number, number>> {
  const spec = await loadSpec(name);
  const df = secToFrame(spec.duration);
  const cf = [...spec.contacts].map((c) => secToFrame(c.t)).sort((a, b) => a - b);
  const gaps = sliceTimeline(cf, df);
  const m = new Map<number, number>();
  for (const g of gaps) m.set(g.index, g.endFrame - g.startFrame);
  return m;
}

function durBucket(frames: number): string {
  const s = frames / FPS;
  return s < 0.4 ? "<0.4s" : s < 0.8 ? "0.4-0.8s" : s < 1.2 ? "0.8-1.2s" : ">=1.2s";
}
function pct(a: number[], p: number): number { const s = [...a].sort((x, y) => x - y); return s[Math.floor(p * (s.length - 1))]; }

const airByDur = new Map<string, number[]>();
const speedByDur = new Map<string, number[]>();
const targets: Record<string, number[]> = { air: [], speed: [], contact_style: [], grain: [] };
const durCache = new Map<string, Map<number, number>>();

for (const r of j.rows) {
  const name: string = r.name;
  if (!durCache.has(name)) durCache.set(name, await gapDurations(name));
  const durs = durCache.get(name)!;
  const last = r.checkpoints[r.checkpoints.length - 1];
  for (const a of (last.axes ?? [])) {
    if (targets[a.axis]) targets[a.axis].push(a.target);
    const dur = durs.get(a.gap_index);
    if (dur === undefined) continue;
    const b = durBucket(dur);
    if (a.axis === "air") (airByDur.get(b) ?? airByDur.set(b, []).get(b)!).push(a.achieved);
    if (a.axis === "speed") (speedByDur.get(b) ?? speedByDur.set(b, []).get(b)!).push(a.achieved);
  }
}

console.log(`source=${jsonPath} rows=${j.rows.length}`);
console.log("\n=== REAL-CONTEXT air achieved by gap duration (sets duration-aware air band) ===");
for (const b of ["<0.4s", "0.4-0.8s", "0.8-1.2s", ">=1.2s"]) {
  const a = airByDur.get(b);
  if (a && a.length) console.log(`  ${b.padEnd(9)} n=${String(a.length).padStart(5)} floor(p02)=${pct(a, 0.02).toFixed(3)} p10=${pct(a, 0.10).toFixed(3)} p50=${pct(a, 0.5).toFixed(3)} ceil(p98)=${pct(a, 0.98).toFixed(3)}`);
}
console.log("\n=== REAL-CONTEXT speed achieved by gap duration ===");
for (const b of ["<0.4s", "0.4-0.8s", "0.8-1.2s", ">=1.2s"]) {
  const a = speedByDur.get(b);
  if (a && a.length) console.log(`  ${b.padEnd(9)} n=${String(a.length).padStart(5)} p02=${pct(a, 0.02).toFixed(3)} p50=${pct(a, 0.5).toFixed(3)} p98=${pct(a, 0.98).toFixed(3)} max=${pct(a, 1).toFixed(3)}`);
}

console.log("\n=== INFEASIBILITY AUDIT: % of current spec targets in infeasible zones ===");
const zones: Record<string, (t: number) => boolean> = {
  air: (t) => t < 0.30,                  // below the real achievable floor
  speed: (t) => t < 0.20,                // below the speed floor
  grain: (t) => t < 0.05,                // below the grain floor
  contact_style: (t) => t > 0.15 && t < 0.85, // bimodal dead zone (unreachable mid)
};
for (const ax of ["air", "speed", "contact_style", "grain"]) {
  const t = targets[ax];
  if (!t.length) continue;
  const bad = t.filter(zones[ax]).length;
  console.log(`  ${ax.padEnd(14)} n=${t.length} infeasible=${bad} (${(100 * bad / t.length).toFixed(1)}%)  [zone: ${ax === "contact_style" ? "0.15<t<0.85 bimodal" : ax === "air" ? "t<0.30" : ax === "speed" ? "t<0.20" : "t<0.05"}]  targetRange=[${pct(t, 0).toFixed(2)},${pct(t, 1).toFixed(2)}]`);
}
