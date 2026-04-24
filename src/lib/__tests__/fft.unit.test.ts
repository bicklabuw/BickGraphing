import { describe, it, expect } from 'vitest';
import { hann, N_FFT } from './helpers';

// Pure unit tests on the Hann window formula. No I/O, no pipeline composition,
// no external fixtures — just properties of a single mathematical function.

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
		// For an even-length symmetric Hann the two center samples are equal
		// and within ~1e-6 of 1.
		expect(w[N_FFT / 2 - 1]).toBeCloseTo(1, 5);
		expect(w[N_FFT / 2]).toBeCloseTo(1, 5);
	});

	it('sums to ~N/2 within 0.1%', () => {
		const w = hann(N_FFT);
		let sum = 0;
		for (let i = 0; i < w.length; i++) sum += w[i];
		// Symmetric Hann sum is exactly N/2 - 0.5 (off-by-one vs the periodic
		// form). 0.1% relative tolerance is plenty for N=2048.
		expect(sum).toBeGreaterThan((N_FFT / 2) * 0.999);
		expect(sum).toBeLessThan((N_FFT / 2) * 1.001);
	});
});
