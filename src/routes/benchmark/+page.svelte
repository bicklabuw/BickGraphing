<!--
  @component
  Description: Performance benchmark page — sweeps STFT timings across audio lengths,
  compares main-thread vs web-worker pipelines, renders spectrogram thumbnails per length,
  and reports per-machine results in a fresh markdown table each run. No data is persisted.

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
	const REFERENCE_LENGTHS = [5, 15, 30, 60, 300, 900, 1800, 2700];
	const WORKER_THRESHOLD_SEC = 20;

	type Signal = 'sine' | 'noise' | 'siren';
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

	function renderThumbnail(magnitudes: Float32Array, frameCount: number, halfSize: number): string {
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
			const bin = Math.min(
				halfSize - 1,
				Math.floor(((THUMB_H - 1 - y) / (THUMB_H - 1)) * (halfSize - 1))
			);
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

	const DEFAULT_LENGTHS = '5, 15, 20, 25, 30, 60, 120, 300, 1800, 2700';
	let lengthsInput = DEFAULT_LENGTHS;

	function setDefaultLengths() {
		lengthsInput = DEFAULT_LENGTHS;
	}

	function setRandomLengths() {
		const MAX_SEC = 2700;
		const targetCount = 8;
		const set = new Set<number>();
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
	let sineFreq = 440;
	let sirenMinFreq = 200;
	let sirenMaxFreq = 8000;
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
	let machineInfo = '';

	onMount(() => {
		try {
			localStorage.removeItem('bench-calibration-v1');
		} catch {
			// ignore: localStorage may be unavailable (private mode, no storage permissions, etc.)
		}
		machineInfo = describeMachine();
	});

	function describeMachine(): string {
		if (typeof navigator === 'undefined') return '';
		const ua = navigator.userAgent;
		let browser = 'Unknown browser';
		const browserMatch =
			ua.match(/Edg\/(\d+\.\d+)/) ||
			ua.match(/OPR\/(\d+\.\d+)/) ||
			ua.match(/Firefox\/(\d+\.\d+)/) ||
			ua.match(/Chrome\/(\d+\.\d+)/) ||
			(!ua.includes('Chrome') ? ua.match(/Version\/(\d+\.\d+).*Safari/) : null);
		if (ua.includes('Edg/')) browser = `Edge ${browserMatch?.[1] ?? ''}`.trim();
		else if (ua.includes('OPR/') || ua.includes('Opera'))
			browser = `Opera ${browserMatch?.[1] ?? ''}`.trim();
		else if (ua.includes('Firefox/')) browser = `Firefox ${browserMatch?.[1] ?? ''}`.trim();
		else if (ua.includes('Chrome/')) browser = `Chrome ${browserMatch?.[1] ?? ''}`.trim();
		else if (ua.includes('Safari/')) browser = `Safari ${browserMatch?.[1] ?? ''}`.trim();

		let os = 'Unknown OS';
		if (ua.includes('Windows NT 10')) os = 'Windows 10/11';
		else if (ua.includes('Windows')) os = 'Windows';
		else if (ua.includes('Mac OS X')) os = 'macOS';
		else if (ua.includes('Android')) os = 'Android';
		else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
		else if (ua.includes('Linux')) os = 'Linux';

		const parts = [`${browser} on ${os}`];
		const cores = navigator.hardwareConcurrency;
		if (cores) parts.push(`${cores} CPU cores`);
		const memory = (navigator as unknown as { deviceMemory?: number }).deviceMemory;
		if (memory) parts.push(`${memory} GB RAM`);
		return parts.join(', ');
	}

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

	$: mainFit = calibration
		? fitLinear(calibration.points.map((p) => [p.lengthSec, p.mainMs]))
		: null;
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
		if (ms === null) return 'n/a';
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

	const RISKY_LENGTH_SEC = 1800;
	const LENGTH_CAP_SEC = 2700;

	function rawParsedLengths(input: string): number[] {
		return input
			.split(/[,\s]+/)
			.map((s) => parseFloat(s.trim()))
			.filter((n) => !isNaN(n) && n >= 0);
	}

	function parsedLengths(input: string = lengthsInput): number[] {
		return rawParsedLengths(input).filter((n) => n <= LENGTH_CAP_SEC);
	}

	$: parsedLengthChips = parsedLengths(lengthsInput);
	$: overCapCount = rawParsedLengths(lengthsInput).filter((n) => n > LENGTH_CAP_SEC).length;

	function removeLengthAt(idx: number) {
		const next = parsedLengthChips.filter((_, i) => i !== idx);
		lengthsInput = next.join(', ');
	}

	function generatePCM(durationSec: number, kind: Signal): Float32Array {
		const n = Math.floor(SAMPLE_RATE * durationSec);
		const out = new Float32Array(n);
		if (kind === 'sine') {
			const k = (2 * Math.PI * sineFreq) / SAMPLE_RATE;
			for (let i = 0; i < n; i++) out[i] = 0.5 * Math.sin(k * i);
		} else if (kind === 'siren') {
			const T = n / SAMPLE_RATE;
			const fMin = sirenMinFreq;
			const fDelta = sirenMaxFreq - sirenMinFreq;
			for (let i = 0; i < n; i++) {
				const t = i / SAMPLE_RATE;
				const phase = 2 * Math.PI * (fMin * t + (fDelta * t * t) / (2 * T));
				out[i] = 0.5 * Math.sin(phase);
			}
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
		if (expectedFrames === 0)
			return { frames: 0, ms: 0, magnitudes: new Float32Array(0), halfSize };

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
						{
							workerId: w,
							pcm: pcmSlice,
							fftSize: FFT_SIZE,
							hopSize: HOP_SIZE,
							frameStart,
							frameCount
						},
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

		console.log(
			`[bench] starting sweep — lengths=[${lengths.join(', ')}] signal=${signal} workers=${workerCount}`
		);
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
			console.log(
				`[bench] ${lengthSec}s main-thread: ${main.ms.toFixed(0)}ms, ${main.frames} frames`
			);

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

		console.log(
			`[bench] sweep done — total ${((performance.now() - sweepStart) / 1000).toFixed(1)}s`
		);

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
		}

		progress = 'Done.';
		runFramesDone = 0;
		runFramesTotal = 0;
		running = false;
	}

	function verdict(r: Result): string {
		if (r.savedMs > thresholdMs) return '✅ web workers';
		if (r.savedMs < -thresholdMs) return '❌ main-thread';
		return '➖ either';
	}

	function toMarkdown(): string {
		const header =
			'| Length (s) | Frames | Main-thread (ms) | Web workers (ms) | Saved (ms) | Verdict |';
		const sep = '|---|---|---|---|---|---|';
		const rows = results.map(
			(r) =>
				`| ${r.lengthSec} | ${r.frames} | ${r.mainMs.toFixed(0)} | ${r.workerMs.toFixed(0)} | ${r.savedMs.toFixed(0)} | ${verdict(r)} |`
		);
		const machine = machineInfo ? `_Machine: ${machineInfo}._` : '';
		const sigDesc =
			signal === 'sine'
				? `sine (${sineFreq} Hz)`
				: signal === 'siren'
					? `siren (${sirenMinFreq} to ${sirenMaxFreq} Hz)`
					: 'noise';
		const meta = `_Signal: ${sigDesc}, Web workers: ${workerCount}, Verdict threshold: ${thresholdMs} ms saved._`;
		return [machine, meta, '', header, sep, ...rows].filter(Boolean).join('\n');
	}

	async function copyMarkdown() {
		try {
			await navigator.clipboard.writeText(toMarkdown());
			progress = 'Copied Markdown to clipboard.';
		} catch {
			progress = 'Clipboard write failed. Copy from the table manually.';
		}
	}

	const plotWidth = 700;
	const plotHeight = 320;
	const plotMargin = { top: 20, right: 120, bottom: 40, left: 70 };
	const plotInnerW = plotWidth - plotMargin.left - plotMargin.right;
	const plotInnerH = plotHeight - plotMargin.top - plotMargin.bottom;

	$: xMax = results.length ? (d3.max(results, (r) => r.lengthSec) as number) : 1;
	$: yMax = results.length ? (d3.max(results, (r) => Math.max(r.mainMs, r.workerMs)) as number) : 1;
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
	<h1 class="mb-2 text-2xl font-bold">STFT benchmark: main-thread vs web workers</h1>
	<p class="mb-3 text-sm text-gray-600">
		Generates synthetic PCM at each length, runs the same STFT (n_fft={FFT_SIZE}, hop={HOP_SIZE})
		twice, and reports timings. Find the audio length where web worker savings exceed the verdict
		threshold.
	</p>
	<p class="mb-4 text-sm text-gray-600">
		Web workers parallelize the STFT computation across CPU cores instead of blocking the main
		thread, but spawning them has fixed overhead (~50–300 ms total to start the workers and transfer
		data). For short audio that overhead can exceed the savings; for long audio the parallel speedup
		wins. The crossover is machine-specific. The verdict column tells you per-row which approach is
		worth it on this machine, given the threshold you set for "noticeable."
	</p>

	<div class="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
		<div class="mb-2 flex items-baseline justify-between">
			<h2 class="text-base font-semibold">Predicted spectrogram time per file length</h2>
			<span class="text-xs text-gray-500">
				{#if calibration}
					Calibrated {calibrationAge()} from your last sweep ({calibration.points.length} data points,
					signal: {calibration.signal})
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
				{#each REFERENCE_LENGTHS as len (len)}
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

	<div
		role="alert"
		class="mb-4 rounded-lg border-2 border-red-400 bg-red-50 p-3 text-sm text-red-800"
	>
		<p class="font-bold">⚠ Warning: long lengths can hang the page</p>
		<p class="mt-1">
			Each length runs the STFT once on the main thread (no worker), then once with workers. The
			main-thread pass blocks the UI for the full duration, and very large values (roughly
			1800&nbsp;s and above) can crash the tab on slower machines and require a fresh reload. Start
			with smaller values and only add long durations once you know your machine handles them.
		</p>
	</div>

	<div class="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
						class="random-shine relative overflow-hidden rounded border border-purple-500 bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700 transition hover:bg-purple-100 disabled:opacity-50"
					>
						Random
					</button>
				</div>
			</div>
			<span class="text-xs text-gray-500">
				Comma- or space-separated audio durations to benchmark. Click Default for a curated set, or
				Random for a fresh sample.
			</span>
			<input
				type="text"
				bind:value={lengthsInput}
				class="mt-auto rounded border border-gray-300 px-2 py-1"
				disabled={running}
			/>
			{#if parsedLengthChips.length > 0}
				<div class="mt-1.5 flex flex-wrap gap-1" aria-label="Parsed lengths">
					{#each parsedLengthChips as len, i (i + '-' + len)}
						{#if len >= RISKY_LENGTH_SEC}
							<span
								class="inline-flex items-center gap-1 rounded-full border border-red-400 bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700"
								title="May hang or crash the tab on slower machines."
							>
								⚠ {len}s
								<button
									type="button"
									on:click={() => removeLengthAt(i)}
									disabled={running}
									aria-label={`Remove ${len}s`}
									class="-mr-0.5 ml-0.5 rounded-full px-1 leading-none text-red-500 transition hover:bg-red-100 hover:text-red-800 disabled:opacity-50"
								>
									×
								</button>
							</span>
						{:else}
							<span
								class="inline-flex items-center gap-1 rounded-full border border-gray-300 bg-white px-2 py-0.5 text-[11px] text-gray-700"
							>
								{len}s
								<button
									type="button"
									on:click={() => removeLengthAt(i)}
									disabled={running}
									aria-label={`Remove ${len}s`}
									class="-mr-0.5 ml-0.5 rounded-full px-1 leading-none text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
								>
									×
								</button>
							</span>
						{/if}
					{/each}
				</div>
				{#if overCapCount > 0}
					<p class="mt-1 text-[11px] text-red-700">
						{overCapCount}
						{overCapCount === 1 ? 'value' : 'values'} above the {LENGTH_CAP_SEC}s cap will be
						ignored.
					</p>
				{/if}
			{/if}
		</div>
		<label class="flex flex-col text-sm">
			<span class="font-medium">Signal</span>
			<span class="text-xs text-gray-500">
				Synthetic input the benchmark generates fresh per run: <code>sine</code> = pure tone,
				<code>siren</code> = linear frequency sweep, <code>noise</code> = uniform random PCM.
			</span>
			<select
				bind:value={signal}
				class="mt-auto rounded border border-gray-300 px-2 py-1"
				disabled={running}
			>
				<option value="sine">sine</option>
				<option value="siren">siren</option>
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
				class="mt-auto rounded border border-gray-300 px-2 py-1"
				disabled={running}
			/>
		</label>
		<label class="flex flex-col text-sm">
			<span class="font-medium">Verdict threshold (ms saved)</span>
			<span class="text-xs text-gray-500">
				<code>ms</code> = milliseconds (1/1000 of a second). 500&nbsp;ms is where the speedup becomes
				perceptible, and it's above the ~50–300&nbsp;ms worker spawn cost.
			</span>
			<input
				type="number"
				bind:value={thresholdMs}
				min="0"
				class="mt-auto rounded border border-gray-300 px-2 py-1"
				disabled={running}
			/>
		</label>
	</div>

	{#if signal === 'sine'}
		<div class="mt-3 flex flex-wrap items-center gap-3 text-sm">
			<label class="flex items-center gap-2">
				<span class="font-medium">Sine frequency (Hz)</span>
				<input
					type="number"
					bind:value={sineFreq}
					min="20"
					max="22000"
					step="1"
					class="w-28 rounded border border-gray-300 px-2 py-1"
					disabled={running}
				/>
			</label>
			<span class="text-xs text-gray-500">
				A pure tone at this frequency. Visible as a single horizontal line in the spectrogram.
			</span>
		</div>
	{:else if signal === 'siren'}
		<div class="mt-3 flex flex-wrap items-center gap-3 text-sm">
			<label class="flex items-center gap-2">
				<span class="font-medium">Siren min freq (Hz)</span>
				<input
					type="number"
					bind:value={sirenMinFreq}
					min="20"
					max="22000"
					step="1"
					class="w-28 rounded border border-gray-300 px-2 py-1"
					disabled={running}
				/>
			</label>
			<label class="flex items-center gap-2">
				<span class="font-medium">Siren max freq (Hz)</span>
				<input
					type="number"
					bind:value={sirenMaxFreq}
					min="20"
					max="22000"
					step="1"
					class="w-28 rounded border border-gray-300 px-2 py-1"
					disabled={running}
				/>
			</label>
			<span class="text-xs text-gray-500">
				A linear frequency sweep from min to max over each clip. Visible as a diagonal stripe in the
				spectrogram, which makes it obvious the audio is generated at runtime.
			</span>
		</div>
	{/if}

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
				class="flex items-center gap-1.5 rounded border border-green-500 bg-green-50 px-3 py-2 text-sm font-medium text-green-700 transition hover:bg-green-100"
			>
				<svg
					class="h-4 w-4"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					viewBox="0 0 24 24"
					aria-hidden="true"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
					/>
				</svg>
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
				{#each results as r (r.lengthSec)}
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

		<h2 class="mb-2 mt-8 text-lg font-bold">Time vs audio length</h2>
		<svg
			viewBox="0 0 {plotWidth} {plotHeight}"
			preserveAspectRatio="xMidYMid meet"
			class="block w-full rounded border border-gray-200 bg-white"
		>
			<g transform="translate({plotMargin.left}, {plotMargin.top})">
				{#each yScale.ticks(5) as tick (tick)}
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
				{#each xScale.ticks(6) as tick (tick)}
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

				{#each results as r (r.lengthSec)}
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

		<h3 class="mb-2 mt-8 text-sm font-medium text-gray-700">Markdown export</h3>
		<pre class="overflow-auto rounded bg-gray-50 p-3 text-xs">{toMarkdown()}</pre>

		<h3 class="mb-2 mt-4 text-sm font-medium text-gray-700">Rendered preview</h3>
		<div class="space-y-1 text-xs italic text-gray-600">
			{#if machineInfo}
				<p>Machine: {machineInfo}.</p>
			{/if}
			<p>
				Signal: {signal === 'sine'
					? `sine (${sineFreq} Hz)`
					: signal === 'siren'
						? `siren (${sirenMinFreq} to ${sirenMaxFreq} Hz)`
						: 'noise'}, Web workers: {workerCount}, Verdict threshold: {thresholdMs} ms saved.
			</p>
		</div>
		<table class="mt-2 w-full text-sm">
			<thead class="bg-gray-100 text-left">
				<tr>
					<th class="px-2 py-1">Length (s)</th>
					<th class="px-2 py-1">Frames</th>
					<th class="px-2 py-1">Main-thread (ms)</th>
					<th class="px-2 py-1">Web workers (ms)</th>
					<th class="px-2 py-1">Saved (ms)</th>
					<th class="px-2 py-1">Verdict</th>
				</tr>
			</thead>
			<tbody>
				{#each results as r (r.lengthSec)}
					<tr class="border-t border-gray-200">
						<td class="px-2 py-1 tabular-nums">{r.lengthSec}</td>
						<td class="px-2 py-1 tabular-nums">{r.frames}</td>
						<td class="px-2 py-1 tabular-nums">{r.mainMs.toFixed(0)}</td>
						<td class="px-2 py-1 tabular-nums">{r.workerMs.toFixed(0)}</td>
						<td class="px-2 py-1 tabular-nums">{r.savedMs.toFixed(0)}</td>
						<td class="px-2 py-1">{verdict(r)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</div>

<style>
	.random-shine::after {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(
			110deg,
			transparent 30%,
			rgba(255, 255, 255, 0.7) 50%,
			transparent 70%
		);
		background-size: 250% 100%;
		background-position: 250% 50%;
		pointer-events: none;
		opacity: 0;
	}
	.random-shine:hover::after {
		animation: random-shine-sweep 0.9s ease-out forwards;
	}
	@keyframes random-shine-sweep {
		0% {
			background-position: 250% 50%;
			opacity: 0;
		}
		15% {
			opacity: 1;
		}
		85% {
			opacity: 1;
		}
		100% {
			background-position: -50% 50%;
			opacity: 0;
		}
	}
</style>
