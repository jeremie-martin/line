import { readFileSync } from "node:fs";
import { keyframes, type Ease, type Keyframe } from "../core/curves.ts";
import type { AxisCurves, Spec, StartState } from "../types.ts";

export const SCORE_DOCUMENT_SCHEMA = "line.benchmark-v2.score.v1" as const;

export const EVENT_ROLES = [
  "primary",
  "support",
  "pickup",
  "accent",
  "reentry",
  "breath_exit",
  "fill",
  "tail",
] as const;

export type EventRole = typeof EVENT_ROLES[number];

export type ScoreEvent = {
  offset: number;
  role: EventRole;
  impact: number;
};

export type AbsoluteScoreEvent = {
  t: number;
  role: EventRole;
  phrase: string;
  impact: number;
};

export type ScoreAxisPoint = Keyframe & { intent: string };

export type BenchmarkScoreDocument = {
  schema: typeof SCORE_DOCUMENT_SCHEMA;
  id: string;
  title: string;
  duration: number;
  provenance: {
    kind: "reference_informed_manual" | "capability_manual" | "legacy_informed_manual";
    authoring_brief: string;
  };
  primary_family: string;
  diagnostic_tags: string[];
  pulse_regions: Array<{
    start: number;
    end: number;
    pulse_seconds: number;
    intent: string;
  }>;
  phases?: Array<{
    id: string;
    start: number;
    end: number;
    intent: string;
  }>;
  phrases: Record<string, ScoreEvent[]>;
  placements: Array<{ at: number; phrase: string }>;
  events?: AbsoluteScoreEvent[];
  axes: {
    air: ScoreAxisPoint[];
    speed: ScoreAxisPoint[];
    amplitude?: ScoreAxisPoint[];
  };
  start?: StartState;
  preroll?: number;
  jitter: 0;
};

export type ExpandedScoreEvent = AbsoluteScoreEvent & { placement_index: number | null };

export type LoadedBenchmarkScore = {
  document: BenchmarkScoreDocument;
  events: ExpandedScoreEvent[];
  spec: Spec;
};

export function loadBenchmarkScore(path: string): LoadedBenchmarkScore {
  const parsed = JSON.parse(readFileSync(path, "utf8")) as BenchmarkScoreDocument;
  return buildBenchmarkScore(parsed, path);
}

export function buildBenchmarkScore(
  document: BenchmarkScoreDocument,
  label = document.id,
): LoadedBenchmarkScore {
  validateDocumentShape(document, label);
  const events: ExpandedScoreEvent[] = [];
  for (const [placementIndex, placement] of document.placements.entries()) {
    const phrase = document.phrases[placement.phrase];
    if (phrase === undefined) throw new Error(`${label}: unknown phrase ${placement.phrase}`);
    for (const event of phrase) {
      events.push({
        t: round(placement.at + event.offset),
        role: event.role,
        phrase: placement.phrase,
        impact: event.impact,
        placement_index: placementIndex,
      });
    }
  }
  for (const event of document.events ?? []) {
    events.push({ ...event, t: round(event.t), placement_index: null });
  }
  events.sort((a, b) => a.t - b.t || a.phrase.localeCompare(b.phrase));
  validateExpandedEvents(events, document.duration, label);

  const axes: AxisCurves = {
    air: keyframes(axisPoints(document.axes.air)),
    speed: keyframes(axisPoints(document.axes.speed)),
    ...(document.axes.amplitude === undefined
      ? {}
      : { amplitude: keyframes(axisPoints(document.axes.amplitude)) }),
  };
  const spec: Spec = {
    duration: document.duration,
    contacts: events.map(({ t, impact }) => ({ t, impact })),
    axes,
    jitter: 0,
    preroll: document.preroll ?? 5,
    ...(document.start === undefined ? {} : { start: { ...document.start } }),
  };
  return { document, events, spec };
}

function validateDocumentShape(document: BenchmarkScoreDocument, label: string): void {
  if (document.schema !== SCORE_DOCUMENT_SCHEMA) {
    throw new Error(`${label}: unsupported score schema ${String(document.schema)}`);
  }
  if (!/^[a-z0-9_]+$/.test(document.id)) throw new Error(`${label}: invalid id`);
  if (!document.title.trim()) throw new Error(`${label}: title is required`);
  if (!Number.isFinite(document.duration) || document.duration <= 0) {
    throw new Error(`${label}: duration must be positive`);
  }
  if (
    !["reference_informed_manual", "capability_manual", "legacy_informed_manual"].includes(
      document.provenance?.kind,
    ) || !document.provenance.authoring_brief
  ) {
    throw new Error(`${label}: explicit manual provenance is required`);
  }
  if (!document.primary_family || new Set(document.diagnostic_tags).size !== document.diagnostic_tags.length) {
    throw new Error(`${label}: family and unique diagnostic tags are required`);
  }
  if (document.jitter !== 0) throw new Error(`${label}: benchmark jitter must be zero`);
  if (!Array.isArray(document.placements) || !document.phrases || Object.keys(document.phrases).length === 0) {
    throw new Error(`${label}: phrases and placements are required`);
  }
  for (const [name, phrase] of Object.entries(document.phrases)) {
    if (!name || phrase.length === 0) throw new Error(`${label}: phrase ${name || "<empty>"} is empty`);
    validatePhrase(phrase, `${label}:${name}`);
  }
  for (const [index, placement] of document.placements.entries()) {
    if (!Number.isFinite(placement.at) || placement.at < 0) {
      throw new Error(`${label}: placement ${index} has invalid time`);
    }
    if (!(placement.phrase in document.phrases)) {
      throw new Error(`${label}: placement ${index} references unknown phrase ${placement.phrase}`);
    }
  }
  for (const event of document.events ?? []) validateAbsoluteEvent(event, label);
  validatePulseRegions(document, label);
  validatePhases(document, label);
  validateAxis(document.axes.air, "air", document.duration, label);
  validateAxis(document.axes.speed, "speed", document.duration, label);
  if (document.axes.amplitude !== undefined) {
    validateAxis(document.axes.amplitude, "amplitude", document.duration, label);
  }
}

