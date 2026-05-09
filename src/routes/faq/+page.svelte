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

	const HOW_LONG_KEY = 'How long will graphing generation take?';
	let openMap: Record<string, boolean> = {};

	function toggleQuestion(key: string) {
		openMap[key] = !openMap[key];
		openMap = openMap;
	}

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
		if (ms === null) return 'n/a';
		if (ms < 1000) return `${Math.round(ms)} ms`;
		if (ms < 60000) return `${(ms / 1000).toFixed(2)} s`;
		const min = Math.floor(ms / 60000);
		const sec = ((ms % 60000) / 1000).toFixed(0);
		return `${min} min ${sec} s`;
	}

	const aboutItems = [
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
			question: 'What browsers are supported?',
			answer:
				'Bick Graphing works in any modern browser that supports the Web Audio API: Chrome, Firefox, Safari, and Edge. Chromium-based browsers (Chrome, Edge, Opera) handle the longest files best; see the Troubleshooting section if you load files over an hour.'
		},
		{
			question: 'What kinds of recordings is this designed for?',
			answer: `Bick Graphing was originally built to support insect bioacoustics research as part of the <a href="https://www.insecteavesdropper.com/home" target="_blank" rel="noopener noreferrer" class="text-purple-600 underline hover:text-purple-800">Insect Eavesdropper</a> project, but it works for any .wav recording you'd like to inspect visually.`
		},
		{
			question: 'Is the source code available?',
			answer: `Yes! Bick Graphing is open source under the <a href="https://github.com/bicklabuw/BickGraphing/blob/main/LICENSE" target="_blank" rel="noopener noreferrer" class="text-purple-600 underline hover:text-purple-800">MIT license</a>. You can browse the source, file issues, or contribute on <a href="https://github.com/bicklabuw/BickGraphing" target="_blank" rel="noopener noreferrer" class="text-purple-600 underline hover:text-purple-800">GitHub</a>.`
		},
		{
			question: 'Where can I find the original version of Bick Graphing?',
			answer: `The original v0.1.0 was designed by Grace Steinmetz and Alex Arovas, and is still hosted on UW–Madison's GitLab Pages at <a href="https://ie-graphing-709865.pages.doit.wisc.edu" target="_blank" rel="noopener noreferrer" class="text-purple-600 underline hover:text-purple-800">https://ie-graphing-709865.pages.doit.wisc.edu</a>.`
		}
	];

	const usingItems = [
		{
			question: 'How do I use Bick Graphing?',
			answer: `Open the <a href="${base}/graphing" class="text-purple-600 underline hover:text-purple-800">Graphing Tool</a> and drop one or more .wav files anywhere on the page; everything stays local and nothing uploads. Pick a view: Waveform, Spectrogram, or both. Toggle <strong>Sliders</strong> to fine-tune amplitude, time, and frequency ranges. Toggle <strong>Details</strong> to see per-file metadata. Click any mini-waveform thumbnail to jump to that file's full graph. Use the <strong>Download</strong> button on any chart to save as SVG, PNG, or JPEG.`
		},
		{
			question: 'Can I view multiple files at once?',
			answer:
				'Yes. Drop several .wav files at the same time, or drag more in later; each file gets its own waveform and spectrogram, stacked vertically. The mini-waveform thumbnails along the top let you jump quickly between files, and the file list lets you reorder files by drag-and-drop or remove individual files.'
		},
		{
			question: 'What file types are supported?',
			answer:
				'Currently, only .wav files are supported. Multi-channel and stereo .wav files are accepted; the tool reads the first channel for visualization.'
		},
		{
			question: 'What happens when I click a mini-waveform thumbnail?',
			answer: `When you've loaded multiple files, the row of mini thumbnails above the full graphs lets you jump quickly. Click any thumbnail to smooth-scroll the page to that file's full-size waveform; a brief green pulse highlights the target so your eye lands on it. Keyboard users can Tab to a thumbnail and press Enter or Space.`
		},
		{
			question: 'What is the frequency range on the spectrogram?',
			answer: `The frequency slider defaults to 0 to 3000 Hz, the primary band for insect vibrational signals captured by the <a href="https://www.insecteavesdropper.com/home" target="_blank" rel="noopener noreferrer" class="text-purple-600 underline hover:text-purple-800">Insect Eavesdropper</a> sensor. You can extend the upper bound up to 22050 Hz, the <a href="https://en.wikipedia.org/wiki/Nyquist_frequency" target="_blank" rel="noopener noreferrer" class="text-purple-600 underline hover:text-purple-800">Nyquist limit</a> for 44.1 kHz audio. Content above 22050 Hz would be either absent or a resampling artifact, so the slider is hard-capped at that ceiling.`
		},
		{
			question: 'What download formats are supported?',
			answer:
				'Each waveform and spectrogram has a Download button with three options: <strong>SVG</strong> (vector, infinite zoom, best for paper figures), <strong>PNG</strong> (lossless raster, good general default), and <strong>JPEG</strong> (smaller file, lossy compression, fine for casual sharing).'
		}
	];

	const citingItems = [
		{
			question: 'Where can I learn more about the tool and the research behind it?',
			answer: `We've written a preprint that goes into the design and motivation in more detail. You can read it on <a href="https://arxiv.org/abs/2601.17014" target="_blank" rel="noopener noreferrer" class="text-purple-600 underline hover:text-purple-800">arXiv</a>.`
		},
		{
			question: 'How should I cite Bick Graphing in my research?',
			answer: `If you end up using Bick Graphing in academic work, please cite our <a href="https://arxiv.org/abs/2601.17014" target="_blank" rel="noopener noreferrer" class="text-purple-600 underline hover:text-purple-800">arXiv preprint</a>:<blockquote class="my-3 border-l-4 border-purple-300 bg-gray-50 px-4 py-2 text-xs italic text-gray-700">Seow, K., Arovas, A., Steinmetz, G., &amp; Bick, E. (2026). <em>BickGraphing: Web-Based Application for Visual Inspection of Audio Recordings</em>. arXiv:2601.17014 [eess.AS]. <a href="https://arxiv.org/abs/2601.17014" target="_blank" rel="noopener noreferrer" class="text-purple-600 underline hover:text-purple-800">https://arxiv.org/abs/2601.17014</a></blockquote>The repository's <a href="https://github.com/bicklabuw/BickGraphing#readme" target="_blank" rel="noopener noreferrer" class="text-purple-600 underline hover:text-purple-800">README</a> includes a ready-to-paste BibTeX entry, and a <a href="https://github.com/bicklabuw/BickGraphing/blob/main/CITATION.cff" target="_blank" rel="noopener noreferrer" class="text-purple-600 underline hover:text-purple-800"><code class="rounded bg-gray-100 px-1 py-0.5 text-xs">CITATION.cff</code></a> file is available for citation managers.`
		}
	];

	const troubleshootingItems = [
		{
			question: "Why won't my .mp3, .flac, or .ogg file load?",
			answer: `Bick Graphing only supports .wav for now; other formats are rejected at ingest. To use a different audio file, convert it to .wav first using a free tool like <a href="https://www.audacityteam.org/" target="_blank" rel="noopener noreferrer" class="text-purple-600 underline hover:text-purple-800">Audacity</a> or <a href="https://ffmpeg.org/" target="_blank" rel="noopener noreferrer" class="text-purple-600 underline hover:text-purple-800">FFmpeg</a>.`
		},
		{
			question: 'My file is over an hour long. What happens?',
			answer: `Browsers cap how much audio they can decode in one shot: Chromium-based browsers (Chrome, Edge, Opera) throw an EncodingError past about 1.5 hours of 44.1 kHz audio. Files over an hour show a "this may take a while" warning during ingest. We're working on a hybrid decode path that bypasses this for very long files; for now, very long files may fail entirely past ~90 minutes depending on your browser.`
		},
		{
			question: 'The spectrogram looks blank or stuck. What do I do?',
			answer: `If a spectrogram paints blank after a slider change, refreshing the page or toggling the Spectrogram view off and on should rebuild it. If it keeps happening, please file an issue on <a href="https://github.com/bicklabuw/BickGraphing/issues" target="_blank" rel="noopener noreferrer" class="text-purple-600 underline hover:text-purple-800">GitHub</a> with your browser version and a brief description of what you were doing.`
		},
		{
			question: 'My browser feels slow when I load a long file.',
			answer: `Spectrogram generation scales linearly with file length, so a 30-minute file takes proportionally longer than a 5-minute one. The waveform is always near-instant. If you only need to inspect time-domain content, leave the Spectrogram view off; if you do need it, run a calibration sweep on the <a href="${base}/benchmark" class="text-purple-600 underline hover:text-purple-800">benchmark page</a> so the predictor knows your machine.`
		}
	];

	for (const item of usingItems) openMap[item.question] = false;
	openMap[HOW_LONG_KEY] = false;
	for (const item of citingItems) openMap[item.question] = false;
	for (const item of troubleshootingItems) openMap[item.question] = false;

	$: usingAllOpen = usingItems.every((i) => openMap[i.question]) && openMap[HOW_LONG_KEY];
	$: citingAllOpen = citingItems.every((i) => openMap[i.question]);
	$: troubleshootingAllOpen = troubleshootingItems.every((i) => openMap[i.question]);

	function setUsing(open: boolean) {
		for (const item of usingItems) openMap[item.question] = open;
		openMap[HOW_LONG_KEY] = open;
		openMap = openMap;
	}
	function setCiting(open: boolean) {
		for (const item of citingItems) openMap[item.question] = open;
		openMap = openMap;
	}
	function setTroubleshooting(open: boolean) {
		for (const item of troubleshootingItems) openMap[item.question] = open;
		openMap = openMap;
	}
