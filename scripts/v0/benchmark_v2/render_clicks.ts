import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { encodeClickTrack } from "./click_model.ts";
import { loadSourceManifest, loadSourceSpec, resolveSources } from "./model.ts";

const args = process.argv.slice(2);
const manifestPath = resolve(argument("manifest") ?? "benchmark/v2/compat/source-manifest.json");
const outDir = resolve(argument("out") ?? "generated/benchmark-v2/listening-review");
const manifest = loadSourceManifest(manifestPath);
const sources = resolveSources(manifest);

mkdirSync(outDir, { recursive: true });
const items = [];
for (const source of sources) {
  const spec = await loadSourceSpec(source);
  const path = resolve(outDir, `${source.id}.wav`);
  const bytes = encodeClickTrack(spec);
  writeFileSync(path, bytes);
  items.push({
    id: source.id,
    parentId: source.parentId,
    cohort: source.role,
    title: source.caseMetadata?.title ?? source.id,
    durationSeconds: spec.duration,
    contacts: spec.contacts.length,
    phases: source.caseMetadata?.phases.map((phase) => phase.id) ?? [],
    audio: relative(path),
    sha256: createHash("sha256").update(bytes).digest("hex"),
    review: {
      rhythmPlausible: null,
      phraseCoherent: null,
      variantFaithfulToParent: source.parentId === undefined ? "not_applicable" : null,
      notes: null,
    },
  });
  console.log(`${source.id}: ${spec.contacts.length} contacts, ${spec.duration.toFixed(1)}s -> ${path}`);
}
writeFileSync(resolve(outDir, "review.json"), `${JSON.stringify({
  schema: "line.benchmark-v2.listening-review.v1",
  status: "awaiting-human-review",
  manifest: relative(manifestPath),
  instructions: "Listen without compiler outcomes. Judge musical plausibility, phrase coherence, and whether each variant remains recognizably related to its parent.",
  items,
}, null, 2)}\n`);

function argument(name: string): string | undefined {
  const prefix = `--${name}=`;
  return args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function relative(path: string): string {
  return path.startsWith(`${process.cwd()}/`) ? path.slice(process.cwd().length + 1) : path;
}
