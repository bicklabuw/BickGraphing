/**
 * @file Unit tests for extractWaveformData.
 *
 * Exercises `extractWaveformData` against a mocked AudioBuffer (the
 * function only reads `sampleRate`, `length`, and `getChannelData(0)`,
 * so a tiny fake suffices — no Web Audio API needed in Node). Covers
 * the 5000-point output cap, edge cases (empty slice, over-long range,
 * zero-length buffer, negative start), and time-range / index
 * correctness. Also documents the known striding-decimation
 * limitation via an `it.fails` test.
 *
 * @author K. Seow <kseow@wisc.edu>
 * @created 2026-05-03
 * @version 0.2.0
 * @license MIT
 */

import { describe, it, expect } from 'vitest';
import { extractWaveformData } from '../utils/waveformData';

const MAX_POINTS = 5000;
const SAMPLE_RATE = 44100;

// Fake AudioBuffer — extractWaveformData only reads sampleRate, length, getChannelData(0).
function mockBuffer(lengthOrData: number | Float32Array, sampleRate = SAMPLE_RATE): AudioBuffer {
	const data = typeof lengthOrData === 'number' ? new Float32Array(lengthOrData) : lengthOrData;
	return {
		sampleRate,
		length: data.length,
		getChannelData: () => data
	} as unknown as AudioBuffer;
}

describe('extractWaveformData — output length contract', () => {
	// MAX_POINTS+1..2*MAX_POINTS-1 was the silently-broken range (Math.floor → step=1).
	it.each([1, 100, 4999, MAX_POINTS, 5001, 7500, 9999, 10000, 50000, 1_000_000])(
		'caps output at MAX_POINTS for an input of %i samples',
		(totalSamples) => {
			const buf = mockBuffer(totalSamples);
			const end = totalSamples / SAMPLE_RATE;
			const { waveform } = extractWaveformData(buf, 0, end);
			expect(waveform.length).toBeLessThanOrEqual(MAX_POINTS);
		}
	);

	it.each([1, 100, 4999, MAX_POINTS])(
		'returns every sample (no decimation) when input has %i samples',
		(totalSamples) => {
			const buf = mockBuffer(totalSamples);
			const end = totalSamples / SAMPLE_RATE;
			const { waveform } = extractWaveformData(buf, 0, end);
			expect(waveform.length).toBe(totalSamples);
		}
	);
});

describe('extractWaveformData — edge cases', () => {
	// Empty slice: minAmp/maxAmp must be finite (±Infinity would corrupt graph.svelte:275-278).
	it('returns finite bounds when start equals end (no samples in slice)', () => {
		const { waveform, minAmp, maxAmp } = extractWaveformData(mockBuffer(SAMPLE_RATE), 0.5, 0.5);
		expect(waveform).toEqual([]);
		expect(Number.isFinite(minAmp)).toBe(true);
		expect(Number.isFinite(maxAmp)).toBe(true);
	});

	// Over-long range must clamp, not crash.
	it('clamps end > duration to the buffer length', () => {
		const buf = mockBuffer(SAMPLE_RATE); // 1 second
		const { waveform } = extractWaveformData(buf, 0, 100); // request 100s
		expect(waveform.length).toBeGreaterThan(0);
		expect(waveform[waveform.length - 1].time).toBeLessThanOrEqual(1.0);
	});

	// Zero-length buffer must not crash.
	it('handles a zero-length buffer without crashing', () => {
		const { waveform, minAmp, maxAmp } = extractWaveformData(mockBuffer(0), 0, 0);
		expect(waveform).toEqual([]);
		expect(Number.isFinite(minAmp)).toBe(true);
		expect(Number.isFinite(maxAmp)).toBe(true);
	});

	// Negative start would yield channelData[-N] = undefined; output must stay finite.
	it('produces only finite amplitudes for a negative start time', () => {
		const { waveform } = extractWaveformData(mockBuffer(SAMPLE_RATE), -0.5, 1);
		expect(waveform.every((p) => Number.isFinite(p.amplitude))).toBe(true);
	});
});

// Known limitation: the current implementation decimates by simple striding
// (every Nth sample), so a peak that falls between strides is silently dropped
// from the displayed waveform. This block documents the limitation. If the
// implementation moves to min/max-per-bucket decimation, this test will start
// unexpectedly passing — at which point `.fails` should be removed and the
// JORS paper note updated.
describe('extractWaveformData — decimation fidelity (known limitation)', () => {
	it.fails('preserves a sub-stride peak (currently dropped by striding)', () => {
		// 200,000 samples → step = ceil(200000 / 5000) = 40.
		// Index 17 sits between strides 0 and 40, so the loop never reads it.
		const data = new Float32Array(200_000);
		const spikeIndex = 17;
		const spikeValue = 1.0;
		data[spikeIndex] = spikeValue;

		const buf = mockBuffer(data);
		const { maxAmp } = extractWaveformData(buf, 0, data.length / SAMPLE_RATE);

		// Expected to fail: striding skips index 17, so maxAmp is 0, not 1.0.
		expect(maxAmp).toBe(spikeValue);
	});
});

// [start, end] → indices: (a) starts at right sample, (b) stops strictly before end,
// (c) reads amplitude at the right index. [0.25, 0.75] avoids float drift at 44100 Hz.
describe('extractWaveformData — time-range correctness', () => {
	it('emits times within [start, end) and reads amplitudes from the right indices', () => {
		// 1s sine — neighboring samples differ, so an off-by-one would fail (c).
		const data = new Float32Array(SAMPLE_RATE);
		for (let n = 0; n < SAMPLE_RATE; n++) {
			data[n] = 0.5 * Math.sin((2 * Math.PI * 440 * n) / SAMPLE_RATE);
		}
		const buf = mockBuffer(data);

		const { waveform } = extractWaveformData(buf, 0.25, 0.75);

		// (a) First timestamp at start, within one sample of slop.
		expect(waveform[0].time).toBeGreaterThanOrEqual(0.25);
		expect(waveform[0].time).toBeLessThan(0.25 + 1 / SAMPLE_RATE);

		// (b) Last timestamp < end. Catches the loop condition flipping to `<=`.
		expect(waveform.at(-1)!.time).toBeLessThan(0.75);

		// (c) Amplitude matches data[startSample] — tests indexing, not sine math.
		const startSample = Math.floor(0.25 * SAMPLE_RATE);
		expect(waveform[0].amplitude).toBe(data[startSample]);
	});
});
