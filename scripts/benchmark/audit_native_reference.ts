import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { LineRiderEngine as Reference, createLineFromJson } from "../lib/_lr_engine.ts";
import { LineRiderEngine as Judge, disposeAllWasmEnginesForStudy } from "../lib/_lr_engine_wasm.ts";
import { extractRawTrajectory, detect, getPhysicsFrameCount } from "../lib/detector.ts";
const arg = (key: string) => process.argv.find(a => a.startsWith(`--${key}=`))?.slice(key.length + 3);
const input = arg("input")!, out = arg("out")!;
if (process.env.LR_ENGINE !== "official") throw new Error("published reference required");
const hash = (b: string | Buffer) => createHash("sha256").update(b).digest("hex");
const bytes = readFileSync(input);
if (hash(bytes) !== readFileSync(input + ".sha256", "utf8").split(/\s/)[0]) throw new Error("input checksum mismatch");
const { track } = JSON.parse(bytes.toString());
const start = (Engine: any) => new Engine().setStart(track.startPosition, track.riders[0].startVelocity);
const reference = extractRawTrajectory(start(Reference).addLine(track.lines.map(createLineFromJson)), track.duration);
let judge: any;
try { judge = extractRawTrajectory(start(Judge).addLine(track.lines), track.duration); }
finally { disposeAllWasmEnginesForStudy(); }
const report = { schema: "line.native-published-reference-audit.v1", inputSha256: hash(bytes), frames: getPhysicsFrameCount(),
  exact: JSON.stringify(reference) === JSON.stringify(judge),
  referenceSha256: hash(JSON.stringify(reference)), judgeSha256: hash(JSON.stringify(judge)),
  referenceTerminus: detect(reference).terminus, judgeTerminus: detect(judge).terminus,
  eventsExact: JSON.stringify(detect(reference).events) === JSON.stringify(detect(judge).events) };
const body = JSON.stringify(report) + "\n"; writeFileSync(out, body); writeFileSync(out + ".sha256", hash(body) + "\n");
console.log(body);
