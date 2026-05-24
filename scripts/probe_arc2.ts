import { readFileSync } from "node:fs";
import { searchRideGreedy } from "./lib/search.ts";
import { primitiveForIntent, planArcBeats } from "./lib/arc.ts";
import descendThenClimb from "../arcs/descend_then_climb.ts";

const raw = JSON.parse(readFileSync("beats/drums_0_30s_60_125.json", "utf8"));
const beatFrames = raw.onsets.map((o: any) => Math.round((typeof o === "number" ? o : o.t) * 40));
const planned = planArcBeats(beatFrames, descendThenClimb, 40, { minFirstFrame: 30, minSpacingFrames: 15 });

// Test 1: descend only
const descendMoves = planned.filter(p => p.intent === "descend").map(p => primitiveForIntent(p.intent, p.target, p.idxInSection));
console.log(`test descend only (${descendMoves.length} drops)...`);
let t = Date.now();
const r1 = searchRideGreedy(descendMoves, {}, {triesPerMove: 5, seed: 1});
console.log(`  ${Date.now()-t}ms ${r1.totalSimulations} sims survived=${r1.result.survived}`);

// Test 2: descend(first 5) + climb (next 5)
const mixedMoves = [
  ...planned.slice(0, 5).map(p => primitiveForIntent("descend", p.target, p.idxInSection)),
  ...planned.slice(5, 10).map((p, i) => primitiveForIntent("climb", p.target, i)),
];
console.log(`test 5 descend + 5 climb...`);
t = Date.now();
const r2 = searchRideGreedy(mixedMoves, {}, {triesPerMove: 5, seed: 1});
console.log(`  ${Date.now()-t}ms ${r2.totalSimulations} sims survived=${r2.result.survived}`);
