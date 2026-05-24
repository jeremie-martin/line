import { searchRideGreedy } from "./lib/search.ts";
import { drop } from "./lib/moves.ts";

for (const spacing of [20, 25, 30, 40, 50]) {
  const moves = Array.from({length: 10}, (_, i) => drop({at: 30 + i * spacing}));
  const t = Date.now();
  const r = searchRideGreedy(moves, {}, {triesPerMove: 5, seed: 1});
  console.log(`spacing=${spacing} ${(Date.now()-t).toString().padStart(5)}ms ${r.totalSimulations.toString().padStart(4)} sims survived=${r.result.survived}`);
}
