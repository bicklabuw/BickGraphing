import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';
import { base } from '$app/paths';

/**
 * Loads the FFmpeg WebAssembly core from the app's static assets.
 *
 * Both `ffmpeg-core.js` and `ffmpeg-core.wasm` are served from the same
 * origin (no CDN), which keeps the tool fully offline-capable after the
 * first load and avoids cross-origin isolation issues with SharedArrayBuffer.
 *
 * @returns A loaded FFmpeg instance ready for `exec()` calls.
 * @throws Re-throws the underlying loader error if the WASM fails to instantiate.
 */
export async function initFFmpeg() {
	try {
		const ffmpeg = new FFmpeg();
		await ffmpeg.load({
			coreURL: `${base}/ffmpeg-core/esm/ffmpeg-core.js`,
			wasmURL: `${base}/ffmpeg-core/esm/ffmpeg-core.wasm`
		});

		console.log('FFmpeg loaded successfully - offline mode active');
		return ffmpeg;
	} catch (error) {
		console.error('FFmpeg loading failed:', error);
		throw error;
	}
}

/**
 * Wraps an FFmpeg instance plus a single audio file and exposes methods
 * for producing visualization-ready data (waveform / spectrogram).
 *
 * Pipeline: the input file is written into FFmpeg's virtual filesystem,
 * transcoded to little-endian 32-bit float PCM at 44.1 kHz mono, then
 * read back as a `Float32Array` for downsampling or STFT analysis.
 */
export class AudioProcessor {
	ffmpeg: FFmpeg; // Replace with actual FFmpeg type if available
	file: File;
	onProgress: (progress: number) => void;
	chunkSize: number;
	totalChunks: number;
	rawFile: string | null;

	constructor(ffmpeg: FFmpeg, file: File, onProgress?: (progress: number) => void) {
		if (!ffmpeg) throw new Error('FFmpeg instance is required');
		if (!file) throw new Error('Audio file is required');

		this.ffmpeg = ffmpeg;
		this.file = file;
		this.onProgress = onProgress || (() => {});
		this.chunkSize = 1024 * 1024 * 10; // 10MB chunks
		this.totalChunks = Math.ceil(file.size / this.chunkSize);
		this.rawFile = null;
	}

	/**
	 * Runs the full pipeline: write the source file into FFmpeg's FS,
	 * transcode it to mono f32le PCM at 44.1 kHz, and extract a
	 * downsampled, normalized waveform.
	 *
	 * @returns The waveform samples, or `null` if PCM extraction fails.
	 */
	async process() {
		console.log('Processing Audio File:', this.file.name);

		// Step 1: Write the input wav to FFmpeg's FS
		await this.ffmpeg.writeFile('input.wav', await fetchFile(this.file));

		// Step 2: Convert to raw PCM (float 32)
		await this.ffmpeg.exec([
			'-i',
			'input.wav',
			'-f',
			'f32le',
			'-acodec',
			'pcm_f32le',
			'-ar',
			'44100',
			'-ac',
			'1',
			'audio_data.raw'
		]);
		this.rawFile = 'audio_data.raw';

		// Step 3: Read + extract waveform
		const waveform = await this.extractWaveform(this.rawFile);
		// const spectrogram = await this.extractSpectrogram(this.rawFile)

		console.log('✅ Done. Waveform length:', waveform?.length ?? 'N/A');
		// console.log("✅ Done. spectrogram length:", spectrogram?.length ?? 'N/A');
		return waveform;
	}

	/**
	 * Reads raw f32le PCM out of FFmpeg's FS and reduces it to a fixed
	 * number of plot-friendly samples.
	 *
	 * @param rawFile - Filename of the raw PCM file inside FFmpeg's FS.
	 * @param samplesCount - Number of output samples after downsampling.
	 * @returns Normalized samples in [-1, 1], or `null` if PCM is empty / silent.
	 */
	async extractWaveform(rawFile: string, samplesCount = 1000) {
		console.log('🔍 Extracting waveform from:', rawFile);

		const rawData = (await this.ffmpeg.readFile(rawFile)) as Uint8Array;

		if (!rawData || rawData.length === 0) {
			console.error('❌ Error: Failed to read raw PCM data');
			return null;
		}

		console.log('✅ Raw PCM Data (First 20 bytes):', rawData.slice(0, 20));

		const dataView = new DataView(rawData.buffer);
		const samples = new Float32Array(rawData.buffer);

		for (let i = 0; i < samples.length; i++) {
			samples[i] = dataView.getFloat32(i * 4, true); // Little-endian
		}

		console.log('✅ Extracted waveform (First 10 samples):', samples.slice(0, 10));

		if (samples.every((sample) => sample === 0)) {
			console.error('❌ Error: All extracted waveform samples are zero');
			return null;
		}

		// ✅ Normalize after downsampling
		return this.normalizeWaveform(this.downsampleWaveform(samples, samplesCount));
	}

