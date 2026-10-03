/** Base search configuration for arc construction, scaled by ride length and frame budget. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import type { ArcMotionOptions } from "./arc_motion.ts";
import futureValueModel from "./arc_value_model.json" with { type: "json" };
import type { Spec } from "../types.ts";

/** Reads a JSON model artifact, expanding a checksummed gzip companion file. */
export function parseArcPolicyArtifact(bytes:Buffer|string,artifactUrl?:URL):any {
  const artifact=JSON.parse(bytes.toString());
  if(artifact.schema!=="line.arc-compressed-policy.v1")return artifact;
  if(artifact.compression!=="gzip-file"||!artifactUrl||typeof artifact.file!=="string"||
    !/^[a-zA-Z0-9_.-]+\.gz$/.test(artifact.file)||!Number.isSafeInteger(artifact.uncompressedBytes)||artifact.uncompressedBytes<=0)
    throw new Error("invalid arc policy archive");
  const compressed=readFileSync(new URL(artifact.file,artifactUrl));
  if(createHash("sha256").update(compressed).digest("hex")!==artifact.compressedSha256)
    throw new Error("arc policy archive checksum mismatch");
  const raw=gunzipSync(compressed,{maxOutputLength:artifact.uncompressedBytes});
  if(raw.length!==artifact.uncompressedBytes||createHash("sha256").update(raw).digest("hex")!==artifact.sha256)
    throw new Error("arc policy archive checksum mismatch");
  return JSON.parse(raw.toString());
}

/** Production allocation from ride length and frame budget. Research can spread
 * this configuration and override a mechanism without duplicating shipped defaults. */
export function connectedArcOptions(spec: Pick<Spec, "duration">, budget: number): ArcMotionOptions {
  const duration = Math.round(spec.duration * 40), end = duration + 20;
  // Reserve construction capacity for revisiting difficult approaches. This
  // scales with actual ride length and budget, without benchmark-tier gates.
  // Give the base curve search its initial breadth before adding independent
  // guide variables. The allocation depends on available work per ride frame,
  // including the two cold replays, rather than named benchmark budgets.
  const allowance = .7 * (budget - 2 * (end + 1)) / Math.max(1, end);
  const refinement = Math.max(0, allowance - 80);
  const planningBreadth = Math.max(12, Math.min(160, Math.floor(Math.min(80, allowance) + .8 * refinement)));
  // Keep continuation capacity calibrated independently of the construction mix.
  const planningGuidanceSamples = Math.min(96, Math.floor(.8 * refinement));
  // Preserve proposal and continuation calibration while directing more of the
  // construction allowance to joint geometry refinement.
  const proposalGuidanceSamples = Math.min(160, Math.floor(2.25 * refinement));
  const samples = Math.min(80, planningBreadth);
  const guidanceSamples = Math.min(176, Math.floor(1.5 * proposalGuidanceSamples));
  const responseSamples = Math.floor(guidanceSamples * 161 / 176);
  const lookaheadSamples = Math.max(8, Math.round(planningBreadth * .2));
  return { budget, samples,
    channel: 12, radius: 24, impactWeight: 1,
    amplitudeWeight: 1 / 3, arrivalMode: "speed", arrivalWeight: .3,
    headingWeight: .3, qualityRetries: 2, guidance: guidanceSamples ? "clearance" : undefined, guidanceSamples,
    lookaheadWidth: guidanceSamples ? 3 : 0, lookaheadSamples,
    reserveFactor: .7 + .7 * (1 - planningGuidanceSamples / 96), responseSamples,
    budgetAdaptiveLocal: guidanceSamples > 0,
    // Complete-span correction needs the joint search's room to adjust the
    // approach. Preserve the measured low-allowance curve search otherwise.
    completeBoundary: guidanceSamples > 0,
    memorySamples: Math.round(4 * planningGuidanceSamples / 96),
    memoryResponseSamples: Math.round(4 * planningGuidanceSamples / 96),
    policySamples: Math.round(32 * proposalGuidanceSamples / 160),
    futureValueModel: guidanceSamples ? futureValueModel : undefined,
    // Rank unprobed arrivals with the model; its value at the simulated
    // continuation boundary is weighted separately below. Calibrate model
    // influence directly, independently of curve-search allocation.
    valueWeight: .45,
    // Let the learned arrival estimate guide geometry refinement before planning.
    valueGuidanceWeight: .25,
    continuationValueWeight: .5 * planningGuidanceSamples / 96 };
}