</script>

<section class="min-h-screen px-3 py-7 text-gray-900">
	<div class="mx-auto max-w-3xl">
		<h1 class="mb-12 text-center text-4xl font-bold text-gray-900">Frequently Asked Questions</h1>

		<h2 class="mb-6 text-2xl font-bold text-gray-900">About Bick Graphing</h2>
		<div class="mb-12 space-y-6">
			{#each aboutItems as faq (faq.question)}
				<div class="rounded-xl bg-white p-6 shadow-md transition hover:shadow-lg">
					<h3 class="mb-2 text-lg font-semibold text-purple-700">{faq.question}</h3>
					<p class="text-sm text-gray-600">{@html faq.answer}</p>
				</div>
			{/each}
		</div>

		<div class="mb-12">
			<h2 id="using-heading" class="mb-6">
				<button
					type="button"
					on:click={() => setUsing(!usingAllOpen)}
					aria-expanded={usingAllOpen}
					aria-controls="using-content"
					class="flex w-full cursor-pointer items-center justify-between gap-2 rounded-xl border border-purple-200 bg-white p-6 shadow-md transition hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
				>
					<span class="text-2xl font-bold text-gray-900">Using Bick Graphing</span>
					<span
						aria-hidden="true"
						class="text-2xl text-purple-600 transition-transform"
						class:rotate-90={usingAllOpen}>▸</span
					>
				</button>
			</h2>
			<div id="using-content" role="region" aria-labelledby="using-heading" class="space-y-6">
				{#each usingItems as faq (faq.question)}
					<div class="rounded-xl bg-white p-6 shadow-md transition hover:shadow-lg">
						<h3 class="text-lg font-semibold text-purple-700" class:mb-2={openMap[faq.question]}>
							<button
								type="button"
								on:click={() => toggleQuestion(faq.question)}
								aria-expanded={openMap[faq.question]}
								class="w-full cursor-pointer rounded text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
							>
								{faq.question}
							</button>
						</h3>
						{#if openMap[faq.question]}
							<p class="text-sm text-gray-600">{@html faq.answer}</p>
						{/if}
					</div>
				{/each}

				<div class="rounded-xl bg-white p-6 shadow-md transition hover:shadow-lg">
					<h3 class="text-lg font-semibold text-purple-700" class:mb-2={openMap[HOW_LONG_KEY]}>
						<button
							type="button"
							on:click={() => toggleQuestion(HOW_LONG_KEY)}
							aria-expanded={openMap[HOW_LONG_KEY]}
							class="w-full cursor-pointer text-left"
						>
							How long will graphing generation take?
						</button>
					</h3>
					{#if openMap[HOW_LONG_KEY]}
						<div class="space-y-3 text-sm text-gray-600">
							<p>
								<strong>Waveform rendering is near-instant.</strong> It's a simple plot of amplitude
								over time, computed in milliseconds regardless of file length.
							</p>
							<p>
								<strong>Spectrogram generation takes longer</strong>, and the time depends almost
								entirely on how long your audio file is. The longer the file, the more FFT frames
								have to be computed, and time scales roughly linearly with duration.
							</p>
							<p>
								The number of parallel web workers the tool can spin up depends on what your browser
								exposes; different browsers (and different machines) report different counts.{#if calibration}
									For example, testing in <strong>{detectedBrowser}</strong> means your machine can
									spin up <strong>{calibration.workerCount} parallel web workers</strong>.{/if}
							</p>
							{#if calibration}
								<p>Translated to file lengths, that gives roughly:</p>
								<ul class="ml-4 list-disc space-y-0.5">
									<li>
										10-second clip: <span class="tabular-nums">~{formatMs(predictedMs(10))}</span>
									</li>
									<li>
										1-minute file: <span class="tabular-nums">~{formatMs(predictedMs(60))}</span>
									</li>
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
									<a
										href="{base}/benchmark"
										class="text-purple-600 underline hover:text-purple-800"
									>
										benchmark page
									</a>
									and these numbers will fill in automatically.
								</p>
							{/if}

							<details
								class="group/nerds rounded-lg border border-purple-200 bg-purple-50 p-3 open:bg-purple-100"
							>
								<summary
									class="cursor-pointer list-none text-xs font-semibold text-purple-700 marker:hidden"
								>
									<span class="mr-1 inline-block transition-transform group-open/nerds:rotate-90"
										>▸</span
									>
									For the curious
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
										running in parallel; each worker computes its slice of frames, then converts magnitudes
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
										extraction (~25 s for a 30-min file). Render is a single
										<code>putImageData</code>
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
										Time complexity is <strong>O(N log N)</strong> per frame and the number of
										frames scales linearly with audio length, so total work is roughly linear in
										file duration. The numbers above come from a
										<a
											href="https://en.wikipedia.org/wiki/Simple_linear_regression#Fitting_the_regression_line"
											target="_blank"
											rel="noopener noreferrer"
											class="text-purple-600 underline hover:text-purple-800"
										>
											least-squares linear fit
										</a>
										of your last
										<a
											href="{base}/benchmark"
											class="text-purple-600 underline hover:text-purple-800"
										>
											benchmark sweep
										</a>'s (lengthSec, workerMs) data points.
									</p>
								</div>
							</details>
						</div>
					{/if}
				</div>
			</div>
		</div>

		<div class="mb-12">
			<h2 id="citing-heading" class="mb-6">
				<button
					type="button"
					on:click={() => setCiting(!citingAllOpen)}
					aria-expanded={citingAllOpen}
					aria-controls="citing-content"
					class="flex w-full cursor-pointer items-center justify-between gap-2 rounded-xl border border-purple-200 bg-white p-6 shadow-md transition hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
				>
					<span class="text-2xl font-bold text-gray-900">Citing &amp; Research</span>
					<span
						aria-hidden="true"
						class="text-2xl text-purple-600 transition-transform"
						class:rotate-90={citingAllOpen}>▸</span
					>
				</button>
			</h2>
			<div id="citing-content" role="region" aria-labelledby="citing-heading" class="space-y-6">
				{#each citingItems as faq (faq.question)}
					<div class="rounded-xl bg-white p-6 shadow-md transition hover:shadow-lg">
						<h3 class="text-lg font-semibold text-purple-700" class:mb-2={openMap[faq.question]}>
							<button
								type="button"
								on:click={() => toggleQuestion(faq.question)}
								aria-expanded={openMap[faq.question]}
								class="w-full cursor-pointer rounded text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
							>
								{faq.question}
							</button>
						</h3>
						{#if openMap[faq.question]}
							<p class="text-sm text-gray-600">{@html faq.answer}</p>
						{/if}
					</div>
				{/each}
			</div>
		</div>

		<div class="mb-12">
			<h2 id="troubleshooting-heading" class="mb-6">
				<button
					type="button"
					on:click={() => setTroubleshooting(!troubleshootingAllOpen)}
					aria-expanded={troubleshootingAllOpen}
					aria-controls="troubleshooting-content"
					class="flex w-full cursor-pointer items-center justify-between gap-2 rounded-xl border border-purple-200 bg-white p-6 shadow-md transition hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
				>
					<span class="text-2xl font-bold text-gray-900">Troubleshooting</span>
					<span
						aria-hidden="true"
						class="text-2xl text-purple-600 transition-transform"
						class:rotate-90={troubleshootingAllOpen}>▸</span
					>
				</button>
			</h2>
			<div
				id="troubleshooting-content"
				role="region"
				aria-labelledby="troubleshooting-heading"
				class="space-y-6"
			>
				{#each troubleshootingItems as faq (faq.question)}
					<div class="rounded-xl bg-white p-6 shadow-md transition hover:shadow-lg">
						<h3 class="text-lg font-semibold text-purple-700" class:mb-2={openMap[faq.question]}>
							<button
								type="button"
								on:click={() => toggleQuestion(faq.question)}
								aria-expanded={openMap[faq.question]}
								class="w-full cursor-pointer rounded text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
							>
								{faq.question}
							</button>
						</h3>
						{#if openMap[faq.question]}
							<p class="text-sm text-gray-600">{@html faq.answer}</p>
						{/if}
					</div>
				{/each}
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
