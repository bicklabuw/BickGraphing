<!--
  @component
  Description: Main graphing orchestrator — loads audio files, initializes FFmpeg, and renders waveform and spectrogram views with shared controls.

  @author Grace Steinmetz <gesparkles@gmail.com>
  @author K. Seow <kseow@wisc.edu>
  @contributors Alex Arovas <aarovas@wisc.edu>
  @created 2025-05-30
  @version 0.2.0
  @license MIT
-->
<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { initFFmpeg } from '$lib/utils/audioProcessing';
	import { extractWaveformData } from '$lib/utils/waveformData';
	import { peekWavDuration, isLongDuration } from '$lib/utils/wavHeader';
	import type { FFmpeg } from '@ffmpeg/ffmpeg';
	import { fetchFile } from '@ffmpeg/util';
	import Waveform from './waveform.svelte';
	import Miniwaveform from './miniwaveform.svelte';
	import Spectrogram from './spectrogram.svelte';
	import Rangeslider from './rangeslider.svelte';
	import Viewselector from './viewselector.svelte';
	import Rangeinput from './rangeinput.svelte';
	import Togglebutton from './togglebutton.svelte';
	import Filelist from './filelist.svelte';
	import Fileselector from './fileselector.svelte';
	import { spectrogramBusy } from '$lib/stores/uiBusy';

	let debug = true;
	let isIngesting = false;
	let ingestProgress = 0;
	let ingestingTotal = 0;
	let isFFmpegReady = false;

	let ffmpeg: FFmpeg | null = null;
	let selectedFiles: { id: string; name: string }[] = [];

	let originalAudioFiles: File[] = [];
	let audioDataArray: { name: string; inputName: string }[] = [];
	let waveformDataMap: Record<
		string,
		{
			waveform: { time: number; amplitude: number }[];
			minAmp: number;
			maxAmp: number;
		}
	> = {};
	let audioDurationMap: Record<string, number> = {};
	let pendingDurationMap: Record<string, number> = {};
	$: hasLongPendingFile = Object.values(pendingDurationMap).some(isLongDuration);
	let timeRangeMap: Record<string, { start: number; end: number }> = {};
	let ampRangeMap: Record<string, { min: number; max: number }> = {};
	let freqRangeMap: Record<string, { min: number; max: number }> = {};
	let waveformLoadingMap: Record<string, boolean> = {};

	let ampValuesMap: Record<string, [number, number]> = {};
	let timeValuesMap: Record<string, [number, number]> = {};
	let freqValuesMap: Record<string, [number, number]> = {};

	let audioBufferMap: Record<string, AudioBuffer> = {};
	let lastExtractedRange: Record<string, [number, number]> = {};

	let waveformVersion = 0;
	let spectrogramVersion = 0;

	// Nyquist for 44.1 kHz audio (Insect Eavesdropper standard rate).
	const NYQUIST_HZ = 22050;

	let startTime = 0;
	let endTime = 10;
	let minAmp = -0.01;
	let maxAmp = 0.01;
	let minFreq = 0;
	// Primary band for insect vibrational signals; users can extend up to NYQUIST_HZ.
	let maxFreq = 3000;

	let waveformRefs: Record<string, Waveform | null> = {};
	let spectrogramRefs: Record<string, Spectrogram | null> = {};
	let waveformContainerEls: Record<string, HTMLElement | null> = {};
	let glowedWaveform: string | null = null;
	let glowTimer: ReturnType<typeof setTimeout> | null = null;
	let spectrogramFirstRendered: Record<string, boolean> = {};
	let openDownloadMenu: string | null = null;

	function smoothScrollTo(targetY: number, duration = 800) {
		const startY = window.scrollY;
		const distance = targetY - startY;
		if (Math.abs(distance) < 1) return;
		const startTime = performance.now();
		const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
		function step(now: number) {
			const t = Math.min((now - startTime) / duration, 1);
			window.scrollTo(0, startY + distance * ease(t));
			if (t < 1) requestAnimationFrame(step);
		}
		requestAnimationFrame(step);
	}

	function focusWaveform(name: string) {
		const el = waveformContainerEls[name];
		if (!el) return;
		const rect = el.getBoundingClientRect();
		smoothScrollTo(window.scrollY + rect.top - 16);
		if (glowTimer) clearTimeout(glowTimer);
		glowedWaveform = null;
		requestAnimationFrame(() => {
			glowedWaveform = name;
			glowTimer = setTimeout(() => {
				if (glowedWaveform === name) glowedWaveform = null;
			}, 2500);
		});
	}

	function handleDownload(name: string, kind: 'wave' | 'spec', format: 'svg' | 'png' | 'jpeg') {
		if (kind === 'wave') waveformRefs[name]?.downloadWaveform(format);
		else spectrogramRefs[name]?.downloadSpectrogram(format);
		openDownloadMenu = null;
	}

	function handleDownloadOutsideClick(event: MouseEvent) {
		if (openDownloadMenu === null) return;
		const target = event.target as HTMLElement;
		if (!target.closest('[data-download-menu]')) openDownloadMenu = null;
	}
	let waveformHeights: Record<string, number> = {};
	let spectrogramHeights: Record<string, number> = {};

	let showWaveform = false;
	let showSpectrogram = false;
	let showDetailsMap: Record<string, boolean> = {};
	let showSlidersMap: Record<string, boolean> = {};
	let showReset = true;
	let showDownload = true;

	onMount(async () => {
		try {
			ffmpeg = await initFFmpeg();
			isFFmpegReady = true;
			if (debug) console.log('FFmpeg mounted');
			await tick();
		} catch (error) {
			console.error('Failed to initialize FFmpeg:', error);
		}
	});

	/**
	 * Ingests user-selected audio files: writes bytes into ffmpeg's FS, decodes for duration,
	 * seeds per-file range maps, and regenerates visualizations if any view is open.
	 * Re-uploads (same name) replace prior state.
	 */
	async function processFiles(files: FileList | File[]) {
		const incoming = Array.from(files);
		if (debug) console.log('Processing files:', incoming);

		if (debug) {
			for (let file of incoming) {
				console.log(file);
				console.log(`Processing file: ${file.name}`);
				console.log(`File size: ${file.size} bytes`);
				console.log(`File type: ${file.type}`);
			}
		}

		if (!incoming.length) return;

		isIngesting = true;
		ingestProgress = 0;
		ingestingTotal = incoming.length;
		let completed = 0;

		// Re-uploads (same name) drop the old per-file state so the new bytes win.
		for (const file of incoming) {
			if (selectedFiles.some((f) => f.name === file.name)) {
				cleanupFileState(file.name);
			}
		}

		await Promise.all(
			incoming.map(async (file) => {
				const peeked = await peekWavDuration(file);
				if (peeked != null) {
					pendingDurationMap = { ...pendingDurationMap, [file.name]: peeked };
				}
			})
		);

		await Promise.all(
			incoming.map(async (file) => {
				if (!ffmpeg) return;

				const inputName = `input_${file.name.replace(/[^a-zA-Z0-9]/g, '_')}`;
				const data = await fetchFile(file);
				await ffmpeg.writeFile(inputName, data);

				const arrayBuffer = await file.arrayBuffer();
				const audioBuffer = await new AudioContext().decodeAudioData(arrayBuffer);
				audioBufferMap[file.name] = audioBuffer;
				const duration = audioBuffer.duration;

				// Seed per-file range defaults.
				timeRangeMap[file.name] = { start: 0, end: duration };
				// ampRangeMap[file.name] = { min: minAmp, max: maxAmp };
				freqRangeMap[file.name] = { min: minFreq, max: Math.min(maxFreq, NYQUIST_HZ) };
				audioDurationMap[file.name] = duration;

				// Append to file state.
				originalAudioFiles = [...originalAudioFiles, file];
				audioDataArray = [...audioDataArray, { name: file.name, inputName }];
				selectedFiles = [...selectedFiles, { id: crypto.randomUUID(), name: file.name }];

				delete pendingDurationMap[file.name];
				pendingDurationMap = { ...pendingDurationMap };

				completed += 1;
				ingestProgress = Math.round((completed / incoming.length) * 100);
			})
		);

		await tick();
		isIngesting = false;
		pendingDurationMap = {};
	}

	/** Syncs file arrays with the drag-and-drop reorder from filelist. */
	function handleReorder({ detail }: CustomEvent) {
		selectedFiles = detail.items;

		originalAudioFiles = selectedFiles
			.map((f) => originalAudioFiles.find((of) => of.name === f.name))
			.filter((f): f is File => f !== undefined);

		audioDataArray = selectedFiles
			.map((f) => audioDataArray.find((a) => a.name === f.name))
			.filter((a): a is { name: string; inputName: string } => a !== undefined);
	}

	/** Removes a file and clears its derived state across all per-file maps. */
	function cleanupFileState(name: string) {
		selectedFiles = selectedFiles.filter((f) => f.name !== name);
		originalAudioFiles = originalAudioFiles.filter((f) => f.name !== name);
		audioDataArray = audioDataArray.filter((a) => a.name !== name);
		delete waveformDataMap[name];
		delete audioDurationMap[name];
		delete pendingDurationMap[name];
		pendingDurationMap = { ...pendingDurationMap };
		delete timeRangeMap[name];
		delete ampRangeMap[name];
		delete freqRangeMap[name];
		delete ampValuesMap[name];
		delete timeValuesMap[name];
		delete freqValuesMap[name];
		delete waveformRefs[name];
		delete spectrogramRefs[name];
		delete waveformContainerEls[name];
		delete spectrogramFirstRendered[name];
		delete waveformHeights[name];
		delete spectrogramHeights[name];
		delete waveformLoadingMap[name];
		delete audioBufferMap[name];
		delete lastExtractedRange[name];
		delete showDetailsMap[name];
		delete showSlidersMap[name];
	}

	function removeFile(name: string) {
		cleanupFileState(name);

		if (selectedFiles.length === 0) {
			showWaveform = false;
			showSpectrogram = false;
		}
	}

	function removeAllFiles() {
		for (const f of [...selectedFiles]) {
			cleanupFileState(f.name);
		}
		showWaveform = false;
		showSpectrogram = false;
	}

	function handleTimeChange(event: CustomEvent<{ values: number[] }>, fileName: string) {
		const [start, end] = event.detail.values;
		timeRangeMap[fileName] = { start, end };
	}

	function handleAmpChange(event: CustomEvent<{ values: number[] }>, fileName: string) {
		const [min, max] = event.detail.values;
		ampRangeMap[fileName] = { min, max };
	}

	function handleFreqChange(event: CustomEvent<{ values: number[] }>, fileName: string) {
		const [min, max] = event.detail.values;
		freqRangeMap[fileName] = { min, max };
	}

	function handleAllTimeChange(start: number, end: number) {
		startTime = start;
		endTime = end;
		for (const { name } of audioDataArray) {
			timeRangeMap[name] = { start, end };
		}
	}

	function handleAllAmpChange(min: number, max: number) {
		minAmp = min;
		maxAmp = max;

		for (const { name } of audioDataArray) {
			ampRangeMap[name] = { min, max };
		}
	}

	function handleAllFreqChange(min: number, max: number) {
		minFreq = min;
		maxFreq = max;
		for (const { name } of audioDataArray) {
			freqRangeMap[name] = { min, max };
		}
	}

	/**
	 * Toggles waveform/spectrogram views and regenerates if needed.
	 * Bumping *Version invalidates downstream {#key} blocks so children remount cleanly.
	 */
	function handleVisChange(wave: boolean, spec: boolean) {
		const changedWaveform = wave !== showWaveform;
		const changedSpectrogram = spec !== showSpectrogram;

		showWaveform = wave;
		showSpectrogram = spec;

		if (changedWaveform) waveformVersion += 1;
		if (changedSpectrogram) spectrogramVersion += 1;
	}

	// Per-file slider state: first two blocks seed ampValuesMap/timeValuesMap from each
	// file's extent on first appearance; third block pushes slider edits back into the
	// canonical ampRangeMap/timeRangeMap consumed by renderers.
	$: {
		for (const audioFile of audioDataArray) {
			if (!ampValuesMap[audioFile.name]) {
				ampValuesMap[audioFile.name] = [
					ampRangeMap[audioFile.name]?.min ?? waveformDataMap[audioFile.name]?.minAmp ?? -0.01,
					ampRangeMap[audioFile.name]?.max ?? waveformDataMap[audioFile.name]?.maxAmp ?? 0.01
				];
			}
		}
	}

	$: {
		for (const audioFile of audioDataArray) {
			if (!timeValuesMap[audioFile.name]) {
				timeValuesMap[audioFile.name] = [
					timeRangeMap[audioFile.name]?.start ?? 0,
					timeRangeMap[audioFile.name]?.end ?? audioDurationMap[audioFile.name] ?? 10
				];
			}
		}
	}

	$: {
		for (const audioFile of audioDataArray) {
			if (!freqValuesMap[audioFile.name]) {
				freqValuesMap[audioFile.name] = [
					freqRangeMap[audioFile.name]?.min ?? minFreq,
					freqRangeMap[audioFile.name]?.max ?? maxFreq
				];
			}
		}
	}

	$: {
		for (const audioFile of audioDataArray) {
			const ampvalues = ampValuesMap[audioFile.name];
			if (ampvalues) {
				ampRangeMap[audioFile.name] = { min: ampvalues[0], max: ampvalues[1] };
			}

			const timevalues = timeValuesMap[audioFile.name];
			if (timevalues) {
				timeRangeMap[audioFile.name] = { start: timevalues[0], end: timevalues[1] };
			}

			const freqvalues = freqValuesMap[audioFile.name];
			if (freqvalues) {
				freqRangeMap[audioFile.name] = { min: freqvalues[0], max: freqvalues[1] };
			}
		}
	}

	$: if (showWaveform) {
		for (const af of audioDataArray) {
			const name = af.name;
			const buf = audioBufferMap[name];
			const range = timeRangeMap[name];
			if (!buf) {
				waveformLoadingMap[name] = true;
				continue;
			}
			if (!range) continue;
			const last = lastExtractedRange[name];
			if (!last || last[0] !== range.start || last[1] !== range.end) {
				const data = extractWaveformData(buf, range.start, range.end);
				waveformDataMap[name] = data;
				if (!last) {
					ampRangeMap[name] = { min: data.minAmp, max: data.maxAmp };
				}
				lastExtractedRange[name] = [range.start, range.end];
			}
			waveformLoadingMap[name] = false;
		}
		waveformDataMap = { ...waveformDataMap };
		waveformLoadingMap = { ...waveformLoadingMap };
		ampRangeMap = { ...ampRangeMap };
	}
