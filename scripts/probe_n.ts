import { searchRideGreedy } from "./lib/search.ts";
import { drop } from "./lib/moves.ts";

for (const N of [2, 5, 8, 10, 15, 20]) {
  const moves = Array.from({length: N}, (_, i) => drop({at: 30 + i * 40}));
  const t = Date.now();
  const r = searchRideGreedy(moves, {}, {triesPerMove: 5, seed: 1});
  console.log(`N=${N.toString().padStart(2)} ${(Date.now()-t).toString().padStart(5)}ms ${r.totalSimulations.toString().padStart(4)} sims survived=${r.result.survived}`);
}
