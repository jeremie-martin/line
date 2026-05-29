import { evaluateTrackJson } from "./completion_oracle.ts";
import { detectFull } from "./gap_evaluator.ts";
import { rebuildEngineFromLines } from "./engine_adapter.ts";
import { stableHash } from "./deterministic_math.ts";
import { CompileStatsBuilder } from "./stats.ts";
import type {
  CandidateKey,
  CompleteCandidate,
  NormalizedSpecContext,
  TrackJson,
  TrackLine,
} from "./types.ts";
import type { GapFit } from "./search_state.ts";
import { WorkMeter } from "./work_meter.ts";
import { CALIB } from "./normalize.ts";
import type { Detection } from "../lib/detector.ts";

export type PolishCandidate = {
  baseTrackHash: string;
  candidateKey: CandidateKey;
  track: TrackJson;
  fits?: (GapFit | null)[];
};

const POLISH_PROPOSALS_PER_COMPLETE = 12;

export function evaluatePolishCandidates(
  base: CompleteCandidate,
  context: NormalizedSpecContext,
  meter: WorkMeter,
  stats: CompileStatsBuilder,
): CompleteCandidate[] {
  if (!base.score.contract_passed || base.track.lines.length === 0) return [];
  stats.recordPolishIteration();

  const baseDet = meter.canSpendOne()
    ? detectFull(
        rebuildEngineFromLines(base.track.lines, context.startState, meter, stats).raw(),
        context.durationFrames + 20,
        stats,
      )
    : undefined;
  const proposals = proposePolishCandidates(base, context, baseDet).slice(0, POLISH_PROPOSALS_PER_COMPLETE);
  const out: CompleteCandidate[] = [];
  for (const proposal of proposals) {
    if (!meter.canSpendOne()) break;
    stats.recordPolishCandidate();
    out.push(evaluateTrackJson(
      proposal.track,
      context,
      proposal.candidateKey,
      meter,
      stats,
      proposal.fits ?? base.fits,
    ));
  }
  return out;
}

export function proposePolishCandidates(
  base: CompleteCandidate,
  context: NormalizedSpecContext,
  detection?: Detection,
): PolishCandidate[] {
  const lastIndex = base.track.lines.length - 1;
  const last = base.track.lines[lastIndex];
  if (last === undefined) return [];

  return [
    ...contactEdgePolishCandidates(base, context, detection),
    ...sectionLengthPolishCandidates(base, context),
    {
      baseTrackHash: base.trackHash,
      candidateKey: polishKey(base, context, 0),
      ...withLine(base, lastIndex, shortenLine(last, 0.92), "v1-polish-shorten-tail"),
    },
    {
      baseTrackHash: base.trackHash,
      candidateKey: polishKey(base, context, 1),
      ...withLine(base, lastIndex, shiftLine(last, 0, -0.5), "v1-polish-tail-up"),
    },
    {
      baseTrackHash: base.trackHash,
      candidateKey: polishKey(base, context, 2),
      ...withLine(base, lastIndex, shiftLine(last, 0, 0.5), "v1-polish-tail-down"),
    },
    {
      baseTrackHash: base.trackHash,
      candidateKey: polishKey(base, context, 3),
      ...withoutLine(base, lastIndex, "v1-polish-drop-tail"),
    },
  ];
}

type ContactEdge = {
  lineId: number;
  frame: number;
  side: "start" | "end";
};

