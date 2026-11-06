/** The track format the compiler produces and every engine reads. */
export type TrackLine = {
  id: number;
  type: 0 | 1 | 2;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  flipped: boolean;
  leftExtended: boolean;
  rightExtended: boolean;
};

/** Connected ordinary solid lines, with consecutive ids in vertex order. */
export type SolidPath = {id: number; points: readonly {x: number; y: number}[]};

export type TrackJson = {
  label: string;
  creator: string;
  description: string;
  duration: number;
  version: string;
  audio: null;
  startPosition: { x: number; y: number };
  riders: Array<{
    startPosition: { x: number; y: number };
    startVelocity: { x: number; y: number };
    remountable: number;
  }>;
  layers: Array<{ id: number; type: number; name: string; visible: boolean; editable: boolean; folderId: number }>;
  script: string;
  lines: TrackLine[];
};
