"""Generate a 1-second 440Hz sine wav at 44.1 kHz for unit-test fixtures.

The test wav is intentionally tiny and deterministic (no normalization,
no fades) so the JS-side STFT can be compared bin-for-bin against the
librosa reference produced by `librosa_stft.py`.

Run from the repo root:

    python tests/generate_440hz.py
"""

from pathlib import Path
import numpy as np
from scipy.io.wavfile import write

SAMPLE_RATE = 44100
FREQ_HZ = 440.0
DURATION_S = 1.0
AMPLITUDE = 0.5  # leave headroom so int16 quantization is benign

OUT_PATH = Path(__file__).parent / "fixtures" / "sine_440hz.wav"


def main() -> None:
    n = int(SAMPLE_RATE * DURATION_S)
    t = np.arange(n, dtype=np.float64) / SAMPLE_RATE
    samples = AMPLITUDE * np.sin(2 * np.pi * FREQ_HZ * t)

    pcm16 = np.int16(np.round(samples * 32767))
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    write(OUT_PATH, SAMPLE_RATE, pcm16)
    print(f"Wrote {OUT_PATH} ({n} samples @ {SAMPLE_RATE} Hz, {FREQ_HZ} Hz tone)")


if __name__ == "__main__":
    main()
