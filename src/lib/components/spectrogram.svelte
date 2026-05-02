<!--
  @component
  Description: Generates and renders an STFT spectrogram from a .wav file using FFmpeg and D3.

  @author Grace Steinmetz <gesparkles@gmail.com>
  @contributors K. Seow <kseow@wisc.edu>
  @created 2025-04-01
  @version 1.0.1
  @license MIT
-->
<script lang="ts">
	import type { FFmpeg } from '@ffmpeg/ffmpeg';
	import * as d3 from 'd3';

	/** FFmpeg instance loaded by the parent (used for audio decoding). */
	export let ffmpeg: FFmpeg | null = null;
	/** Filename of the input audio in FFmpeg's virtual filesystem. */
	export let inputFileName: string | null = null;
	/** Start of the analysis window, in seconds. */
	export let startTime = 0;
	/** End of the analysis window, in seconds. */
	export let endTime = 15;
	/** Lower frequency bound for the rendered spectrogram, in Hz. */
	export let minFreq = 0;
	/** Upper frequency bound for the rendered spectrogram, in Hz. */
	export let maxFreq = 5000;

	let container: HTMLDivElement;
	let status = 'Waiting...';

	$: if (ffmpeg && inputFileName) {
		console.log('Props OK:', { startTime, endTime, inputFileName });
		generateSpectrogram();
	}

	/**
	 * Decodes the selected segment via FFmpeg, computes an STFT magnitude
	 * spectrogram, and renders it with D3.
	 *
	 * Pipeline:
	 *   1. FFmpeg trims `[startTime, endTime]` and emits mono 32-bit float PCM.
	 *   2. PCM is framed into overlapping Hann windows (2048 samples, 50% hop).
	 *   3. Per-frame magnitudes are log10-compressed for dynamic range.
	 *   4. D3 paints the resulting time × frequency grid as a heatmap.
	 *
	 * Sample rate is fixed at 44.1 kHz to match the FFmpeg transcode upstream.
	 */
	async function generateSpectrogram() {
		try {
			status = 'Extracting audio...';
			console.log(`[Spectrogram] Processing ${inputFileName}`);

			await ffmpeg!.exec([
				'-i',
				inputFileName!,
				'-ss',
				`${startTime}`,
				'-t',
				`${endTime - startTime}`,
				'-ac',
				'1',
				'-f',
				'f32le',
				'-y',
				'waveform.raw'
			]);

			const raw = await ffmpeg!.readFile('waveform.raw');
			console.log('after raw');

			if (!(raw instanceof Uint8Array)) {
				throw new Error('Expected Uint8Array from FFmpeg readFile');
			}
			const data = new Float32Array(raw.buffer);
			console.log('PCM slice:', data.length, 'samples');

			const sampleRate = 44100;
			const fftSize = 2048;
			const hopSize = fftSize / 2;

			const spectrogram: number[][] = [];
			for (let i = 0; i + fftSize <= data.length; i += hopSize) {
				console.log('inside spectrogram for loop, i is ' + i);

				const endIdx = i + fftSize;
				if (endIdx > data.length) {
					console.error(`🚫 Slice overflow! i=${i}, end=${endIdx} > length=${data.length}`);
					break; // Stop cleanly
				}

				const segment = data.slice(i, i + fftSize);
				const mags = fft(segment);
				spectrogram.push(mags);
			}

			const logMag = spectrogram.map((row) => row.map((v) => Math.log10(v + 1e-6)));

			status = 'Rendering...';
			drawWithD3(logMag, sampleRate); //removed fftSize
			status = 'Done.';
		} catch (err) {
			console.error('[Spectrogram] Failed:', err);
			status = 'Error.';
		}
	}

	/**
	 * Naive O(N²) DFT magnitude with an applied Hann window.
	 *
	 * Used inline here to keep the spectrogram pipeline self-contained.
	 * For larger N or performance-sensitive paths, prefer the optimized
	 * radix-2 implementation in `src/lib/utils/fft.ts`.
	 */
	function fft(signal: Float32Array): number[] {
		const N = signal.length;
		const windowed = signal.map((v, i) => v * 0.5 * (1 - Math.cos((2 * Math.PI * i) / (N - 1))));
		const out = new Float32Array(N / 2);

		for (let k = 0; k < N / 2; k++) {
			let real = 0,
				imag = 0;
			for (let n = 0; n < N; n++) {
				const angle = (2 * Math.PI * k * n) / N;
				real += windowed[n] * Math.cos(angle);
				imag -= windowed[n] * Math.sin(angle);
			}
			out[k] = Math.sqrt(real * real + imag * imag);
		}
		return Array.from(out);
	}

	/**
	 * Renders the STFT magnitude grid as a heatmap with time/frequency
	 * axes and a Turbo-colormap legend.
	 *
	 * @param data - Row-major STFT magnitudes (`data[t][f]`).
	 * @param sampleRate - Audio sample rate in Hz, used to map bins to frequency.
	 */
	function drawWithD3(data: number[][], sampleRate: number) {
		const margin = { top: 20, right: 60, bottom: 40, left: 60 }; // more right margin
		const width = 800 - margin.left - margin.right;
		const height = 400 - margin.top - margin.bottom;

		const svg = d3
			.select(container)
			.html('')
			.append('svg')
			.attr('width', width + margin.left + margin.right)
			.attr('height', height + margin.top + margin.bottom)
			.append('g')
			.attr('transform', `translate(${margin.left},${margin.top})`);

		const timeScale = d3.scaleLinear().domain([0, data.length]).range([0, width]);
		const binCount = data[0].length;
		const binHz = sampleRate / 2 / binCount;
		const freqScale = d3.scaleLinear().domain([minFreq, maxFreq]).range([height, 0]);

		const flat = data.flat();
		const colorDomain = d3.extent(flat) as [number, number];
		const colorScale = d3.scaleSequential(d3.interpolateTurbo).domain(colorDomain);

		const pixelWidth = width / data.length;

		for (let t = 0; t < data.length; t++) {
			for (let f = 0; f < binCount; f++) {
				const freq = f * binHz;
				if (freq < minFreq || freq > maxFreq) continue;

				const y = freqScale(freq);
				const h = 1.8;

				svg
					.append('rect')
					.attr('x', timeScale(t))
					.attr('y', y)
					.attr('width', pixelWidth)
					.attr('height', h)
					.attr('fill', colorScale(data[t][f]));
			}
		}

		// X Axis (Time)
		const xAxis = d3
			.axisBottom(timeScale)
			.ticks(10)
			.tickFormat((d) => `${(startTime + ((endTime - startTime) * +d) / data.length).toFixed(1)}s`);
		svg
			.append('g')
			.attr('transform', `translate(0, ${height})`)
			.call(xAxis)
			.append('text')
			.attr('x', width / 2)
			.attr('y', 35)
			.attr('fill', '#000')
			.style('text-anchor', 'middle')
			.text('Time (s)');

		// Y Axis (Frequency)
		const yAxis = d3
			.axisLeft(freqScale)
			.ticks(10)
			.tickFormat((d) => `${Math.round(d as number)} Hz`);
		svg
			.append('g')
			.call(yAxis)
			.append('text')
			.attr('transform', 'rotate(-90)')
			.attr('x', -height / 2)
			.attr('y', -45)
			.attr('fill', '#000')
			.style('text-anchor', 'middle')
			.text('Frequency (Hz)');

		// Color scale bar
		const legendHeight = height;
		const legendWidth = 20;

		const legendScale = d3.scaleLinear().domain(colorDomain).range([legendHeight, 0]);

		const legendAxis = d3
			.axisRight(legendScale)
			.ticks(6)
			.tickFormat((d) => Number(d).toFixed(2));

		const legend = svg.append('g').attr('transform', `translate(${width + 10}, 0)`);

		// Create gradient
		const defs = svg.append('defs');
		const gradientId = 'color-gradient';

		const gradient = defs
			.append('linearGradient')
			.attr('id', gradientId)
			.attr('x1', '0%')
			.attr('y1', '100%')
			.attr('x2', '0%')
			.attr('y2', '0%');

		const stops = d3.range(0, 1.01, 0.01);
		stops.forEach((t) => {
			gradient
				.append('stop')
				.attr('offset', `${t * 100}%`)
				.attr('stop-color', colorScale(colorDomain[0] + t * (colorDomain[1] - colorDomain[0])));
		});

		// Draw color bar
		legend
			.append('rect')
			.attr('width', legendWidth)
			.attr('height', legendHeight)
			.style('fill', `url(#${gradientId})`);

		// Draw legend axis
		legend.append('g').attr('transform', `translate(${legendWidth}, 0)`).call(legendAxis);

		legend
			.append('text')
			.attr('x', legendWidth / 2)
			.attr('y', -10)
			.attr('fill', '#000')
			.attr('text-anchor', 'middle')
			.style('font-size', '10px')
			.text('Log Intensity');
	}
</script>

<div bind:this={container} class="spectrogram">
	<p class="mt-2 text-xs italic text-gray-500">Spectrogram status: {status}</p>
</div>
