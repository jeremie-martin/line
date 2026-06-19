import React from "react";
import { Composition, getInputProps } from "remotion";
import { CurveOverlay, CurveOverlayVertical, ImpactStudyOverlay } from "./CurveOverlay";

// Three overlay compositions, parameterized by input props from the produce
// pipeline (scripts/produce/render.ts): dataFile, videoFile, durationS.
//   CurveOverlay         — landscape creative annotated overlay (axis charts + a
//                          small per-beat impact row = the production redir metric).
//   CurveOverlayVertical — the 9:16 production overlay used by the produce pipeline.
//   ImpactStudyOverlay   — the impact-study mode: the big top-center panel comparing
//                          the impact-metric candidates per landing.
const FPS = 30;

export const RemotionRoot: React.FC = () => {
  const { durationS = 56.55 } = getInputProps() as { durationS?: number };
  const common = { durationInFrames: Math.ceil(durationS * FPS), fps: FPS, width: 1920, height: 1080 } as const;
  const vertical = { durationInFrames: Math.ceil(durationS * FPS), fps: FPS, width: 1080, height: 1920 } as const;
  return (
    <>
      <Composition id="CurveOverlay" component={CurveOverlay} {...common} />
      <Composition id="CurveOverlayVertical" component={CurveOverlayVertical} {...vertical} />
      <Composition id="ImpactStudyOverlay" component={ImpactStudyOverlay} {...common} />
    </>
  );
};
