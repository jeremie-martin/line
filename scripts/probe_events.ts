import {readFileSync} from "node:fs";
import {simulateTrack} from "./lib/metrics.ts";
for (const path of ["generated/drums_60_125.drop_search.track.json","eval/references/cool/synthetic_cool.track.json","eval/references/cool/human_authored.track.json","eval/references/bland/drums_60_125_current.track.json","generated/drums_60_125.baseline_new.track.json"]) {
  const t = JSON.parse(readFileSync(path,"utf8"));
  const d = simulateTrack(t);
  const counts: any = {};
  for (const e of d.events) counts[e.type] = (counts[e.type] ?? 0) + 1;
  console.log(path.padEnd(60), JSON.stringify(counts));
}