function validatePhases(document: BenchmarkScoreDocument, label: string): void {
  let previousEnd = 0;
  const ids = new Set<string>();
  for (const phase of document.phases ?? []) {
    if (
      !/^[a-z0-9_]+$/.test(phase.id) || ids.has(phase.id) ||
      !Number.isFinite(phase.start) || !Number.isFinite(phase.end) ||
      phase.start < previousEnd || phase.end <= phase.start ||
      phase.end > document.duration || !phase.intent
    ) {
      throw new Error(`${label}: invalid capability phase ${phase.id || "<missing>"}`);
    }
    ids.add(phase.id);
    previousEnd = phase.end;
  }
}

function validatePhrase(events: ScoreEvent[], label: string): void {
  let last = -Infinity;
  for (const event of events) {
    if (!Number.isFinite(event.offset) || event.offset < 0 || event.offset <= last) {
      throw new Error(`${label}: offsets must be finite, non-negative, and strictly increasing`);
    }
    validateRoleAndImpact(event, label);
    last = event.offset;
  }
}

function validateAbsoluteEvent(event: AbsoluteScoreEvent, label: string): void {
  if (!Number.isFinite(event.t) || event.t < 0 || !event.phrase) {
    throw new Error(`${label}: invalid absolute event`);
  }
  validateRoleAndImpact(event, label);
}

function validateRoleAndImpact(
  event: Pick<ScoreEvent, "role" | "impact">,
  label: string,
): void {
  if (!(EVENT_ROLES as readonly string[]).includes(event.role)) {
    throw new Error(`${label}: unsupported event role ${String(event.role)}`);
  }
  if (!Number.isFinite(event.impact) || event.impact < 0 || event.impact > 1) {
    throw new Error(`${label}: impact must be in [0,1]`);
  }
}

function validateExpandedEvents(events: ExpandedScoreEvent[], duration: number, label: string): void {
  if (events.length === 0) throw new Error(`${label}: score expands to no contacts`);
  for (const [index, event] of events.entries()) {
    if (event.t > duration) throw new Error(`${label}: contact ${event.t}s exceeds duration`);
    if (index > 0 && event.t <= events[index - 1].t) {
      throw new Error(`${label}: duplicate or unsorted expanded contact at ${event.t}s`);
    }
  }
}

function validatePulseRegions(document: BenchmarkScoreDocument, label: string): void {
  let lastEnd = -Infinity;
  for (const region of document.pulse_regions) {
    if (
      !Number.isFinite(region.start) || !Number.isFinite(region.end) ||
      !Number.isFinite(region.pulse_seconds) || region.start < 0 ||
      region.end <= region.start || region.end > document.duration ||
      region.start < lastEnd || region.pulse_seconds <= 0 || !region.intent
    ) {
      throw new Error(`${label}: invalid or overlapping pulse region`);
    }
    lastEnd = region.end;
  }
}

function validateAxis(
  points: ScoreAxisPoint[],
  axis: "air" | "speed" | "amplitude",
  duration: number,
  label: string,
): void {
  if (!Array.isArray(points) || points.length === 0) throw new Error(`${label}: ${axis} is required`);
  let last = -Infinity;
  for (const point of points) {
    if (
      !Number.isFinite(point.t) || !Number.isFinite(point.v) || point.t < 0 ||
      point.t > duration || point.t <= last || point.v < 0 || point.v > 1 || !point.intent
    ) {
      throw new Error(`${label}: invalid ${axis} keyframe`);
    }
    if (point.ease !== undefined && !EASES.has(point.ease)) {
      throw new Error(`${label}: invalid ${axis} easing ${String(point.ease)}`);
    }
    last = point.t;
  }
}

function axisPoints(points: ScoreAxisPoint[]): Keyframe[] {
  return points.map(({ t, v, ease }) => ({ t, v, ...(ease === undefined ? {} : { ease }) }));
}

const EASES = new Set<Ease>(["hold", "linear", "smooth", "easeIn", "easeOut"]);

function round(value: number): number {
  return Number(value.toFixed(3));
}
