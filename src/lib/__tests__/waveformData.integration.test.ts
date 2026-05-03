import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { extractWaveformData } from '../utils/waveformData';
import { loadWavMono } from './helpers';

// End-to-end check on the WAV → AudioBuffer → extractWaveformData path.
// The unit tests pin behavior with synthetic inputs; this file exercises the
// same function with real PCM bytes off disk to catch any regression that
// only shows up on real-world data (sample-rate quirks, large files, etc).
//
// Two cases:
//   - sine_440hz.wav (1 s, PCM16, predictable) → sharp assertions.
//   - tests/test.wav (~7 min, PCM24 from CreateWavSounds.py) → contract-only.
//
// Note: the website normally decodes WAVs via the browser's
// AudioContext.decodeAudioData (graph.svelte:128). That API isn't available
// in the Node test env, so loadWavMono substitutes for it here.

const MAX_POINTS = 5000;
const FIXTURE_DIR = resolve(__dirname, '../../../tests/fixtures');
const TESTS_DIR = resolve(__dirname, '../../../tests');

// Wraps the loaded samples into the AudioBuffer-shaped object that
// extractWaveformData consumes. Same trick as mockBuffer in the unit tests,
// but populated with real samples.
function asAudioBuffer(sampleRate: number, samples: Float32Array): AudioBuffer {
	return {
		sampleRate,
		length: samples.length,
		getChannelData: () => samples
	} as unknown as AudioBuffer;
}

describe('extractWaveformData — sine_440hz.wav (small predictable fixture)', () => {
	it('extracts the expected shape from a 1-second 440 Hz sine', () => {
		const { sampleRate, samples } = loadWavMono(resolve(FIXTURE_DIR, 'sine_440hz.wav'));
		const buf = asAudioBuffer(sampleRate, samples);

		const { waveform, minAmp, maxAmp } = extractWaveformData(buf, 0, 1);

		// Decimation cap holds.
		expect(waveform.length).toBeLessThanOrEqual(MAX_POINTS);

		// The fixture is generated at amplitude 0.5 (see tests/generate_440hz.py
		// — half-amplitude leaves int16 headroom), so peaks should be very close
		// to ±0.5. Tolerance covers decimation possibly missing the exact peak.
		expect(maxAmp).toBeGreaterThan(0.49);
		expect(minAmp).toBeLessThan(-0.49);

		// Sine is symmetric around zero — mean of sampled amplitudes should be ~0.
		// Catches sample shifting / endianness bugs that would show "valid-looking"
		// values that are nonetheless wrong.
		const mean = waveform.reduce((s, p) => s + p.amplitude, 0) / waveform.length;
		expect(Math.abs(mean)).toBeLessThan(0.05);

		// Time window matches what we asked for.
		expect(waveform[0].time).toBeGreaterThanOrEqual(0);
		expect(waveform.at(-1)!.time).toBeLessThan(1);

		// Timestamps strictly increase — no duplicates, no reversals.
		for (let i = 1; i < waveform.length; i++) {
			expect(waveform[i].time).toBeGreaterThan(waveform[i - 1].time);
		}

		// No NaN / Infinity / undefined leaks.
		expect(waveform.every((p) => Number.isFinite(p.amplitude))).toBe(true);
	});
});

describe('extractWaveformData — tests/test.wav (full CreateWavSounds.py fixture)', () => {
	it('handles the realistic multi-signal file without breaking its contract', () => {
		const { sampleRate, samples } = loadWavMono(resolve(TESTS_DIR, 'test.wav'));
		const buf = asAudioBuffer(sampleRate, samples);
		const duration = samples.length / sampleRate;

		const { waveform, minAmp, maxAmp } = extractWaveformData(buf, 0, duration);

		// The reason this test exists: even on a multi-million-sample input,
		// output must stay under the rendering budget.
		expect(waveform.length).toBeLessThanOrEqual(MAX_POINTS);

		// Both polarities present — confirms something audible was decoded,
		// not all zeros from a silent decode failure.
		expect(maxAmp).toBeGreaterThan(0);
		expect(minAmp).toBeLessThan(0);

		// All values finite.
		expect(waveform.every((p) => Number.isFinite(p.amplitude))).toBe(true);

		// Time window respected.
		expect(waveform[0].time).toBeGreaterThanOrEqual(0);
		expect(waveform.at(-1)!.time).toBeLessThanOrEqual(duration);

		// Timestamps strictly increase.
		for (let i = 1; i < waveform.length; i++) {
			expect(waveform[i].time).toBeGreaterThan(waveform[i - 1].time);
		}
	});
});
