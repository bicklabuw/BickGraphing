# Tests

This directory contains the unit-test suite for the STFT signal-processing
pipeline (`src/lib/utils/fft.ts` + the windowing logic in
`src/lib/utils/audioProcessing.ts`), the Python scripts that generate the
test fixtures, and the research-stimulus generators they reuse.

The Vitest test files themselves live alongside the code they test, under
`src/lib/__tests__/`. This directory holds only the Python side and the
generated fixtures.

## Quick reference

```bash
# One-time fixture generation (or anytime you change test parameters)
python tests/generate_440hz.py
python tests/librosa_stft.py
python tests/generate_extra_fixtures.py

# Run the test suite (everyday command)
npm test
```

Current status: **9 tests across 3 files, ~1.2 s runtime.**

## Directory layout

```
tests/
├── README.md                       This file
├── CreateWavSounds.py              Research-stimulus generators (used by tests + the app)
├── generate_440hz.py               Generates the 440 Hz sine wav fixture
├── librosa_stft.py                 Runs librosa STFT on the 440 Hz wav → JSON reference
├── generate_extra_fixtures.py      Generates sweep + noise wavs and their JSON references
└── fixtures/
    ├── sine_440hz.wav              1 s, 440 Hz sine, amp 0.5, int16 mono
    ├── librosa_stft_440hz.json     librosa STFT, 6 reference frames
    ├── sweep_1s.wav                1 s up+down chirp, 50→2000→50 Hz, amp 0.5
    ├── sweep_1s_stft.json          librosa STFT, 9 reference frames
    ├── noise_1s.wav                1 s seeded white noise (seed=42), amp 0.5
    └── noise_1s_stft.json          librosa STFT, 6 reference frames
```

The Vitest test files (under `src/lib/__tests__/`):

```
src/lib/__tests__/
├── helpers.ts                      Shared utilities (Hann formula, STFT composition, WAV loader, comparator)
├── fft.unit.test.ts                3 unit tests on the Hann window
├── stft.integration.test.ts        3 integration tests on the full STFT pipeline
└── librosa.parity.test.ts          3 characterization tests vs librosa
```

## Test categories

### Unit tests — `fft.unit.test.ts`

Pure mathematical-property tests on the Hann window formula
`0.5 * (1 - cos(2πi/(N-1)))`, the same form used inline at
`audioProcessing.ts:178`. No I/O, no fixtures, no pipeline composition.

| Test | Asserts |
|---|---|
| Endpoints are zero | `w[0] === 0` exactly, `w[N-1] ≈ 0` to 10 decimal places |
| Peaks near 1 at center | Maximum value > 0.9999, even-N center samples close to 1 |
| Sums to ~N/2 | Within 0.1% relative tolerance |

### Integration tests — `stft.integration.test.ts`

Exercise the composed pipeline `createWindows` → Hann → `fft` on signals
with known spectral structure. No external reference involved.

| Test | Asserts |
|---|---|
| 440 Hz peak detection | Every frame's argmax is bin 20 = `round(440 · 2048 / 44100)` |
| Peak/noise-floor ratio | Peak magnitude > 100× the median off-peak bin |
| Sweep arc tracking | Peak bin rises monotonically then falls; apex within ±2 bins of 2000 Hz |

### Characterization tests — `librosa.parity.test.ts`

Bin-for-bin comparison against librosa across three signal classes,
tolerance = **1% of per-frame peak magnitude**.

| Test | Signal | Frames stored |
|---|---|---|
| Stationary single tone | 440 Hz sine | 6 |
| Non-stationary | 50→2000→50 Hz chirp | 9 (across the full arc) |
| Broadband stochastic | Seeded white noise (seed=42) | 6 |

## librosa parameters

The Python fixture generators are configured to match the JS pipeline
exactly. If you change any of these on one side, you must change the
other or parity tests will fail.

| Parameter | Value | Why |
|---|---|---|
| `n_fft` | 2048 | Matches `audioProcessing.ts` |
| `hop_length` | 1024 | Matches `audioProcessing.ts` (50% overlap) |
| `window` | `scipy.signal.windows.hann(N, sym=True)` | **Symmetric** Hann — matches the inline JS formula. librosa's *default* `'hann'` is periodic, which is a different window and would silently break parity. |
| `center` | `False` | No reflective padding. Frame starts align with `createWindows()` (which doesn't pad). |
| Sample rate | 44100 Hz | Matches the FFmpeg conversion in `audioProcessing.ts` |
| Bin count comparison | bins 0..N/2−1 | The JS `fft()` drops the Nyquist bin; librosa returns N/2+1 bins, so we skip its last bin during comparison |

## Reproducibility

- **Sine and sweep** signals are deterministic given their parameters; any platform should produce byte-identical wav files.
- **White noise** uses `np.random.seed(42)` in `generate_extra_fixtures.py:NOISE_SEED`. Removing the seed would break the noise parity test on regeneration.
- **int16 quantization**: all fixtures are written as 16-bit PCM, which introduces ~1/32768 ≈ 3 × 10⁻⁵ rounding noise. The JS WAV loader divides by 32768 to match `librosa.load`/`soundfile`'s convention so both sides see the same float values.
- **Float drift**: the 440 Hz parity test does **not** load the wav; it regenerates the sine in JS. The two paths diverge by the int16 quantization noise, well below the 1% tolerance.

## CreateWavSounds.py — stimuli vs fixtures

`CreateWavSounds.py` was originally written to produce **research stimuli**
— the audio that the app is designed to analyze. Two of its functions
(`create_continuous_sweep`, `create_white_noise`) are reused by
`generate_extra_fixtures.py` to build **test fixtures**.

The distinction:

- **Fixture** — frozen data that a test asserts against. Exists *because of* a test. Small, deterministic, version-controlled.
- **Stimulus** — audio generated to drive an experiment or the visualizer itself. Exists independent of tests. Often longer; may evolve with the research design.

`CreateWavSounds.py` is a *stimulus generator*; `generate_extra_fixtures.py`
borrows two of its primitives to build *fixtures*. The same function can
play either role depending on how it's called.

If you run `python tests/CreateWavSounds.py` directly, it generates
`sounds/path_freq_exp_v1.wav` (relative to the working directory) — that
file is a stimulus, not a fixture, and is unrelated to the unit tests.

## Extending the suite

### Adding a new parity test

1. In `generate_extra_fixtures.py` (or a new sibling script), produce a wav file under `tests/fixtures/` and dump a JSON reference using the same `librosa_stft_magnitudes` helper. Keep `n_fft`, `hop_length`, `window`, and `center` matching the existing fixtures.
2. In `src/lib/__tests__/librosa.parity.test.ts`, add a `describe`/`it` block that loads the wav with `loadWavMonoInt16()`, runs `stft()` from `helpers.ts`, and calls `compareToLibrosa()`.
3. Re-run the Python generator and `npm test` to verify.

### Adding a new unit test

For tests on the existing `fft()` and `createWindows()` exports (e.g.,
Parseval's theorem, impulse response, non-power-of-2 rejection), add to
`fft.unit.test.ts` or create a new `fft.unit.test.ts`-style file. These
should not depend on any fixture file.

### Tightening the tolerance

The current 1% of per-frame peak is generous — correct implementations
typically agree to ~10⁻⁴ or better since the only real difference is
int16 quantization. To tighten, edit the third argument to
`compareToLibrosa()` in `librosa.parity.test.ts` (default `0.01` →
e.g. `0.001`). Tightening will make the tests more sensitive to bugs
but also more likely to fail on minor numeric drift across platforms.
