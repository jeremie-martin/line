import React from "react";
import { Composition, getInputProps } from "remotion";
import { CurveOverlay, ImpactStudyOverlay } from "./CurveOverlay";

// Two overlay compositions, parameterized by input props from the pipeline
// (scripts/produce_video.sh): dataFile, videoFile, durationS.
//   CurveOverlay       — the creative annotated overlay (axis charts + a small
//                        per-beat impact row = the production redir metric).
//   ImpactStudyOverlay — the impact-study mode: the big top-center panel comparing
//                        the impact-metric candidates per landing.
const FPS = 30;

export const RemotionRoot: React.FC = () => {
  const { durationS = 56.55 } = getInputProps() as { durationS?: number };
  const common = { durationInFrames: Math.ceil(durationS * FPS), fps: FPS, width: 1920, height: 1080 } as const;
  return (
    <>
      <Composition id="CurveOverlay" component={CurveOverlay} {...common} />
      <Composition id="ImpactStudyOverlay" component={ImpactStudyOverlay} {...common} />
    </>
  );
};
