import { readFileSync } from "node:fs";
import { searchRideGreedy } from "./lib/search.ts";
import { primitiveForIntent, planArcBeats } from "./lib/arc.ts";
import descendThenClimb from "../arcs/descend_then_climb.ts";

const raw = JSON.parse(readFileSync("beats/drums_0_30s_60_125.json", "utf8"));
const beatFrames = raw.onsets.map((o: any) => Math.round((typeof o === "number" ? o : o.t) * 40));
const planned = planArcBeats(beatFrames, descendThenClimb, 40, { minFirstFrame: 30, minSpacingFrames: 15 });
console.log(`planned ${planned.length} beats. intents: ${planned.filter(p => p.intent === "descend").length} descend, ${planned.filter(p => p.intent === "climb").length} climb`);
console.log(`first 5: ${planned.slice(0,5).map(p => `${p.target}/${p.intent}`).join(", ")}`);
console.log(`spacings: ${planned.slice(0,10).map((p,i) => i>0 ? p.target - planned[i-1].target : 0).slice(1).join(",")}`);

const moves = planned.map((p, idx) => primitiveForIntent(p.intent, p.target, p.idxInSection));
const t = Date.now();
const r = searchRideGreedy(moves, {}, {triesPerMove: 5, seed: 1});
console.log(`${Date.now()-t}ms ${r.totalSimulations} sims survived=${r.result.survived}`);
