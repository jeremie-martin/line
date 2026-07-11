import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { encodeClickTrack } from "./click_model.ts";
import { loadSourceManifest, loadSourceSpec, resolveSources } from "./model.ts";
import { suiteIdentity } from "./suite_model.ts";
import {
  LISTENING_REVIEW_ATTESTATION,
  LISTENING_REVIEW_SCHEMA,
} from "./listening_review.ts";

const args = process.argv.slice(2);
const manifestPath = resolve(argument("manifest") ?? "benchmark/v2/compat/source-manifest.json");
const outDir = resolve(argument("out") ?? "generated/benchmark-v2/listening-review");
const reviewPath = resolve(argument("review") ?? resolve(outDir, "review.json"));
const suitePath = resolve(argument("suite") ?? "benchmark/v2/compat/suite-manifest.json");
const manifest = loadSourceManifest(manifestPath);
const sources = resolveSources(manifest);
const identity = suiteIdentity(suitePath, manifestPath, sources);

mkdirSync(outDir, { recursive: true });
const items = [];
for (const source of sources) {
  const spec = await loadSourceSpec(source);
  const path = resolve(outDir, `${source.id}.wav`);
  const bytes = encodeClickTrack(spec);
  writeFileSync(path, bytes);
  items.push({
    id: source.id,
    sourceFingerprint: source.sourceFingerprint,
    parentId: source.parentId,
    cohort: source.role,
    title: source.caseMetadata?.title ?? source.id,
    durationSeconds: spec.duration,
    contacts: spec.contacts.length,
    phases: source.caseMetadata?.phases.map((phase) => phase.id) ?? [],
    audio: relative(path),
    audioSha256: createHash("sha256").update(bytes).digest("hex"),
    review: {
      rhythmPlausible: null,
      phraseCoherent: null,
      variantFaithfulToParent: source.parentId === undefined ? "not_applicable" : null,
      notes: null,
    },
  });
  console.log(`${source.id}: ${spec.contacts.length} contacts, ${spec.duration.toFixed(1)}s -> ${path}`);
}
writeFileSync(reviewPath, `${JSON.stringify({
  schema: LISTENING_REVIEW_SCHEMA,
  status: "awaiting-human-review",
  suiteFingerprint: identity.suiteFingerprint,
  sourceManifestFingerprint: identity.sourceManifestFingerprint,
  generatedAt: new Date().toISOString(),
  instructions: `Listen without compiler outcomes. Judge musical plausibility, phrase coherence, and whether each variant remains recognizably related to its parent. To approve, fill every judgment, reviewer, reviewedAt, and use this exact attestation: ${LISTENING_REVIEW_ATTESTATION}`,
  reviewer: null,
  reviewedAt: null,
  attestation: null,
  items,
}, null, 2)}\n`);

function argument(name: string): string | undefined {
  const prefix = `--${name}=`;
  return args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function relative(path: string): string {
  return path.startsWith(`${process.cwd()}/`) ? path.slice(process.cwd().length + 1) : path;
}
