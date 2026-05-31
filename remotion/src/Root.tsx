import React from "react";
import { Composition } from "remotion";
import { PhaseOverlay } from "./PhaseOverlay";

// Source video is 56.55s @ 1280x720 (the believer_v3 ride with muxed audio).
const FPS = 30;
const DURATION_S = 56.55;

export const RemotionRoot: React.FC = () => (
  <Composition
    id="PhaseOverlay"
    component={PhaseOverlay}
    durationInFrames={Math.ceil(DURATION_S * FPS)}
    fps={FPS}
    width={1920}
    height={1080}
  />
);
