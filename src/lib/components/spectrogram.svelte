<!--
  @component
  Description: Generates and renders an STFT spectrogram from a .wav file using FFmpeg and D3.

  @author K. Seow <kseow@wisc.edu>
  @contributors Grace Steinmetz <gesparkles@gmail.com>
  @created 2025-04-01
  @version 0.2.0
  @license MIT
-->
<script context="module" lang="ts">
	let generationQueue: Promise<unknown> = Promise.resolve();
	let pendingGenerationCount = 0;
</script>

<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type { FFmpeg } from '@ffmpeg/ffmpeg';
	import * as d3 from 'd3';
	// Radix-2 FFT (O(N log N)) — replaces the inline DFT kept commented at bottom.
	import { fft } from '$lib/utils/fft';
	// Pauses waveform/miniwaveform redraws — avoids ~6× redundant D3 work per spectrogram run.
	import { spectrogramBusy } from '$lib/stores/uiBusy';

	export let ffmpeg: FFmpeg | null = null;
	export let inputFileName: string | null = null;
	export let audioBuffer: AudioBuffer | null = null;
	export let startTime = 0;
	export let endTime = 15;
	export let minFreq = 0;
	export let maxFreq = 3000;
	export let computedHeight: number = 400;

	let container: HTMLDivElement;
	let _status = 'Waiting...';

	// Cached so resize can repaint without re-running ffmpeg + STFT.
	let logMagCache: number[][] | null = null;
	let sampleRateCache = 44100;
	let observer: ResizeObserver | undefined;

	const WORKER_THRESHOLD_SEC = 20;

	const DEBOUNCE_IDLE_MS = 400;
	const DEBOUNCE_BUSY_MS = 1000;
	let debounceTimer: ReturnType<typeof setTimeout> | undefined;
	let currentController: AbortController | null = null;

	let lastStart: number | null = null;
	let lastEnd: number | null = null;
	let lastMinFreq: number | null = null;
	let lastMaxFreq: number | null = null;
	let lastInput: string | null = null;

	type Phase = 'idle' | 'queued' | 'decode' | 'stft' | 'finalize' | 'done';
	let phase: Phase = 'idle';
	let progressPct = 0;
	let etaMs = 0;
	let stftFramesDone = 0;
	let stftFramesTotal = 0;

	// rAF-coalesced staging — workers post PROGRESS up to dozens of times
	// per second across 8 cores; we paint at most once per frame.
	let pendingFramesDone = 0;
	let pendingFramesTotal = 0;
	let stftStartTs = 0;
	let rafScheduled = false;

	function scheduleProgressUpdate() {
		if (rafScheduled) return;
		rafScheduled = true;
		requestAnimationFrame(() => {
			rafScheduled = false;
			stftFramesDone = pendingFramesDone;
			stftFramesTotal = pendingFramesTotal;
			const frac = stftFramesTotal > 0 ? stftFramesDone / stftFramesTotal : 0;
			progressPct = 10 + Math.min(70, frac * 70);
			if (frac > 0.05) {
				const elapsed = performance.now() - stftStartTs;
				etaMs = Math.max(0, (elapsed / frac) * (1 - frac));
			}
		});
	}

	function formatEta(ms: number) {
		if (ms <= 0 || !isFinite(ms)) return '';
		const sec = ms / 1000;
		if (sec < 1) return '<1s';
		if (sec < 60) return `${Math.round(sec)}s`;
		const m = Math.floor(sec / 60);
		const s = Math.round(sec % 60);
		return `${m}m ${s}s`;
	}

	$: phaseLabel = (() => {
		if (phase === 'queued') return 'Queued';
		if (phase === 'decode') return 'Decoding audio';
		if (phase === 'stft') {
			return `Computing FFT (${stftFramesDone.toLocaleString()} / ${stftFramesTotal.toLocaleString()})`;
		}
		if (phase === 'finalize') return 'Finalizing render';
		return '';
	})();

	export let hasRendered = false;
	$: if (phase === 'done') hasRendered = true;

	export let audioFileName: string = 'spectrogram';

	/**
	 * Composes the canvas heatmap and the SVG axes overlay into a single file.
	 * PNG/JPEG: rasterized to a 2× canvas. SVG: hybrid file with the heatmap
	 * embedded as a PNG `<image>` plus a clone of the axes overlay.
	 */
	export function downloadSpectrogram(format: 'svg' | 'png' | 'jpeg' = 'png') {
		if (!container) return;
		const wrapper = container.querySelector('div.spec-plot') as HTMLDivElement | null;
		const heatmap = wrapper?.querySelector('canvas') as HTMLCanvasElement | null;
		const overlay = wrapper?.querySelector('svg.spec-overlay') as SVGSVGElement | null;
		if (!wrapper || !heatmap || !overlay) return;

		const totalWidth = wrapper.clientWidth;
		const totalHeight = wrapper.clientHeight;
		const heatLeft = parseFloat(heatmap.style.left) || 0;
		const heatTop = parseFloat(heatmap.style.top) || 0;
		const heatWidth = heatmap.width;
		const heatHeight = heatmap.height;

		const cleanName = audioFileName.replace(/\.wav$/i, '');
		const baseName = `${cleanName}_spectrogram_t${startTime.toFixed(1)}-${endTime.toFixed(1)}s_f${Math.round(minFreq)}-${Math.round(maxFreq)}Hz`;

		if (format === 'svg') {
			const heatPng = heatmap.toDataURL('image/png');
			const svgNS = 'http://www.w3.org/2000/svg';
			const out = document.createElementNS(svgNS, 'svg');
			out.setAttribute('xmlns', svgNS);
			out.setAttribute('width', String(totalWidth));
			out.setAttribute('height', String(totalHeight));
			out.setAttribute('viewBox', `0 0 ${totalWidth} ${totalHeight}`);

			const bg = document.createElementNS(svgNS, 'rect');
			bg.setAttribute('width', '100%');
			bg.setAttribute('height', '100%');
			bg.setAttribute('fill', 'white');
			out.appendChild(bg);

			const img = document.createElementNS(svgNS, 'image');
			img.setAttribute('x', String(heatLeft));
			img.setAttribute('y', String(heatTop));
			img.setAttribute('width', String(heatWidth));
			img.setAttribute('height', String(heatHeight));
			img.setAttribute('href', heatPng);
			out.appendChild(img);

			const overlayClone = overlay.cloneNode(true) as SVGSVGElement;
			overlayClone.childNodes.forEach((node) => out.appendChild(node.cloneNode(true)));

			const source = new XMLSerializer().serializeToString(out);
			const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
			triggerSpectrogramDownload(URL.createObjectURL(blob), `${baseName}.svg`);
			return;
		}

		const overlayClone = overlay.cloneNode(true) as SVGSVGElement;
		overlayClone.setAttribute('width', String(totalWidth));
		overlayClone.setAttribute('height', String(totalHeight));
		overlayClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
		const overlaySource = new XMLSerializer().serializeToString(overlayClone);
		const overlayUrl = URL.createObjectURL(
			new Blob([overlaySource], { type: 'image/svg+xml;charset=utf-8' })
		);

		const scale = 2;
		const out = document.createElement('canvas');
		out.width = totalWidth * scale;
		out.height = totalHeight * scale;
		const ctx = out.getContext('2d');
		if (!ctx) return;
		ctx.scale(scale, scale);
		ctx.fillStyle = 'white';
		ctx.fillRect(0, 0, totalWidth, totalHeight);
		ctx.drawImage(heatmap, heatLeft, heatTop, heatWidth, heatHeight);

		const overlayImg = new Image();
		overlayImg.onload = () => {
			ctx.drawImage(overlayImg, 0, 0, totalWidth, totalHeight);
			URL.revokeObjectURL(overlayUrl);
			const mime = format === 'png' ? 'image/png' : 'image/jpeg';
			const ext = format === 'png' ? 'png' : 'jpg';
			out.toBlob(
				(blob) => {
					if (!blob) return;
					triggerSpectrogramDownload(URL.createObjectURL(blob), `${baseName}.${ext}`);
				},
				mime,
				format === 'jpeg' ? 0.95 : undefined
			);
		};
		overlayImg.src = overlayUrl;
	}

	function triggerSpectrogramDownload(href: string, filename: string) {
		const a = document.createElement('a');
		a.href = href;
		a.download = filename;
		a.click();
		URL.revokeObjectURL(href);
	}

	onMount(() => {
		observer = new ResizeObserver(() => {
			if ($spectrogramBusy) return;
			if (logMagCache) drawSpectrogram(logMagCache, sampleRateCache);
		});
		if (container) observer.observe(container);
	});

	onDestroy(() => {
		if (debounceTimer) clearTimeout(debounceTimer);
		if (observer && container) observer.unobserve(container);
	});

	$: if (ffmpeg && inputFileName) {
		if (
			startTime !== lastStart ||
			endTime !== lastEnd ||
			minFreq !== lastMinFreq ||
			maxFreq !== lastMaxFreq ||
			inputFileName !== lastInput
		) {
			lastStart = startTime;
			lastEnd = endTime;
			lastMinFreq = minFreq;
			lastMaxFreq = maxFreq;
			lastInput = inputFileName;

			if (debounceTimer) clearTimeout(debounceTimer);
			const wait = $spectrogramBusy ? DEBOUNCE_BUSY_MS : DEBOUNCE_IDLE_MS;
			debounceTimer = setTimeout(() => {
				generateSpectrogram();
			}, wait);
		}
	}

	async function generateSpectrogram() {
		if (currentController) currentController.abort();
		const myController = new AbortController();
		currentController = myController;

		pendingGenerationCount++;
		$spectrogramBusy = true;
		phase = 'queued';
		progressPct = 0;
		etaMs = 0;
		stftFramesDone = 0;
		stftFramesTotal = 0;

		const myTurn = generationQueue.then(() => runGeneration(myController));
		generationQueue = myTurn.catch(() => {});

		try {
			await myTurn;
		} finally {
			pendingGenerationCount--;
			if (pendingGenerationCount === 0) $spectrogramBusy = false;
		}
	}

	async function runGeneration(myController: AbortController) {
		const signal = myController.signal;
		if (signal.aborted) return;

		phase = 'decode';
		progressPct = 0;
		try {
			_status = 'Extracting audio...';
			console.log(`[Spectrogram] Processing ${inputFileName}`);
			console.time('[spec-test] total');

			let data: Float32Array;
			let sampleRate: number;

			if (audioBuffer) {
				console.time('[spec-test] audioBuffer slice');
				sampleRate = audioBuffer.sampleRate;
				const fullPcm = audioBuffer.getChannelData(0);
				const startSample = Math.max(0, Math.floor(startTime * sampleRate));
				const endSample = Math.min(fullPcm.length, Math.floor(endTime * sampleRate));
				data = fullPcm.slice(startSample, endSample);
				console.timeEnd('[spec-test] audioBuffer slice');
			} else {
				console.time('[spec-test] ffmpeg decode');
				const rawName = `waveform_${inputFileName}.raw`;
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
					rawName
				]);
				signal.throwIfAborted();

				const raw = await ffmpeg!.readFile(rawName);
				signal.throwIfAborted();

				if (!(raw instanceof Uint8Array)) {
					throw new Error('Expected Uint8Array from FFmpeg readFile');
				}
				data = new Float32Array(raw.buffer);
				sampleRate = 44100;
				console.timeEnd('[spec-test] ffmpeg decode');
			}
			console.log('[spec-test] PCM samples:', data.length);

			progressPct = 10;

			const fftSize = 2048;
			const hopSize = fftSize / 2;

			const audioDurationSec = data.length / sampleRate;
			const useWorkers = audioDurationSec >= WORKER_THRESHOLD_SEC;
			console.log(
				`[spec-test] audio: ${audioDurationSec.toFixed(1)}s → ${useWorkers ? 'workers' : 'main-thread'}`
			);

			const expectedFrames = Math.max(0, Math.floor((data.length - fftSize) / hopSize) + 1);

			phase = 'stft';
			stftFramesTotal = expectedFrames;
			stftStartTs = performance.now();

			console.time('[spec-test] STFT');
			const logMag = useWorkers
				? await computeStftWithWorkers(data, fftSize, hopSize, expectedFrames, signal)
				: computeStftMainThread(data, fftSize, hopSize);
			console.timeEnd('[spec-test] STFT');
			console.log('[spec-test] frames produced:', logMag.length);
			signal.throwIfAborted();

			phase = 'finalize';
			progressPct = 80;
			etaMs = 0;

			logMagCache = logMag;
			sampleRateCache = sampleRate;

			progressPct = 92;

			_status = 'Rendering...';
			console.time('[spec-test] canvas render');
			drawSpectrogram(logMag, sampleRate);
			console.timeEnd('[spec-test] canvas render');
			console.timeEnd('[spec-test] total');
			progressPct = 100;
			_status = 'Done.';
			phase = 'done';
		} catch (err) {
			if (signal.aborted || (err as Error)?.name === 'AbortError') {
				console.log('[Spectrogram] Superseded by new render');
				return;
			}
			console.error('[Spectrogram] Failed:', err);
			_status = 'Error.';
			phase = 'idle';
		} finally {
			if (currentController === myController) {
				currentController = null;
			}
		}
	}

	function computeStftMainThread(pcm: Float32Array, fftSize: number, hopSize: number): number[][] {
		const hannWindow = new Float32Array(fftSize);
		for (let n = 0; n < fftSize; n++) {
			hannWindow[n] = 0.5 * (1 - Math.cos((2 * Math.PI * n) / (fftSize - 1)));
		}
		const out: number[][] = [];
		for (let i = 0; i + fftSize <= pcm.length; i += hopSize) {
			const segment = pcm.slice(i, i + fftSize);
			for (let n = 0; n < fftSize; n++) segment[n] *= hannWindow[n];
			const mags = fft(Array.from(segment));
			const logRow = new Array<number>(mags.length);
			for (let n = 0; n < mags.length; n++) {
				logRow[n] = Math.log10(mags[n] + 1e-6);
			}
			out.push(logRow);
		}
		return out;
	}

	async function computeStftWithWorkers(
		pcm: Float32Array,
		fftSize: number,
		hopSize: number,
		expectedFrames: number,
		signal: AbortSignal
	): Promise<number[][]> {
		const halfSize = fftSize >> 1;
		const numWorkers = Math.max(1, Math.min(navigator.hardwareConcurrency || 4, expectedFrames));
		const framesPerWorker = Math.ceil(expectedFrames / numWorkers);
		console.log(`[spec-test] dispatching ${expectedFrames} frames across ${numWorkers} workers`);

		type WorkerChunk = { frameStart: number; frameCount: number; magnitudes: Float32Array };
		const tasks: Promise<WorkerChunk>[] = [];
		const workers: Worker[] = [];
		const rejecters: ((reason?: unknown) => void)[] = [];

		const onAbort = () => {
			for (const w of workers) w.terminate();
			for (const r of rejecters) r(new DOMException('aborted', 'AbortError'));
		};
		signal.addEventListener('abort', onAbort);

		const workerProgress = new Array(numWorkers).fill(0);
		pendingFramesTotal = expectedFrames;

		try {
			for (let w = 0; w < numWorkers; w++) {
				const frameStart = w * framesPerWorker;
				if (frameStart >= expectedFrames) break;
				const frameCount = Math.min(framesPerWorker, expectedFrames - frameStart);
				const pcmStart = frameStart * hopSize;
				const pcmEnd = (frameStart + frameCount - 1) * hopSize + fftSize;
				const pcmSlice = pcm.slice(pcmStart, pcmEnd);

				const worker = new Worker(new URL('../workers/stft.worker.ts', import.meta.url), {
					type: 'module'
				});
				workers.push(worker);

				tasks.push(
					new Promise<WorkerChunk>((resolve, reject) => {
						rejecters.push(reject);
						worker.onmessage = (e: MessageEvent<any>) => {
							const data = e.data;
							if (data.type === 'PROGRESS') {
								workerProgress[data.workerId] = data.framesComplete;
								pendingFramesDone = workerProgress.reduce((a, b) => a + b, 0);
								scheduleProgressUpdate();
								return;
							}
							workerProgress[data.workerId] = data.frameCount;
							pendingFramesDone = workerProgress.reduce((a, b) => a + b, 0);
							scheduleProgressUpdate();
							worker.terminate();
							resolve({
								frameStart: data.frameStart,
								frameCount: data.frameCount,
								magnitudes: data.magnitudes
							});
						};
						worker.onerror = (err) => {
							worker.terminate();
							reject(err);
						};
						worker.postMessage(
							{ workerId: w, pcm: pcmSlice, fftSize, hopSize, frameStart, frameCount },
							[pcmSlice.buffer]
						);
					})
				);
			}

			const chunks = await Promise.all(tasks);

			const spectrogram: number[][] = new Array(expectedFrames);
			for (const chunk of chunks) {
				for (let f = 0; f < chunk.frameCount; f++) {
					const row = new Array<number>(halfSize);
					const base = f * halfSize;
					for (let bin = 0; bin < halfSize; bin++) {
						row[bin] = chunk.magnitudes[base + bin];
					}
					spectrogram[chunk.frameStart + f] = row;
				}
			}
			return spectrogram;
		} finally {
			signal.removeEventListener('abort', onAbort);
		}
	}

	// Original inline naive DFT (O(N²)) — kept for reference. Same magnitudes
	// as the imported radix-2 fft() above, just ~93× more ops at fftSize=2048.
	// Hann window is applied inline (line `const windowed = ...`) so callers
	// pass raw segments. To revert, rename this back to `fft` and change the
	// STFT loop to `const mags = fft(segment);` with no separate Hann step.
	//
	// function fft(signal: Float32Array): number[] {
	// 	const N = signal.length;
	// 	const windowed = signal.map((v, i) => v * 0.5 * (1 - Math.cos((2 * Math.PI * i) / (N - 1))));
	// 	const out = new Float32Array(N / 2);
	//
	// 	for (let k = 0; k < N / 2; k++) {
	// 		let real = 0,
	// 			imag = 0;
	// 		for (let n = 0; n < N; n++) {
	// 			const angle = (2 * Math.PI * k * n) / N;
	// 			real += windowed[n] * Math.cos(angle);
	// 			imag -= windowed[n] * Math.sin(angle);
	// 		}
	// 		out[k] = Math.sqrt(real * real + imag * imag);
	// 	}
	// 	return Array.from(out);
	// }

	function drawSpectrogram(data: number[][], sampleRate: number) {
		if (!data.length || !data[0].length || !container) return;

		const margin = { top: 20, right: 75, bottom: 24, left: 55 };
		const aspectRatio = 21 / 9;
		const measured = container.getBoundingClientRect().width;
		const totalWidth = Math.max(300, Math.round(measured));
		const totalHeight = Math.round(totalWidth / aspectRatio);
		computedHeight = totalHeight;
		const width = totalWidth - margin.left - margin.right;
		const height = totalHeight - margin.top - margin.bottom;

		const wrapper = d3
			.create('div')
			.attr('class', 'spec-plot')
			.style('position', 'relative')
			.style('width', `${totalWidth}px`)
			.style('height', `${totalHeight}px`);

		const canvas = wrapper
			.append('canvas')
			.attr('width', width)
			.attr('height', height)
			.style('position', 'absolute')
			.style('top', `${margin.top}px`)
			.style('left', `${margin.left}px`)
			.node() as HTMLCanvasElement;
		const ctx = canvas.getContext('2d')!;

		const svg = wrapper
			.append('svg')
			.attr('class', 'spec-overlay')
			.attr('width', totalWidth)
			.attr('height', totalHeight)
			.style('position', 'absolute')
			.style('top', '0')
			.style('left', '0')
			.append('g')
			.attr('transform', `translate(${margin.left},${margin.top})`);

		const nFrames = data.length;
		const binCount = data[0].length;
		const binHz = sampleRate / 2 / binCount;

		// optimization fix: walk nested rows once tracking min/max instead of flattening to find extent — kills the ~1.2 GB allocation that OOM'd the 1h file
		console.time('[spec-test] min/max scan');
		let scanMin = Infinity;
		let scanMax = -Infinity;
		for (let i = 0; i < data.length; i++) {
			const row = data[i];
			for (let j = 0; j < row.length; j++) {
				const v = row[j];
				if (v < scanMin) scanMin = v;
				if (v > scanMax) scanMax = v;
			}
		}
		const colorDomain: [number, number] = [scanMin, scanMax];
		console.timeEnd('[spec-test] min/max scan');
		// Original (replaced for OOM fix at 1h scale; kept for JORS-window traceability):
		// const flat = data.flat();
		// const colorDomain = d3.extent(flat) as [number, number];
		const [domainMin, domainMax] = colorDomain;
		const domainSpan = domainMax - domainMin || 1;

		const LUT_SIZE = 256;
		const lut = new Uint8ClampedArray(LUT_SIZE * 3);
		for (let i = 0; i < LUT_SIZE; i++) {
			const c = d3.color(d3.interpolateTurbo(i / (LUT_SIZE - 1)))!.rgb();
			lut[i * 3] = c.r;
			lut[i * 3 + 1] = c.g;
			lut[i * 3 + 2] = c.b;
		}

		const imgData = ctx.createImageData(width, height);
		const pixels = imgData.data;
		const freqRange = maxFreq - minFreq;
		const lutMaxIdx = LUT_SIZE - 1;

		for (let py = 0; py < height; py++) {
			// y inverted: top of canvas = high freq.
			const freq = minFreq + (1 - py / (height - 1)) * freqRange;
			const bin = Math.round(freq / binHz);
			const rowOffset = py * width * 4;

			if (bin < 0 || bin >= binCount) continue;

			for (let px = 0; px < width; px++) {
				const frame = Math.min(nFrames - 1, Math.floor((px / width) * nFrames));
				const mag = data[frame][bin];
				const t = (mag - domainMin) / domainSpan;
				const lutIdx = Math.max(0, Math.min(lutMaxIdx, Math.floor(t * lutMaxIdx))) * 3;
				const idx = rowOffset + px * 4;
				pixels[idx] = lut[lutIdx];
				pixels[idx + 1] = lut[lutIdx + 1];
				pixels[idx + 2] = lut[lutIdx + 2];
				pixels[idx + 3] = 255;
			}
		}

		ctx.putImageData(imgData, 0, 0);

		const timeScale = d3.scaleLinear().domain([0, nFrames]).range([0, width]);
		const freqScale = d3.scaleLinear().domain([minFreq, maxFreq]).range([height, 0]);
		const colorScale = d3.scaleSequential(d3.interpolateTurbo).domain(colorDomain);

		svg
			.append('text')
			.attr('x', width / 2)
			.attr('y', -5)
			.attr('text-anchor', 'middle')
			.attr('font-size', '14px')
			.attr('font-weight', 'bold')
			.text(`${audioFileName.replace(/\.wav$/i, '')}: Spectrogram`);

		const xAxis = d3
			.axisBottom(timeScale)
			.ticks(10)
			.tickFormat((d) => `${(startTime + ((endTime - startTime) * +d) / nFrames).toFixed(1)}`);
		svg
			.append('g')
			.attr('transform', `translate(0, ${height})`)
			.call(xAxis)
			.append('text')
			.attr('x', width / 2)
			.attr('y', 22)
			.attr('fill', '#000')
			.attr('font-size', '10px')
			.style('text-anchor', 'middle')
			.text('Time (s)');

		const yAxis = d3
			.axisLeft(freqScale)
			.ticks(10)
			.tickFormat((d) => `${Math.round(d as number)}`);
		svg
			.append('g')
			.call(yAxis)
			.append('text')
			.attr('transform', 'rotate(-90)')
			.attr('x', -height / 2)
			.attr('y', -38)
			.attr('fill', '#000')
			.attr('font-size', '10px')
			.style('text-anchor', 'middle')
			.text('Frequency (Hz)');

		const legendHeight = height;
		const legendWidth = 20;
		const legendScale = d3.scaleLinear().domain(colorDomain).range([legendHeight, 0]);
		const legendAxis = d3
			.axisRight(legendScale)
			.ticks(6)
			.tickFormat((d) => Number(d).toFixed(2));

		const legend = svg.append('g').attr('transform', `translate(${width + 10}, 0)`);

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
				.attr('stop-color', colorScale(domainMin + t * (domainMax - domainMin)));
		});

		legend
			.append('rect')
			.attr('width', legendWidth)
			.attr('height', legendHeight)
			.style('fill', `url(#${gradientId})`);

		legend.append('g').attr('transform', `translate(${legendWidth}, 0)`).call(legendAxis);

		legend
			.append('text')
			.attr('x', legendWidth / 2)
			.attr('y', -10)
			.attr('fill', '#000')
			.attr('text-anchor', 'middle')
			.style('font-size', '10px')
			.text('Log Intensity');

		// eslint-disable-next-line svelte/no-dom-manipulating -- atomic swap is the flash fix; see commit history
		container.replaceChildren(wrapper.node()!);
	}
