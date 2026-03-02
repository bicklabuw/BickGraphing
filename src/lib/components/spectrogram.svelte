<script lang="ts">
	import type { FFmpeg } from '@ffmpeg/ffmpeg';
	import * as d3 from 'd3';

	export let ffmpeg: FFmpeg | null = null;
	export let inputFileName: string | null = null;
	export let startTime = 0;
	export let endTime = 15;
	export let minFreq = 0;
	export let maxFreq = 5000;

	let container: HTMLDivElement;
	let status = 'Waiting...';

	$: if (ffmpeg && inputFileName) {
		console.log('Props OK:', { startTime, endTime, inputFileName });
		generateSpectrogram();
	}

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

	function drawWithD3(data: number[][], sampleRate: number) {
		//fftSize: number
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
