import type { SpecMusic } from "../types.ts";

export const BELIEVER_MUSIC: SpecMusic = {
  audio: "beats/audio.mp3",
  title: "Believer",
  artist: "Imagine Dragons",
  tempo: "125 BPM · 4/4",
  beats: "beats/detection_madmom.json",
  spectrogram: {
    image: "beats/spectrogram.png",
    metadata: "beats/spectrogram.json",
  },
};

export const SHELTER_65_MUSIC: SpecMusic = {
  audio: "beats/shelter_65s.mp3",
  title: "Shelter",
  artist: "Porter Robinson & Madeon",
  tempo: "100 BPM · 4/4",
  beats: "beats/shelter_65s.json",
  spectrogram: {
    image: "beats/shelter_65s.spectrogram.png",
    metadata: "beats/shelter_65s.spectrogram.json",
  },
};

export const SHELTER_81_MUSIC: SpecMusic = {
  audio: "beats/shelter_81s.mp3",
  title: "Shelter",
  artist: "Porter Robinson & Madeon",
  tempo: "100 BPM · 4/4",
  beats: "beats/shelter81/madmom.json",
  spectrogram: {
    image: "beats/shelter_81s.spectrogram.png",
    metadata: "beats/shelter_81s.spectrogram.json",
  },
};
