import { describe, it, expect } from 'vitest';
import { extractWaveformData } from '../utils/waveformData';

// Pure unit test on the output-length contract of `extractWaveformData`. No
// I/O, no fixtures — just verifies that the decimation step keeps the rendered
// waveform bounded across input sizes the user might realistically supply.
//
// Why this matters: the function exists to throw away samples so the SVG
// `<path>` stays cheap to draw. The `maxPoints = 5000` cap in waveformData.ts
// is the performance budget. If a future change quietly raises that cap or
// breaks the striding logic (as `Math.floor` did before being replaced with
// `Math.ceil`), the rendered waveform could balloon to millions of points and
// freeze the browser.

const MAX_POINTS = 5000;
const SAMPLE_RATE = 44100;

// `extractWaveformData` only reads `sampleRate`, `length`, and
// `getChannelData(0)`, so a 6-line fake is enough. Pass a length for a
// zero-filled buffer, or a Float32Array for known values at known indices.
function mockBuffer(lengthOrData: number | Float32Array, sampleRate = SAMPLE_RATE): AudioBuffer {
	const data = typeof lengthOrData === 'number' ? new Float32Array(lengthOrData) : lengthOrData;
	return {
		sampleRate,
		length: data.length,
		getChannelData: () => data
	} as unknown as AudioBuffer;
}

describe('extractWaveformData — output length contract', () => {
	// Inputs span the boundaries that previously exposed an off-by-one in the
	// striding formula:
	//   * <= MAX_POINTS: no decimation expected (output equals input)
	//   * MAX_POINTS+1 .. 2*MAX_POINTS-1: the formerly-buggy range (Math.floor
	//     produced step=1 here, so the cap was silently violated)
	//   * >= 2*MAX_POINTS: decimation has always worked here
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
	// When start == end the loop never runs. minAmp/maxAmp are initialized to
	// ±Infinity and never overwritten, so they currently flow into
	// graph.svelte:275-278 and corrupt the amplitude slider state. This test
	// pins the desired behavior: empty waveform, finite bounds.
	it('returns finite bounds when start equals end (no samples in slice)', () => {
		const { waveform, minAmp, maxAmp } = extractWaveformData(mockBuffer(SAMPLE_RATE), 0.5, 0.5);
		expect(waveform).toEqual([]);
		expect(Number.isFinite(minAmp)).toBe(true);
		expect(Number.isFinite(maxAmp)).toBe(true);
	});

	// `endSample = Math.min(end * sampleRate, audioBuffer.length)` should
	// silently clamp an over-long range request rather than return out-of-
	// bounds samples or crash. This case currently passes — pinning it ensures
	// the clamp doesn't get accidentally removed.
	it('clamps end > duration to the buffer length', () => {
		const buf = mockBuffer(SAMPLE_RATE); // 1 second
		const { waveform } = extractWaveformData(buf, 0, 100); // request 100s
		expect(waveform.length).toBeGreaterThan(0);
		expect(waveform[waveform.length - 1].time).toBeLessThanOrEqual(1.0);
	});

	// A zero-length buffer (e.g. a file that failed to decode upstream)
	// should not crash. Same finite-bounds expectation as start==end.
	it('handles a zero-length buffer without crashing', () => {
		const { waveform, minAmp, maxAmp } = extractWaveformData(mockBuffer(0), 0, 0);
		expect(waveform).toEqual([]);
		expect(Number.isFinite(minAmp)).toBe(true);
		expect(Number.isFinite(maxAmp)).toBe(true);
	});

	// Negative `start` produces negative sample indices in the loop.
	// `channelData[-N]` is `undefined` on a Float32Array, contaminating every
	// output point. Desired behavior: clamp start to 0 (or guard the loop).
	it('produces only finite amplitudes for a negative start time', () => {
		const { waveform } = extractWaveformData(mockBuffer(SAMPLE_RATE), -0.5, 1);
		expect(waveform.every((p) => Number.isFinite(p.amplitude))).toBe(true);
	});
});

// Pins the [start, end] → indices mapping: (a) starts at the right sample,
// (b) stops strictly before end, (c) reports the actual amplitude at those
// indices. Slice [0.25, 0.75] picked so both bounds multiply cleanly by
// 44100 — no float drift in the timestamp checks.
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

		// (c) Amplitude matches data[startSample] directly — tests indexing,
		// not sine math.
		const startSample = Math.floor(0.25 * SAMPLE_RATE);
		expect(waveform[0].amplitude).toBe(data[startSample]);
	});
});
