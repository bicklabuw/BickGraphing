"""Generate sweep + white-noise wavs and their librosa STFT references.

Reuses `create_continuous_sweep` and `create_white_noise` from
`CreateWavSounds.py` (in this same directory) so the test signals are
produced by exactly the same code that drives the app's research stimuli —
keeping unit-test fixtures and experimental audio in sync.

Output (under tests/fixtures/):
  - sweep_1s.wav            1 s up+down chirp 50→2000→50 Hz, amp 0.5
  - sweep_1s_stft.json      librosa STFT magnitudes for selected frames
  - noise_1s.wav            1 s seeded white noise, amp 0.5
  - noise_1s_stft.json      librosa STFT magnitudes for selected frames

Run:
    python tests/generate_extra_fixtures.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import librosa
from scipy.io.wavfile import write as wav_write
from scipy.signal.windows import hann

# Make sibling modules importable when this script is run directly.
sys.path.insert(0, str(Path(__file__).resolve().parent))

from CreateWavSounds import create_continuous_sweep, create_white_noise  # noqa: E402

FIXTURES = Path(__file__).parent / "fixtures"
SAMPLE_RATE = 44100
N_FFT = 2048
HOP_LENGTH = 1024
AMPLITUDE = 0.5
NOISE_SEED = 42


def write_int16_wav(path: Path, samples: np.ndarray, sr: int) -> None:
    pcm = np.int16(np.clip(samples, -1.0, 1.0) * 32767)
    path.parent.mkdir(parents=True, exist_ok=True)
    wav_write(path, sr, pcm)


def librosa_stft_magnitudes(samples: np.ndarray) -> np.ndarray:
    window = hann(N_FFT, sym=True).astype(np.float64)
    spec = librosa.stft(
        samples.astype(np.float64),
        n_fft=N_FFT,
        hop_length=HOP_LENGTH,
        window=window,
        center=False,
    )
    return np.abs(spec)


def dump_fixture(
    out_path: Path,
    wav_path: Path,
    label: str,
    frames_to_store: list[int],
    extra: dict | None = None,
) -> None:
    samples, sr = librosa.load(wav_path, sr=None, mono=True)
    mags = librosa_stft_magnitudes(samples)
    n_bins, n_frames = mags.shape
    print(f"[{label}] {n_frames} frames x {n_bins} bins from {wav_path.name}")

    frames = [i for i in frames_to_store if i < n_frames]
    payload = {
        "sample_rate": int(sr),
        "n_fft": N_FFT,
        "hop_length": HOP_LENGTH,
        "window": "hann_symmetric",
        "center": False,
        "amplitude": AMPLITUDE,
        "n_frames_total": int(n_frames),
        "n_bins": int(n_bins),
        "frame_indices": frames,
        "magnitudes": [
            [float(f"{mags[b, i]:.8g}") for b in range(n_bins)] for i in frames
        ],
        "peak_bin_per_frame": [int(np.argmax(mags[:, i])) for i in frames],
    }
    if extra:
        payload.update(extra)
    out_path.write_text(json.dumps(payload, indent=2))
    print(f"[{label}] wrote {out_path.name}  peak bins={payload['peak_bin_per_frame']}")


def make_sweep() -> None:
    # duration=0.5 produces 0.5 s up + 0.5 s down = exactly 1 s when extend=False.
    sweep = create_continuous_sweep(
        duration=0.5,
        sample_rate=SAMPLE_RATE,
        min_freq=50,
        max_freq=2000,
        amplitude=AMPLITUDE,
        extend_duration_to_freq_at_zero=False,
    )
    wav_path = FIXTURES / "sweep_1s.wav"
    write_int16_wav(wav_path, sweep, SAMPLE_RATE)
    print(f"[sweep] wrote {wav_path.name} ({sweep.shape[0]} samples)")

    # Cover the whole sweep arc: early (low f), mid (peak f), late (low f again).
    dump_fixture(
        out_path=FIXTURES / "sweep_1s_stft.json",
        wav_path=wav_path,
        label="sweep",
        frames_to_store=[0, 5, 10, 15, 20, 25, 30, 35, 40],
        extra={"min_freq_hz": 50, "max_freq_hz": 2000, "duration_per_dir_s": 0.5},
    )


def make_noise() -> None:
    np.random.seed(NOISE_SEED)
    noise = create_white_noise(duration=1.0, sample_rate=SAMPLE_RATE, amplitude=AMPLITUDE)
    wav_path = FIXTURES / "noise_1s.wav"
    write_int16_wav(wav_path, noise, SAMPLE_RATE)
    print(f"[noise] wrote {wav_path.name} ({noise.shape[0]} samples, seed={NOISE_SEED})")

    dump_fixture(
        out_path=FIXTURES / "noise_1s_stft.json",
        wav_path=wav_path,
        label="noise",
        frames_to_store=[0, 8, 16, 24, 32, 40],
        extra={"seed": NOISE_SEED},
    )


def main() -> None:
    FIXTURES.mkdir(parents=True, exist_ok=True)
    make_sweep()
    make_noise()


if __name__ == "__main__":
    main()
