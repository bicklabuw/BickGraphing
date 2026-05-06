<!--
  @component
  Description: Performance benchmark page — sweeps STFT timings across audio lengths,
  compares main-thread vs web-worker pipelines, renders spectrogram thumbnails per length,
  and persists per-machine calibration data for the FAQ predictions.

  @author K. Seow <kseow@wisc.edu>
  @contributors
  @created 2026-05-07
  @version 0.2.0
  @license MIT
-->
<script lang="ts">
	import * as d3 from 'd3';
	import { onMount } from 'svelte';
	import { fft } from '$lib/utils/fft';

	const SAMPLE_RATE = 44100;
	const FFT_SIZE = 2048;
	const HOP_SIZE = 1024;
	const STORAGE_KEY = 'bench-calibration-v1';
	const REFERENCE_LENGTHS = [5, 15, 30, 60, 300, 900, 1800, 2700];
	const WORKER_THRESHOLD_SEC = 20;

	type Signal = 'sine' | 'noise';
	type Result = {
		lengthSec: number;
		frames: number;
		mainMs: number;
		workerMs: number;
		savedMs: number;
		thumbnailUrl?: string;
	};

	const THUMB_W = 240;
	const THUMB_H = 96;
	const LUT_SIZE = 256;
	let turboLut: Uint8ClampedArray | null = null;
	function getTurboLut(): Uint8ClampedArray {
		if (turboLut) return turboLut;
		const lut = new Uint8ClampedArray(LUT_SIZE * 3);
		for (let i = 0; i < LUT_SIZE; i++) {
			const c = d3.color(d3.interpolateTurbo(i / (LUT_SIZE - 1)))!.rgb();
			lut[i * 3] = c.r;
			lut[i * 3 + 1] = c.g;
			lut[i * 3 + 2] = c.b;
		}
		turboLut = lut;
		return lut;
	}

	function renderThumbnail(
		magnitudes: Float32Array,
		frameCount: number,
		halfSize: number
	): string {
		if (frameCount === 0 || halfSize === 0) return '';
		let dMin = Infinity;
		let dMax = -Infinity;
		for (let i = 0; i < magnitudes.length; i++) {
			const v = magnitudes[i];
			if (v < dMin) dMin = v;
			if (v > dMax) dMax = v;
		}
		const span = dMax - dMin || 1;
		const lut = getTurboLut();
		const lutMaxIdx = LUT_SIZE - 1;

		const canvas = document.createElement('canvas');
		canvas.width = THUMB_W;
		canvas.height = THUMB_H;
		const ctx = canvas.getContext('2d')!;
		const img = ctx.createImageData(THUMB_W, THUMB_H);
		const px = img.data;

		for (let y = 0; y < THUMB_H; y++) {
			const bin = Math.min(halfSize - 1, Math.floor(((THUMB_H - 1 - y) / (THUMB_H - 1)) * (halfSize - 1)));
			const rowOffset = y * THUMB_W * 4;
			for (let x = 0; x < THUMB_W; x++) {
				const frame = Math.min(frameCount - 1, Math.floor((x / THUMB_W) * frameCount));
				const v = magnitudes[frame * halfSize + bin];
				const t = (v - dMin) / span;
				const lutIdx = Math.max(0, Math.min(lutMaxIdx, Math.floor(t * lutMaxIdx))) * 3;
				const idx = rowOffset + x * 4;
				px[idx] = lut[lutIdx];
				px[idx + 1] = lut[lutIdx + 1];
				px[idx + 2] = lut[lutIdx + 2];
				px[idx + 3] = 255;
			}
		}
		ctx.putImageData(img, 0, 0);
		return canvas.toDataURL('image/png');
	}

	const DEFAULT_LENGTHS = '0, 5, 15, 20, 25, 30, 60, 120, 300, 1800, 2700';
	let lengthsInput = DEFAULT_LENGTHS;

	function setDefaultLengths() {
		lengthsInput = DEFAULT_LENGTHS;
	}

	function setRandomLengths() {
		const MAX_SEC = 2700;
		const targetCount = 8;
		const set = new Set<number>([0]);
		let attempts = 0;
		while (set.size < targetCount && attempts < 100) {
			const r = Math.random();
			set.add(Math.max(1, Math.floor(Math.pow(r, 3) * MAX_SEC)));
			attempts++;
		}
		const arr = Array.from(set).sort((a, b) => a - b);
		lengthsInput = arr.join(', ');
	}
	let signal: Signal = 'sine';
	let workerCount = (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 4;
	let thresholdMs = 500;
	let running = false;
	let progress = '';
	let runFramesDone = 0;
	let runFramesTotal = 0;
	$: runProgressPct = runFramesTotal > 0 ? (runFramesDone / runFramesTotal) * 100 : 0;
	let results: Result[] = [];

	type Calibration = {
		savedAt: number;
		signal: Signal;
		workerCount: number;
		points: { lengthSec: number; mainMs: number; workerMs: number }[];
	};
	let calibration: Calibration | null = null;

	onMount(() => {
		try {
			const raw = localStorage.getItem(STORAGE_KEY);
			if (raw) calibration = JSON.parse(raw);
		} catch {
			calibration = null;
		}
	});

	function fitLinear(points: [number, number][]): { slope: number; intercept: number } | null {
		if (points.length < 2) return null;
		const n = points.length;
		let sumX = 0,
			sumY = 0,
			sumXY = 0,
			sumXX = 0;
		for (const [x, y] of points) {
			sumX += x;
			sumY += y;
			sumXY += x * y;
			sumXX += x * x;
		}
		const denom = n * sumXX - sumX * sumX;
		if (denom === 0) return null;
		const slope = (n * sumXY - sumX * sumY) / denom;
		const intercept = (sumY - slope * sumX) / n;
		return { slope, intercept };
	}

	$: mainFit = calibration ? fitLinear(calibration.points.map((p) => [p.lengthSec, p.mainMs])) : null;
	$: workerFit = calibration
		? fitLinear(calibration.points.map((p) => [p.lengthSec, p.workerMs]))
		: null;

	function predictedMs(lengthSec: number): number | null {
		const useWorker = lengthSec >= WORKER_THRESHOLD_SEC;
		const fit = useWorker ? workerFit : mainFit;
		if (!fit) return null;
		return Math.max(0, fit.slope * lengthSec + fit.intercept);
	}

	function formatLength(sec: number): string {
		if (sec < 60) return `${sec} s`;
		if (sec < 3600) return `${(sec / 60).toFixed(sec % 60 === 0 ? 0 : 1)} min`;
		return `${(sec / 3600).toFixed(1)} hr`;
	}

	function formatMs(ms: number | null): string {
		if (ms === null) return '—';
		if (ms < 1000) return `${Math.round(ms)} ms`;
		if (ms < 60000) return `${(ms / 1000).toFixed(2)} s`;
		const min = Math.floor(ms / 60000);
		const sec = ((ms % 60000) / 1000).toFixed(0);
		return `${min} min ${sec} s`;
	}

	function calibrationAge(): string {
		if (!calibration) return '';
		const ageMs = Date.now() - calibration.savedAt;
		const ageMin = Math.round(ageMs / 60000);
		if (ageMin < 1) return 'just now';
		if (ageMin < 60) return `${ageMin} min ago`;
		const ageHr = Math.round(ageMin / 60);
		if (ageHr < 24) return `${ageHr} hr ago`;
		const ageDay = Math.round(ageHr / 24);
		return `${ageDay} day${ageDay === 1 ? '' : 's'} ago`;
	}

	function parsedLengths(): number[] {
		return lengthsInput
			.split(/[,\s]+/)
			.map((s) => parseFloat(s.trim()))
			.filter((n) => !isNaN(n) && n >= 0);
	}

	function generatePCM(durationSec: number, kind: Signal): Float32Array {
		const n = Math.floor(SAMPLE_RATE * durationSec);
		const out = new Float32Array(n);
		if (kind === 'sine') {
			const k = (2 * Math.PI * 440) / SAMPLE_RATE;
			for (let i = 0; i < n; i++) out[i] = 0.5 * Math.sin(k * i);
		} else {
			for (let i = 0; i < n; i++) out[i] = (Math.random() * 2 - 1) * 0.5;
		}
		return out;
	}

	function buildHann(N: number): Float32Array {
		const w = new Float32Array(N);
		for (let n = 0; n < N; n++) w[n] = 0.5 * (1 - Math.cos((2 * Math.PI * n) / (N - 1)));
		return w;
	}

	function runMainThreadSTFT(pcm: Float32Array): { frames: number; ms: number } {
		const hann = buildHann(FFT_SIZE);
		const t0 = performance.now();
		const out: number[][] = [];
		for (let i = 0; i + FFT_SIZE <= pcm.length; i += HOP_SIZE) {
			const segment = pcm.slice(i, i + FFT_SIZE);
			for (let n = 0; n < FFT_SIZE; n++) segment[n] *= hann[n];
			const mags = Array.from(fft(Array.from(segment)));
			out.push(mags);
		}
		return { frames: out.length, ms: performance.now() - t0 };
	}

	async function runWorkerSTFT(
		pcm: Float32Array
	): Promise<{ frames: number; ms: number; magnitudes: Float32Array; halfSize: number }> {
		const halfSize = FFT_SIZE >> 1;
		const expectedFrames = Math.max(0, Math.floor((pcm.length - FFT_SIZE) / HOP_SIZE) + 1);
		if (expectedFrames === 0) return { frames: 0, ms: 0, magnitudes: new Float32Array(0), halfSize };

		runFramesDone = 0;
		runFramesTotal = expectedFrames;
		const workerProgress: number[] = [];

		const numWorkers = Math.max(1, Math.min(workerCount, expectedFrames));
		const framesPerWorker = Math.ceil(expectedFrames / numWorkers);
		console.log(
			`[bench] dispatching ${expectedFrames.toLocaleString()} frames across ${numWorkers} worker(s), ~${framesPerWorker} per worker`
		);

		const t0 = performance.now();
		type Chunk = { frameStart: number; frameCount: number; magnitudes: Float32Array };
		const tasks: Promise<Chunk>[] = [];

		for (let w = 0; w < numWorkers; w++) {
			const frameStart = w * framesPerWorker;
			if (frameStart >= expectedFrames) break;
			const frameCount = Math.min(framesPerWorker, expectedFrames - frameStart);
			const pcmStart = frameStart * HOP_SIZE;
			const pcmEnd = (frameStart + frameCount - 1) * HOP_SIZE + FFT_SIZE;
			const pcmSlice = pcm.slice(pcmStart, pcmEnd);

			const worker = new Worker(new URL('../../lib/workers/stft.worker.ts', import.meta.url), {
				type: 'module'
			});

			workerProgress[w] = 0;
			tasks.push(
				new Promise<Chunk>((resolve, reject) => {
					worker.onmessage = (e: MessageEvent<any>) => {
						const data = e.data;
						if (data.type === 'PROGRESS') {
							workerProgress[data.workerId] = data.framesComplete;
							runFramesDone = workerProgress.reduce((a, b) => a + b, 0);
							return;
						}
						workerProgress[data.workerId] = data.frameCount;
						runFramesDone = workerProgress.reduce((a, b) => a + b, 0);
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
						{ workerId: w, pcm: pcmSlice, fftSize: FFT_SIZE, hopSize: HOP_SIZE, frameStart, frameCount },
						[pcmSlice.buffer]
					);
				})
			);
		}

		const chunks = await Promise.all(tasks);
		const totalFrames = chunks.reduce((sum, c) => sum + c.frameCount, 0);
		const ms = performance.now() - t0;

		const combined = new Float32Array(totalFrames * halfSize);
		for (const chunk of chunks) {
			combined.set(chunk.magnitudes, chunk.frameStart * halfSize);
		}
		return { frames: totalFrames, ms, magnitudes: combined, halfSize };
	}

	async function bench() {
		const lengths = parsedLengths();
		if (!lengths.length) return;

		running = true;
		results = [];

		console.log(`[bench] starting sweep — lengths=[${lengths.join(', ')}] signal=${signal} workers=${workerCount}`);
		const sweepStart = performance.now();

		progress = 'Warming up...';
		console.log('[bench] warmup (2s) — pre-JIT compile');
		await new Promise((r) => setTimeout(r, 0));
		const warm = generatePCM(2, signal);
		runMainThreadSTFT(warm);
		await runWorkerSTFT(warm);
		console.log('[bench] warmup done');

		for (const lengthSec of lengths) {
			progress = `Running ${lengthSec}s (${signal})...`;
			const lengthStart = performance.now();
			const expectedSamples = Math.floor(SAMPLE_RATE * lengthSec);
			const expectedFrames = Math.max(0, Math.floor((expectedSamples - FFT_SIZE) / HOP_SIZE) + 1);
			const pcmMb = (expectedSamples * 4) / 1024 / 1024;
			console.log(
				`[bench] length=${lengthSec}s — samples=${expectedSamples.toLocaleString()} frames=${expectedFrames.toLocaleString()} pcm=${pcmMb.toFixed(1)}MB`
			);
			await new Promise((r) => setTimeout(r, 0));

			console.time(`[bench] ${lengthSec}s generatePCM`);
			const pcm = generatePCM(lengthSec, signal);
			console.timeEnd(`[bench] ${lengthSec}s generatePCM`);

			console.time(`[bench] ${lengthSec}s main-thread STFT`);
			const main = runMainThreadSTFT(pcm);
			console.timeEnd(`[bench] ${lengthSec}s main-thread STFT`);
			console.log(`[bench] ${lengthSec}s main-thread: ${main.ms.toFixed(0)}ms, ${main.frames} frames`);

			await new Promise((r) => setTimeout(r, 0));

			console.time(`[bench] ${lengthSec}s worker STFT`);
			const wkr = await runWorkerSTFT(pcm);
			console.timeEnd(`[bench] ${lengthSec}s worker STFT`);
			console.log(`[bench] ${lengthSec}s worker: ${wkr.ms.toFixed(0)}ms, ${wkr.frames} frames`);

			console.time(`[bench] ${lengthSec}s thumbnail`);
			const thumbnailUrl = renderThumbnail(wkr.magnitudes, wkr.frames, wkr.halfSize);
			console.timeEnd(`[bench] ${lengthSec}s thumbnail`);

			console.log(
				`[bench] length=${lengthSec}s — TOTAL ${(performance.now() - lengthStart).toFixed(0)}ms`
			);

			results = [
				...results,
				{
					lengthSec,
					frames: main.frames,
					mainMs: main.ms,
					workerMs: wkr.ms,
					savedMs: main.ms - wkr.ms,
					thumbnailUrl
				}
			];
		}

		console.log(`[bench] sweep done — total ${((performance.now() - sweepStart) / 1000).toFixed(1)}s`);

		const calibPoints = results
			.filter((r) => r.lengthSec > 0 && r.frames > 0)
			.map((r) => ({ lengthSec: r.lengthSec, mainMs: r.mainMs, workerMs: r.workerMs }));
		if (calibPoints.length >= 2) {
			calibration = {
				savedAt: Date.now(),
				signal,
				workerCount,
				points: calibPoints
			};
			try {
				localStorage.setItem(STORAGE_KEY, JSON.stringify(calibration));
				console.log('[bench] calibration saved to localStorage');
			} catch {
				console.warn('[bench] could not persist calibration to localStorage');
			}
		}

		progress = 'Done.';
		runFramesDone = 0;
		runFramesTotal = 0;
		running = false;
	}

	function verdict(r: Result): string {
		if (r.savedMs > thresholdMs) return '✅ web workers';
		if (r.savedMs < -thresholdMs) return '❌ main-thread';
		return '— either';
	}

	function toMarkdown(): string {
		const header =
			'| Length (s) | Frames | Main-thread (ms) | Web workers (ms) | Saved (ms) | Verdict |';
		const sep = '|---|---|---|---|---|---|';
		const rows = results.map(
			(r) =>
				`| ${r.lengthSec} | ${r.frames} | ${r.mainMs.toFixed(0)} | ${r.workerMs.toFixed(0)} | ${r.savedMs.toFixed(0)} | ${verdict(r)} |`
		);
		const meta = `_Signal: ${signal}, Web workers: ${workerCount}, Verdict threshold: ${thresholdMs} ms saved._`;
		return [meta, '', header, sep, ...rows].join('\n');
	}

	async function copyMarkdown() {
		try {
			await navigator.clipboard.writeText(toMarkdown());
			progress = 'Copied Markdown to clipboard.';
		} catch {
			progress = 'Clipboard write failed — copy from the table manually.';
		}
	}

	const plotWidth = 700;
	const plotHeight = 320;
	const plotMargin = { top: 20, right: 120, bottom: 40, left: 70 };
	$: plotInnerW = plotWidth - plotMargin.left - plotMargin.right;
	$: plotInnerH = plotHeight - plotMargin.top - plotMargin.bottom;

	$: xMax = results.length ? (d3.max(results, (r) => r.lengthSec) as number) : 1;
	$: yMax = results.length
		? (d3.max(results, (r) => Math.max(r.mainMs, r.workerMs)) as number)
		: 1;
	$: xScale = d3.scaleLinear().domain([0, xMax]).nice().range([0, plotInnerW]);
	$: yScale = d3.scaleLinear().domain([0, yMax]).nice().range([plotInnerH, 0]);

	$: mainPath = d3
		.line<Result>()
		.x((r) => xScale(r.lengthSec))
		.y((r) => yScale(r.mainMs))(results);
	$: workerPath = d3
		.line<Result>()
		.x((r) => xScale(r.lengthSec))
		.y((r) => yScale(r.workerMs))(results);
</script>

<div class="mx-auto max-w-4xl p-6">
	<h1 class="mb-2 text-2xl font-bold">STFT benchmark — main-thread vs web workers</h1>
	<p class="mb-3 text-sm text-gray-600">
		Generates synthetic PCM at each length, runs the same STFT (n_fft={FFT_SIZE}, hop={HOP_SIZE}) twice, and reports
		timings. Find the audio length where web worker savings exceed the verdict threshold.
	</p>
	<p class="mb-4 text-sm text-gray-600">
		Web workers parallelize the STFT computation across CPU cores instead of blocking the main thread, but spawning
		them has fixed overhead (~50–300 ms total to start the workers and transfer data). For short audio that overhead
		can exceed the savings; for long audio the parallel speedup wins. The crossover is machine-specific — the verdict
		column tells you per-row which approach is worth it on this machine, given the threshold you set for "noticeable."
	</p>

	<div class="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
		<div class="mb-2 flex items-baseline justify-between">
			<h2 class="text-base font-semibold">Predicted spectrogram time per file length</h2>
			<span class="text-xs text-gray-500">
				{#if calibration}
					Calibrated {calibrationAge()} from your last sweep ({calibration.points.length} data
					points, signal: {calibration.signal})
				{:else}
					Run a benchmark below to calibrate this table for your machine.
				{/if}
			</span>
		</div>
		<table class="w-full text-sm">
			<thead class="text-left text-gray-700">
				<tr>
					<th class="px-2 py-1">File length</th>
					<th class="px-2 py-1">Predicted time</th>
					<th class="px-2 py-1 text-xs font-normal text-gray-500">Path used</th>
				</tr>
			</thead>
			<tbody>
				{#each REFERENCE_LENGTHS as len}
					<tr class="border-t border-gray-200">
						<td class="px-2 py-1 font-medium">{formatLength(len)}</td>
						<td class="px-2 py-1 tabular-nums">{formatMs(predictedMs(len))}</td>
						<td class="px-2 py-1 text-xs text-gray-500">
							{len >= WORKER_THRESHOLD_SEC ? 'web workers' : 'main-thread'}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
		<p class="mt-2 text-xs text-gray-500">
			Linear extrapolation from your last benchmark sweep. Same STFT algorithm and same web workers
			the spectrogram tool uses, so predictions should be within ~10–20% of actual.
		</p>
	</div>

	<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
		<div class="flex flex-col text-sm">
			<div class="flex items-center justify-between gap-2">
				<span class="font-medium">Lengths (sec)</span>
				<div class="flex gap-1">
					<button
						type="button"
						on:click={setDefaultLengths}
						disabled={running}
						class="rounded border border-green-500 bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 transition hover:bg-green-100 disabled:opacity-50"
					>
						Default
					</button>
					<button
						type="button"
						on:click={setRandomLengths}
						disabled={running}
						class="holo-button relative rounded px-2 py-0.5 text-xs font-bold text-white disabled:opacity-50"
					>
						<span class="sparkle sparkle-1">✨</span>
						<span class="sparkle sparkle-2">✨</span>
						<span class="sparkle sparkle-3">✨</span>
						<span class="sparkle sparkle-4">✨</span>
						Random
					</button>
				</div>
			</div>
			<input
				type="text"
				bind:value={lengthsInput}
				class="mt-1 rounded border border-gray-300 px-2 py-1"
				disabled={running}
			/>
		</div>
		<label class="flex flex-col text-sm">
			<span class="font-medium">Signal</span>
			<select
				bind:value={signal}
				class="mt-1 rounded border border-gray-300 px-2 py-1"
				disabled={running}
			>
				<option value="sine">sine</option>
				<option value="noise">noise</option>
			</select>
		</label>
		<label class="flex flex-col text-sm">
			<span class="font-medium">Web workers</span>
			<span class="text-xs text-gray-500">
				Auto-detected from your browser via
				<a
					href="https://developer.mozilla.org/en-US/docs/Web/API/Navigator/hardwareConcurrency"
					target="_blank"
					rel="noopener noreferrer"
					class="text-green-700 underline hover:text-green-800"
				>
					<code>navigator.hardwareConcurrency</code>
				</a>; override to test other counts.
			</span>
			<input
				type="number"
				bind:value={workerCount}
				min="1"
				max="32"
				class="mt-1 rounded border border-gray-300 px-2 py-1"
				disabled={running}
			/>
		</label>
		<label class="flex flex-col text-sm">
			<span class="font-medium">Verdict threshold (ms saved)</span>
			<span class="text-xs text-gray-500">
				<code>ms</code> = milliseconds (1/1000 of a second). 500&nbsp;ms is where the speedup
				becomes perceptible, and it's above the ~50–300&nbsp;ms worker spawn cost.
			</span>
			<input
				type="number"
				bind:value={thresholdMs}
				min="0"
				class="mt-1 rounded border border-gray-300 px-2 py-1"
				disabled={running}
			/>
		</label>
	</div>

	<div class="mt-4 flex items-center gap-3">
		<button
			on:click={bench}
			disabled={running}
			class="rounded bg-green-600 px-4 py-2 text-sm font-medium text-white disabled:bg-gray-400"
		>
			{running ? 'Running…' : 'Run benchmark'}
		</button>
		{#if results.length}
			<button
				on:click={copyMarkdown}
				class="rounded border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
			>
				Copy as Markdown
			</button>
		{/if}
		<span class="text-sm text-gray-600">{progress}</span>
	</div>

	{#if running && runFramesTotal > 0}
		<div class="mt-3">
			<div class="mb-1 flex items-baseline justify-between text-xs text-gray-600">
				<span>Worker STFT progress</span>
				<span class="tabular-nums"
					>{runFramesDone.toLocaleString()} / {runFramesTotal.toLocaleString()} frames ({Math.round(
						runProgressPct
					)}%)</span
				>
			</div>
			<div class="h-2 w-full overflow-hidden rounded-full bg-gray-200">
				<div
					class="h-full rounded-full bg-green-600 transition-all duration-150"
					style="width: {runProgressPct}%"
				></div>
			</div>
		</div>
	{/if}

	{#if results.length}
		<table class="mt-6 w-full text-sm">
			<thead class="bg-gray-100 text-left">
				<tr>
					<th class="px-2 py-1">Length (s)</th>
					<th class="px-2 py-1">Frames</th>
					<th class="px-2 py-1">Main-thread (ms)</th>
					<th class="px-2 py-1">Web workers (ms)</th>
					<th class="px-2 py-1">Saved (ms)</th>
					<th class="px-2 py-1">Verdict</th>
					<th class="px-2 py-1">Spectrogram</th>
				</tr>
			</thead>
			<tbody>
				{#each results as r}
					<tr class="border-t border-gray-200 align-middle">
						<td class="px-2 py-1">{r.lengthSec}</td>
						<td class="px-2 py-1">{r.frames}</td>
						<td class="px-2 py-1">{r.mainMs.toFixed(0)}</td>
						<td class="px-2 py-1">{r.workerMs.toFixed(0)}</td>
						<td class="px-2 py-1">{r.savedMs.toFixed(0)}</td>
						<td class="px-2 py-1">{verdict(r)}</td>
						<td class="px-2 py-1">
							{#if r.thumbnailUrl}
								<a
									href={r.thumbnailUrl}
									download={`spectrogram_${signal}_${r.lengthSec}s.png`}
									title="Click to download as PNG"
								>
									<img
										src={r.thumbnailUrl}
										alt={`spectrogram for ${r.lengthSec}s ${signal}`}
										class="rounded border border-gray-300 transition hover:border-green-500"
										width={THUMB_W}
										height={THUMB_H}
									/>
								</a>
							{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>

		<h2 class="mt-8 mb-2 text-lg font-bold">Time vs audio length</h2>
		<svg width={plotWidth} height={plotHeight} class="rounded border border-gray-200 bg-white">
			<g transform="translate({plotMargin.left}, {plotMargin.top})">
				{#each yScale.ticks(5) as tick}
					<line
						x1={0}
						y1={yScale(tick)}
						x2={plotInnerW}
						y2={yScale(tick)}
						stroke="#e5e7eb"
						stroke-width="1"
					/>
					<text
						x={-8}
						y={yScale(tick)}
						text-anchor="end"
						dominant-baseline="middle"
						font-size="10"
						fill="#374151"
					>
						{tick}
					</text>
				{/each}
				{#each xScale.ticks(6) as tick}
					<line
						x1={xScale(tick)}
						y1={0}
						x2={xScale(tick)}
						y2={plotInnerH}
						stroke="#f3f4f6"
						stroke-width="1"
					/>
					<line
						x1={xScale(tick)}
						y1={plotInnerH}
						x2={xScale(tick)}
						y2={plotInnerH + 5}
						stroke="#374151"
					/>
					<text
						x={xScale(tick)}
						y={plotInnerH + 18}
						text-anchor="middle"
						font-size="10"
						fill="#374151"
					>
						{tick}s
					</text>
				{/each}

				<line x1={0} y1={0} x2={0} y2={plotInnerH} stroke="#374151" />
				<line x1={0} y1={plotInnerH} x2={plotInnerW} y2={plotInnerH} stroke="#374151" />

				<text
					transform="translate(-50, {plotInnerH / 2}) rotate(-90)"
					text-anchor="middle"
					font-size="11"
					fill="#374151"
				>
					Time (ms)
				</text>
				<text
					x={plotInnerW / 2}
					y={plotInnerH + 32}
					text-anchor="middle"
					font-size="11"
					fill="#374151"
				>
					Audio length (s)
				</text>

				{#if mainPath}
					<path d={mainPath} fill="none" stroke="#3b82f6" stroke-width="2" />
				{/if}
				{#if workerPath}
					<path d={workerPath} fill="none" stroke="#16a34a" stroke-width="2" />
				{/if}

				{#each results as r}
					<circle cx={xScale(r.lengthSec)} cy={yScale(r.mainMs)} r="3" fill="#3b82f6" />
					<circle cx={xScale(r.lengthSec)} cy={yScale(r.workerMs)} r="3" fill="#16a34a" />
				{/each}

				<g transform="translate({plotInnerW + 12}, 0)">
					<line x1={0} y1={6} x2={16} y2={6} stroke="#3b82f6" stroke-width="2" />
					<text x={20} y={6} dominant-baseline="middle" font-size="11" fill="#374151">
						Main-thread
					</text>
					<line x1={0} y1={26} x2={16} y2={26} stroke="#16a34a" stroke-width="2" />
					<text x={20} y={26} dominant-baseline="middle" font-size="11" fill="#374151">
						Web workers
					</text>
				</g>
			</g>
		</svg>

		<pre class="mt-4 overflow-auto rounded bg-gray-50 p-3 text-xs">{toMarkdown()}</pre>
	{/if}
</div>

<style>
	.holo-button {
		position: relative;
		background: linear-gradient(
			90deg,
			#ff0080,
			#ff8c00,
			#ffd700,
			#00ff80,
			#00bfff,
			#8a2be2,
			#ff0080
		);
		background-size: 400% 100%;
		animation: holo-shimmer 8s linear infinite;
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
		box-shadow: 0 0 8px rgba(255, 100, 200, 0.4);
	}
	.holo-button::after {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: inherit;
		background: linear-gradient(
			110deg,
			transparent 30%,
			rgba(255, 255, 255, 0.55) 50%,
			transparent 70%
		);
		background-size: 250% 100%;
		animation: holo-shine 4s linear infinite;
		animation-play-state: paused;
		mix-blend-mode: overlay;
		pointer-events: none;
		opacity: 0;
		transition: opacity 0.3s ease;
	}
	.holo-button:hover::after {
		animation-play-state: running;
		opacity: 1;
	}
	.holo-button > * {
		position: relative;
		z-index: 1;
	}
	@keyframes holo-shimmer {
		from {
			background-position: 0% 50%;
		}
		to {
			background-position: 400% 50%;
		}
	}
	@keyframes holo-shine {
		from {
			background-position: 250% 50%;
		}
		to {
			background-position: -50% 50%;
		}
	}
	.sparkle {
		position: absolute;
		font-size: 0.6rem;
		pointer-events: none;
		animation: sparkle-twinkle 1.6s ease-in-out infinite;
	}
	.sparkle-1 {
		top: -6px;
		left: -4px;
		animation-delay: 0s;
	}
	.sparkle-2 {
		top: -6px;
		right: -4px;
		animation-delay: 0.4s;
	}
	.sparkle-3 {
		bottom: -6px;
		left: 30%;
		animation-delay: 0.8s;
	}
	.sparkle-4 {
		bottom: -6px;
		right: 8%;
		animation-delay: 1.2s;
	}
	@keyframes sparkle-twinkle {
		0%,
		100% {
			opacity: 0;
			transform: scale(0.4) rotate(0deg);
		}
		50% {
			opacity: 1;
			transform: scale(1.3) rotate(180deg);
		}
	}
</style>
