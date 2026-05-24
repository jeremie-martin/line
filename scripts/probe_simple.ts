import { searchRideGreedy } from "./lib/search.ts";
import { drop } from "./lib/moves.ts";

// Just two drops, single iter, no shifts
const moves = [drop({at: 30}), drop({at: 80})];
const t = Date.now();
const r = searchRideGreedy(moves, {}, {triesPerMove: 5, seed: 1});
console.log(`${Date.now()-t}ms ${r.totalSimulations} sims survived=${r.result.survived}`);
