import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';

import {
	stft,
	generateSine,
	loadWavMonoInt16,
	loadFixture,
	compareToLibrosa,
	StftFixture,
	SAMPLE_RATE,
	N_FFT,
	HOP_LENGTH,
	FIXTURE_DIR
} from './helpers';

// Characterization tests: bin-for-bin agreement with librosa's STFT on three
// signal classes that span what the app actually processes.
//
//   * 440 Hz sine    stationary, single tone
//   * frequency sweep  non-stationary, time-varying instantaneous frequency
//   * white noise    broadband, stochastic
//
// Tolerance is 1% of per-frame peak magnitude.

describe('librosa parity — 440 Hz sine (stationary)', () => {
	it('matches librosa magnitudes within 1% of per-frame peak', () => {
		const fixture = loadFixture<StftFixture & { frequency_hz: number; amplitude: number }>(
			'librosa_stft_440hz.json'
		);
		expect(fixture.sample_rate).toBe(SAMPLE_RATE);
		expect(fixture.n_fft).toBe(N_FFT);
		expect(fixture.hop_length).toBe(HOP_LENGTH);

		// Quantization noise from the int16 wav is ~1/32768 — well below 1%.
		const samples = generateSine(
			fixture.frequency_hz,
			1.0,
			fixture.sample_rate,
			fixture.amplitude
		);
		compareToLibrosa(stft(samples), fixture);
	});
});

describe('librosa parity — frequency sweep (non-stationary)', () => {
	it('matches librosa magnitudes within 1% of per-frame peak', () => {
		const fixture = loadFixture<StftFixture & { min_freq_hz: number; max_freq_hz: number }>(
			'sweep_1s_stft.json'
		);
		expect(fixture.sample_rate).toBe(SAMPLE_RATE);
		const { samples } = loadWavMonoInt16(resolve(FIXTURE_DIR, 'sweep_1s.wav'));
		compareToLibrosa(stft(samples), fixture);
	});
});

describe('librosa parity — white noise (broadband, stochastic)', () => {
	it('matches librosa magnitudes within 1% of per-frame peak', () => {
		const fixture = loadFixture<StftFixture & { seed: number }>('noise_1s_stft.json');
		expect(fixture.sample_rate).toBe(SAMPLE_RATE);
		const { samples } = loadWavMonoInt16(resolve(FIXTURE_DIR, 'noise_1s.wav'));
		compareToLibrosa(stft(samples), fixture);
	});
});
