# Test files

This directory holds the Vitest test suite for the audio pipeline. The
**Python side** of the test infrastructure (fixture generators, the
research-stimulus library, generated WAV/JSON fixtures) lives in
[`tests/`](../../../tests/README.md), which also contains the overview,
glossary, quick-start commands, and reproducibility notes. Read that
first if you haven't.

This README documents what each test file covers in detail.

## Contents

- [`helpers.ts`](#helpersts) — shared utilities, no tests of its own
- [Hann window tests — `fft.unit.test.ts`](#hann-window-tests--fftunittestts)
- [STFT pipeline tests — `stft.integration.test.ts`](#stft-pipeline-tests--stftintegrationtestts)
- [Librosa parity tests — `librosa.parity.test.ts`](#librosa-parity-tests--librosaparitytestts)
- [Waveform extraction — unit tests — `waveformData.unit.test.ts`](#waveform-extraction--unit-tests--waveformdataunittestts)
- [Waveform extraction — integration tests — `waveformData.integration.test.ts`](#waveform-extraction--integration-tests--waveformdataintegrationtestts)
- [WAV header tests — `wavHeader.unit.test.ts`](#wav-header-tests--wavheaderunittestts)
- [Adding new tests](#adding-new-tests)

## `helpers.ts`

Not a test file — a shared module imported by every other file in this
directory. Holds:

- Constants (`SAMPLE_RATE`, `N_FFT`, `HOP_LENGTH`, `FIXTURE_DIR`)
- The STFT pipeline composer (`stft`)
- Synthetic signal generators (`generateSine`)
- Node-side WAV loaders (`loadWavMono`, `loadWavMonoInt16`)
- The librosa-fixture comparator (`compareToLibrosa`)

Imports the production `fft` and `createWindows` from `../utils/fft` so
tests exercise the same FFT the live spectrogram uses.

## Hann window tests — `fft.unit.test.ts`

Pure mathematical-property tests on the Hann window formula
`0.5 * (1 - cos(2πi/(N-1)))`. The same formula is duplicated inline in
`spectrogram.svelte`, `stft.worker.ts`, and `audioProcessing.ts`;
keeping all four in lockstep is what makes librosa parity reliable.

**No I/O, no fixtures, no pipeline composition** — just the window
itself.

| Test                   | Asserts                                                  |
| ---------------------- | -------------------------------------------------------- |
| Endpoints are zero     | `w[0] === 0` exactly, `w[N−1] ≈ 0` to 10 decimal places  |
| Peaks near 1 at center | Maximum value > 0.9999, even-N center samples close to 1 |
| Sums to ~N/2           | Within 0.1% relative tolerance                           |

> This file does _not_ directly test the FFT itself — that's verified
> indirectly through `stft.integration.test.ts` and
> `librosa.parity.test.ts`. We chose not to add direct FFT tests
> because librosa parity already covers the math more rigorously than
> any unit test would.

## STFT pipeline tests — `stft.integration.test.ts`

Exercises the composed `framing → window → FFT` pipeline against
signals with known correct answers. No external reference like librosa —
these tests check the math against physics directly. See
[Librosa parity tests](#librosa-parity-tests--librosaparitytestts) for
the reference-comparison layer.

### Synthetic 440 Hz tone

| Test                     | Asserts                                                                 |
| ------------------------ | ----------------------------------------------------------------------- |
| 440 Hz peak detection    | Every frame's argmax is bin 20 = `round(440 · 2048 / 44100)`            |
| Peak / noise-floor ratio | Peak magnitude > 100× the median off-peak bin (sharp peak, not a smear) |

### Frequency sweep

| Test               | Asserts                                                                                |
| ------------------ | -------------------------------------------------------------------------------------- |
| Up-then-down chirp | Peak bin rises monotonically across frames, then falls; apex within ±2 bins of 2000 Hz |

Uses the real `1_second_files/sweep_1s.wav` fixture. Verifies that the
pipeline tracks pitch changes over time, not just steady frequencies.

### Near-Nyquist edge

| Test                  | Asserts                                         |
| --------------------- | ----------------------------------------------- |
| 21 kHz tone placement | Peak at bin `round(21000 · 2048 / 44100) = 975` |

Validates the upper end of the spectrum — the new top bin (Nyquist,
22050 Hz) opened up by extending the FFT output to N/2+1 bins.

### Empty / very-short input edge cases

| Test                                     | Asserts                                  |
| ---------------------------------------- | ---------------------------------------- |
| Empty input                              | Returns zero frames (no crash, no error) |
| Input shorter than `n_fft` (500 samples) | Returns zero frames                      |
| Input of exactly `n_fft` samples         | Returns exactly one frame                |

Locks in the contract for boundary inputs that real users might hit
(empty file, very short clip).

## Librosa parity tests — `librosa.parity.test.ts`

Bin-for-bin comparison against librosa across signal classes and
durations. Tolerance = **1% of per-frame peak magnitude** — generous
enough to forgive int16 quantization noise (~3 × 10⁻⁵) and float
order-of-operations drift, tight enough to catch real algorithmic
divergence.

For each test: load the signal (or regenerate it in JS), run our
`stft()`, then for each saved frame in the librosa fixture, compare
every bin within tolerance and assert the peak bin matches librosa's
peak bin exactly.

### Signal classes (1 second each)

| Test                   | Signal                       | Frames stored | Why this signal                                                           |
| ---------------------- | ---------------------------- | ------------- | ------------------------------------------------------------------------- |
| Stationary single tone | 440 Hz sine                  | 6             | Cleanest possible signal — single bin should dominate                     |
| Non-stationary         | 50→2000→50 Hz chirp          | 8             | Tests time-varying frequencies — catches errors invisible on steady tones |
| Broadband stochastic   | Seeded white noise (seed=42) | 8             | All bins active — strictest possible bin-by-bin comparison                |

### Long-form drift checks (sweep at longer durations)

| Test        | Duration | Frames per fixture | What it catches                                                           |
| ----------- | -------- | ------------------ | ------------------------------------------------------------------------- |
| Sweep, 10 s | 10 s     | 8                  | Frame-count drift over ~430 frames                                        |
| Sweep, 60 s | 60 s     | 8                  | Frame-count drift over ~2580 frames; hop-accumulator floating-point drift |

The 1-second tests pass quickly; the 60-second test is the heaviest in
the suite (~3.9 s) because the STFT computes ~2580 frames before
checking the 8 stored ones.

### How fixtures are referenced

The librosa-side reference values live in JSON files under
`tests/fixtures/{N}_second_files/`. Each JSON stores:

- The full magnitude vector for 6–8 evenly-spaced frames (length 1025 = N/2+1)
- The peak bin per stored frame
- The librosa parameters used (sample rate, n_fft, hop_length, window, center)

The JS pipeline must match all of these. If the JSONs need regeneration,
see [`tests/README.md`](../../../tests/README.md) (Quick start →
"Regenerate fixtures").

## Waveform extraction — unit tests — `waveformData.unit.test.ts`

Tests `extractWaveformData` (the function that prepares plot data for
the waveform component) against mocked AudioBuffers. The function only
reads `sampleRate`, `length`, and `getChannelData(0)`, so a tiny fake
buffer is enough — no Web Audio API needed in Node.

**Four test groups:**

### Output length contract

Verifies the 5000-point cap. Parametrized over 14 input sizes ranging
from 1 sample to 1,000,000 — including 5001, 7500, 9999 (which used to
silently break before `Math.ceil` was used for the stride calculation).

| Test                                                                                          | Asserts                                                    |
| --------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Caps output at 5000 points (10 sizes: 1, 100, 4999, 5000, 5001, 7500, 9999, 10000, 50000, 1M) | `waveform.length ≤ 5000`                                   |
| Returns every sample when input ≤ 5000 (4 sizes: 1, 100, 4999, 5000)                          | `waveform.length === totalSamples` (no decimation applied) |

### Edge cases

| Test                | Weird input                   | Asserts                                                            |
| ------------------- | ----------------------------- | ------------------------------------------------------------------ |
| Empty slice         | `start === end`               | Returns `[]`; `minAmp/maxAmp` are finite (not ±Infinity)           |
| Over-long range     | Request 100 s on a 1 s buffer | Clamps end to buffer length; doesn't crash                         |
| Zero-length buffer  | Empty audio                   | Returns `[]`; finite bounds                                        |
| Negative start time | `start = -0.5`                | All amplitudes finite (the clamp prevents `channelData[-N]` reads) |

### Decimation fidelity (known limitation)

| Test                         | Asserts                                                                       | Status                            |
| ---------------------------- | ----------------------------------------------------------------------------- | --------------------------------- |
| Sub-stride peak preservation | A spike at index 17 (between strides at index 0 and 40) appears in the output | **`it.fails`** — expected to fail |

The current implementation strides through samples, so spikes between
strides are silently dropped. Documented as a known limitation; if the
implementation changes to min/max-bucket decimation, this test will
unexpectedly pass and `.fails` should be removed.

### Time-range correctness

| Test                    | Asserts                                                                                            |
| ----------------------- | -------------------------------------------------------------------------------------------------- |
| `[start, end)` indexing | First timestamp ≥ start; last timestamp < end; first amplitude reads from `Math.floor(start × SR)` |

Uses a 440 Hz sine where neighboring samples differ noticeably, so
off-by-one errors in the index math fail loudly.

## Waveform extraction — integration tests — `waveformData.integration.test.ts`

Companion to the unit tests, feeding bytes from real WAV fixtures
through `loadWavMono` (a Node-side stand-in for the browser's
`AudioContext.decodeAudioData`, which isn't available in Node). Catches
anything that breaks at the boundary between WAV decoding and the
function under test.

### `sine_440hz.wav` — predictable fixture

A clean 1-second 440 Hz sine wave, amp 0.5. Every property of the
output is precisely predictable.

| Test                         | Asserts                                                      |
| ---------------------------- | ------------------------------------------------------------ |
| Output length cap holds      | `waveform.length ≤ 5000`                                     |
| Peak amplitudes near ±0.5    | `maxAmp > 0.49`, `minAmp < -0.49`                            |
| Mean amplitude ≈ 0           | A sine is zero-mean — catches sample-shift / endianness bugs |
| Time window respected        | First time ≥ 0, last time < 1                                |
| Timestamps strictly increase | No duplicates, no reversals                                  |
| All amplitudes finite        | No NaN/Infinity/undefined leaks                              |

The mean-near-zero check is the sneaky-good one: if endianness were
wrong (read low byte where high byte should be), you'd see plausible
numbers that aren't centered at zero. Most other assertions would still
pass; this one wouldn't.

### `tests/fixtures/test.wav` — realistic multi-signal fixture

A multi-million-sample composite from `CreateWavSounds.py` (scale notes,
sweeps, noise, varied volumes, all stitched together). The signal isn't
predictable enough for exact-value assertions, so the checks are
robustness-oriented.

| Test                         | Asserts                                                                    |
| ---------------------------- | -------------------------------------------------------------------------- |
| Output length cap holds      | `waveform.length ≤ 5000`                                                   |
| Both polarities present      | `maxAmp > 0` AND `minAmp < 0` (catches silent zero-fill on decode failure) |
| All amplitudes finite        | No NaN/Infinity leaks                                                      |
| Time window respected        | First time ≥ 0, last time ≤ duration                                       |
| Timestamps strictly increase | No reordering                                                              |

The "both polarities" check is more important than it sounds. Without
it, a buggy decode that returns all-zeros would pass every other
assertion (`length ≤ 5000`, finite, increasing timestamps).

## WAV header tests — `wavHeader.unit.test.ts`

Tests the lightweight WAV-header peek utility used by the file uploader
to determine duration before the full `decodeAudioData` call. Reads
only the first 64 KB of a file, walks the RIFF chunk list to find
`fmt ` and `data`, and returns `dataChunkSize / byteRate`.

| Test                                 | Asserts                                                                         |
| ------------------------------------ | ------------------------------------------------------------------------------- |
| `isLongDuration` threshold semantics | False at/below 3600 s (the threshold), true above, false for `null`/`undefined` |
| `peekWavDuration` on a real fixture  | A 1-second WAV is read as ~1.0 s (within 0.005 s tolerance)                     |
| `peekWavDuration` on non-WAV bytes   | Returns `null` (graceful fallback to the regular decode path)                   |

The threshold (3600 s = 1 hour) drives the "this might take a while"
warning shown to users uploading long files. Crossing it should change
behavior; staying below it should not.

## Adding new tests

### Adding a new STFT integration test

Add a `describe`/`it` block in `stft.integration.test.ts`. Use
`generateSine()` for synthetic signals or `loadWavMonoInt16()` for
fixture WAVs. No JSON reference needed — assertions are against the
math directly.

### Adding a new librosa parity test

1. Generate a fixture wav + JSON on the Python side using
   `make_fixtures.py` (or a sibling script). See
   [`tests/README.md`](../../../tests/README.md) → "Adding a new parity
   fixture" for the recipe.
2. In `librosa.parity.test.ts`, add a `describe`/`it` that loads the
   wav with `loadWavMonoInt16()`, runs `stft()` from `helpers.ts`, and
   calls `compareToLibrosa()`.
3. Re-run `npm test`.

### Adding a new waveform test

- Mocked-buffer tests go in `waveformData.unit.test.ts`. Use the
  `mockBuffer(lengthOrData, sampleRate)` helper at the top of the
  file.
- Real-WAV tests go in `waveformData.integration.test.ts`. Use
  `loadWavMono()` from `helpers.ts` plus the `asAudioBuffer` helper.

### Tightening parity tolerance

The default 1% of per-frame peak is generous — correct implementations
typically agree to ~10⁻⁴ since the only real difference is int16
quantization. To tighten, edit the third argument to
`compareToLibrosa()` in `helpers.ts` (default `0.01` → e.g. `0.001`).
Tighter tolerance catches more bugs but is also more sensitive to
platform-level numeric drift.
