# Tests

This directory holds the **Python side** of the test infrastructure
(fixture generators and the research-stimulus library) plus the generated
WAV/JSON fixture files. The actual Vitest test files live under
`src/lib/__tests__/`, alongside the code they exercise.

The suite covers three pieces of the audio pipeline:

- **STFT pipeline** — turns audio into a spectrogram (a frequency-vs-time
  picture). Lives in `src/lib/utils/fft.ts` plus the framing/windowing
  loops inside `spectrogram.svelte` and `stft.worker.ts`.
- **Waveform extraction** — turns audio into the data points plotted on
  the wavy-line graph. Lives in `src/lib/utils/waveformData.ts`.
- **WAV header peek** — reads only a WAV file's header (no full decode)
  to estimate duration before deciding whether to warn the user about a
  long file. Lives in `src/lib/utils/wavHeader.ts`.

## Glossary

Terms used throughout this README:

| Term | Meaning |
| --- | --- |
| **STFT** | Short-Time Fourier Transform — the algorithm behind every spectrogram. |
| **FFT** | Fast Fourier Transform — the math kernel inside an STFT. Turns a chunk of audio samples into a list of frequency magnitudes. |
| **Hann window** | A bell-shaped curve we multiply each audio chunk by before running the FFT, to avoid edge artifacts. |
| **Bin** | One cell of the FFT output. Bin `k` corresponds to frequency `k × sample_rate / N`. |
| **Frame** | One chunk of audio (typically 2048 samples = ~46 ms at 44.1 kHz). |
| **librosa** | Python's gold-standard audio-analysis library. We compare our STFT output against librosa's to verify correctness. |
| **Fixture** | A frozen audio file or JSON reference checked into the repo, used to make tests reproducible. |

## Quick start

**Prerequisites:**

- **Node.js 20.x and npm** — required to run the test suite.
- **Python 3.8+ with pip** — required only to regenerate fixtures. Install Python dependencies with:
  ```bash
  pip install -r tests/requirements.txt
  ```

**Run the tests:**

```bash
npm test
```

That's all you need for normal development — fixtures are committed (some via Git LFS) so no regeneration is required.

**Regenerate fixtures** (only when you change test parameters or fixture-generation logic):

```bash
python tests/librosa_stft.py            # regenerates the root-level sine fixture
python tests/make_fixtures.py 1 10 60   # regenerates the {1s, 10s, 60s} sets
```

Current status: **40 tests across 6 files (39 passed + 1 expected fail), ~7 s runtime.**

## Directory layout

**Python side and fixtures** (this directory):

```
tests/
├── README.md                       This file
├── CreateWavSounds.py              Research-stimulus generators (used by tests + the app)
├── fixture_helpers.py              Shared WAV I/O + librosa STFT JSON utilities
├── librosa_stft.py                 Generates the root-level 440 Hz sine + JSON reference
├── make_fixtures.py                Parameterized sine/sweep/noise generator at any duration
├── requirements.txt                Python dependencies (librosa, scipy, numpy)
└── fixtures/
    ├── sine_440hz.wav              1 s, 440 Hz sine, amp 0.5, int16 mono
    ├── librosa_stft_440hz.json     librosa STFT, 6 reference frames
    ├── test.wav                    Multi-signal CreateWavSounds.py composite (used by integration tests)
    ├── 1_second_files/             {sine, sweep, noise} at 1 s + their _stft.json refs
    ├── 10_second_files/            same set at 10 s
    ├── 60_second_files/            same set at 60 s
    ├── 600_second_files/           same set at 600 s (10 min)
    ├── 1800_second_files/          same set at 1800 s (30 min)
    ├── 3600_second_files/          same set at 3600 s (1 hr)
    ├── 7200_second_files/          same set at 7200 s (2 hr)
    └── misc_wav_files/             WAVs from CreateWavSounds.py methods not used by parity tests:
                                    siren, scale up-and-down, varied volume, three-C varied
```

