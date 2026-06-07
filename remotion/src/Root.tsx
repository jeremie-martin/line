import React from "react";
import { Composition, getInputProps } from "remotion";
import { CurveOverlay } from "./CurveOverlay";

// One annotated-overlay composition, parameterized by input props from the
// pipeline (scripts/produce_video.sh): dataFile, videoFile, durationS.
const FPS = 30;

export const RemotionRoot: React.FC = () => {
  const { durationS = 56.55 } = getInputProps() as { durationS?: number };
  return (
    <Composition
      id="CurveOverlay"
      component={CurveOverlay}
      durationInFrames={Math.ceil(durationS * FPS)}
      fps={FPS}
      width={1920}
      height={1080}
    />
  );
};
