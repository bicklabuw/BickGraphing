/**
 * @file Hann window unit tests.
 *
 * Verifies the symmetric Hann window math used by the STFT pipeline:
 * zero at the endpoints, peaks near 1 at the center, and a known sum
 * (~N/2). The same Hann formula is duplicated in `audioProcessing.ts`
 * and matches scipy's `hann(n, sym=True)` on the librosa fixture side.
 *
 * Note: this file does NOT directly test the FFT itself — that is
 * verified indirectly through `stft.integration.test.ts` and
 * `librosa.parity.test.ts`.
 *
 * @author K. Seow <kseow@wisc.edu>
 * @created 2026-04-23
 * @version 0.2.0
 * @license MIT
 */

import { describe, it, expect } from 'vitest';
import { hann, N_FFT } from './helpers';

describe('Hann window', () => {
	it('is zero at the endpoints (symmetric form)', () => {
		const w = hann(N_FFT);
		expect(w[0]).toBe(0);
		expect(w[N_FFT - 1]).toBeCloseTo(0, 10);
	});

	it('peaks near 1 at the center', () => {
		const w = hann(N_FFT);
		const peak = Math.max(...w);
		expect(peak).toBeGreaterThan(0.9999);
		expect(peak).toBeLessThanOrEqual(1);
		// Even-N symmetric Hann: two center samples are equal and ~1.
		expect(w[N_FFT / 2 - 1]).toBeCloseTo(1, 5);
		expect(w[N_FFT / 2]).toBeCloseTo(1, 5);
	});

	it('sums to ~N/2 within 0.1%', () => {
		const w = hann(N_FFT);
		let sum = 0;
		for (let i = 0; i < w.length; i++) sum += w[i];
		// Symmetric Hann sum is exactly N/2 - 0.5; 0.1% tolerance is plenty.
		expect(sum).toBeGreaterThan((N_FFT / 2) * 0.999);
		expect(sum).toBeLessThan((N_FFT / 2) * 1.001);
	});
});