**Vitest test files** (live under `src/lib/__tests__/`):

```
src/lib/__tests__/
├── helpers.ts                       Shared utilities (Hann formula, STFT composer, WAV loaders, comparator)
├── fft.unit.test.ts                 3 tests on the Hann window math
├── stft.integration.test.ts         7 tests on the full STFT pipeline
├── librosa.parity.test.ts           5 tests comparing our STFT to librosa
├── waveformData.unit.test.ts        20 tests on extractWaveformData (mocked AudioBuffer)
├── waveformData.integration.test.ts 2 tests on extractWaveformData (real WAV bytes)
└── wavHeader.unit.test.ts           3 tests on the WAV header peek utility
```

All WAVs and fixture JSONs are tracked via Git LFS (per `.gitattributes`). After cloning, run `git lfs pull` to fetch the actual file contents.

## What we're testing

The audio pipeline has three independent paths, each tested at multiple
levels:

**1. The STFT pipeline** — turns audio into the spectrogram. Tested in
three layers:

- **Math layer** (`fft.unit.test.ts`) — the Hann window formula on its
  own, in isolation.
- **Pipeline layer** (`stft.integration.test.ts`) — the composed
  `framing → window → FFT` pipeline against synthetic signals with
  known correct answers (sine, sweep, edge cases).
- **Reference layer** (`librosa.parity.test.ts`) — the same pipeline,
  but the answers are checked bin-by-bin against librosa.

**2. Waveform extraction** — turns audio into the wavy-line plot data.
Tested in two layers:

- **Mocked layer** (`waveformData.unit.test.ts`) — function logic
  against a tiny fake AudioBuffer (no Web Audio API needed).
- **Real-bytes layer** (`waveformData.integration.test.ts`) — same
  function fed bytes from real WAV fixtures on disk.

**3. WAV header peek** (`wavHeader.unit.test.ts`) — the small utility
that reads a WAV's duration without decoding the whole file. Single
layer, three tests.

The next section walks through each test file in detail.

## Test files

Each test file is documented in detail in
[`src/lib/__tests__/README.md`](../src/lib/__tests__/README.md). That
README walks through every test in every file with the assertions and
the rationale.

At a glance:

| File | Tests | Coverage |
| --- | ---: | --- |
| `fft.unit.test.ts` | 3 | Hann window math (endpoints, peak, sum) |
| `stft.integration.test.ts` | 7 | STFT pipeline against synthetic signals + edge cases |
| `librosa.parity.test.ts` | 5 | Bin-by-bin parity vs librosa across signal classes + durations |
| `waveformData.unit.test.ts` | 20 | `extractWaveformData` against mocked AudioBuffers |
| `waveformData.integration.test.ts` | 2 | `extractWaveformData` against real WAV bytes |
| `wavHeader.unit.test.ts` | 3 | `peekWavDuration` + `isLongDuration` semantics |

## librosa parameters

The Python fixture generators are configured to match the JS pipeline
exactly. If you change any of these on one side, you must change the
other or parity tests will fail.

| Parameter            | Value                                    | Why                                                                                                                                                        |
| -------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `n_fft`              | 2048                                     | Matches the production STFT loops in `spectrogram.svelte` and `stft.worker.ts`                                                                             |
| `hop_length`         | 1024                                     | 50% overlap, matches production                                                                                                                            |
| `window`             | `scipy.signal.windows.hann(N, sym=True)` | **Symmetric** Hann — matches the inline JS formula. librosa's _default_ `'hann'` is periodic, which is a different window and would silently break parity. |
| `center`             | `False`                                  | No reflective padding. Frame starts align with the production framing loops.                                                                               |
| Sample rate          | 44100 Hz                                 | Matches the FFmpeg conversion in `audioProcessing.ts`                                                                                                      |
| Bin count comparison | bins 0..N/2 (inclusive)                  | Both JS `fft()` and librosa now return N/2+1 bins; the comparison covers the full magnitude vector including Nyquist.                                      |