</script>

<div class="flex w-full flex-col gap-2">
	<div class="flex items-center justify-between gap-2">
		<div class="flex justify-start">
			{#if hasRendered && phase !== 'idle'}
				<div
					role="status"
					aria-live="polite"
					class="max-w-md rounded-lg bg-white px-3 py-2 text-xs shadow-sm ring-1 ring-gray-200 transition-all duration-300"
				>
					{#if phase === 'done'}
						<div class="flex items-center gap-2 font-medium text-green-700">
							<span aria-hidden="true" class="inline-block h-2 w-2 rounded-full bg-green-500"
							></span>
							<span>Spectrogram Ready</span>
						</div>
					{:else}
						<div class="flex items-center gap-2">
							<span class="font-medium text-gray-800">{phaseLabel}</span>
							<div
								role="progressbar"
								aria-valuemin="0"
								aria-valuemax="100"
								aria-valuenow={Math.round(progressPct)}
								class="h-1 w-32 overflow-hidden rounded-full bg-gray-200"
							>
								<div
									class="h-full rounded-full bg-blue-600 transition-all duration-200"
									style="width: {progressPct}%"
								></div>
							</div>
							<span class="tabular-nums text-gray-500">
								{Math.round(progressPct)}%{etaMs > 0 ? ` · ETA ${formatEta(etaMs)}` : ''}
							</span>
						</div>
					{/if}
				</div>
			{/if}
		</div>
		<div class="flex gap-2">
			<slot name="actions" />
		</div>
	</div>
	<div class="relative w-full" style="aspect-ratio: 21 / 9;">
		<div
			bind:this={container}
			role="img"
			aria-label={`${audioFileName.replace(/\.wav$/i, '')} spectrogram from ${startTime.toFixed(2)} to ${endTime.toFixed(2)} seconds, ${minFreq} to ${maxFreq} hertz`}
			class="spectrogram h-full w-full"
		></div>
		{#if !hasRendered && phase !== 'idle' && phase !== 'done'}
			<div
				role="status"
				aria-live="polite"
				aria-label={`${phaseLabel}, ${Math.round(progressPct)} percent complete`}
				class="absolute inset-0 flex items-center justify-center rounded-lg bg-gray-50"
			>
				<div class="w-3/4">
					<p class="mb-2 text-center text-sm font-medium text-gray-700">{phaseLabel}</p>
					<div
						role="progressbar"
						aria-valuemin="0"
						aria-valuemax="100"
						aria-valuenow={Math.round(progressPct)}
						class="h-3 w-full overflow-hidden rounded-full bg-gray-200"
					>
						<div
							class="h-full rounded-full bg-blue-600 transition-all duration-200"
							style="width: {progressPct}%"
						></div>
					</div>
					<p class="mt-1 text-center text-xs text-gray-500">
						{Math.round(progressPct)}%{etaMs > 0 ? ` · ETA ${formatEta(etaMs)}` : ''}
					</p>
				</div>
			</div>
		{/if}
	</div>
</div>
