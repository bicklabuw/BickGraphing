"""Generate sine_440hz.wav and its librosa STFT reference (parity ground truth).

Produces two locked unit-test fixtures used by the JS<->librosa parity tests:
  - sine_440hz.wav         1 s, 440 Hz, amp 0.5, int16 mono @ 44.1 kHz
  - librosa_stft_440hz.json  6 reference frames, magnitudes + peak bins

Configuration matches the JS pipeline (n_fft=2048, hop=1024, symmetric Hann,
center=False) — see fixture_helpers.py for the actual STFT call. The JS test
recreates the same input deterministically and compares bin-for-bin within 1%.

Run from the repo root:

    python tests/librosa_stft.py
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from fixture_helpers import SAMPLE_RATE, dump_stft_json, write_int16_wav  # noqa: E402

FIXTURES = Path(__file__).parent / "fixtures"
WAV_PATH = FIXTURES / "sine_440hz.wav"
OUT_PATH = FIXTURES / "librosa_stft_440hz.json"

FREQ_HZ = 440.0
DURATION_S = 1.0
AMPLITUDE = 0.5  # leave headroom so int16 quantization is benign
# Subset of frames to store (keeps the JSON small while giving the JS test
# enough coverage to detect drift in the FFT or windowing math).
FRAMES_TO_STORE = [0, 5, 10, 20, 30, 40]


def main() -> None:
    n = int(SAMPLE_RATE * DURATION_S)
    t = np.arange(n, dtype=np.float64) / SAMPLE_RATE
    samples = AMPLITUDE * np.sin(2 * np.pi * FREQ_HZ * t)
    write_int16_wav(WAV_PATH, samples)
    dump_stft_json(
        OUT_PATH,
        WAV_PATH,
        frames_to_store=FRAMES_TO_STORE,
        extra={"frequency_hz": FREQ_HZ, "amplitude": AMPLITUDE},
    )


if __name__ == "__main__":
    main()
