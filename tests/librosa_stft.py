"""Compute a reference STFT with librosa and dump magnitudes to JSON.

Configuration matches the JS pipeline in `src/lib/utils/fft.ts` +
`src/lib/utils/audioProcessing.ts`:

  * n_fft     = 2048
  * hop_length = 1024
  * window    = symmetric Hann (matches the inline formula in
                audioProcessing.ts:178, `0.5*(1 - cos(2πi/(N-1)))`)
  * center    = False (no reflective padding — frame starts align with
                `createWindows()` in fft.ts)

The fixture stores per-frame magnitudes for a handful of representative
frames so the JSON stays small. The JS test recreates the same input
signal deterministically and compares bin-for-bin within 1%.

Run from the repo root (after `python tests/generate_440hz.py`):

    python tests/librosa_stft.py
"""

from __future__ import annotations

import json
from pathlib import Path

import librosa
import numpy as np
from scipy.signal.windows import hann

WAV_PATH = Path(__file__).parent / "fixtures" / "sine_440hz.wav"
OUT_PATH = Path(__file__).parent / "fixtures" / "librosa_stft_440hz.json"

N_FFT = 2048
HOP_LENGTH = 1024
FREQ_HZ = 440.0
# Subset of frames to store (keeps the JSON small while still giving the
# JS test enough coverage to detect drift in the FFT or windowing math).
FRAMES_TO_STORE = [0, 5, 10, 20, 30, 40]


def main() -> None:
    if not WAV_PATH.exists():
        raise SystemExit(
            f"Missing {WAV_PATH}. Run `python tests/generate_440hz.py` first."
        )

    samples, sr = librosa.load(WAV_PATH, sr=None, mono=True)
    print(f"Loaded {samples.shape[0]} samples @ {sr} Hz")

    # Symmetric Hann to match audioProcessing.ts:178. Pass a precomputed
    # numpy window so librosa skips its own get_window() (which defaults
    # to periodic).
    window = hann(N_FFT, sym=True).astype(np.float64)

    spec = librosa.stft(
        samples.astype(np.float64),
        n_fft=N_FFT,
        hop_length=HOP_LENGTH,
        window=window,
        center=False,
    )
    magnitudes = np.abs(spec)  # shape: (n_bins, n_frames) where n_bins = N_FFT/2 + 1
    n_bins, n_frames = magnitudes.shape
    print(f"librosa STFT: {n_frames} frames x {n_bins} bins")

    frames = [i for i in FRAMES_TO_STORE if i < n_frames]
    fixture = {
        "sample_rate": int(sr),
        "n_fft": N_FFT,
        "hop_length": HOP_LENGTH,
        "window": "hann_symmetric",
        "center": False,
        "frequency_hz": FREQ_HZ,
        "amplitude": 0.5,
        "n_frames_total": int(n_frames),
        "n_bins": int(n_bins),
        "frame_indices": frames,
        # Round to 8 sig figs to keep the JSON readable; well under 1% tol.
        "magnitudes": [
            [float(f"{magnitudes[b, i]:.8g}") for b in range(n_bins)]
            for i in frames
        ],
        "peak_bin_per_frame": [int(np.argmax(magnitudes[:, i])) for i in frames],
    }

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(fixture, indent=2))
    print(f"Wrote {OUT_PATH}")
    print(f"  peak bin per stored frame: {fixture['peak_bin_per_frame']}")


if __name__ == "__main__":
    main()
