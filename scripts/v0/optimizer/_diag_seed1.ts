/**
 * Diagnostic: investigate the tiny_dance seed=1 monotonicity violation.
 *
 * Run compileLDS at B=100k and B=500k. Log every leaf scored, in order,
 * with its rank-sequence and axis_quality. Compare the two enumerations
 * leaf-by-leaf — they should agree on the first N leaves (where N is
 * however many B=100k saw).
 *
 * If they DO agree on the first N: the algorithm is correct, but B=100k
 * happens to capture a high-quality leaf, and B=500k then sees worse
 * leaves and the register correctly keeps the best — meaning the
 * apparent "violation" should not exist (register only swaps on strict
 * improvement). If the data still shows a violation, there's a real bug.
 *
 * If they DISAGREE on some early leaf: the enumeration order is
 * budget-dependent → bug in the LDS core.
 */

import { compileLDS } from "./api.ts";
import { loadGoldenSpec } from "../golden_suite.ts";
import { scoreDriftReport } from "../score.ts";

type LeafTrace = {
  index: number;
  ranks: number[];
  discrepancy: number;
  axis_quality: number;
  contract_passed: boolean;
  sim_frames_after: number;
};

async function runWithTrace(budget: number): Promise<{ best_quality: number; trace: LeafTrace[]; final_sim_frames: number; budget_exhausted: boolean }> {
  const spec = await loadGoldenSpec("tiny_dance", "base");
  const trace: LeafTrace[] = [];
  let i = 0;
  // Need to grab sim_frames after each leaf. The api doesn't expose a
  // per-leaf callback with sim_frames, but we can inspect via onLeaf
  // and import getSimFrames here.
  const { getSimFrames } = await import("./sim_frames.ts");
  const r = compileLDS(spec, 1, {
    maxDiscrepancy: 4,
    budget: { kind: "work", units: budget },
    onLeaf: (leaf, key) => {
      trace.push({
        index: i++,
        ranks: leaf.ranks,
        discrepancy: leaf.discrepancy,
        axis_quality: key.axis_quality,
        contract_passed: key.contract_passed,
        sim_frames_after: getSimFrames(),
      });
    },
  });
  return {
    best_quality: scoreDriftReport(r.report).axis_quality,
    trace,
    final_sim_frames: r.stats.sim_frames,
    budget_exhausted: r.stats.budget_exhausted,
  };
}

async function main() {
  console.log("Running tiny_dance seed=1 at B=100k...");
  const r1 = await runWithTrace(100_000);
  console.log("Running tiny_dance seed=1 at B=500k...");
  const r2 = await runWithTrace(500_000);

  console.log(`\nB=100k: best q=${r1.best_quality.toFixed(4)}, ${r1.trace.length} leaves, sim_frames=${r1.final_sim_frames}`);
  console.log(`B=500k: best q=${r2.best_quality.toFixed(4)}, ${r2.trace.length} leaves, sim_frames=${r2.final_sim_frames}`);

  // Check prefix property: do the first N leaves of B=500k match B=100k's leaves?
  const minLen = Math.min(r1.trace.length, r2.trace.length);
  let firstMismatch = -1;
  for (let i = 0; i < minLen; i++) {
    const t1 = r1.trace[i];
    const t2 = r2.trace[i];
    if (
      t1.ranks.join(",") !== t2.ranks.join(",")
      || Math.abs(t1.axis_quality - t2.axis_quality) > 1e-9
    ) {
      firstMismatch = i;
      console.log(`\nMISMATCH at leaf ${i}:`);
      console.log(`  B=100k: ranks=[${t1.ranks}] q=${t1.axis_quality.toFixed(4)}`);
      console.log(`  B=500k: ranks=[${t2.ranks}] q=${t2.axis_quality.toFixed(4)}`);
      break;
    }
  }
  if (firstMismatch === -1) {
    console.log(`\nFirst ${minLen} leaves AGREE between the two runs.`);
  } else {
    console.log(`\nMismatch first at leaf ${firstMismatch}.`);
  }

  // What was the best leaf in each run?
  const bestIn = (trace: LeafTrace[]) => {
    let best = trace[0];
    for (const t of trace) {
      if (
        t.contract_passed && !best.contract_passed
        || (t.contract_passed === best.contract_passed && t.axis_quality > best.axis_quality + 1e-9)
      ) {
        best = t;
      }
    }
    return best;
  };
  const best1 = bestIn(r1.trace);
  const best2 = bestIn(r2.trace);
  console.log(`\nBest leaf in B=100k trace: idx=${best1.index} ranks=[${best1.ranks}] q=${best1.axis_quality.toFixed(4)} contract=${best1.contract_passed}`);
  console.log(`Best leaf in B=500k trace: idx=${best2.index} ranks=[${best2.ranks}] q=${best2.axis_quality.toFixed(4)} contract=${best2.contract_passed}`);

  console.log("\nFull trace B=500k:");
  for (const t of r2.trace) {
    console.log(`  #${t.index}: d=${t.discrepancy} ranks=[${t.ranks}] q=${t.axis_quality.toFixed(4)} contract=${t.contract_passed}`);
  }

  // The crucial check: is best1's index < r2.trace.length? I.e., did
  // B=500k see best1? If yes, register should have kept it.
  if (best1.index < r2.trace.length) {
    const sameLeafInR2 = r2.trace[best1.index];
    console.log(`B=500k's leaf #${best1.index}: ranks=[${sameLeafInR2.ranks}] q=${sameLeafInR2.axis_quality.toFixed(4)}`);
    if (Math.abs(sameLeafInR2.axis_quality - best1.axis_quality) > 1e-9) {
      console.log(`*** SAME leaf index but DIFFERENT axis_quality — register/enumerator is not deterministic! ***`);
    }
  } else {
    console.log(`B=500k did NOT see best1 (only ${r2.trace.length} leaves vs best1.index=${best1.index})`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