	/**
	 * Reduces a long sample buffer to `targetSamples` entries using
	 * min/max pooling. The midpoint of each bucket's (min, max) pair
	 * is kept, which preserves visible peaks better than plain striding
	 * when zoomed-out waveforms are rendered.
	 */
	downsampleWaveform(waveform: Float32Array, targetSamples: number): Float32Array {
		console.log('Downsampling waveforms with min/max for accuracy');
		const step = Math.floor(waveform.length / targetSamples);
		const downsampled = new Float32Array(targetSamples);

		for (let i = 0; i < targetSamples; i++) {
			const start = i * step; //TODO: Change back to let
			const end = Math.min(start + step, waveform.length);
			let min = Infinity,
				max = -Infinity;

			for (let j = start; j < end; j++) {
				const val = waveform[j];
				if (val < min) min = val;
				if (val > max) max = val;
			}

			downsampled[i] = (min + max) / 2;
		}

		return downsampled;
	}

	/**
	 * Computes a 2-D STFT magnitude spectrogram from raw PCM.
	 *
	 * Uses a sliding Hann window of 2048 samples and a naive O(N²) DFT
	 * per frame (see `computeFFT`). For larger inputs the optimized
	 * radix-2 implementation in `src/lib/utils/fft.ts` should be preferred.
	 *
	 * @param rawFile - Filename of the raw PCM file inside FFmpeg's FS.
	 * @param options.width - Number of time frames in the output grid.
	 * @param options.height - Number of frequency bins in the output grid.
	 * @returns Row-major magnitude grid (`width * height`), normalized to [0, 1].
	 */
	async extractSpectrogram(rawFile: string, options = { width: 1000, height: 256 }) {
		console.log('🔍 Extracting spectrogram from:', rawFile);

		const rawData = (await this.ffmpeg.readFile(rawFile)) as Uint8Array;
		if (!rawData || rawData.length === 0) {
			console.error('❌ Error: Failed to read raw PCM data');
			return null;
		}

		const dataView = new DataView(rawData.buffer);
		const samples = new Float32Array(rawData.byteLength / 4);
		for (let i = 0; i < samples.length; i++) {
			samples[i] = dataView.getFloat32(i * 4, true); // Little-endian
		}

		// Compute spectrogram using streaming approach to avoid memory issues
		const { width, height } = options;
		const spectrogram = new Float32Array(width * height);
		// const sampleRate = 44100; // Matches FFmpeg conversion
		const windowSize = 2048; // Power of 2 for FFT
		const hopLength = Math.floor(samples.length / width);

		// Simple sliding window Short-time Fourier Transform (STFT)
		for (let x = 0; x < width; x++) {
			const windowStart = x * hopLength;
			const window = samples.slice(windowStart, windowStart + windowSize);

			// Apply Hann window to reduce spectral leakage
			for (let i = 0; i < window.length; i++) {
				const multiplier = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (window.length - 1)));
				window[i] *= multiplier;
			}

			// Compute magnitude spectrum
			const fftMagnitudes = this.computeFFT(window);

			// Store magnitude spectrum in spectrogram
			for (let y = 0; y < height; y++) {
				const mag = y < fftMagnitudes.length ? Math.log(1 + Math.abs(fftMagnitudes[y])) : 0;
				spectrogram[x * height + y] = mag;
			}
		}

		// Normalize spectrogram
		const max = Math.max(...spectrogram);
		return spectrogram.map((val) => val / max);
	}

	/**
	 * Naive O(N²) DFT magnitude spectrum.
	 *
	 * Kept here for clarity / pedagogical use inside `extractSpectrogram`.
	 * Production code paths use the radix-2 FFT in `src/lib/utils/fft.ts`.
	 */
	computeFFT(samples: Float32Array): Float32Array {
		const magnitudes = new Float32Array(samples.length / 2);

		for (let k = 0; k < magnitudes.length; k++) {
			let realPart = 0,
				imagPart = 0;
			for (let n = 0; n < samples.length; n++) {
				const angle = (-2 * Math.PI * k * n) / samples.length;
				realPart += samples[n] * Math.cos(angle);
				imagPart += samples[n] * Math.sin(angle);
			}
			magnitudes[k] = Math.sqrt(realPart * realPart + imagPart * imagPart);
		}

		return magnitudes;
	}

	/**
	 * Scales samples into [-1, 1] by dividing through the absolute peak.
	 * Falls back to a divisor of 1 when the input is all zeros.
	 */
	normalizeWaveform(samples: Float32Array): Float32Array {
		const max = Math.max(...samples.map(Math.abs)) || 1;
		const normalized = samples.map((s) => s / max);
		return Float32Array.from(normalized);
	}
}
