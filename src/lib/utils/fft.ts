export function fft(input: number[]) {
	const N = input.length;
	if ((N & (N - 1)) !== 0) {
		throw new Error('Input length must be a power of 2');
	}

	const real = input.slice();
	const imag = new Float32Array(N);

	// Bit reversal permutation
	let j = 0;
	for (let i = 0; i < N; i++) {
		if (i < j) {
			[real[i], real[j]] = [real[j], real[i]];
			[imag[i], imag[j]] = [imag[j], imag[i]];
		}
		let m = N >> 1;
		while (j >= m && m >= 2) {
			j -= m;
			m >>= 1;
		}
		j += m;
	}

	// FFT
	for (let size = 2; size <= N; size <<= 1) {
		const halfsize = size >> 1;
		const tableStep = (Math.PI * 2) / size;
		for (let i = 0; i < N; i += size) {
			for (let j = 0; j < halfsize; j++) {
				const angle = tableStep * j;
				const cos = Math.cos(angle);
				const sin = -Math.sin(angle);

				const k = i + j;
				const tReal = cos * real[k + halfsize] - sin * imag[k + halfsize];
				const tImag = sin * real[k + halfsize] + cos * imag[k + halfsize];

				real[k + halfsize] = real[k] - tReal;
				imag[k + halfsize] = imag[k] - tImag;
				real[k] += tReal;
				imag[k] += tImag;
			}
		}
	}

	const magnitude = new Float32Array(N / 2);
	for (let i = 0; i < N / 2; i++) {
		magnitude[i] = Math.sqrt(real[i] * real[i] + imag[i] * imag[i]);
	}
	return magnitude;
}

export function createWindows(samples: Float32Array, windowSize = 1024, hopSize = 512) {
	const windows = [];
	for (let i = 0; i + windowSize <= samples.length; i += hopSize) {
		windows.push(samples.slice(i, i + windowSize));
	}
	return windows;
}
