"""
Render a mel-spectrogram of the mix as a PNG, plus a small JSON sidecar with
timing metadata, so the dashboard can use it as a synchronized backdrop.

Standalone from extract.py — that script's JSON already carries a heavy
envelope; we keep the image separate so it can be loaded lazily and cached
by the browser.

  - log-mel spectrogram (128 bands, 0–11025 Hz)
  - magnitudes in dB, clipped to a fixed dynamic range
  - magma colormap baked in (so the browser just blits)
  - one column per STFT hop ⇒ time→pixel mapping is trivial
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import librosa
import numpy as np
from matplotlib import cm
from PIL import Image

SR = 22050
N_FFT = 2048
HOP = 512          # ~23 ms per column
N_MELS = 128
FMIN = 30.0
FMAX = SR / 2
DB_TOP = 0.0       # peak == 0 dB
DB_FLOOR = -70.0   # anything quieter is clipped to floor


def main(audio_path: Path, png_path: Path, json_path: Path) -> None:
    print(f"loading {audio_path} ...")
    y, sr = librosa.load(str(audio_path), sr=SR, mono=True)
    duration = len(y) / sr
    print(f"  {duration:.2f}s @ {sr} Hz")

    print(f"mel spectrogram (n_mels={N_MELS}, hop={HOP}) ...")
    mel = librosa.feature.melspectrogram(
        y=y, sr=sr, n_fft=N_FFT, hop_length=HOP,
        n_mels=N_MELS, fmin=FMIN, fmax=FMAX, power=2.0,
    )
    db = librosa.power_to_db(mel, ref=np.max, top_db=-DB_FLOOR)
    # db is now in [DB_FLOOR, DB_TOP]; normalize to [0, 1]
    norm = (db - DB_FLOOR) / (DB_TOP - DB_FLOOR)
    norm = np.clip(norm, 0.0, 1.0)

    # Apply magma. Flip vertically so low freq is at bottom of the image.
    rgba = cm.magma(norm[::-1, :])           # (H, W, 4) float
    rgb = (rgba[:, :, :3] * 255).astype(np.uint8)

    img = Image.fromarray(rgb, mode="RGB")
    img.save(png_path, optimize=True)
    print(f"wrote {png_path}  ({img.size[0]}×{img.size[1]}, "
          f"{png_path.stat().st_size/1024:.1f} KiB)")

    meta = {
        "audio_file": audio_path.name,
        "duration":   duration,
        "sr":         sr,
        "hop":        HOP,
        "n_mels":     N_MELS,
        "fmin":       FMIN,
        "fmax":       FMAX,
        "db_floor":   DB_FLOOR,
        "db_top":     DB_TOP,
        "width":      img.size[0],
        "height":     img.size[1],
        "image":      png_path.name,
        "colormap":   "magma",
    }
    json_path.write_text(json.dumps(meta, indent=2))
    print(f"wrote {json_path}")


if __name__ == "__main__":
    here = Path(__file__).parent
    audio = Path(sys.argv[1]) if len(sys.argv) > 1 else here / "audio.mp3"
    main(audio, here / "spectrogram.png", here / "spectrogram.json")
