// Shared test utilities used by the three test files in this directory:
//   - fft.unit.test.ts        unit tests on the Hann window formula
//   - stft.integration.test.ts  pipeline composition tests on synthetic signals
//   - librosa.parity.test.ts   characterization tests vs the librosa reference

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect } from 'vitest';

import { fft, createWindows } from '../utils/fft';

export const SAMPLE_RATE = 44100;
export const N_FFT = 2048;
export const HOP_LENGTH = 1024;
export const FIXTURE_DIR = resolve(__dirname, '../../../tests/fixtures');

// Symmetric Hann window — mirrors the inline formula at audioProcessing.ts:178
// (`0.5 * (1 - cos(2πi/(N-1)))`). All librosa fixtures are generated with the
// same window, so this is the formula on the JS side that must match.
export function hann(n: number): Float32Array {
	const w = new Float32Array(n);
	for (let i = 0; i < n; i++) {
		w[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1)));
	}
	return w;
}

export function applyWindow(frame: Float32Array, window: Float32Array): Float32Array {
	const out = new Float32Array(frame.length);
	for (let i = 0; i < frame.length; i++) out[i] = frame[i] * window[i];
	return out;
}

// Compose STFT from the existing `createWindows` + Hann + `fft` exports.
// Returns one magnitude array per frame, length nFft/2 (matches fft() output —
// Nyquist bin is dropped, same as the rest of the pipeline).
export function stft(samples: Float32Array, nFft = N_FFT, hop = HOP_LENGTH): Float32Array[] {
	const frames = createWindows(samples, nFft, hop);
	const window = hann(nFft);
	return frames.map((frame) => fft(Array.from(applyWindow(frame, window))));
}

export function generateSine(
	freq: number,
	durationSec: number,
	sr: number,
	amplitude = 0.5
): Float32Array {
	const n = Math.floor(durationSec * sr);
	const out = new Float32Array(n);
	const k = (2 * Math.PI * freq) / sr;
	for (let i = 0; i < n; i++) out[i] = amplitude * Math.sin(k * i);
	return out;
}

export function argmax(arr: ArrayLike<number>): number {
	let best = 0;
	let bestVal = -Infinity;
	for (let i = 0; i < arr.length; i++) {
		if (arr[i] > bestVal) {
			bestVal = arr[i];
			best = i;
		}
	}
	return best;
}

// Permissive mono PCM WAV loader — accepts 16- or 24-bit. Falls back to
// reading until EOF when the data-chunk size header is implausible (the
// scipy-written tests/test.wav reports size = 0). Used by integration tests
// that need to exercise real fixtures outside the STFT 16-bit format.
export function loadWavMono(path: string): {
	sampleRate: number;
	samples: Float32Array;
} {
	const buf = readFileSync(path);
	if (buf.toString('ascii', 0, 4) !== 'RIFF') throw new Error('not a RIFF file');
	if (buf.toString('ascii', 8, 12) !== 'WAVE') throw new Error('not a WAVE file');

	let offset = 12;
	let fmtOffset = -1;
	let dataOffset = -1;
	let dataSize = 0;
	while (offset + 8 <= buf.length) {
		const id = buf.toString('ascii', offset, offset + 4);
		const size = buf.readUInt32LE(offset + 4);
		if (id === 'fmt ') fmtOffset = offset + 8;
		if (id === 'data') {
			dataOffset = offset + 8;
			dataSize = size;
			break;
		}
		offset += 8 + size + (size & 1);
	}
	if (fmtOffset < 0 || dataOffset < 0) throw new Error('missing fmt or data chunk');

	const audioFormat = buf.readUInt16LE(fmtOffset);
	const channels = buf.readUInt16LE(fmtOffset + 2);
	const sampleRate = buf.readUInt32LE(fmtOffset + 4);
	const bitsPerSample = buf.readUInt16LE(fmtOffset + 14);
	if (audioFormat !== 1) throw new Error(`expected PCM (1), got ${audioFormat}`);
	if (channels !== 1) throw new Error(`expected mono, got ${channels} ch`);
	if (bitsPerSample !== 16 && bitsPerSample !== 24) {
		throw new Error(`expected 16- or 24-bit, got ${bitsPerSample}`);
	}

	const bytesPerSample = bitsPerSample / 8;
	const remaining = buf.length - dataOffset;
	const effectiveSize = dataSize > 0 && dataSize <= remaining ? dataSize : remaining;
	const numSamples = Math.floor(effectiveSize / bytesPerSample);
	const samples = new Float32Array(numSamples);

	if (bitsPerSample === 16) {
		for (let i = 0; i < numSamples; i++) {
			samples[i] = buf.readInt16LE(dataOffset + i * 2) / 32768;
		}
	} else {
		// 24-bit LE signed; sign-extend to 32 bits, scale to [-1, 1).
		for (let i = 0; i < numSamples; i++) {
			const o = dataOffset + i * 3;
			let v = buf[o] | (buf[o + 1] << 8) | (buf[o + 2] << 16);
			if (v & 0x800000) v |= ~0xffffff;
			samples[i] = v / 8388608;
		}
	}

	return { sampleRate, samples };
}

