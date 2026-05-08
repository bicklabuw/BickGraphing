/**
 * @file STFT pipeline integration tests.
 *
 * Self-contained sanity checks that don't depend on an external
 * reference like librosa. Verifies peak placement on a stationary
 * 440 Hz tone, peak-vs-floor SNR ratio, frequency tracking on a
 * non-stationary sweep, near-Nyquist tone placement (validates the
 * N/2+1 magnitude extension), and graceful behavior on empty /
 * very-short input.
 *
 * Complements `librosa.parity.test.ts`: parity catches drift vs the
 * gold standard, integration catches outright pipeline bugs even when
 * drift is uniform.
 *
 * @author K. Seow <kseow@wisc.edu>
 * @created 2026-04-23
 * @version 0.2.0
 * @license MIT
 */

import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';

import {
	stft,
	generateSine,
	argmax,
	loadWavMonoInt16,
	SAMPLE_RATE,
	N_FFT,
	FIXTURE_DIR
} from './helpers';

const FREQ_HZ = 440;

describe('STFT on a synthetic 440 Hz tone', () => {
	it('places the peak at bin round(f * N / fs) = 20 for every frame', () => {
		const samples = generateSine(FREQ_HZ, 1.0, SAMPLE_RATE);
		const frames = stft(samples);
		expect(frames.length).toBeGreaterThan(0);

		const expectedBin = Math.round((FREQ_HZ * N_FFT) / SAMPLE_RATE); // 20
		for (const mags of frames) {
			expect(argmax(mags)).toBe(expectedBin);
		}
	});

	it('peak magnitude dominates the off-peak noise floor by >100x', () => {
		const samples = generateSine(FREQ_HZ, 1.0, SAMPLE_RATE);
		const mags = stft(samples)[0];
		const peak = Math.max(...mags);
		const peakBin = argmax(mags);
		// Exclude the main lobe (±5 bins) when computing the off-peak baseline.
		const offPeak = Array.from(mags).filter((_, i) => Math.abs(i - peakBin) > 5);
		offPeak.sort((a, b) => a - b);
		const median = offPeak[Math.floor(offPeak.length / 2)];
		expect(peak / Math.max(median, 1e-12)).toBeGreaterThan(100);
	});
});

describe('STFT on a frequency sweep (non-stationary)', () => {
	it('peak frequency rises then falls (up-then-down chirp)', () => {
		const { samples } = loadWavMonoInt16(resolve(FIXTURE_DIR, '1_second_files', 'sweep_1s.wav'));
		const frames = stft(samples);
		const peaks = frames.map((m) => argmax(m));
		const turnIdx = peaks.indexOf(Math.max(...peaks));

		// Non-decreasing up, non-increasing down.
		for (let i = 1; i <= turnIdx; i++) {
			expect(peaks[i]).toBeGreaterThanOrEqual(peaks[i - 1]);
		}
		for (let i = turnIdx + 1; i < peaks.length; i++) {
			expect(peaks[i]).toBeLessThanOrEqual(peaks[i - 1]);
		}

		// Apex bin within ±2 of the 2000 Hz bin.
		const apexBin = Math.round((2000 * N_FFT) / SAMPLE_RATE); // 93
		expect(Math.abs(peaks[turnIdx] - apexBin)).toBeLessThanOrEqual(2);
	});
});

describe('STFT edge cases — empty and very-short input', () => {
	it('returns zero frames for empty input', () => {
		const frames = stft(new Float32Array(0));
		expect(frames).toEqual([]);
	});

	it('returns zero frames when input is shorter than one window (< n_fft samples)', () => {
		// 500 samples at 44.1 kHz is ~11 ms — well under the 2048-sample window.
		const frames = stft(new Float32Array(500));
		expect(frames).toEqual([]);
	});

	it('returns exactly one frame for input of exactly n_fft samples', () => {
		// Exactly 2048 samples → one window fits, no room for a second hop.
		const frames = stft(new Float32Array(N_FFT));
		expect(frames).toHaveLength(1);
	});
});

describe('STFT on a near-Nyquist tone (high-frequency edge)', () => {
	it('places the peak at the expected high-end bin for a 21 kHz tone', () => {
		// 21000 Hz is well into the upper region opened up by the N/2+1 extension
		// (Nyquist = 22050 Hz at sample_rate 44100). Locks in that the top end of
		// the spectrum is correctly addressed.
		const FREQ_HZ = 21000;
		const samples = generateSine(FREQ_HZ, 1.0, SAMPLE_RATE);
		const frames = stft(samples);
		expect(frames.length).toBeGreaterThan(0);

		const expectedBin = Math.round((FREQ_HZ * N_FFT) / SAMPLE_RATE); // 975
		for (const mags of frames) {
			expect(argmax(mags)).toBe(expectedBin);
		}
	});
});
