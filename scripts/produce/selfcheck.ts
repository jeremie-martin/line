/**
 * Fast, dependency-free smoke check of the pure produce primitives. No compile,
 * no engine — just asserts the gate, the distribution stats, and the suggested-
 * floor derivation behave as specified.
 *
 *   node --import tsx scripts/produce/selfcheck.ts
 */
import { passesGate, type Floors, type SeedMetrics } from "./measure.ts";
import { stats, buildCharacterization, suggestFloors } from "./config.ts";

let failures = 0;
function expect(cond: boolean, msg: string): void {
  console.log(`${cond ? "  ok  " : " FAIL "} ${msg}`);
  if (!cond) failures++;
}
const close = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) <= eps;

const baseMetrics = (over: Partial<SeedMetrics> = {}): SeedMetrics => ({
  seed: 0, score: 650, standTimePct: 6, rotations: 2, flipCount: 1,
  reachedEnd: true, offBeat: 0, contractPassed: true, durationFrames: 1760, ...over,
});
const floors: Floors = { reachedEnd: true, maxOffBeat: 0, score: 640, standTimePctMin: 5, rotationsMin: 0 };

console.log("gate:");
expect(passesGate(baseMetrics(), floors) === true, "clears all floors → passes");
expect(passesGate(baseMetrics({ reachedEnd: false }), floors) === false, "dead track → fails (reachedEnd)");
expect(passesGate(baseMetrics({ offBeat: 1 }), floors) === false, "one off-beat → fails (maxOffBeat=0)");
expect(passesGate(baseMetrics({ score: 639 }), floors) === false, "score below floor → fails");
expect(passesGate(baseMetrics({ standTimePct: 4.9 }), floors) === false, "stand-time below floor → fails");
expect(passesGate(baseMetrics({ score: 640, standTimePct: 5 }), floors) === true, "exactly at floors → passes");
expect(passesGate(baseMetrics({ reachedEnd: false }), { ...floors, reachedEnd: false }) === true, "reachedEnd floor off → death allowed");

console.log("\nstats:");
const s = stats([1, 2, 3, 4, 5]);
expect(close(s.mean, 3), `mean=3 (${s.mean})`);
expect(close(s.median, 3), `median=3 (${s.median})`);
expect(close(s.min, 1) && close(s.max, 5), `min/max 1..5 (${s.min}..${s.max})`);
expect(close(s.p25, 2) && close(s.p75, 4), `p25=2 p75=4 (${s.p25}/${s.p75})`);
expect(close(stats([]).mean, 0) && close(stats([]).max, 0), "empty → all zeros (no NaN)");
const s1 = stats([7]);
expect(close(s1.median, 7) && close(s1.sd, 0), "single value → median=value sd=0");

console.log("\nsuggested floors:");
const m: SeedMetrics[] = Array.from({ length: 20 }, (_, i) => baseMetrics({
  seed: i, score: 600 + i * 5, standTimePct: 2 + i * 0.4, rotations: i < 10 ? 0 : 3,
  reachedEnd: i !== 0, offBeat: i === 1 ? 2 : 0, // seed0 dies, seed1 off-beat → both invalid
}));
const c = buildCharacterization(m, { spec: "x", budget: 1_000_000, gitSha: "test", host: "h", seeds: "0-19" });
expect(c.n === 20, `n counts all attempted (${c.n})`);
expect(close(c.validityRate, 18 / 20), `validityRate excludes the 2 invalid (${c.validityRate})`);
const f = suggestFloors(c);
expect(f.reachedEnd === true && f.maxOffBeat === 0, "suggested keeps validity hard floors");
expect(f.score === Math.round(c.metrics.score.median), `suggested score = median (${f.score})`);
expect(close(f.standTimePctMin, Math.round(c.metrics.standTimePct.p25 * 100) / 100), `suggested stand-time = p25 (${f.standTimePctMin})`);

console.log(`\n${failures === 0 ? "ALL PASS" : `${failures} FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
