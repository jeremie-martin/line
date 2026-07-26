/**
 * verify_determinism — does the same (spec, seed, budget) always produce the
 * same compile?
 *
 * The rest of the speed workflow leans on this without ever testing it.
 * `verify_optimizer` and `verify_compiler_behavior` compare against a RECORDED
 * baseline, so they answer "did behavior change since we recorded it" — one
 * compile per cell, once. Neither can see a compiler that is merely *usually*
 * deterministic.
 *
 * That distinction stops being academic the moment anything concurrent, lazily
 * initialised, or iteration-order-dependent enters the compiler: the failure
 * mode is intermittent, so a single-shot comparison catches it only sometimes,
 * and a green gate then means nothing. This runs the same cell repeatedly and
 * compares every repeat against the first.
 *
 *   npm run verify:determinism
 *   npm run verify:determinism -- --repeats=8 --cases=mini_burst:0,tiny_dance:0
 *   npm run verify:determinism -- --budget=100000
 *
 * Exits non-zero on the first divergence, naming the cell, the repeat index and
 * which of track/report/stats moved.
 */
import { createHash } from "node:crypto";
import { loadGoldenSpec } from "../golden_suite.ts";
import { compileHandoff } from "../optimizer/handoff.ts";

type Case = { spec: string; seed: number };

const DEFAULT_CASES: Case[] = [
  { spec: "mini_burst", seed: 0 },
  { spec: "tiny_dance", seed: 0 },
  { spec: "drums_signature", seed: 2 },
];

function arg(name: string): string | null {
  return process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? null;
}

function parseCases(source: string | null): Case[] {
  if (source === null) return DEFAULT_CASES;
  return source.split(",").map((entry) => {
    const [spec, seed] = entry.split(":");
    if (spec === undefined || seed === undefined) {
      throw new Error(`--cases entries look like spec:seed, got ${JSON.stringify(entry)}`);
    }
    return { spec, seed: Number(seed) };
  });
}

function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16);
}

/** `repair.records` carry timing-ish detail that is not part of the contract the
 *  behavior gate gets hashed on; mirror that gate's exclusion exactly. */
function behaviorStats(stats: unknown): unknown {
  const clone = structuredClone(stats) as { repair?: { records?: unknown[] } };
  if (clone?.repair?.records !== undefined) delete clone.repair.records;
  return clone;
}

type Fingerprint = { track: string; report: string; stats: string };

async function fingerprint(spec: string, seed: number, budget: number): Promise<Fingerprint> {
  // deno-lint-ignore no-explicit-any
  const loaded = await loadGoldenSpec(spec as any, "base" as any);
  const cp = compileHandoff(loaded, seed, { budget });
  return {
    track: hash(cp.track),
    report: hash(cp.report),
    stats: hash(behaviorStats(cp.stats)),
  };
}

function differences(first: Fingerprint, repeat: Fingerprint): string[] {
  const moved: string[] = [];
  if (first.track !== repeat.track) moved.push(`track ${first.track}->${repeat.track}`);
  if (first.report !== repeat.report) moved.push(`report ${first.report}->${repeat.report}`);
  if (first.stats !== repeat.stats) moved.push(`stats ${first.stats}->${repeat.stats}`);
  return moved;
}

async function main(): Promise<void> {
  const repeats = Number(arg("repeats") ?? 5);
  const budget = Number(arg("budget") ?? 50_000);
  const cases = parseCases(arg("cases"));
  if (!Number.isSafeInteger(repeats) || repeats < 2) {
    throw new Error(`--repeats must be at least 2, got ${repeats}`);
  }

  console.log(
    `verify_determinism cases=${cases.length} repeats=${repeats} budget=${budget.toLocaleString()}`,
  );

  let compiles = 0;
  for (const { spec, seed } of cases) {
    const cell = `${spec}|seed${seed}`;
    const first = await fingerprint(spec, seed, budget);
    compiles++;
    for (let repeat = 1; repeat < repeats; repeat++) {
      const again = await fingerprint(spec, seed, budget);
      compiles++;
      const moved = differences(first, again);
      if (moved.length > 0) {
        throw new Error(
          `NON-DETERMINISTIC: ${cell} repeat ${repeat} differs from repeat 0 [${moved.join(", ")}]`,
        );
      }
    }
    console.log(`  ${cell.padEnd(28)} ${repeats} identical compiles  ${first.track}`);
  }

  console.log(`\nOK deterministic across ${compiles} compiles (${cases.length} cells x ${repeats})`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
