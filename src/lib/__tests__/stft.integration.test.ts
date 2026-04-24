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

// Integration tests: exercise `createWindows` + Hann + `fft` composed as a
// full STFT pipeline. Verify behavioral properties on signals with known
// spectral structure — no external reference implementation involved.

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
		const { samples } = loadWavMonoInt16(resolve(FIXTURE_DIR, 'sweep_1s.wav'));
		const frames = stft(samples);
		const peaks = frames.map((m) => argmax(m));
		const turnIdx = peaks.indexOf(Math.max(...peaks));

		// Strictly non-decreasing on the way up, non-increasing on the way down.
		for (let i = 1; i <= turnIdx; i++) {
			expect(peaks[i]).toBeGreaterThanOrEqual(peaks[i - 1]);
		}
		for (let i = turnIdx + 1; i < peaks.length; i++) {
			expect(peaks[i]).toBeLessThanOrEqual(peaks[i - 1]);
		}

		// Apex bin should be within ±2 of the bin corresponding to 2000 Hz.
		const apexBin = Math.round((2000 * N_FFT) / SAMPLE_RATE); // 93
		expect(Math.abs(peaks[turnIdx] - apexBin)).toBeLessThanOrEqual(2);
	});
});
