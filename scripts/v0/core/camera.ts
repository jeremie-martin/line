import { FPS, secToFrame, type Spec, type SpecZoomLane } from "../types.ts";

export type RenderZoomPlan = {
  /** Native createZoomer input: frame index plus log2(linear zoom). */
  zoomKeyframes: [number, number][];
  /** Dense linear zoom fallback, indexed by simulator frame. */
  autoZoom: number[];
  /** Native createZoomer smoothing window in frames. */
  zoomSmoothing: number;
};

export type CameraSidecar = {
  fps: number;
  durationFrames: number;
  zoom?: {
    keyframes: [number, number][];
    smoothingFrames: number;
  };
};

export function specCameraToSidecar(spec: Spec): CameraSidecar | null {
  const plan = specZoomLaneToRenderPlan(spec.camera?.zoom, spec.duration);
  if (plan === null) return null;
  return {
    fps: FPS,
    durationFrames: secToFrame(spec.duration),
    zoom: {
      keyframes: plan.zoomKeyframes,
      smoothingFrames: plan.zoomSmoothing,
    },
  };
}

export function cameraSidecarToRenderPlan(sidecar: CameraSidecar | null | undefined): RenderZoomPlan | null {
  const zoom = sidecar?.zoom;
  if (zoom === undefined || zoom.keyframes.length === 0) return null;
  const zoomKeyframes = zoom.keyframes.map(([frame, log2Zoom]) => [frame, log2Zoom] as [number, number]);
  return {
    zoomKeyframes,
    autoZoom: denseLinearZoomFromLog2Keyframes(zoomKeyframes, sidecar.durationFrames),
    zoomSmoothing: zoom.smoothingFrames ?? 0,
  };
}

export function specZoomLaneToRenderPlan(
  lane: SpecZoomLane | undefined,
  durationSeconds: number,
): RenderZoomPlan | null {
  if (lane === undefined) return null;
  const durationFrames = secToFrame(durationSeconds);
  const zoomKeyframes = normalizeSpecZoomKeyframes(lane, durationFrames);
  return {
    zoomKeyframes,
    autoZoom: denseLinearZoomFromLog2Keyframes(zoomKeyframes, durationFrames),
    zoomSmoothing: lane.smoothingFrames ?? 0,
  };
}

export function normalizeSpecZoomKeyframes(lane: SpecZoomLane, durationFrames: number): [number, number][] {
  const byFrame = new Map<number, number>();
  for (const point of [...lane.keyframes].sort((a, b) => a.t - b.t)) {
    const frame = Math.max(0, Math.min(durationFrames, secToFrame(point.t)));
    byFrame.set(frame, Math.log2(point.zoom));
  }
  const ordered = [...byFrame.entries()].sort((a, b) => a[0] - b[0]);
  if (ordered.length === 0) {
    throw new Error("camera zoom lane requires at least one keyframe");
  }
  if (ordered[0][0] !== 0) {
    ordered.unshift([0, ordered[0][1]]);
  }
  if (ordered[ordered.length - 1][0] !== durationFrames) {
    ordered.push([durationFrames, ordered[ordered.length - 1][1]]);
  }
  return ordered;
}

export function denseLinearZoomFromLog2Keyframes(
  zoomKeyframes: readonly [number, number][],
  durationFrames: number,
): number[] {
  const n = Math.max(1, durationFrames + 1);
  const out = new Array<number>(n);
  let segment = 0;
  for (let frame = 0; frame < n; frame++) {
    while (
      segment < zoomKeyframes.length - 2 &&
      frame > zoomKeyframes[segment + 1][0]
    ) {
      segment++;
    }
    const [f0, z0] = zoomKeyframes[segment];
    const [f1, z1] = zoomKeyframes[Math.min(segment + 1, zoomKeyframes.length - 1)];
    const u = f1 === f0 ? 0 : Math.max(0, Math.min(1, (frame - f0) / (f1 - f0)));
    out[frame] = 2 ** (z0 + (z1 - z0) * u);
  }
  return out;
}