## Reproducibility

- **Sine and sweep** signals are deterministic given their parameters; any platform should produce byte-identical wav files.
- **White noise** uses `np.random.seed(42)` in `make_fixtures.py:NOISE_SEED`. Removing the seed would break the noise parity test on regeneration.
- **int16 quantization**: all fixtures are written as 16-bit PCM, which introduces ~1/32768 ≈ 3 × 10⁻⁵ rounding noise. The JS WAV loader divides by 32768 to match `librosa.load`/`soundfile`'s convention so both sides see the same float values.
- **Float drift**: the 440 Hz parity test does **not** load the wav; it regenerates the sine in JS. The two paths diverge by the int16 quantization noise, well below the 1% tolerance.

## CreateWavSounds.py — stimuli vs fixtures

`CreateWavSounds.py` was originally written to produce **research
stimuli** — the audio that the app is designed to analyze. Several of
its primitives are reused for test fixtures:

- **Used by `make_fixtures.py` (parity fixtures):** `create_continuous_sweep`, `create_white_noise`
- **Used in `fixtures/misc_wav_files/`:** `create_siren`, `create_scale_up_and_down`, `create_varied_volume`, `create_three_c_varied_volumes`

The distinction:

- **Fixture** — frozen data that a test asserts against. Exists _because of_ a test. Small, deterministic, version-controlled.
- **Stimulus** — audio generated to drive an experiment or the visualizer itself. Exists independent of tests. Often longer; may evolve with the research design.

`CreateWavSounds.py` is itself a _stimulus generator_; `make_fixtures.py`
and the inline `misc_wav_files/` generation borrow some of its
primitives to build _fixtures_. The same function can play either role
depending on how it's called.

If you run `python tests/CreateWavSounds.py` directly, it generates
`sounds/path_freq_exp_v1.wav` (relative to the working directory) — that
file is a stimulus, not a fixture, and is unrelated to the unit tests.

## Adding a new parity fixture

This section covers the **Python side**. For writing the corresponding
JS test, see
[`src/lib/__tests__/README.md`](../src/lib/__tests__/README.md) →
"Adding new tests".

1. Run `python tests/make_fixtures.py <duration_in_seconds>` to
   generate a `{N}_second_files/` directory with sine, sweep, and noise
   WAVs plus their `_stft.json` librosa references. The script writes
   into `tests/fixtures/{N}_second_files/` automatically.
2. (Or write a sibling script that calls `dump_stft_json` from
   `fixture_helpers.py` to produce a custom WAV + JSON pair.)
3. Either way, keep `n_fft`, `hop_length`, `window`, and `center`
   matching the existing fixtures (see the
   [librosa parameters](#librosa-parameters) table).
4. The new files will be auto-tracked by Git LFS (per
   `.gitattributes`). Run `git add` + `git lfs status` to verify.
5. Add the corresponding JS parity test in `librosa.parity.test.ts`,
   then re-run `npm test`.

## Troubleshooting

**Parity tests fail after regenerating fixtures.** Verify that the
librosa parameters in the Python scripts match the JS pipeline
parameters listed in the [librosa parameters](#librosa-parameters)
table above. The most common culprits are `window` (must be symmetric
Hann, not librosa's default periodic) and `center` (must be `False`).

**Noise parity test fails with "expected `<some bin>` to be `1024`"
after regenerating with an old `fixture_helpers.py`.** The
`peak_bin_per_frame` computation must slice over the full magnitude
vector (`mags[:, i]`), not exclude Nyquist (`mags[:-1, i]`). The JS
side now returns N/2+1 bins, so Python must agree.

**`npm run test:fixtures` errors with "file not found".** The script
expects `tests/make_fixtures.py` and `tests/fixture_helpers.py` to be
present. If you're on a fresh checkout, run `git lfs pull` to fetch
all binary fixtures.
