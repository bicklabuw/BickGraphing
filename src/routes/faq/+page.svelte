<!--
  @component
  Description: Frequently asked questions page covering usage, supported formats, and citation details.

  @author Grace Steinmetz <gesparkles@gmail.com>
  @contributors K. Seow <kseow@wisc.edu>
  @created 2025-05-30
  @version 0.2.0
  @license MIT
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';

	const STORAGE_KEY = 'bench-calibration-v1';
	const WORKER_THRESHOLD_SEC = 20;
	const FFT_SIZE = 2048;
	const HOP_SIZE = 1024;

	type Calibration = {
		savedAt: number;
		signal: string;
		workerCount: number;
		points: { lengthSec: number; mainMs: number; workerMs: number }[];
	};
	let calibration: Calibration | null = null;
	let detectedBrowser = 'your browser';

	onMount(() => {
		try {
			const raw = localStorage.getItem(STORAGE_KEY);
			if (raw) calibration = JSON.parse(raw);
		} catch {
			calibration = null;
		}
		detectedBrowser = detectBrowser();
	});

	function detectBrowser(): string {
		if (typeof navigator === 'undefined') return 'your browser';
		const ua = navigator.userAgent;
		if (ua.includes('Edg/')) return 'Microsoft Edge';
		if (ua.includes('OPR/') || ua.includes('Opera')) return 'Opera';
		if (ua.includes('Firefox/')) return 'Firefox';
		if (ua.includes('Chrome/')) return 'Google Chrome';
		if (ua.includes('Safari/')) return 'Safari';
		return 'your browser';
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

	function formatMs(ms: number | null): string {
		if (ms === null) return '—';
		if (ms < 1000) return `${Math.round(ms)} ms`;
		if (ms < 60000) return `${(ms / 1000).toFixed(2)} s`;
		const min = Math.floor(ms / 60000);
		const sec = ((ms % 60000) / 1000).toFixed(0);
		return `${min} min ${sec} s`;
	}

	let faqs = [
		{
			question: 'Is this tool free to use?',
			answer: 'Yes. Bick Graphing is completely free and runs entirely in your browser.'
		},
		{
			question: 'Can I use this offline?',
			answer:
				'Absolutely. The tool works offline after the initial load, and no data ever leaves your device.'
		},
		{
			question: 'What file types are supported?',
			answer: 'Currently, only .wav files are supported for visualization.'
		},
		{
			question: 'What kinds of recordings is this designed for?',
			answer: `Bick Graphing was originally built to support insect bioacoustics research as part of the <a href="https://www.insecteavesdropper.com/home" target="_blank" rel="noopener noreferrer" class="text-purple-600 underline hover:text-purple-800">Insect Eavesdropper</a> project, but it works for any .wav recording you'd like to inspect visually.`
		},
		{
			question: 'Where can I learn more about the tool and the research behind it?',
			answer: `We've written a preprint that goes into the design and motivation in more detail — you can read it on <a href="https://arxiv.org/abs/2601.17014" target="_blank" rel="noopener noreferrer" class="text-purple-600 underline hover:text-purple-800">arXiv</a>.`
		},
		{
			question: 'Is the source code available?',
			answer: `Yes! Bick Graphing is open source under the MIT license. You can browse the source, file issues, or contribute on <a href="https://github.com/bicklabuw/BickGraphing" target="_blank" rel="noopener noreferrer" class="text-purple-600 underline hover:text-purple-800">GitHub</a>.`
		},
		{
			question: 'How should I cite Bick Graphing in my research?',
			answer: `If you end up using Bick Graphing in academic work, please cite our <a href="https://arxiv.org/abs/2601.17014" target="_blank" rel="noopener noreferrer" class="text-purple-600 underline hover:text-purple-800">arXiv preprint</a>:<blockquote class="my-3 border-l-4 border-purple-300 bg-gray-50 px-4 py-2 text-xs italic text-gray-700">Seow, K., Arovas, A., Steinmetz, G., &amp; Bick, E. (2026). <em>BickGraphing: Web-Based Application for Visual Inspection of Audio Recordings</em>. arXiv:2601.17014 [eess.AS]. <a href="https://arxiv.org/abs/2601.17014" target="_blank" rel="noopener noreferrer" class="text-purple-600 underline hover:text-purple-800">https://arxiv.org/abs/2601.17014</a></blockquote>The repository's README includes a ready-to-paste BibTeX entry, and a <code class="rounded bg-gray-100 px-1 py-0.5 text-xs">CITATION.cff</code> file is available for citation managers.`
		},
		{
			question: 'Where can I find the original version of Bick Graphing?',
			answer: `The original v0.1.0 was designed by Grace Steinmetz and Alex Arovas, and is still hosted on UW–Madison's GitLab Pages at <a href="https://ie-graphing-709865.pages.doit.wisc.edu" target="_blank" rel="noopener noreferrer" class="text-purple-600 underline hover:text-purple-800">https://ie-graphing-709865.pages.doit.wisc.edu</a>.`
		}
	];
</script>

<section class="min-h-screen px-3 py-7 text-gray-900">
	<div class="mx-auto max-w-3xl">
		<h1 class="mb-12 text-center text-4xl font-bold text-gray-900">Frequently Asked Questions</h1>

		<div class="space-y-6">
			{#each faqs as faq (faq.question)}
				<div class="rounded-xl bg-white p-6 shadow-md transition hover:shadow-lg">
					<h2 class="mb-2 text-lg font-semibold text-purple-700">{faq.question}</h2>
					<p class="text-sm text-gray-600">{@html faq.answer}</p>
				</div>
			{/each}

			<div class="rounded-xl bg-white p-6 shadow-md transition hover:shadow-lg">
				<h2 class="mb-2 text-lg font-semibold text-purple-700">
					How long will graphing generation take?
				</h2>
				<div class="space-y-3 text-sm text-gray-600">
					<p>
						<strong>Waveform rendering is near-instant</strong> — it's a simple plot of amplitude over
						time, computed in milliseconds regardless of file length.
					</p>
					<p>
						<strong>Spectrogram generation takes longer</strong>, and the time depends almost
						entirely on how long your audio file is. The longer the file, the more FFT frames have
						to be computed, and time scales roughly linearly with duration.
					</p>
					<p>
						The number of parallel web workers the tool can spin up depends on what your browser
						exposes — different browsers (and different machines) report different counts. For
						example, testing in <strong>{detectedBrowser}</strong>{#if calibration}, it exposes
							<strong>{calibration.workerCount} parallel web workers</strong>{/if}.
					</p>
					{#if calibration}
						<p>Translated to file lengths, that gives roughly:</p>
						<ul class="ml-4 list-disc space-y-0.5">
							<li>
								10-second clip: <span class="tabular-nums">~{formatMs(predictedMs(10))}</span>
							</li>
							<li>1-minute file: <span class="tabular-nums">~{formatMs(predictedMs(60))}</span></li>
							<li>
								5-minute file: <span class="tabular-nums">~{formatMs(predictedMs(300))}</span>
							</li>
							<li>
								15-minute file: <span class="tabular-nums">~{formatMs(predictedMs(900))}</span>
							</li>
							<li>
								30-minute file: <span class="tabular-nums">~{formatMs(predictedMs(1800))}</span>
							</li>
							<li>
								45-minute file: <span class="tabular-nums">~{formatMs(predictedMs(2700))}</span>
							</li>
						</ul>
					{:else}
						<p class="italic text-gray-500">
							Want estimates calibrated to your machine? Run a sweep on the
							<a href="{base}/benchmark" class="text-purple-600 underline hover:text-purple-800">
								benchmark page
							</a>
							and these numbers will fill in automatically.
						</p>
					{/if}

					<details
						class="group rounded-lg border border-purple-200 bg-purple-50 p-3 open:bg-purple-100"
					>
						<summary
							class="cursor-pointer list-none text-xs font-semibold text-purple-700 marker:hidden"
						>
							<span class="mr-1 inline-block transition-transform group-open:rotate-90">▸</span>
							For the nerds
						</summary>
						<div class="mt-3 space-y-2 text-xs text-gray-700">
							<p>
								The spectrogram is a
								<a
									href="https://en.wikipedia.org/wiki/Short-time_Fourier_transform"
									target="_blank"
									rel="noopener noreferrer"
									class="text-purple-600 underline hover:text-purple-800"
								>
									<em>Short-Time Fourier Transform</em>
								</a>
								(STFT): the audio is split into overlapping windows ({FFT_SIZE} samples wide,
								{HOP_SIZE} samples between windows = 50% overlap), each window is multiplied by a
								<a
									href="https://en.wikipedia.org/wiki/Hann_function"
									target="_blank"
									rel="noopener noreferrer"
									class="text-purple-600 underline hover:text-purple-800"
								>
									Hann taper
								</a>
								to reduce spectral leakage, and a
								<a
									href="https://en.wikipedia.org/wiki/Cooley%E2%80%93Tukey_FFT_algorithm"
									target="_blank"
									rel="noopener noreferrer"
									class="text-purple-600 underline hover:text-purple-800"
								>
									radix-2 FFT
								</a>
								computes the frequency content of that slice.
							</p>
							<p>
								For files <strong>≥ {WORKER_THRESHOLD_SEC} seconds</strong>, the work is split
								across
								<a
									href="https://developer.mozilla.org/en-US/docs/Web/API/Navigator/hardwareConcurrency"
									target="_blank"
									rel="noopener noreferrer"
									class="text-purple-600 underline hover:text-purple-800"
								>
									<code>navigator.hardwareConcurrency</code>
								</a>
								<a
									href="https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API"
									target="_blank"
									rel="noopener noreferrer"
									class="text-purple-600 underline hover:text-purple-800"
								>
									web workers
								</a>
								running in parallel — each worker computes its slice of frames, then converts magnitudes
								to log10 in-place before sending the buffer back via a
								<a
									href="https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects"
									target="_blank"
									rel="noopener noreferrer"
									class="text-purple-600 underline hover:text-purple-800"
								>
									transferable <code>ArrayBuffer</code>
								</a> (zero-copy). For shorter files it runs single-threaded; the worker spawn overhead
								(~50–300 ms) would otherwise exceed the savings.
							</p>
							<p>
								PCM extraction is skipped entirely when an
								<a
									href="https://developer.mozilla.org/en-US/docs/Web/API/AudioBuffer"
									target="_blank"
									rel="noopener noreferrer"
									class="text-purple-600 underline hover:text-purple-800"
								>
									<code>AudioBuffer</code>
								</a>
								is already available from the browser's
								<a
									href="https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/decodeAudioData"
									target="_blank"
									rel="noopener noreferrer"
									class="text-purple-600 underline hover:text-purple-800"
								>
									<code>decodeAudioData()</code>
								</a>
								at file ingest. Otherwise it falls back to
								<a
									href="https://github.com/ffmpegwasm/ffmpeg.wasm"
									target="_blank"
									rel="noopener noreferrer"
									class="text-purple-600 underline hover:text-purple-800"
								>
									FFmpeg.wasm
								</a>
								extraction (~25 s for a 30-min file). Render is a single <code>putImageData</code>
								call into a canvas using a 256-entry
								<a
									href="https://research.google/blog/turbo-an-improved-rainbow-colormap-for-visualization/"
									target="_blank"
									rel="noopener noreferrer"
									class="text-purple-600 underline hover:text-purple-800"
								>
									Turbo
								</a> color LUT.
							</p>
							<p>
								Time complexity is <strong>O(N log N)</strong> per frame and the number of frames
								scales linearly with audio length, so total work is roughly linear in file duration.
								The numbers above come from a
								<a
									href="https://en.wikipedia.org/wiki/Simple_linear_regression#Fitting_the_regression_line"
									target="_blank"
									rel="noopener noreferrer"
									class="text-purple-600 underline hover:text-purple-800"
								>
									least-squares linear fit
								</a>
								of your last
								<a href="{base}/benchmark" class="text-purple-600 underline hover:text-purple-800">
									benchmark sweep
								</a>'s (lengthSec, workerMs) data points.
							</p>
						</div>
					</details>
				</div>
			</div>
		</div>

		<div class="mt-12 text-center">
			<p class="text-sm text-gray-500">
				Still have questions?
				<a
					href="https://www.bicklab.com/"
					class="text-purple-600 underline hover:text-purple-800"
					target="_blank"
					rel="noopener noreferrer"
				>
					Contact us
				</a>
			</p>
		</div>
	</div>
</section>
