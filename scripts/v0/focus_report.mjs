#!/usr/bin/env node
// Focus-campaign metric reader for the fragile-spec loop.
//   node scripts/v0/focus_report.mjs <golden.json> [loBudget] [hiBudget]
//
// Reports, for the 5 fragile specs (or whatever is in the archive):
//   - CURVE        : mean per-row score over the [lo,hi] budget window (the
//                    optimization target — rewards both height and convergence).
//   - last         : mean per-row score at the last budget (headline-comparable).
//   - validLast    : # seeds whose last-budget compile passed the contract.
//   - minValid     : worst valid-seed count across the window (fragility floor).
//   - worst        : lowest single-seed last-budget score (collapse detector).
//   - std          : stddev of last-budget score across seeds (fragility).
//   - axis rms     : pooled per-axis error rms at the last budget.
// Fragile specs care about validLast/minValid/worst/std as much as the mean —
// a high mean with a collapsing seed is exactly the failure we are fixing.
import { readFileSync } from "node:fs";

const path = process.argv[2];
if (!path) {
  console.error("usage: node focus_report.mjs <golden.json> [loBudget] [hiBudget]");
  process.exit(1);
}
const j = JSON.parse(readFileSync(path, "utf8"));
const allB = j.budgets;
const lo = process.argv[3] ? Number(process.argv[3]) : allB[0];
const hi = process.argv[4] ? Number(process.argv[4]) : allB[allB.length - 1];
const window = allB.filter((b) => b >= lo && b <= hi);
const lastB = window[window.length - 1];

const specs = [...new Set(j.rows.map((r) => r.name))];
const stat = (xs) => {
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  const v = xs.reduce((a, b) => a + (b - m) * (b - m), 0) / xs.length;
  return { m, sd: Math.sqrt(v), min: Math.min(...xs) };
};

// Known-hard cross-check seeds (default 100-102): reported separately, NOT part
// of the primary curve metric. Override with FOCUS_CHECK_SEEDS=comma,list.
const checkSeeds = new Set(
  (process.env.FOCUS_CHECK_SEEDS ?? "100,101,102").split(",").map((s) => Number(s.trim())).filter((n) => !Number.isNaN(n)),
);
const isCheck = (r) => checkSeeds.has(r.seed);
const hasCheck = j.rows.some(isCheck);

function reportBlock(rowFilter) {
  let grandCurve = [];
  const rowsOut = [];
  for (const spec of specs.sort()) {
  const rows = j.rows.filter((r) => r.name === spec && rowFilter(r));
  if (rows.length === 0) continue;
  // curve = mean over (seed, budget-in-window) of checkpoint score
  const curvePts = [];
  let minValid = Infinity;
  for (const b of window) {
    let validAtB = 0;
    for (const r of rows) {
      const c = r.checkpoints.find((c) => c.budget === b);
      if (!c) continue;
      curvePts.push(c.score);
      if (c.contract_passed) validAtB++;
    }
    minValid = Math.min(minValid, validAtB);
  }
  grandCurve.push(...curvePts);
  const lastScores = [];
  let validLast = 0;
  const axAcc = {};
  for (const r of rows) {
    const c = r.checkpoints.find((c) => c.budget === lastB);
    if (!c) continue;
    lastScores.push(c.score);
    if (c.contract_passed) validLast++;
    for (const a of c.axes || []) {
      (axAcc[a.axis] ??= []).push(a.error);
    }
  }
  const curve = curvePts.reduce((a, b) => a + b, 0) / curvePts.length;
  const ls = stat(lastScores);
  const axStr = Object.keys(axAcc)
    .sort()
    .map((k) => `${k}=${Math.sqrt(axAcc[k].reduce((a, b) => a + b * b, 0) / axAcc[k].length).toFixed(3)}`)
    .join(" ");
  rowsOut.push({ spec, curve, last: ls.m, validLast, n: rows.length, minValid, worst: ls.min, std: ls.sd, axStr });
  }
  return { rowsOut, grandCurve };
}

const W = (s, n) => String(s).padEnd(n);
const R = (s, n) => String(s).padStart(n);
function printBlock(title, block) {
  const { rowsOut, grandCurve } = block;
  console.log(title);
  console.log(`${W("spec", 22)} ${R("curve", 7)} ${R("last", 7)} ${R("valid", 7)} ${R("minV", 5)} ${R("worst", 7)} ${R("std", 6)}  axis_rms`);
  for (const o of rowsOut) {
    console.log(
      `${W(o.spec, 22)} ${R(o.curve.toFixed(1), 7)} ${R(o.last.toFixed(1), 7)} ${R(`${o.validLast}/${o.n}`, 7)} ${R(o.minValid, 5)} ${R(o.worst.toFixed(0), 7)} ${R(o.std.toFixed(1), 6)}  ${o.axStr}`,
    );
  }
  const gc = grandCurve.reduce((a, b) => a + b, 0) / grandCurve.length;
  const meanLast = rowsOut.reduce((a, b) => a + b.last, 0) / rowsOut.length;
  const meanValid = rowsOut.reduce((a, b) => a + b.validLast, 0) / rowsOut.length;
  console.log(`${W("— MEAN —", 22)} ${R(gc.toFixed(1), 7)} ${R(meanLast.toFixed(1), 7)} ${R(meanValid.toFixed(1), 7)}`);
}

const primary = reportBlock((r) => !isCheck(r));
const nPrimary = new Set(j.rows.filter((r) => !isCheck(r)).map((r) => r.seed)).size;
printBlock(
  `focus PRIMARY  window=${lo / 1000}k..${hi / 1000}k  last=${lastB / 1000}k  specs=${specs.length}  seeds=${nPrimary}`,
  primary,
);
if (hasCheck) {
  const nCheck = new Set(j.rows.filter(isCheck).map((r) => r.seed)).size;
  console.log("");
  printBlock(
    `CROSS-CHECK (known-hard seeds ${[...checkSeeds].sort((a, b) => a - b).join(",")} — generalization only, ${nCheck} seeds)`,
    reportBlock(isCheck),
  );
}
