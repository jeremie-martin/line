import type { ResolvedStart, TrackJson, TrackLine } from "./types.ts";
import { roundToGrid, stableHash } from "./deterministic_math.ts";

export function quantizeTrackLine(line: TrackLine): TrackLine {
  return {
    ...line,
    x1: roundToGrid(line.x1),
    y1: roundToGrid(line.y1),
    x2: roundToGrid(line.x2),
    y2: roundToGrid(line.y2),
  };
}

export function buildTrackJson(
  lines: readonly TrackLine[],
  durationFrames: number,
  start: ResolvedStart,
  label = "v1",
): TrackJson {
  return {
    label,
    creator: "line/v1",
    description: "v1 compiler output",
    duration: durationFrames,
    version: "6.2",
    audio: null,
    startPosition: { x: start.position.x, y: start.position.y },
    riders: [
      {
        startPosition: { x: start.position.x, y: start.position.y },
        startVelocity: { x: start.velocity.x, y: start.velocity.y },
        remountable: 1,
      },
    ],
    layers: [
      { id: 0, type: 0, name: "Base Layer", visible: true, editable: true, folderId: -1 },
    ],
    script: "",
    lines: lines.map(quantizeTrackLine),
  };
}

export function canonicalTrackHash(track: TrackJson): string {
  return stableHash(track);
}