// Minimal mono 16-bit PCM WAV loader. Matches librosa/soundfile semantics
// (int16 → float in [-1, 1) via /32768) so fixtures and JS see the same floats.
export function loadWavMonoInt16(path: string): {
	sampleRate: number;
	samples: Float32Array;
} {
	const buf = readFileSync(path);
	if (buf.toString('ascii', 0, 4) !== 'RIFF') throw new Error('not a RIFF file');
	if (buf.toString('ascii', 8, 12) !== 'WAVE') throw new Error('not a WAVE file');

	let offset = 12;
	let fmtOffset = -1;
	let dataOffset = -1;
	let dataSize = 0;
	while (offset + 8 <= buf.length) {
		const id = buf.toString('ascii', offset, offset + 4);
		const size = buf.readUInt32LE(offset + 4);
		if (id === 'fmt ') fmtOffset = offset + 8;
		if (id === 'data') {
			dataOffset = offset + 8;
			dataSize = size;
			break;
		}
		offset += 8 + size + (size & 1);
	}
	if (fmtOffset < 0 || dataOffset < 0) throw new Error('missing fmt or data chunk');

	const audioFormat = buf.readUInt16LE(fmtOffset);
	const channels = buf.readUInt16LE(fmtOffset + 2);
	const sampleRate = buf.readUInt32LE(fmtOffset + 4);
	const bitsPerSample = buf.readUInt16LE(fmtOffset + 14);
	if (audioFormat !== 1) throw new Error(`expected PCM (1), got ${audioFormat}`);
	if (channels !== 1) throw new Error(`expected mono, got ${channels} ch`);
	if (bitsPerSample !== 16) throw new Error(`expected 16-bit, got ${bitsPerSample}`);

	const numSamples = dataSize / 2;
	const samples = new Float32Array(numSamples);
	for (let i = 0; i < numSamples; i++) {
		samples[i] = buf.readInt16LE(dataOffset + i * 2) / 32768;
	}
	return { sampleRate, samples };
}

export interface StftFixture {
	sample_rate: number;
	n_fft: number;
	hop_length: number;
	frame_indices: number[];
	magnitudes: number[][];
	peak_bin_per_frame: number[];
	n_frames_total: number;
}

export function loadFixture<T extends StftFixture>(name: string): T {
	return JSON.parse(readFileSync(resolve(FIXTURE_DIR, name), 'utf8')) as T;
}

// Compares our magnitude frames bin-by-bin against a librosa reference fixture.
// Tolerance is a fraction of the per-frame peak magnitude (default 1%) — this
// is the right framing for "agree on the strong stuff, allow noise on the
// weak stuff" rather than relative-per-bin (which would be infinite for zero
// bins).
export function compareToLibrosa(
	ourFrames: Float32Array[],
	fixture: StftFixture,
	tolerancePct = 0.01
): void {
	const maxIdx = Math.max(...fixture.frame_indices);
	expect(ourFrames.length).toBeGreaterThan(maxIdx);

	for (let f = 0; f < fixture.frame_indices.length; f++) {
		const frameIdx = fixture.frame_indices[f];
		const expectedBins = fixture.magnitudes[f]; // length n_fft/2 + 1
		const ourMags = ourFrames[frameIdx]; // length n_fft/2

		expect(argmax(ourMags)).toBe(fixture.peak_bin_per_frame[f]);

		const peakRef = Math.max(...expectedBins);
		const tol = peakRef * tolerancePct;
		for (let k = 0; k < ourMags.length; k++) {
			const diff = Math.abs(ourMags[k] - expectedBins[k]);
			if (diff > tol) {
				throw new Error(
					`frame ${frameIdx} bin ${k}: ours=${ourMags[k]} ` +
						`librosa=${expectedBins[k]} diff=${diff.toExponential(3)} ` +
						`tol=${tol.toExponential(3)} ` +
						`(${(tolerancePct * 100).toFixed(2)}% of peak ${peakRef})`
				);
			}
		}
	}
}
