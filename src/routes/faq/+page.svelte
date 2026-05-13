<!--
  @component
  Description: Frequently asked questions page covering usage, supported formats, and citation details.

  @author K. Seow <kseow@wisc.edu>
  @contributors Grace Steinmetz <gesparkles@gmail.com>
  @created 2025-05-30
  @version 0.2.0
  @license MIT
-->
<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { base } from '$app/paths';

	const WORKER_THRESHOLD_SEC = 20;
	const FFT_SIZE = 2048;
	const HOP_SIZE = 1024;

	const HOW_LONG_KEY = 'How long will graphing generation take?';
	let openMap: Record<string, boolean> = {};

	function toggleQuestion(key: string) {
		openMap[key] = !openMap[key];
		openMap = openMap;
	}

	function slugify(s: string): string {
		return s
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '');
	}

	let detectedBrowser = 'your browser';

	function openItemFromHash() {
		if (typeof location === 'undefined' || !location.hash) return;
		const hash = location.hash.slice(1);
		if (hash === 'how-long') {
			openMap[HOW_LONG_KEY] = true;
			openMap = openMap;
			return;
		}
		const collapsibles = [...usingItems, ...citingItems, ...troubleshootingItems];
		const match = collapsibles.find((item) => slugify(item.question) === hash);
		if (match) {
			openMap[match.question] = true;
			openMap = openMap;
		}
	}

	onMount(() => {
		try {
			localStorage.removeItem('bench-calibration-v1');
		} catch {
			// ignore: localStorage may be unavailable (private mode, no storage permissions, etc.)
		}
		detectedBrowser = detectBrowser();
		openItemFromHash();
		if (typeof window !== 'undefined') {
			window.addEventListener('hashchange', openItemFromHash);
		}
	});

	onDestroy(() => {
		if (typeof window !== 'undefined') {
			window.removeEventListener('hashchange', openItemFromHash);
		}
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

	const aboutItems = [
		{
			question: 'Is this tool free to use?',
			answer: 'Yes. BickGraphing is completely free and runs entirely in your browser.'
		},
		{
			question: 'Can I use this offline?',
			answer:
				'Absolutely. The tool works offline after the initial load, and no data ever leaves your device.'
		},
		{
			question: 'What browsers are supported?',
			answer:
				'BickGraphing works in any modern browser that supports the Web Audio API: Chrome, Firefox, Safari, and Edge. Chromium-based browsers (Chrome, Edge, Opera) handle the longest files best; see the Troubleshooting section if you load files over an hour.'
		},
		{
			question: 'What kinds of recordings is this designed for?',
			answer: `BickGraphing was originally built to support insect bioacoustics research as part of the <a href="https://www.insecteavesdropper.com/home" target="_blank" rel="noopener noreferrer" class="text-purple-600 underline hover:text-purple-800">Insect Eavesdropper</a> project, but it works for any .wav recording you'd like to inspect visually.`
		},
		{
			question: 'Is the source code available?',
			answer: `Yes! BickGraphing is open source under the <a href="https://github.com/bicklabuw/BickGraphing/blob/main/LICENSE" target="_blank" rel="noopener noreferrer" class="text-purple-600 underline hover:text-purple-800">MIT license</a>. You can browse the source, file issues, or contribute on <a href="https://github.com/bicklabuw/BickGraphing" target="_blank" rel="noopener noreferrer" class="text-purple-600 underline hover:text-purple-800">GitHub</a>.`
		},
		{
			question: 'Where can I find the original version of BickGraphing?',
			answer: `The original v0.1.0 was designed by <a href="https://www.gracesteinmetz.com" target="_blank" rel="noopener noreferrer" class="text-purple-600 underline hover:text-purple-800">Grace Steinmetz</a> and <a href="https://github.com/Alex-Arovas" target="_blank" rel="noopener noreferrer" class="text-purple-600 underline hover:text-purple-800">Alex Arovas</a>, and is still hosted on UW-Madison's GitLab Pages at <a href="https://ie-graphing-709865.pages.doit.wisc.edu" target="_blank" rel="noopener noreferrer" class="text-purple-600 underline hover:text-purple-800">https://ie-graphing-709865.pages.doit.wisc.edu</a>.`
		},
		{
			question: "What's new in V2?",
			answer: `<p class="mb-3">Hey, it rhymes! <a href="https://github.com/bicklabuw/BickGraphing/releases/tag/v0.2.0" target="_blank" rel="noopener noreferrer" class="text-purple-600 underline hover:text-purple-800">v0.2.0</a>, built by <a href="https://github.com/kayleyseow" target="_blank" rel="noopener noreferrer" class="text-purple-600 underline hover:text-purple-800">Kayley Seow</a>, is a significant evolution on the original. Visible improvements include: much faster spectrogram rendering on long files (parallel web workers and a canvas-based heatmap), a calibrated <a href="${base}/benchmark" class="text-purple-600 underline hover:text-purple-800">benchmark page</a> that learns your machine's speed and predicts generation time, mini-waveform thumbnails that smooth-scroll to a file's full graph when clicked, and polished axis labels so downloaded SVGs and PNGs are free of overlap. Internally, most of the pipeline was rebuilt; the original v0.1.0 implementation is preserved in the repository's git history for traceability.</p>
<details class="group/v2ux mt-3 rounded-lg border border-purple-200 bg-purple-50 p-3 open:bg-purple-100">
	<summary class="cursor-pointer list-none text-xs font-semibold text-purple-700 marker:hidden"><span class="mr-1 inline-block transition-transform group-open/v2ux:rotate-90">▸</span> For the design-minded</summary>
	<div class="mt-3 space-y-2 text-xs text-gray-700">
		<p>Throughout v0.2.0, the end-user experience drove the smaller choices as much as the architectural ones. ARIA labels and roles were added across components so the tool is navigable by keyboard and screen reader, the amplitude slider was rotated to run vertically alongside the chart so it reads as a true Y-axis control, each file got its own Sliders and Details toggles plus a smoother scroll-and-glow when jumping between files, and file ingest now shows accurate progress bars for file loading instead of a generic spinner.</p>
		<p><strong>The <a href="${base}/benchmark" class="text-purple-600 underline hover:text-purple-800">benchmark page</a> reflects this philosophy most directly: it warns you before sweeps that could crash long-file ingest on your browser, and the file-length chips are clearly labeled so it is obvious what each row represents.</strong></p>
		<p>The aim across all of these is the same: to make the tool's state and behavior legible to the person using it.</p>
	</div>
</details>
<details class="group/v2 mt-3 rounded-lg border border-purple-200 bg-purple-50 p-3 open:bg-purple-100">
	<summary class="cursor-pointer list-none text-xs font-semibold text-purple-700 marker:hidden"><span class="mr-1 inline-block transition-transform group-open/v2:rotate-90">▸</span> For the technically curious</summary>
	<div class="mt-3 space-y-2 text-xs text-gray-700">
		<p>The single biggest win was on the renderer. v0.1.0 drew the spectrogram with one SVG element per heatmap cell, which was the dominant cost on long files; v0.2.0 replaces that with a single canvas <code>putImageData</code> call backed by a 256-entry <a href="https://research.google/blog/turbo-an-improved-rainbow-colormap-for-visualization/" target="_blank" rel="noopener noreferrer" class="text-purple-600 underline hover:text-purple-800">Turbo</a> color LUT, so render time no longer scales with cell count. v0.1.0 also computed everything on the main thread; v0.2.0 shards the work across web workers above a threshold (see the <a href="#how-long" class="text-purple-600 underline hover:text-purple-800">"How long will graphing generation take?"</a> answer below for the mechanism).</p>
		<p>Two correctness-and-stability fixes were also part of the overhaul. The min/max pass that normalizes magnitudes used to flatten the 2D array first, which produced an ~1.2&nbsp;GB allocation that crashed hour-long ingest on common laptops; v0.2.0 walks the array row-by-row instead, keeping peak memory small. And redraws now build the SVG tree detached and atomically swap it in via <code>replaceChildren</code>, which eliminated the brief white flash visible during slider changes in v0.1.0.</p>
		<p>Two design choices are worth calling out. To make sure the overhaul didn't drift from the canonical reference, STFT output is checked bin-for-bin against fixtures generated by Python's <a href="https://librosa.org/" target="_blank" rel="noopener noreferrer" class="text-purple-600 underline hover:text-purple-800">librosa</a>. And by design, the tool keeps no persistent client-side storage: nothing is saved to <code>localStorage</code>, <code>IndexedDB</code>, or cookies, and reloads always start fresh. The benchmark page calibrates per-machine timings, but even those exist only for the duration of the page.</p>
	</div>
</details>`
		}
	];

	const usingItems = [
		{
			question: 'How do I use BickGraphing?',
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
			question: 'What download formats are supported?',
			answer:
				'Each waveform and spectrogram has a Download button with three options: <strong>SVG</strong> (vector, infinite zoom, best for paper figures), <strong>PNG</strong> (lossless raster, good general default), and <strong>JPEG</strong> (smaller file, lossy compression, fine for casual sharing).'
		},
		{
			question: 'What is the frequency range on the spectrogram?',
			answer: `The frequency slider defaults to 0 to 3000 Hz, the primary band for insect vibrational signals captured by the <a href="https://www.insecteavesdropper.com/home" target="_blank" rel="noopener noreferrer" class="text-purple-600 underline hover:text-purple-800">Insect Eavesdropper</a> sensor. You can extend the upper bound up to 22050 Hz, the <a href="https://en.wikipedia.org/wiki/Nyquist_frequency" target="_blank" rel="noopener noreferrer" class="text-purple-600 underline hover:text-purple-800">Nyquist limit</a> for 44.1 kHz audio. Content above 22050 Hz would be either absent or a resampling artifact, so the slider is hard-capped at that ceiling.
<details class="group/nerds mt-3 rounded-lg border border-purple-200 bg-purple-50 p-3 open:bg-purple-100">
	<summary class="cursor-pointer list-none text-xs font-semibold text-purple-700 marker:hidden"><span class="mr-1 inline-block transition-transform group-open/nerds:rotate-90">▸</span> For the curious</summary>
	<div class="mt-3 space-y-2 text-xs text-gray-700">
		<p>The 3,000 Hz default is tied to the use case BickGraphing was originally built for: insect bioacoustics recorded by the <a href="https://www.insecteavesdropper.com/home" target="_blank" rel="noopener noreferrer" class="text-purple-600 underline hover:text-purple-800">Insect Eavesdropper</a> sensor. Most of the biologically meaningful signal energy from the target species falls below that threshold, so showing 0 to 3,000 Hz by default keeps the band of interest large and legible without forcing every user to drag the slider before they see anything useful.</p>
		<p>The 22,050 Hz hard cap is the <a href="https://en.wikipedia.org/wiki/Nyquist_frequency" target="_blank" rel="noopener noreferrer" class="text-purple-600 underline hover:text-purple-800">Nyquist limit</a> for 44.1 kHz audio: a sampled signal can only faithfully represent frequencies up to half its sample rate. Any content above 22,050 Hz in the file is therefore either physically absent (the recording instrument never captured it) or a resampling artifact introduced during a sample-rate conversion. Displaying anything past that ceiling would just be misleading, so the slider refuses to go there.</p>
		<p>Frequency resolution on a spectrogram is set by the analysis window, not by the slider. With the ${FFT_SIZE}-sample window BickGraphing uses, the bin width is <code class="rounded bg-gray-100 px-1 py-0.5 text-xs">sampleRate / FFT_SIZE</code> Hz, which works out to roughly 21.5 Hz at 44.1 kHz. Narrowing the visible range with the slider only changes which slice of the spectrum you are looking at; the per-bin resolution stays the same. For the rest of the <a href="https://en.wikipedia.org/wiki/Short-time_Fourier_transform" target="_blank" rel="noopener noreferrer" class="text-purple-600 underline hover:text-purple-800">STFT</a> mechanics (window overlap, FFT specifics), see the <a href="#how-long" class="text-purple-600 underline hover:text-purple-800">"How long will graphing generation take?"</a> answer below.</p>
		<p>Before each FFT runs, the windowed slice is multiplied by a <a href="https://en.wikipedia.org/wiki/Hann_function" target="_blank" rel="noopener noreferrer" class="text-purple-600 underline hover:text-purple-800">Hann window</a>, which tapers the samples at the edges of the window to zero. Without that taper, the abrupt cutoff at each window boundary would smear energy across neighbouring frequency bins, a phenomenon called <a href="https://en.wikipedia.org/wiki/Spectral_leakage" target="_blank" rel="noopener noreferrer" class="text-purple-600 underline hover:text-purple-800">spectral leakage</a>. The Hann taper trades a small loss of frequency resolution for substantially cleaner bin estimates, which is the right tradeoff for visual spectrograms.</p>
	</div>
</details>`
		},
		{
			question: 'Why does BickGraphing use ffmpeg.wasm instead of native FFmpeg?',
			answer: `The original C/C++ <a href="https://ffmpeg.org/" target="_blank" rel="noopener noreferrer" class="text-purple-600 underline hover:text-purple-800">FFmpeg</a> doesn't run in the browser; it's a native binary that requires an operating system environment. <a href="https://github.com/ffmpegwasm/ffmpeg.wasm" target="_blank" rel="noopener noreferrer" class="text-purple-600 underline hover:text-purple-800">ffmpeg.wasm</a> is a WebAssembly port that runs directly in the browser without any server. BickGraphing goes one step further by configuring ffmpeg.wasm to reference local binaries rather than fetching them over the network, which is what enables fully <a href="#can-i-use-this-offline" class="text-purple-600 underline hover:text-purple-800">offline use</a> after the initial page load. ffmpeg.wasm handles the frame-accurate audio slicing that feeds the spectrogram's <a href="#how-long" class="text-purple-600 underline hover:text-purple-800">STFT pipeline</a>; the waveform uses a separate path via the browser-implemented <a href="https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API" target="_blank" rel="noopener noreferrer" class="text-purple-600 underline hover:text-purple-800">Web Audio API</a>, which needs no external library at all.`
		}
	];

	const citingItems = [
		{
			question: 'Where can I learn more about the tool and the research behind it?',
			answer: `We've written a preprint that goes into the design and motivation in more detail. You can read it on <a href="https://arxiv.org/abs/2601.17014" target="_blank" rel="noopener noreferrer" class="text-purple-600 underline hover:text-purple-800">arXiv</a>.`
		},
		{
			question: 'How should I cite BickGraphing in my research?',
			answer: `If you end up using BickGraphing in academic work, please cite our <a href="https://arxiv.org/abs/2601.17014" target="_blank" rel="noopener noreferrer" class="text-purple-600 underline hover:text-purple-800">arXiv preprint</a>:<blockquote class="my-3 border-l-4 border-purple-300 bg-gray-50 px-4 py-2 text-xs italic text-gray-700">Seow, K., Arovas, A., Steinmetz, G., &amp; Bick, E. (2026). <em>BickGraphing: Web-Based Application for Visual Inspection of Audio Recordings</em>. arXiv:2601.17014 [eess.AS]. <a href="https://arxiv.org/abs/2601.17014" target="_blank" rel="noopener noreferrer" class="text-purple-600 underline hover:text-purple-800">https://arxiv.org/abs/2601.17014</a></blockquote>The repository's <a href="https://github.com/bicklabuw/BickGraphing#readme" target="_blank" rel="noopener noreferrer" class="text-purple-600 underline hover:text-purple-800">README</a> includes a ready-to-paste BibTeX entry, and a <a href="https://github.com/bicklabuw/BickGraphing/blob/main/CITATION.cff" target="_blank" rel="noopener noreferrer" class="text-purple-600 underline hover:text-purple-800"><code class="rounded bg-gray-100 px-1 py-0.5 text-xs">CITATION.cff</code></a> file is available for citation managers.`
		}
	];

	const troubleshootingItems = [
		{
			question: "Why won't my .mp3, .flac, or .ogg file load?",
			answer: `BickGraphing only supports .wav for now; other formats are rejected at ingest. To use a different audio file, convert it to .wav first using a free tool like <a href="https://www.audacityteam.org/" target="_blank" rel="noopener noreferrer" class="text-purple-600 underline hover:text-purple-800">Audacity</a> or <a href="https://ffmpeg.org/" target="_blank" rel="noopener noreferrer" class="text-purple-600 underline hover:text-purple-800">FFmpeg</a>.`
		},
		{
			question: 'My file is over an hour long. What happens?',
			answer: `BickGraphing is designed around a one-hour upper bound: files over an hour still attempt to load and show a "this may take a while" warning during ingest, but performance and stability past that mark depend on your browser and machine. If you want to visualize a longer recording and the page crashes during upload, splitting the file into shorter clips with a free tool like <a href="https://www.audacityteam.org/" target="_blank" rel="noopener noreferrer" class="text-purple-600 underline hover:text-purple-800">Audacity</a> or <a href="https://ffmpeg.org/" target="_blank" rel="noopener noreferrer" class="text-purple-600 underline hover:text-purple-800">FFmpeg</a> is the most reliable workaround.`
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
</script>

<svelte:head>
	<title>FAQ | BickGraphing</title>
</svelte:head>

<section class="min-h-screen px-3 py-7 text-gray-900">
	<div class="mx-auto max-w-3xl">
		<h1 class="mb-12 text-center text-4xl font-bold text-gray-900">Frequently Asked Questions</h1>

		<h2 class="mb-4 pl-4 text-3xl font-bold text-gray-900">About BickGraphing</h2>
		<div class="mb-12 divide-y divide-purple-200 rounded-xl bg-white px-6 shadow-sm">
			{#each aboutItems as faq (faq.question)}
				<div class="py-4">
					<h3 id={slugify(faq.question)} class="mb-2 text-lg font-semibold text-purple-700">
						{faq.question}
					</h3>
					<div class="text-sm text-gray-600">{@html faq.answer}</div>
				</div>
			{/each}
		</div>

		<h2 class="mb-4 pl-4 text-3xl font-bold text-gray-900">Using BickGraphing</h2>
		<div class="mb-12 divide-y divide-purple-200 rounded-xl bg-white px-6 shadow-sm">
			{#each usingItems as faq (faq.question)}
				<div>
					<h3 id={slugify(faq.question)}>
						<button
							type="button"
							on:click={() => toggleQuestion(faq.question)}
							aria-expanded={openMap[faq.question]}
							class="flex w-full cursor-pointer items-center justify-between gap-4 py-4 text-left text-lg font-semibold text-purple-700 hover:text-purple-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
						>
							<span>{faq.question}</span>
							<span aria-hidden="true" class="shrink-0 text-2xl font-normal text-purple-600"
								>{openMap[faq.question] ? '−' : '+'}</span
							>
						</button>
					</h3>
					{#if openMap[faq.question]}
						<div class="pb-4 text-sm text-gray-600">{@html faq.answer}</div>
					{/if}
				</div>
			{/each}

			<div>
				<h3 id="how-long">
					<button
						type="button"
						on:click={() => toggleQuestion(HOW_LONG_KEY)}
						aria-expanded={openMap[HOW_LONG_KEY]}
						class="flex w-full cursor-pointer items-center justify-between gap-4 py-4 text-left text-lg font-semibold text-purple-700 hover:text-purple-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
					>
						<span>How long will graphing generation take?</span>
						<span aria-hidden="true" class="shrink-0 text-2xl font-normal text-purple-600"
							>{openMap[HOW_LONG_KEY] ? '−' : '+'}</span
						>
					</button>
				</h3>
				{#if openMap[HOW_LONG_KEY]}
					<div class="space-y-3 pb-4 text-sm text-gray-600">
						<p>
							<strong>Waveform rendering is near-instant.</strong> It's a simple plot of amplitude over
							time, computed in milliseconds regardless of file length.
						</p>
						<p>
							<strong>Spectrogram generation takes longer</strong>, and the time depends almost
							entirely on how long your audio file is. The longer the file, the more FFT frames have
							to be computed, and time scales roughly linearly with duration.
						</p>
						<p>
							The number of parallel web workers the tool can spin up depends on what your browser
							exposes; different browsers (and different machines) report different counts. Detected
							browser: <strong>{detectedBrowser}</strong>.
						</p>
						<p>
							For a calibrated estimate on your specific machine, run a sweep on the
							<a href="{base}/benchmark" class="text-purple-600 underline hover:text-purple-800"
								>benchmark page</a
							>.
						</p>

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
									Time complexity is <strong>O(N log N)</strong> per frame and the number of frames
									scales linearly with audio length, so total work is roughly linear in file
									duration. The
									<a
										href="{base}/benchmark"
										class="text-purple-600 underline hover:text-purple-800"
									>
										benchmark page
									</a>
									fits a
									<a
										href="https://en.wikipedia.org/wiki/Simple_linear_regression#Fitting_the_regression_line"
										target="_blank"
										rel="noopener noreferrer"
										class="text-purple-600 underline hover:text-purple-800"
									>
										least-squares linear regression
									</a>
									to per-machine sweep data and reports calibrated time predictions.
								</p>
							</div>
						</details>
					</div>
				{/if}
			</div>
		</div>

		<h2 class="mb-4 pl-4 text-3xl font-bold text-gray-900">Citing &amp; Research</h2>
		<div class="mb-12 divide-y divide-purple-200 rounded-xl bg-white px-6 shadow-sm">
			{#each citingItems as faq (faq.question)}
				<div>
					<h3 id={slugify(faq.question)}>
						<button
							type="button"
							on:click={() => toggleQuestion(faq.question)}
							aria-expanded={openMap[faq.question]}
							class="flex w-full cursor-pointer items-center justify-between gap-4 py-4 text-left text-lg font-semibold text-purple-700 hover:text-purple-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
						>
							<span>{faq.question}</span>
							<span aria-hidden="true" class="shrink-0 text-2xl font-normal text-purple-600"
								>{openMap[faq.question] ? '−' : '+'}</span
							>
						</button>
					</h3>
					{#if openMap[faq.question]}
						<div class="pb-4 text-sm text-gray-600">{@html faq.answer}</div>
					{/if}
				</div>
			{/each}
		</div>

		<h2 class="mb-4 pl-4 text-3xl font-bold text-gray-900">Troubleshooting</h2>
		<div class="mb-12 divide-y divide-purple-200 rounded-xl bg-white px-6 shadow-sm">
			{#each troubleshootingItems as faq (faq.question)}
				<div>
					<h3 id={slugify(faq.question)}>
						<button
							type="button"
							on:click={() => toggleQuestion(faq.question)}
							aria-expanded={openMap[faq.question]}
							class="flex w-full cursor-pointer items-center justify-between gap-4 py-4 text-left text-lg font-semibold text-purple-700 hover:text-purple-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
						>
							<span>{faq.question}</span>
							<span aria-hidden="true" class="shrink-0 text-2xl font-normal text-purple-600"
								>{openMap[faq.question] ? '−' : '+'}</span
							>
						</button>
					</h3>
					{#if openMap[faq.question]}
						<div class="pb-4 text-sm text-gray-600">{@html faq.answer}</div>
					{/if}
				</div>
			{/each}
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
