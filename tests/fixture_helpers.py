from __future__ import annotations

import json
from pathlib import Path

import librosa
import numpy as np
from scipy.io.wavfile import write as wav_write
from scipy.signal.windows import hann

SAMPLE_RATE = 44100
N_FFT = 2048
HOP_LENGTH = 1024


def write_int16_wav(path: Path, samples: np.ndarray, sample_rate: int = SAMPLE_RATE) -> None:
    pcm = np.int16(np.clip(samples, -1.0, 1.0) * 32767)
    path.parent.mkdir(parents=True, exist_ok=True)
    wav_write(path, sample_rate, pcm)
    print(f"  wrote {path.name} ({samples.shape[0]} samples)")


def stft_mags(samples: np.ndarray, n_fft: int = N_FFT, hop_length: int = HOP_LENGTH) -> np.ndarray:
    # Symmetric Hann to match audioProcessing.ts:178; center=False so frame
    # starts align with createWindows() in fft.ts.
    window = hann(n_fft, sym=True).astype(np.float64)
    spec = librosa.stft(
        samples.astype(np.float64),
        n_fft=n_fft,
        hop_length=hop_length,
        window=window,
        center=False,
    )
    return np.abs(spec)


def dump_stft_json(
    out_path: Path,
    wav_path: Path,
    frames_to_store: list[int] | None = None,
    n_auto_frames: int = 8,
    extra: dict | None = None,
) -> None:
    """Compute librosa STFT for `wav_path` and write a JSON reference.

    If `frames_to_store` is given, only those frame indices are dumped (filtered
    to in-range). Otherwise, `n_auto_frames` evenly-spaced frames are picked.
    Any keys in `extra` are merged into the payload after the standard fields.
    """
    samples, sr = librosa.load(wav_path, sr=None, mono=True)
    mags = stft_mags(samples)
    n_bins, n_frames = mags.shape

    if frames_to_store is not None:
        frames = [int(i) for i in frames_to_store if i < n_frames]
    elif n_frames <= n_auto_frames:
        frames = list(range(n_frames))
    else:
        frames = [int(i) for i in np.linspace(0, n_frames - 1, n_auto_frames, dtype=int)]

    payload = {
        "sample_rate": int(sr),
        "n_fft": N_FFT,
        "hop_length": HOP_LENGTH,
        "window": "hann_symmetric",
        "center": False,
        "n_frames_total": int(n_frames),
        "n_bins": int(n_bins),
        "frame_indices": frames,
        # Round to 8 sig figs to keep the JSON readable; well under 1% tol.
        "magnitudes": [
            [float(f"{mags[b, i]:.8g}") for b in range(n_bins)] for i in frames
        ],
        # JS returns N/2+1 bins (Nyquist included), so peak_bin_per_frame
        # ranges over the full magnitude vector to match.
        "peak_bin_per_frame": [int(np.argmax(mags[:, i])) for i in frames],
    }
    if extra:
        payload.update(extra)

    out_path.write_text(json.dumps(payload, indent=2))
    print(f"  wrote {out_path.name}  peak bins={payload['peak_bin_per_frame']}")
