/**
 * Descriptive authored-data audit for the transition-generator redesign.
 *
 * This performs no compilation and chooses no controls. It materializes the
 * frozen V2 jolt, reads literal per-interval targets, and reports how often
 * the interval before a contact differs from the interval after it. The result
 * is evidence about the interface a generator needs, not evidence that moving
 * any production knob will improve a score.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { normativeCases, developmentCases } from "../../benchmark/v2/catalog.ts";
import { benchmarkPolicy } from "../../benchmark/v2/policy.ts";
import { applyJolt } from "../produce/seed.ts";
import { effectiveAxes, sliceTimeline } from "./core/substrate.ts";
import { MIN_LANDING_AIRBORNE_FRAMES } from "../lib/detector.ts";
import { TARGET_AXES, secToFrame, type AxisValues, type Spec, type TargetAxisName } from "./types.ts";
import {
  transitionContracts,
  type IntervalAxes,
  type TransitionContract,
} from "./trajectory/transition_contract.ts";

const argv = process.argv.slice(2);
const argument = (name: string): string | undefined =>
  argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);

if (argv.includes("--help") || argv.includes("-h")) {
  process.stdout.write([
    "Usage: study_transition_contract_audit.ts [--scope=normative|development] [--out=FILE]",
    "",
    "Describes literal target ownership around contacts after the frozen V2 jolt.",
    "It performs no compile and excludes qualification/production references.",
  ].join("\n") + "\n");
  process.exit(0);
}

const scope = argument("scope") ?? "normative";
if (scope !== "normative" && scope !== "development") {
  throw new Error(`unknown --scope=${scope}; expected normative or development`);
}
const entries = scope === "normative" ? normativeCases : developmentCases;
const cases = entries.map((entry) => describeCase(entry.case.metadata.id, entry.case.spec));
const summary = summarize(cases);
const document = {
  schema: "line.trajectory-transition-contract-audit.v1",
  purpose: "Descriptive interface audit; no compiler candidate, control selection, or score claim.",
  scope,
  transform: benchmarkPolicy.transform,
  sourceCases: entries.map((entry) => entry.case.metadata.id),
  summary,
  cases,
};

const out = argument("out");
if (out !== undefined) {
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify(document, null, 2)}\n`);
}
process.stdout.write(formatSummary(document) + "\n");

function describeCase(id: string, source: Spec) {
  // Match the trajectory-study input convention: first few impossible frames
  // are excluded after the frozen jolt, and no jittered geometry targets enter
  // this authored-semantic audit.
  const jolted = applyJolt(source, benchmarkPolicy.transform.joltMs);
  const spec: Spec = {
    ...jolted,
    preroll: undefined,
    contacts: jolted.contacts.filter((contact) => secToFrame(contact.t) >= 5),
  };
  const durationFrames = secToFrame(spec.duration);
  const contactFrames = spec.contacts.map((contact) => secToFrame(contact.t)).sort((a, b) => a - b);
  const gaps = sliceTimeline(contactFrames, durationFrames);
  const literalTargets = gaps.map((gap) => effectiveAxes(gap, spec));
  const impactByFrame = new Map(
    spec.contacts.flatMap((contact) => contact.impact === undefined
      ? []
      : [[secToFrame(contact.t), contact.impact] as const]),
  );
  for (const gap of gaps) {
    const impact = impactByFrame.get(gap.endFrame);
    if (gap.endsWithContact && impact !== undefined) literalTargets[gap.index]!.impact = impact;
  }
  const transitions = transitionContracts(gaps, literalTargets).map((contract) => summarizeTransition(id, contract));
  return {
    id,
    durationFrames,
    contactCount: contactFrames.length,
    transitionCount: transitions.length,
    transitions,
  };
}

function summarizeTransition(caseId: string, contract: TransitionContract) {
  const incoming = contract.incoming;
  const outgoing = contract.outgoing;
  return {
    caseId,
    incomingGap: incoming.gapIndex,
    currentFrame: contract.event.frame,
    incomingFrames: incoming.intervalFrames,
    outgoingGap: outgoing?.gapIndex ?? null,
    outgoingEndKind: outgoing?.endKind ?? null,
    outgoingFrames: outgoing?.intervalFrames ?? null,
    eventImpact: contract.event.impact,
    incomingAxes: incoming.axes,
    outgoingAxes: outgoing?.axes ?? null,
    nextEvent: outgoing?.arrival ?? null,
    axisDelta: outgoing === null ? null : axisDelta(incoming.axes, outgoing.axes),
    outgoingAirFeasibility: outgoing === null || outgoing.axes.air === undefined
      ? null
      : {
        targetAir: outgoing.axes.air,
        minimumAirFraction: round(MIN_LANDING_AIRBORNE_FRAMES / outgoing.measurementSamples),
        targetMeetsSingleLandingRun: outgoing.axes.air * outgoing.measurementSamples >= MIN_LANDING_AIRBORNE_FRAMES,
      },
  };
}

function axisDelta(incoming: IntervalAxes, outgoing: IntervalAxes) {
  return Object.fromEntries(TARGET_AXES.map((axis) => {
    const before = incoming[axis];
    const after = outgoing[axis];
    return [axis, before === undefined || after === undefined ? null : round(after - before)];
  }));
}

function summarize(cases: readonly ReturnType<typeof describeCase>[]) {
  const transitions = cases.flatMap((entry) => entry.transitions);
  const withOutgoing = transitions.filter((entry) => entry.outgoingFrames !== null);
  // The first contact has no preceding authored event, and a tail does not end
  // at a later contact. Keep those physical intervals in the document, but use
  // only proper contact-to-contact transitions for target-change statistics.
  const interior = withOutgoing.filter((entry) =>
    entry.incomingGap > 0 && entry.outgoingEndKind === "contact",
  );
  const perAxis = Object.fromEntries(TARGET_AXES.map((axis) => [axis, summarizeAxis(axis, interior)]));
  const longLowAir = interior.filter((entry) =>
    entry.outgoingFrames !== null && entry.outgoingFrames >= 120 &&
    typeof entry.outgoingAxes?.air === "number" && entry.outgoingAxes.air <= 0.3,
  );
  return {
    cases: cases.length,
    authoredContacts: transitions.length,
    contactsWithOutgoingInterval: withOutgoing.length,
    outgoingContactIntervals: withOutgoing.filter((entry) => entry.outgoingEndKind === "contact").length,
    outgoingTailIntervals: withOutgoing.filter((entry) => entry.outgoingEndKind === "tail").length,
    contactsWithoutFollowingInterval: transitions.length - withOutgoing.length,
    interiorContactTransitions: interior.length,
    outgoingDurationBands: durationBands(withOutgoing.map((entry) => entry.outgoingFrames!)),
    incomingDurationBands: durationBands(transitions.map((entry) => entry.incomingFrames)),
    longLowAirOutgoingIntervals: {
      count: longLowAir.length,
      durationBands: durationBands(longLowAir.map((entry) => entry.outgoingFrames!)),
      examples: longLowAir.slice(0, 12).map((entry) => ({
        incomingGap: entry.incomingGap,
        caseId: entry.caseId,
        currentFrame: entry.currentFrame,
        outgoingFrames: entry.outgoingFrames,
        outgoingAir: entry.outgoingAxes?.air ?? null,
      })),
    },
    outgoingAirBelowSingleLandingFloor: interior.filter((entry) =>
      entry.outgoingAirFeasibility?.targetMeetsSingleLandingRun === false,
    ).length,
    outgoingDurationQuantiles: quantiles(withOutgoing.map((entry) => entry.outgoingFrames!)),
    perAxis,
  };
}

function summarizeAxis(
  axis: TargetAxisName,
  transitions: readonly ReturnType<typeof summarizeTransition>[],
) {
  const both = transitions.flatMap((entry) => {
    const before = entry.incomingAxes[axis];
    const after = entry.outgoingAxes?.[axis];
    return typeof before === "number" && typeof after === "number" ? [after - before] : [];
  });
  const incomingOnly = transitions.filter((entry) =>
    typeof entry.incomingAxes[axis] === "number" && entry.outgoingAxes?.[axis] === undefined,
  ).length;
  const outgoingOnly = transitions.filter((entry) =>
    entry.incomingAxes[axis] === undefined && typeof entry.outgoingAxes?.[axis] === "number",
  ).length;
  return {
    bothDefined: both.length,
    incomingOnly,
    outgoingOnly,
    changedOver005: both.filter((delta) => Math.abs(delta) > 0.05).length,
    changedOver010: both.filter((delta) => Math.abs(delta) > 0.10).length,
    meanSignedDelta: both.length === 0 ? null : round(mean(both)),
    maxAbsoluteDelta: both.length === 0 ? null : round(Math.max(...both.map(Math.abs))),
  };
}

function durationBands(values: readonly number[]) {
  const bands = {
    "0_8": 0,
    "9_15": 0,
    "16_40": 0,
    "41_119": 0,
    "120_plus": 0,
  };
  for (const value of values) {
    if (value <= 8) bands["0_8"]++;
    else if (value <= 15) bands["9_15"]++;
    else if (value <= 40) bands["16_40"]++;
    else if (value <= 119) bands["41_119"]++;
    else bands["120_plus"]++;
  }
  return bands;
}

function formatSummary(document: {
  scope: string;
  summary: ReturnType<typeof summarize>;
}) {
  const { summary } = document;
  const lines = [
    `transition-contract audit (${document.scope}; literal targets after ${benchmarkPolicy.transform.joltMs}ms jolt)`,
    `cases=${summary.cases} contacts=${summary.authoredContacts} outgoing=${summary.contactsWithOutgoingInterval} contact-ended=${summary.outgoingContactIntervals} tail=${summary.outgoingTailIntervals} no-following=${summary.contactsWithoutFollowingInterval}`,
    `outgoing duration bands: ${Object.entries(summary.outgoingDurationBands).map(([id, count]) => `${id}=${count}`).join(" ")}`,
    `outgoing duration quantiles: min=${summary.outgoingDurationQuantiles.min} median=${summary.outgoingDurationQuantiles.median} p95=${summary.outgoingDurationQuantiles.p95} max=${summary.outgoingDurationQuantiles.max}`,
    `long low-air outgoing intervals (>=120f, air<=.30): ${summary.longLowAirOutgoingIntervals.count}`,
    `interior contact-to-contact transitions: ${summary.interiorContactTransitions}; authored air below the ${MIN_LANDING_AIRBORNE_FRAMES}-sample single-landing floor: ${summary.outgoingAirBelowSingleLandingFloor}`,
  ];
  for (const axis of TARGET_AXES) {
    const row = summary.perAxis[axis];
    lines.push(
      `${axis}: both=${row.bothDefined} only-in=${row.incomingOnly} only-out=${row.outgoingOnly} ` +
      `|delta|>.05=${row.changedOver005} |delta|>.10=${row.changedOver010} max=${row.maxAbsoluteDelta ?? "n/a"}`,
    );
  }
  return lines.join("\n");
}

function quantiles(values: readonly number[]) {
  const sorted = [...values].sort((left, right) => left - right);
  return {
    min: sorted[0] ?? null,
    median: quantile(sorted, 0.5),
    p95: quantile(sorted, 0.95),
    max: sorted.at(-1) ?? null,
  };
}

function quantile(sorted: readonly number[], probability: number): number | null {
  if (sorted.length === 0) return null;
  const index = Math.max(0, Math.min(sorted.length - 1, Math.round((sorted.length - 1) * probability)));
  return sorted[index]!;
}

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