</script>

<svelte:window on:click={handleDownloadOutsideClick} />

<div class="mb-6">
	<Fileselector
		disabled={!isFFmpegReady || isIngesting}
		on:select={(e) => processFiles(e.detail)}
	/>

	{#if isIngesting}
		<div class="mt-6 rounded-lg bg-gray-100 p-4">
			<p class="font-medium">
				Uploading <code>.wav</code>
				{ingestingTotal === 1 ? 'file' : 'files'}...
			</p>
			<div class="h-4 w-full rounded-full bg-gray-200">
				<div
					class="h-4 rounded-full bg-blue-600 transition-all duration-300"
					style="width: {ingestProgress}%"
				></div>
			</div>
			<p class="mt-1 text-sm text-gray-600">{ingestProgress}% complete</p>
			{#if hasLongPendingFile}
				<div
					class="mt-3 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-sm text-amber-800"
					role="status"
				>
					<svg
						class="mt-0.5 h-4 w-4 flex-shrink-0"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						viewBox="0 0 24 24"
						aria-hidden="true"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M12 9v4m0 4h.01M10.29 3.86l-8.18 14.14A2 2 0 003.84 21h16.32a2 2 0 001.73-2.99L13.71 3.86a2 2 0 00-3.42 0z"
						/>
					</svg>
					<span>One or more files exceed 1 hour — upload and processing may take a while.</span>
				</div>
			{/if}
		</div>
	{:else}
		<Filelist {selectedFiles} {audioDurationMap} {removeFile} {removeAllFiles} {handleReorder} />
	{/if}

	{#if selectedFiles.length > 0}
		<Rangeinput
			label="Time Range"
			description="Sets the horizontal (x-axis) bounds of each plot — what portion of the audio to show."
			unit="(seconds)"
			minLabel="Start Time"
			maxLabel="End Time"
			minValue={startTime}
			maxValue={endTime}
			step={0.1}
			onChange={handleAllTimeChange}
		/>

		<Rangeinput
			label="Amplitude Range"
			description="Sets the vertical (y-axis) bounds of the waveform — how loud the sound is."
			unit=""
			minLabel="Min Amplitude"
			maxLabel="Max Amplitude"
			minValue={minAmp}
			maxValue={maxAmp}
			step={0.00001}
			onChange={handleAllAmpChange}
		/>

		<Rangeinput
			label="Frequency Range"
			description="Sets the vertical (y-axis) bounds of the spectrogram — the pitch of the sound."
			unit="(Hz)"
			minLabel="Min Frequency"
			maxLabel="Max Frequency"
			minValue={minFreq}
			maxValue={maxFreq}
			step={10}
			onChange={handleAllFreqChange}
		/>

		<div class="mt-6">
			<Viewselector bind:showWaveform bind:showSpectrogram onChange={handleVisChange} />
		</div>
	{/if}

	{#if showWaveform}
		<div class="mt-6 grid grid-cols-4 gap-4">
			{#each audioDataArray as audioFile (audioFile.name)}
				{#key `mini-${audioFile.name}-${waveformVersion}`}
					<Miniwaveform
						waveformData={waveformDataMap[audioFile.name]?.waveform ?? []}
						startTime={timeRangeMap[audioFile.name]?.start ?? 0}
						endTime={timeRangeMap[audioFile.name]?.end ?? 10}
						minAmp={ampRangeMap[audioFile.name]?.min ??
							waveformDataMap[audioFile.name]?.minAmp ??
							minAmp}
						maxAmp={ampRangeMap[audioFile.name]?.max ??
							waveformDataMap[audioFile.name]?.maxAmp ??
							maxAmp}
						audioFileName={audioFile.name}
						on:select={(e) => focusWaveform(e.detail.name)}
					/>
				{/key}
			{/each}
		</div>
	{/if}

	{#if (showWaveform || showSpectrogram) && audioDataArray.length > 0}
		{#each audioDataArray as audioFile (audioFile.name)}
			{#if showWaveform}
				<div
					bind:this={waveformContainerEls[audioFile.name]}
					class="mt-6 overflow-hidden rounded-lg border bg-gray-100 p-4 shadow"
					class:waveform-glow={glowedWaveform === audioFile.name}
				>
					<div class="mb-4 flex items-center justify-between">
						<h3
							class="animate-fade-in bg-gradient-to-r from-green-800 to-green-500 bg-clip-text text-lg font-bold text-transparent"
						>
							{audioFile.name} — Waveform
						</h3>
						{#if !waveformLoadingMap[audioFile.name]}
							<div class="flex gap-2">
								{#if showDownload}
									{@const waveKey = `${audioFile.name}::wave`}
									<div class="relative" data-download-menu>
										<button
											type="button"
											aria-haspopup="menu"
											aria-expanded={openDownloadMenu === waveKey}
											aria-label={`Download waveform for ${audioFile.name}`}
											class="flex items-center gap-1 rounded-md border border-green-500 bg-green-50 px-3 py-1 text-xs font-medium text-green-700 transition hover:bg-green-100"
											on:click={() =>
												(openDownloadMenu = openDownloadMenu === waveKey ? null : waveKey)}
										>
											Download
											<svg
												aria-hidden="true"
												class="h-3 w-3"
												viewBox="0 0 12 12"
												fill="none"
												stroke="currentColor"
												stroke-width="1.5"
											>
												<path d="M3 4.5l3 3 3-3" stroke-linecap="round" stroke-linejoin="round" />
											</svg>
										</button>
										{#if openDownloadMenu === waveKey}
											<div
												role="menu"
												aria-label={`Download format for ${audioFile.name} waveform`}
												class="absolute right-0 z-10 mt-1 w-28 divide-y divide-green-200 overflow-hidden rounded-md border border-green-500 bg-white shadow-md"
											>
												<button
													type="button"
													role="menuitem"
													aria-label="Download as PNG"
													class="block w-full px-3 py-1 text-left text-xs font-medium text-green-700 transition hover:bg-green-100"
													on:click={() => handleDownload(audioFile.name, 'wave', 'png')}
													>.png</button
												>
												<button
													type="button"
													role="menuitem"
													aria-label="Download as JPEG"
													class="block w-full px-3 py-1 text-left text-xs font-medium text-green-700 transition hover:bg-green-100"
													on:click={() => handleDownload(audioFile.name, 'wave', 'jpeg')}
													>.jpeg</button
												>
												<button
													type="button"
													role="menuitem"
													aria-label="Download as SVG"
													class="block w-full px-3 py-1 text-left text-xs font-medium text-green-700 transition hover:bg-green-100"
													on:click={() => handleDownload(audioFile.name, 'wave', 'svg')}
													>.svg</button
												>
											</div>
										{/if}
									</div>
								{/if}
								<Togglebutton
									label="Details"
									show={!!showDetailsMap[audioFile.name]}
									onToggle={() => {
										showDetailsMap[audioFile.name] = !showDetailsMap[audioFile.name];
										showDetailsMap = { ...showDetailsMap };
									}}
								/>
								<Togglebutton
									label="Sliders"
									show={!!showSlidersMap[audioFile.name]}
									onToggle={() => {
										showSlidersMap[audioFile.name] = !showSlidersMap[audioFile.name];
										showSlidersMap = { ...showSlidersMap };
									}}
								/>
							</div>
						{/if}
					</div>

					{#if showDetailsMap[audioFile.name]}
						<div class="mt-2 text-sm text-gray-600">
							<p class="font-medium text-gray-800">
								Rendering Details for <span class="font-semibold text-green-700"
									>{audioFile.name}</span
								>
							</p>
							<ul class="mt-1 list-inside list-disc space-y-0.5">
								<li>
									<span class="font-medium">Start Time:</span>
									{timeRangeMap[audioFile.name]?.start ?? 0}s
								</li>
								<li>
									<span class="font-medium">End Time:</span>
									{timeRangeMap[audioFile.name]?.end ?? 10}s
								</li>
								<li>
									<span class="font-medium">Amplitude Range:</span>
									{ampRangeMap[audioFile.name]?.min ?? minAmp} → {ampRangeMap[audioFile.name]
										?.max ?? maxAmp}
								</li>
								<li>
									<span class="font-medium">Audio Length:</span>
									{audioDurationMap[audioFile.name]?.toFixed(2)} seconds
								</li>
							</ul>
						</div>
					{/if}

					<div class="flex justify-end gap-2">
						<!-- Reset button for waveform -->
						{#if showSlidersMap[audioFile.name] && showReset}
							<button
								type="button"
								aria-label={`Reset waveform amplitude and time range for ${audioFile.name}`}
								class="rounded-md border border-red-300 px-3 py-1 text-xs font-medium text-red-700 transition hover:bg-red-50"
								on:click={() => {
									timeRangeMap[audioFile.name] = {
										start: 0,
										end: audioDurationMap[audioFile.name] ?? 10
									};
									ampRangeMap[audioFile.name] = {
										min: waveformDataMap[audioFile.name]?.minAmp ?? -0.01,
										max: waveformDataMap[audioFile.name]?.maxAmp ?? 0.01
									};

									timeRangeMap = { ...timeRangeMap };
									ampRangeMap = { ...ampRangeMap };
								}}
							>
								Reset Changes
							</button>
						{/if}
					</div>

					<!-- {#key `waveform-${audioFile.inputName}-${waveformVersion}`}
						<div class="mx-auto items-center">
							<Waveform
								waveformData={waveformDataMap[audioFile.name]?.waveform ?? []}
								startTime={timeRangeMap[audioFile.name]?.start ?? 0}
								endTime={timeRangeMap[audioFile.name]?.end ?? 10}
								minAmp={ampRangeMap[audioFile.name]?.min ??
									waveformDataMap[audioFile.name]?.minAmp ??
									minAmp}
								maxAmp={ampRangeMap[audioFile.name]?.max ??
									waveformDataMap[audioFile.name]?.maxAmp ??
									maxAmp}
								{scrollY}
							/>
						</div>
						{#if showSlidersMap[audioFile.name]}
							<div class=" px-7">
								<Rangeslider
									title="Time"
									vertical={true}
									min={0}
									max={audioDurationMap[audioFile.name] ?? 100}
									start={[
										timeRangeMap[audioFile.name]?.start ?? 0,
										timeRangeMap[audioFile.name]?.end ?? 10
									]}
									step={1}
									on:change={(e) => handleTimeChange(e, audioFile.name)}
								/>
								<Rangeslider
									title="Amplitude"
									min={-0.01}
									max={0.01}
									start={[
										ampRangeMap[audioFile.name]?.min ?? -0.01,
										ampRangeMap[audioFile.name]?.max ?? 0.01
									]}
									step={0.00001}
									on:change={(e) => handleAmpChange(e, audioFile.name)}
								/>
							</div>
						{/if}
					{/key} -->
					{#key `waveform-${audioFile.inputName}-${waveformVersion}`}
						<!-- 2026-05-08: time slider returned to the right column so it spans only the
							 waveform width; the amp column gains the corresponding height via items-stretch.
							 `pb-12` shortens the slider so its bottom input clears the horizontal time
							 slider below. The actual scroll-jump fix lives in waveform.svelte (aspect-ratio
							 on the rendered container). -->
						<div
							class={showSlidersMap[audioFile.name]
								? 'flex items-stretch gap-8'
								: 'mx-auto items-center'}
						>
							{#if showSlidersMap[audioFile.name]}
								<div class="flex w-32 flex-col pb-12" style="flex: 0 0 auto">
									<div class="flex flex-1 flex-col">
										<Rangeslider
											title="Amplitude"
											vertical={true}
											min={waveformDataMap[audioFile.name]?.minAmp ?? -0.01}
											max={waveformDataMap[audioFile.name]?.maxAmp ?? 0.01}
											step={0.00001}
											start={[
												ampRangeMap[audioFile.name]?.min ??
													waveformDataMap[audioFile.name]?.minAmp ??
													-0.01,
												ampRangeMap[audioFile.name]?.max ??
													waveformDataMap[audioFile.name]?.maxAmp ??
													0.01
											]}
											bind:values={ampValuesMap[audioFile.name]}
											on:change={(e) => handleAmpChange(e, audioFile.name)}
											height="100%"
										/>
									</div>
								</div>
							{/if}

							<div class={showSlidersMap[audioFile.name] ? 'flex flex-grow flex-col' : 'contents'}>
								<Waveform
									bind:this={waveformRefs[audioFile.name]}
									bind:computedHeight={waveformHeights[audioFile.name]}
									waveformData={waveformDataMap[audioFile.name]?.waveform ?? []}
									startTime={timeRangeMap[audioFile.name]?.start ?? 0}
									endTime={timeRangeMap[audioFile.name]?.end ?? 10}
									minAmp={ampRangeMap[audioFile.name]?.min ??
										waveformDataMap[audioFile.name]?.minAmp ??
										minAmp}
									maxAmp={ampRangeMap[audioFile.name]?.max ??
										waveformDataMap[audioFile.name]?.maxAmp ??
										maxAmp}
									audioFileName={audioFile.name}
									loading={waveformLoadingMap[audioFile.name] ?? false}
									audioDurationSec={audioDurationMap[audioFile.name] ?? 0}
								/>

								{#if showSlidersMap[audioFile.name]}
									<div class="mt-2 w-full">
										<Rangeslider
											title="Time"
											vertical={false}
											min={0}
											max={audioDurationMap[audioFile.name] ?? 100}
											start={[
												timeRangeMap[audioFile.name]?.start ?? 0,
												timeRangeMap[audioFile.name]?.end ?? 10
											]}
											step={0.001}
											on:change={(e) => handleTimeChange(e, audioFile.name)}
											bind:values={timeValuesMap[audioFile.name]}
										/>
									</div>
								{/if}
							</div>
						</div>
					{/key}
				</div>
			{/if}

			{#if showSpectrogram}
				<div class="mt-6 overflow-hidden rounded-lg border bg-gray-100 p-4 shadow">
					<!-- <div class="mb-4 flex items-center justify-between">
						<h3
							class="animate-fade-in bg-gradient-to-r from-green-800 to-green-500 bg-clip-text text-lg font-bold text-transparent"
						>
							{audioFile.name} — Spectrogram
						</h3>
						<div class="flex gap-2">
							<Togglebutton
								label="Details"
								show={showDetails}
								onToggle={() => (showDetails = !showDetails)}
							/>
							<Togglebutton
								label="Sliders"
								show={showSliders}
								onToggle={() => (showSliders = !showSliders)}
							/>
						</div>
					</div> -->

					<div class="mb-4 flex items-center justify-between">
						<h3
							class="animate-fade-in bg-gradient-to-r from-green-800 to-green-500 bg-clip-text text-lg font-bold text-transparent"
						>
							{audioFile.name} — Spectrogram
						</h3>
						{#if spectrogramFirstRendered[audioFile.name] || !$spectrogramBusy}
							<div class="flex gap-2">
								{#if showDownload}
									{@const specKey = `${audioFile.name}::spec`}
									<div class="relative" data-download-menu>
										<button
											type="button"
											aria-haspopup="menu"
											aria-expanded={openDownloadMenu === specKey}
											aria-label={`Download spectrogram for ${audioFile.name}`}
											class="flex items-center gap-1 rounded-md border border-green-500 bg-green-50 px-3 py-1 text-xs font-medium text-green-700 transition hover:bg-green-100"
											on:click={() =>
												(openDownloadMenu = openDownloadMenu === specKey ? null : specKey)}
										>
											Download
											<svg
												aria-hidden="true"
												class="h-3 w-3"
												viewBox="0 0 12 12"
												fill="none"
												stroke="currentColor"
												stroke-width="1.5"
											>
												<path d="M3 4.5l3 3 3-3" stroke-linecap="round" stroke-linejoin="round" />
											</svg>
										</button>
										{#if openDownloadMenu === specKey}
											<div
												role="menu"
												aria-label={`Download format for ${audioFile.name} spectrogram`}
												class="absolute right-0 z-10 mt-1 w-28 divide-y divide-green-200 overflow-hidden rounded-md border border-green-500 bg-white shadow-md"
											>
												<button
													type="button"
													role="menuitem"
													aria-label="Download as PNG"
													class="block w-full px-3 py-1 text-left text-xs font-medium text-green-700 transition hover:bg-green-100"
													on:click={() => handleDownload(audioFile.name, 'spec', 'png')}
													>.png</button
												>
												<button
													type="button"
													role="menuitem"
													aria-label="Download as JPEG"
													class="block w-full px-3 py-1 text-left text-xs font-medium text-green-700 transition hover:bg-green-100"
													on:click={() => handleDownload(audioFile.name, 'spec', 'jpeg')}
													>.jpeg</button
												>
												<button
													type="button"
													role="menuitem"
													aria-label="Download as SVG"
													class="block w-full px-3 py-1 text-left text-xs font-medium text-green-700 transition hover:bg-green-100"
													on:click={() => handleDownload(audioFile.name, 'spec', 'svg')}
													>.svg</button
												>
											</div>
										{/if}
									</div>
								{/if}
								<Togglebutton
									label="Details"
									show={!!showDetailsMap[audioFile.name]}
									onToggle={() => {
										showDetailsMap[audioFile.name] = !showDetailsMap[audioFile.name];
										showDetailsMap = { ...showDetailsMap };
									}}
								/>
								<Togglebutton
									label="Sliders"
									show={!!showSlidersMap[audioFile.name]}
									onToggle={() => {
										showSlidersMap[audioFile.name] = !showSlidersMap[audioFile.name];
										showSlidersMap = { ...showSlidersMap };
									}}
								/>
							</div>
						{/if}
					</div>

					{#if showDetailsMap[audioFile.name]}
						<div class="mt-2 text-sm text-gray-600">
							<p class="font-medium text-gray-800">
								Rendering Details for <span class="font-semibold text-green-700"
									>{audioFile.name}</span
								>
							</p>
							<ul class="mt-1 list-inside list-disc space-y-0.5">
								<li>
									<span class="font-medium">Start Time:</span>
									{timeRangeMap[audioFile.name]?.start ?? 0}s
								</li>
								<li>
									<span class="font-medium">End Time:</span>
									{timeRangeMap[audioFile.name]?.end ?? 10}s
								</li>
								<li>
									<span class="font-medium">Frequency Range:</span>
									{freqRangeMap[audioFile.name]?.min ?? minFreq} Hz → {freqRangeMap[audioFile.name]
										?.max ?? maxFreq} Hz
								</li>
								<li>
									<span class="font-medium">Audio Length:</span>
									{audioDurationMap[audioFile.name]?.toFixed(2)} seconds
								</li>
							</ul>
						</div>
					{/if}

					{#key `spectrogram-${audioFile.inputName}-${spectrogramVersion}`}
						{@const nyquist = NYQUIST_HZ}
						<!-- 2026-05-08: time slider returned to the right column so it spans only the
							 spectrogram width; the freq column gains the corresponding height via items-stretch.
							 `pb-12` matches the waveform block above. -->
						<div
							class={showSlidersMap[audioFile.name]
								? 'flex items-stretch gap-8'
								: 'mx-auto flex flex-col items-center'}
						>
							{#if showSlidersMap[audioFile.name]}
								<div class="flex w-32 flex-col pb-12" style="flex: 0 0 auto">
									<div class="flex flex-1 flex-col">
										<Rangeslider
											title="Frequency"
											vertical={true}
											min={0}
											max={nyquist}
											step={10}
											format={{
												to: (value: number) => value.toFixed(1),
												from: (value: string) => parseFloat(value)
											}}
											start={[
												freqRangeMap[audioFile.name]?.min ?? 0,
												freqRangeMap[audioFile.name]?.max ?? Math.min(3000, nyquist)
											]}
											bind:values={freqValuesMap[audioFile.name]}
											on:change={(e) => handleFreqChange(e, audioFile.name)}
											height="100%"
										/>
									</div>
								</div>
							{/if}

							<div
								class={showSlidersMap[audioFile.name]
									? 'flex min-w-0 flex-grow flex-col'
									: 'contents'}
							>
								<Spectrogram
									bind:this={spectrogramRefs[audioFile.name]}
									bind:hasRendered={spectrogramFirstRendered[audioFile.name]}
									{ffmpeg}
									bind:computedHeight={spectrogramHeights[audioFile.name]}
									inputFileName={audioFile.inputName}
									audioFileName={audioFile.name}
									audioBuffer={audioBufferMap[audioFile.name] ?? null}
									startTime={timeRangeMap[audioFile.name]?.start ?? 0}
									endTime={timeRangeMap[audioFile.name]?.end ?? 10}
									minFreq={freqRangeMap[audioFile.name]?.min ?? 0}
									maxFreq={freqRangeMap[audioFile.name]?.max ?? Math.min(3000, NYQUIST_HZ)}
								>
									<svelte:fragment slot="actions">
										{#if showSlidersMap[audioFile.name] && showReset}
											<button
												type="button"
												aria-label={`Reset spectrogram time and frequency range for ${audioFile.name}`}
												class="rounded-md border border-red-300 px-3 py-1 text-xs font-medium text-red-700 transition hover:bg-red-50"
												on:click={() => {
													timeRangeMap[audioFile.name] = {
														start: 0,
														end: audioDurationMap[audioFile.name] ?? 10
													};
													ampRangeMap[audioFile.name] = {
														min: waveformDataMap[audioFile.name]?.minAmp ?? -0.01,
														max: waveformDataMap[audioFile.name]?.maxAmp ?? 0.01
													};

													timeRangeMap = { ...timeRangeMap };
													ampRangeMap = { ...ampRangeMap };
												}}
											>
												Reset Changes
											</button>
										{/if}
									</svelte:fragment>
								</Spectrogram>

								{#if showSlidersMap[audioFile.name]}
									<div class="mt-2 w-full">
										<Rangeslider
											title="Time"
											vertical={false}
											min={0}
											max={audioDurationMap[audioFile.name] ?? 100}
											step={0.001}
											start={[
												timeRangeMap[audioFile.name]?.start ?? 0,
												timeRangeMap[audioFile.name]?.end ?? audioDurationMap[audioFile.name] ?? 10
											]}
											bind:values={timeValuesMap[audioFile.name]}
											on:change={(e) => handleTimeChange(e, audioFile.name)}
										/>
									</div>
								{/if}
							</div>
						</div>
					{/key}
				</div>
			{/if}
		{/each}
	{/if}
</div>

<style>
	@keyframes waveform-glow {
		0% {
			box-shadow: 0 0 0 0 rgba(34, 197, 94, 0);
		}
		30% {
			box-shadow: 0 0 16px 4px rgba(34, 197, 94, 0.6);
		}
		100% {
			box-shadow: 0 0 0 0 rgba(34, 197, 94, 0);
		}
	}
	.waveform-glow {
		animation: waveform-glow 2.5s ease-out;
	}
</style>
