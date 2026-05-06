/**
 * @module
 * Description: STFT worker — computes log-magnitudes for an assigned range of
 * frames and returns them as a single flat Float32Array. Each frame's FFT is
 * independent, so spectrogram.svelte can run several of these in parallel
 * across `navigator.hardwareConcurrency` cores.
 *
 * @author K. Seow <kseow@wisc.edu>
 * @contributors
 * @created 2026-05-05
 * @version 0.2.0
 * @license MIT
 *
 * Wire protocol (discriminated by `type`):
 *   in : { workerId, pcm, fftSize, hopSize, frameStart, frameCount }
 *   out: { type: 'PROGRESS', workerId, framesComplete, frameCount }
 *        ...periodic, sent every REPORT_EVERY frames during the loop
 *   out: { type: 'DONE', workerId, frameStart, frameCount, magnitudes, elapsedMs }
 *        ...sent once at the end, with `magnitudes.buffer` in the transfer list
 *
 * `pcm` is a Float32Array containing only the samples this worker needs
 * (from sample `frameStart * hopSize` through the end of the last frame).
 * The buffer is transferred — the main thread loses access after posting.
 */
import { fft } from '../utils/fft';

interface StftRequest {
	workerId: number;
	pcm: Float32Array;
	fftSize: number;
	hopSize: number;
	frameStart: number;
	frameCount: number;
}

export type StftProgressMessage = {
	type: 'PROGRESS';
	workerId: number;
	framesComplete: number;
	frameCount: number;
};

export type StftDoneMessage = {
	type: 'DONE';
	workerId: number;
	frameStart: number;
	frameCount: number;
	magnitudes: Float32Array;
	elapsedMs: number;
};

export type StftWorkerMessage = StftProgressMessage | StftDoneMessage;

// Tuning knob: every 500 frames we post a PROGRESS message. Lower would
// over-saturate the main thread with structured-clone traffic; higher would
// make the bar feel chunky on long files. ~30–50 updates per worker over a
// hours-long STFT is the sweet spot.
const REPORT_EVERY = 500;

self.onmessage = (e: MessageEvent<StftRequest>) => {
	const t0 = performance.now();
	const { workerId, pcm, fftSize, hopSize, frameStart, frameCount } = e.data;
	const halfSize = fftSize >> 1;

	// Each worker builds its own Hann window — ~8KB at fftSize=2048, cheaper
	// than copying it across the postMessage boundary.
	const hann = new Float32Array(fftSize);
	for (let n = 0; n < fftSize; n++) {
		hann[n] = 0.5 * (1 - Math.cos((2 * Math.PI * n) / (fftSize - 1)));
	}

	// Flat layout: magnitudes[f * halfSize + bin]. The main thread unpacks
	// it back into a row-major number[][] for the existing D3 renderer.
	const magnitudes = new Float32Array(frameCount * halfSize);
	const segment = new Float32Array(fftSize);

	for (let f = 0; f < frameCount; f++) {
		// pcm starts at frame `frameStart`, so frame f's local offset is just
		// f * hopSize regardless of the worker's absolute frame range.
		const localOffset = f * hopSize;
		for (let n = 0; n < fftSize; n++) {
			segment[n] = pcm[localOffset + n] * hann[n];
		}
		// fft.ts accepts number[]; Array.from is the bridge. The allocation
		// is small relative to the FFT work itself.
		const mags = fft(Array.from(segment));
		const base = f * halfSize;
		for (let bin = 0; bin < halfSize; bin++) {
			magnitudes[base + bin] = Math.log10(mags[bin] + 1e-6);
		}

		if (f > 0 && f % REPORT_EVERY === 0) {
			const progress: StftProgressMessage = {
				type: 'PROGRESS',
				workerId,
				framesComplete: f,
				frameCount
			};
			(self as unknown as Worker).postMessage(progress);
		}
	}

	const done: StftDoneMessage = {
		type: 'DONE',
		workerId,
		frameStart,
		frameCount,
		magnitudes,
		elapsedMs: performance.now() - t0
	};
	// Transfer the magnitudes buffer back to avoid copy on return.
	(self as unknown as Worker).postMessage(done, [magnitudes.buffer]);
};
