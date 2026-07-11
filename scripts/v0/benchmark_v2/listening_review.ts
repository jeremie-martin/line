import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { encodeClickTrack } from "./click_model.ts";
import { loadSourceSpec, type ResolvedSource } from "./model.ts";

export const LISTENING_REVIEW_SCHEMA = "line.benchmark-v2.listening-review.v2" as const;
export const LISTENING_REVIEW_ATTESTATION =
  "I reviewed these click tracks without consulting compiler or qualification outcomes." as const;

export type ListeningReview = {
  schema: typeof LISTENING_REVIEW_SCHEMA;
  status: "awaiting-human-review" | "approved" | "rejected";
  suiteFingerprint: string;
  sourceManifestFingerprint: string;
  generatedAt: string;
  instructions: string;
  reviewer: null | { name: string; role: string };
  reviewedAt: string | null;
  attestation: string | null;
  items: Array<{
    id: string;
    sourceFingerprint: string;
    parentId?: string;
    cohort: string;
    title: string;
    durationSeconds: number;
    contacts: number;
    phases: string[];
    audio: string;
    audioSha256: string;
    review: {
      rhythmPlausible: boolean | null;
      phraseCoherent: boolean | null;
      variantFaithfulToParent: boolean | "not_applicable" | null;
      notes: string | null;
    };
  }>;
};

export type ListeningReviewEvidence = {
  path: string;
  fingerprint: string;
  review: ListeningReview;
};

export async function loadListeningReview(
  path: string,
  expectedSuiteFingerprint: string,
  expectedSourceManifestFingerprint: string,
  sources: ResolvedSource[],
): Promise<ListeningReviewEvidence> {
  if (!existsSync(path)) throw new Error(`${path}: listening review is missing`);
  const contents = readFileSync(path, "utf8");
  const review = JSON.parse(contents) as ListeningReview;
  await validateListeningReview(
    review,
    expectedSuiteFingerprint,
    expectedSourceManifestFingerprint,
    sources,
  );
  return {
    path,
    fingerprint: createHash("sha256").update(contents).digest("hex"),
    review,
  };
}

export function requireApprovedListeningReview(evidence: ListeningReviewEvidence): void {
  const { review } = evidence;
  if (review.status !== "approved") {
    throw new Error(`listening review is ${review.status}; canonical baseline and promotion are blocked`);
  }
  if (
    review.reviewer === null || review.reviewer.name.trim() === "" || review.reviewer.role.trim() === "" ||
    review.reviewedAt === null || !Number.isFinite(Date.parse(review.reviewedAt)) ||
    review.attestation !== LISTENING_REVIEW_ATTESTATION
  ) {
    throw new Error(`approved listening review is missing its reviewer, timestamp, or exact attestation`);
  }
  for (const item of review.items) {
    if (
      item.review.rhythmPlausible !== true || item.review.phraseCoherent !== true ||
      (item.parentId === undefined
        ? item.review.variantFaithfulToParent !== "not_applicable"
        : item.review.variantFaithfulToParent !== true)
    ) {
      throw new Error(`${item.id}: approved listening review contains an unapproved judgment`);
    }
  }
}

async function validateListeningReview(
  review: ListeningReview,
  expectedSuiteFingerprint: string,
  expectedSourceManifestFingerprint: string,
  sources: ResolvedSource[],
): Promise<void> {
  if (review.schema !== LISTENING_REVIEW_SCHEMA) throw new Error(`unsupported listening review schema`);
  if (!(["awaiting-human-review", "approved", "rejected"] as const).includes(review.status)) {
    throw new Error(`invalid listening review status`);
  }
  if (
    review.suiteFingerprint !== expectedSuiteFingerprint ||
    review.sourceManifestFingerprint !== expectedSourceManifestFingerprint
  ) {
    throw new Error(`listening review does not attest the current suite and source manifest`);
  }
  if (!Array.isArray(review.items) || review.items.length !== sources.length) {
    throw new Error(`listening review does not cover the complete development catalog`);
  }
  const byId = new Map(sources.map((source) => [source.id, source]));
  const ids = review.items.map((item) => item.id);
  if (new Set(ids).size !== ids.length) throw new Error(`listening review contains duplicate cases`);
  for (const item of review.items) {
    const source = byId.get(item.id);
    if (source === undefined || source.sourceFingerprint !== item.sourceFingerprint) {
      throw new Error(`${item.id}: listening review source identity is stale`);
    }
    if (source.parentId !== item.parentId || source.role !== item.cohort) {
      throw new Error(`${item.id}: listening review parent or cohort is stale`);
    }
    if (!/^[a-f0-9]{64}$/.test(item.audioSha256)) {
      throw new Error(`${item.id}: listening review audio hash is malformed`);
    }
    const audioPath = resolve(item.audio);
    if (existsSync(audioPath)) {
      const reviewedFileSha256 = createHash("sha256").update(readFileSync(audioPath)).digest("hex");
      if (reviewedFileSha256 !== item.audioSha256) {
        throw new Error(`${item.id}: listening review audio file does not match the attested hash`);
      }
    } else if (review.status === "approved") {
      throw new Error(`${item.id}: approved listening review audio file is missing; regenerate exact click files first`);
    }
    const renderedAudioSha256 = createHash("sha256")
      .update(encodeClickTrack(await loadSourceSpec(source)))
      .digest("hex");
    if (renderedAudioSha256 !== item.audioSha256) {
      throw new Error(`${item.id}: listening review audio is stale for the current deterministic click encoder`);
    }
    const judgment = item.review;
    if (
      ![true, false, null].includes(judgment.rhythmPlausible) ||
      ![true, false, null].includes(judgment.phraseCoherent) ||
      ![true, false, null, "not_applicable"].includes(judgment.variantFaithfulToParent)
    ) {
      throw new Error(`${item.id}: listening review contains an invalid judgment`);
    }
  }
  if (review.status === "approved") {
    requireApprovedListeningReview({ path: "", fingerprint: "", review });
  }
}
