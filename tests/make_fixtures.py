"""Generate sine / sweep / noise fixtures at user-specified durations.

Produces a .wav + companion librosa STFT .json reference for each
(signal, duration) pair. Coexists with the locked unit-test fixtures
(`sine_440hz.wav`, `sweep_1s.wav`, `noise_1s.wav`) — different filename
pattern, no collision.

Usage:
    python tests/make_fixtures.py 10
    python tests/make_fixtures.py 1 5 10
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from CreateWavSounds import create_continuous_sweep, create_white_noise  # noqa: E402
from fixture_helpers import SAMPLE_RATE, dump_stft_json, write_int16_wav  # noqa: E402

FIXTURES = Path(__file__).parent / "fixtures"
AMPLITUDE = 0.5
SINE_FREQ_HZ = 440.0
SWEEP_MIN_HZ = 50
SWEEP_MAX_HZ = 2000
NOISE_SEED = 42


def fmt_dur(d: float) -> str:
    return str(int(d)) if d == int(d) else str(d)


def dir_for(duration: float) -> Path:
    return FIXTURES / f"{fmt_dur(duration)}_second_files"


def make_sine(duration: float) -> None:
    n = int(SAMPLE_RATE * duration)
    t = np.arange(n, dtype=np.float64) / SAMPLE_RATE
    samples = AMPLITUDE * np.sin(2 * np.pi * SINE_FREQ_HZ * t)
    name = f"sine_440hz_{fmt_dur(duration)}s"
    out_dir = dir_for(duration)
    wav_path = out_dir / f"{name}.wav"
    write_int16_wav(wav_path, samples)
    dump_stft_json(
        out_dir / f"{name}_stft.json",
        wav_path,
        extra={"amplitude": AMPLITUDE, "freq_hz": SINE_FREQ_HZ},
    )


def make_sweep(duration: float) -> None:
    # `duration` arg to create_continuous_sweep is per-direction; up + down = total.
    sweep = create_continuous_sweep(
        duration=duration / 2,
        sample_rate=SAMPLE_RATE,
        min_freq=SWEEP_MIN_HZ,
        max_freq=SWEEP_MAX_HZ,
        amplitude=AMPLITUDE,
        extend_duration_to_freq_at_zero=False,
    )
    name = f"sweep_{fmt_dur(duration)}s"
    out_dir = dir_for(duration)
    wav_path = out_dir / f"{name}.wav"
    write_int16_wav(wav_path, sweep)
    dump_stft_json(
        out_dir / f"{name}_stft.json",
        wav_path,
        extra={"amplitude": AMPLITUDE, "min_freq_hz": SWEEP_MIN_HZ, "max_freq_hz": SWEEP_MAX_HZ},
    )


def make_noise(duration: float) -> None:
    np.random.seed(NOISE_SEED)
    noise = create_white_noise(duration=duration, sample_rate=SAMPLE_RATE, amplitude=AMPLITUDE)
    name = f"noise_{fmt_dur(duration)}s"
    out_dir = dir_for(duration)
    wav_path = out_dir / f"{name}.wav"
    write_int16_wav(wav_path, noise)
    dump_stft_json(
        out_dir / f"{name}_stft.json",
        wav_path,
        extra={"amplitude": AMPLITUDE, "seed": NOISE_SEED},
    )


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate sine/sweep/noise WAVs and librosa STFT references at given durations."
    )
    parser.add_argument(
        "durations",
        nargs="+",
        type=float,
        help="One or more durations in seconds (e.g. 1 5 10).",
    )
    args = parser.parse_args()

    FIXTURES.mkdir(parents=True, exist_ok=True)
    for d in args.durations:
        print(f"[{fmt_dur(d)}s]")
        make_sine(d)
        make_sweep(d)
        make_noise(d)


if __name__ == "__main__":
    main()