function contactEdgePolishCandidates(
  base: CompleteCandidate,
  context: NormalizedSpecContext,
  detection: Detection | undefined,
): PolishCandidate[] {
  if (base.fits === undefined || detection === undefined) return [];
  const edges = contactEdges(detection);
  if (edges.length === 0) return [];

  const sectionErrors = base.report.sections
    .flatMap((section) => Object.entries(section.axes).map(([axis, value]) => ({
      sectionIndex: section.section_index,
      axis,
      target: value.target,
      achieved: value.achieved,
      error: Math.abs(value.error),
    })))
    .filter((entry) => entry.error >= 0.08)
    .sort((a, b) => {
      if (b.error !== a.error) return b.error - a.error;
      if (a.sectionIndex !== b.sectionIndex) return a.sectionIndex - b.sectionIndex;
      return a.axis.localeCompare(b.axis);
    })
    .slice(0, 4);

  const out: PolishCandidate[] = [];
  const seen = new Set<string>();
  for (const entry of sectionErrors) {
    const direction = lengthDirectionForAxis(entry.axis, entry.target, entry.achieved);
    if (direction === 0) continue;
    const section = context.sectionWindows[entry.sectionIndex];
    if (section === undefined) continue;

    const sectionEdges = edges
      .filter((edge) => edge.frame >= section.startFrame && edge.frame <= section.endFrame)
      .slice(0, 10);
    for (const edge of sectionEdges) {
      const index = lineIndexById(base.track, edge.lineId);
      if (index < 0) continue;
      const line = base.track.lines[index];
      if (line === undefined) continue;
      const variants = direction > 0
        ? ([6, 12, 24] as const).map((extra) => ({
            label: "v1-polish-contact-extend",
            line: adjustLineLength(line, edge.side, extra),
            amount: extra,
          }))
        : ([0.85, 0.7, 0.55] as const).map((fraction) => ({
            label: "v1-polish-contact-trim",
            line: trimLineSide(line, edge.side, fraction),
            amount: -fraction,
          }));

      for (const variant of variants) {
        if (variant.line === null) continue;
        const key = `${entry.sectionIndex}:${entry.axis}:${edge.lineId}:${edge.side}:${variant.amount}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({
          baseTrackHash: base.trackHash,
          candidateKey: polishKey(base, context, 100 + out.length),
          ...withLine(base, index, variant.line, variant.label),
        });
        if (out.length >= 24) return out;
      }
    }
  }
  return out;
}

function contactEdges(det: Detection): ContactEdge[] {
  const out: ContactEdge[] = [];
  const seen = new Set<string>();
  let inContact = false;
  let startFrame = 0;
  let ids = new Set<number>();

  for (let frame = 0; frame < det.measurements.airborne.length; frame++) {
    const contact = !det.measurements.airborne[frame];
    if (contact) {
      if (!inContact) {
        startFrame = frame;
        ids = new Set<number>();
      }
      inContact = true;
      for (const id of det.measurements.contactLineIds[frame] ?? []) ids.add(id);
      continue;
    }

    if (!inContact) continue;
    addContactEdge(out, seen, ids, startFrame, "start");
    addContactEdge(out, seen, ids, frame - 1, "end");
    inContact = false;
    ids = new Set<number>();
  }

  if (inContact) {
    addContactEdge(out, seen, ids, startFrame, "start");
    addContactEdge(out, seen, ids, det.measurements.airborne.length - 1, "end");
  }

  return out;
}

function addContactEdge(
  out: ContactEdge[],
  seen: Set<string>,
  ids: ReadonlySet<number>,
  frame: number,
  side: "start" | "end",
): void {
  const sorted = [...ids].sort((a, b) => a - b);
  const lineId = side === "start" ? sorted[0] : sorted.at(-1);
  if (lineId === undefined) return;
  const key = `${lineId}:${frame}:${side}`;
  if (seen.has(key)) return;
  seen.add(key);
  out.push({ lineId, frame, side });
}

function sectionLengthPolishCandidates(
  base: CompleteCandidate,
  context: NormalizedSpecContext,
): PolishCandidate[] {
  if (base.fits === undefined) return [];

  const errors = base.report.sections
    .flatMap((section) => Object.entries(section.axes).map(([axis, value]) => ({
      sectionIndex: section.section_index,
      axis,
      target: value.target,
      achieved: value.achieved,
      error: Math.abs(value.error),
    })))
    .filter((entry) => entry.error >= 0.08)
    .sort((a, b) => {
      if (b.error !== a.error) return b.error - a.error;
      if (a.sectionIndex !== b.sectionIndex) return a.sectionIndex - b.sectionIndex;
      return a.axis.localeCompare(b.axis);
    })
    .slice(0, 4);

  const out: PolishCandidate[] = [];
  const seen = new Set<string>();
  for (const entry of errors) {
    const direction = lengthDirectionForAxis(entry.axis, entry.target, entry.achieved);
    if (direction === 0) continue;

    const section = context.sectionWindows[entry.sectionIndex];
    if (section === undefined) continue;
    const fitEntries = fitsInSection(base.fits, context, section.startFrame, section.endFrame)
      .sort((a, b) => {
        if (b.fit.cost !== a.fit.cost) return b.fit.cost - a.fit.cost;
        return a.gapIndex - b.gapIndex;
      })
      .slice(0, 3);

    for (const { gapIndex, fit } of fitEntries) {
      const line = medianLengthLine(fit);
      if (line === null) continue;
      for (const magnitude of [4, 8, 16] as const) {
        for (const side of ["end", "start"] as const) {
          const adjusted = adjustLineLength(line, side, direction * magnitude);
          if (adjusted === null) continue;
          const key = `${entry.sectionIndex}:${entry.axis}:${gapIndex}:${line.id}:${side}:${direction * magnitude}`;
          if (seen.has(key)) continue;
          seen.add(key);
          out.push({
            baseTrackHash: base.trackHash,
            candidateKey: polishKey(base, context, 4 + out.length),
            ...withLine(base, lineIndexById(base.track, line.id), adjusted, "v1-polish-section-length"),
          });
          if (out.length >= 24) return out;
        }
      }
    }
  }
  return out;
}

function lengthDirectionForAxis(axis: string, target: number, achieved: number): -1 | 0 | 1 {
  if (Math.abs(target - achieved) < 1e-9) return 0;
  if (axis === "air") return achieved > target ? 1 : -1;
  if (axis === "grain" || axis === "contact_style") return achieved < target ? 1 : -1;
  if (axis === "speed") return achieved < target ? 1 : -1;
  return 0;
}

function fitsInSection(
  fits: readonly (GapFit | null)[],
  context: NormalizedSpecContext,
  startFrame: number,
  endFrame: number,
): { gapIndex: number; fit: GapFit }[] {
  const out: { gapIndex: number; fit: GapFit }[] = [];
  for (let gapIndex = 0; gapIndex < context.gaps.length; gapIndex++) {
    const gap = context.gaps[gapIndex];
    const fit = fits[gapIndex];
    if (!gap.endsWithContact || fit === null) continue;
    if (gap.endFrame >= startFrame && gap.endFrame <= endFrame) out.push({ gapIndex, fit });
  }
  return out;
}

function medianLengthLine(fit: GapFit): TrackLine | null {
  if (fit.lines.length === 0) return null;
  const sorted = [...fit.lines].sort((a, b) => {
    const da = lineLength(a);
    const db = lineLength(b);
    if (da !== db) return da - db;
    return a.id - b.id;
  });
  return sorted[Math.floor((sorted.length - 1) / 2)] ?? null;
}

function polishKey(
  base: CompleteCandidate,
  context: NormalizedSpecContext,
  ordinal: number,
): CandidateKey {
  return {
    specHash: context.specHash,
    seed: context.seed,
    gapIndex: context.gaps.length,
    prefixHash: stableHash(["polish", base.trackHash]),
    stream: "polish",
    ordinal,
  };
}

function withLine(
  base: CompleteCandidate,
  index: number,
  line: TrackLine,
  label: string,
): Pick<PolishCandidate, "track" | "fits"> {
  if (index < 0) {
    return { track: cloneTrack(base.track, base.track.lines.map((existing) => ({ ...existing })), label) };
  }
  const track = base.track;
  const lines = track.lines.map((existing, lineIndex) => (
    lineIndex === index ? { ...line } : { ...existing }
  ));
  return {
    track: cloneTrack(track, lines, label),
    fits: replaceLineInFits(base.fits, line),
  };
}

function withoutLine(
  base: CompleteCandidate,
  index: number,
  label: string,
): Pick<PolishCandidate, "track" | "fits"> {
  const track = base.track;
  const line = track.lines[index];
  const lines = track.lines
    .filter((_, lineIndex) => lineIndex !== index)
    .map((line) => ({ ...line }));
  return {
    track: cloneTrack(track, lines, label),
    fits: line === undefined ? cloneFits(base.fits) : removeLineFromFits(base.fits, line.id),
  };
}

function cloneTrack(track: TrackJson, lines: TrackLine[], label: string): TrackJson {
  return {
    ...track,
    label,
    riders: track.riders.map((rider) => ({
      ...rider,
      startPosition: { ...rider.startPosition },
      startVelocity: { ...rider.startVelocity },
    })),
    layers: track.layers.map((layer) => ({ ...layer })),
    lines,
  };
}

function shiftLine(line: TrackLine, dx: number, dy: number): TrackLine {
  return {
    ...line,
    x1: line.x1 + dx,
    y1: line.y1 + dy,
    x2: line.x2 + dx,
    y2: line.y2 + dy,
  };
}

function shortenLine(line: TrackLine, scale: number): TrackLine {
  const cx = (line.x1 + line.x2) / 2;
  const cy = (line.y1 + line.y2) / 2;
  return {
    ...line,
    x1: cx + (line.x1 - cx) * scale,
    y1: cy + (line.y1 - cy) * scale,
    x2: cx + (line.x2 - cx) * scale,
    y2: cy + (line.y2 - cy) * scale,
  };
}

function trimLineSide(line: TrackLine, side: "start" | "end", keepFraction: number): TrackLine | null {
  if (keepFraction <= 0 || keepFraction >= 1) return null;
  if (side === "start") {
    const x1 = line.x2 - (line.x2 - line.x1) * keepFraction;
    const y1 = line.y2 - (line.y2 - line.y1) * keepFraction;
    if (Math.hypot(line.x2 - x1, line.y2 - y1) < 1) return null;
    return { ...line, x1, y1 };
  }
  const x2 = line.x1 + (line.x2 - line.x1) * keepFraction;
  const y2 = line.y1 + (line.y2 - line.y1) * keepFraction;
  if (Math.hypot(x2 - line.x1, y2 - line.y1) < 1) return null;
  return { ...line, x2, y2 };
}

function adjustLineLength(line: TrackLine, side: "start" | "end", extra: number): TrackLine | null {
  const dx = line.x2 - line.x1;
  const dy = line.y2 - line.y1;
  const len = Math.hypot(dx, dy);
  if (len <= 1e-9 || len + extra <= 1) return null;
  const ux = dx / len;
  const uy = dy / len;
  if (side === "end") {
    return { ...line, x2: line.x2 + ux * extra, y2: line.y2 + uy * extra };
  }
  return { ...line, x1: line.x1 - ux * extra, y1: line.y1 - uy * extra };
}

function lineIndexById(track: TrackJson, lineId: number): number {
  return track.lines.findIndex((line) => line.id === lineId);
}

function replaceLineInFits(
  fits: CompleteCandidate["fits"],
  line: TrackLine,
): (GapFit | null)[] | undefined {
  const cloned = cloneFits(fits);
  if (cloned === undefined) return undefined;
  for (const fit of cloned) {
    if (fit === null) continue;
    const index = fit.lines.findIndex((existing) => existing.id === line.id);
    if (index < 0) continue;
    fit.lines[index] = { ...line };
    refreshGeometryAxes(fit);
    return cloned;
  }
  return cloned;
}

function removeLineFromFits(
  fits: CompleteCandidate["fits"],
  lineId: number,
): (GapFit | null)[] | undefined {
  const cloned = cloneFits(fits);
  if (cloned === undefined) return undefined;
  for (const fit of cloned) {
    if (fit === null) continue;
    const nextLines = fit.lines.filter((line) => line.id !== lineId);
    if (nextLines.length === fit.lines.length) continue;
    fit.lines = nextLines;
    refreshGeometryAxes(fit);
    return cloned;
  }
  return cloned;
}

function cloneFits(fits: CompleteCandidate["fits"]): (GapFit | null)[] | undefined {
  if (fits === undefined) return undefined;
  return fits.map((fit) => fit === null
    ? null
    : {
      ...fit,
      candidateKey: { ...fit.candidateKey },
      lines: fit.lines.map((line) => ({ ...line })),
      achieved: { ...fit.achieved },
    });
}

function refreshGeometryAxes(fit: GapFit): void {
  const lengths = fit.lines.map(lineLength);
  fit.achieved.grain = lengths.length > 0
    ? Math.min(1, median(lengths) / CALIB.LINE_LENGTH_CAP)
    : 0;
  fit.geometryHash = stableHash(fit.lines);
}

function lineLength(line: TrackLine): number {
  return Math.hypot(line.x2 - line.x1, line.y2 - line.y1);
}

function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
