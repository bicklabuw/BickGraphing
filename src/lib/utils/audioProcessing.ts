import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

/**
 * Initialize FFmpeg
 */
export async function initFFmpeg() {
	try {
		const ffmpeg = new FFmpeg();
		await ffmpeg.load({
			coreURL: '/ffmpeg-core/esm/ffmpeg-core.js',
			wasmURL: '/ffmpeg-core/esm/ffmpeg-core.wasm'
		});

		console.log('FFmpeg loaded successfully - offline mode active');
		return ffmpeg;
	} catch (error) {
		console.error('FFmpeg loading failed:', error);
		throw error;
	}
}

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

	// Simple implementation of FFT magnitude computation
	computeFFT(samples: Float32Array): Float32Array {
		// Note: This is a simplified magnitude spectrum computation
		// For a production-ready solution, consider using a proper FFT library
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

	normalizeWaveform(samples: Float32Array): Float32Array {
		const max = Math.max(...samples.map(Math.abs)) || 1;
		const normalized = samples.map((s) => s / max);
		return Float32Array.from(normalized);
	}
}
