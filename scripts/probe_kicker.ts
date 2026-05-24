import { searchRideGreedy } from "./lib/search.ts";
import { kicker, drop, slide } from "./lib/moves.ts";

console.log("test 10 kickers from start");
let t = Date.now();
let r = searchRideGreedy(Array.from({length:10},(_,i)=>kicker({at:30+i*20})), {}, {triesPerMove:5, seed:1});
console.log(`  ${Date.now()-t}ms ${r.totalSimulations} sims survived=${r.result.survived}`);

console.log("test 3 drops then 5 kickers");
t = Date.now();
const m1 = [drop({at:30}), drop({at:60}), drop({at:90}), kicker({at:120}), kicker({at:150}), kicker({at:180}), kicker({at:210}), kicker({at:240})];
r = searchRideGreedy(m1, {}, {triesPerMove:5, seed:1});
console.log(`  ${Date.now()-t}ms ${r.totalSimulations} sims survived=${r.result.survived}`);

console.log("test 3 drops then 5 alternating slide/kicker");
t = Date.now();
const m2 = [drop({at:30}), drop({at:60}), drop({at:90}), slide({at:120}), kicker({at:150}), slide({at:180}), kicker({at:210}), slide({at:240})];
r = searchRideGreedy(m2, {}, {triesPerMove:5, seed:1});
console.log(`  ${Date.now()-t}ms ${r.totalSimulations} sims survived=${r.result.survived}`);
