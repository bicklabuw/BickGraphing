<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { initFFmpeg } from '$lib/utils/audioProcessing';
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

	let debug = true;
	let isProcessing = false;
	let processingProgress = 0;
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
	let timeRangeMap: Record<string, { start: number; end: number }> = {};
	let ampRangeMap: Record<string, { min: number; max: number }> = {};
	let freqRangeMap: Record<string, { min: number; max: number }> = {};

	let ampValuesMap: Record<string, [number, number]> = {};
	let timeValuesMap: Record<string, [number, number]> = {};

	let waveformVersion = 0;
	let spectrogramVersion = 0;

	let startTime = 0;
	let endTime = 10;
	let minAmp = -0.01;
	let maxAmp = 0.01;
	let minFreq = 0;
	let maxFreq = 5000;

	let waveformRefs: Record<string, Waveform | null> = {};

	let showWaveform = false;
	let showSpectrogram = false;
	let showDetails = false;
	let showSliders = false;
	let showReset = true;
	let showDownload = true;

	let scrollY = 0; // Track scroll position for re-rendering

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

	async function processFiles(files: FileList | File[]) {
		const newFiles = Array.from(files).filter(
			(file) => !selectedFiles.some((f) => f.name === file.name)
		);
		if (debug) console.log('Processing files:', newFiles);

		if (debug) {
			for (let file of files) {
				console.log(file);
				console.log(`Processing file: ${file.name}`);
				console.log(`File size: ${file.size} bytes`);
				console.log(`File type: ${file.type}`);
			}
		}

		if (!newFiles.length) return;

		isProcessing = true;

		await Promise.all(
			newFiles.map(async (file) => {
				if (!ffmpeg) return;

				const inputName = `input_${file.name.replace(/[^a-zA-Z0-9]/g, '_')}`;
				const data = await fetchFile(file);
				await ffmpeg.writeFile(inputName, data);

				const arrayBuffer = await file.arrayBuffer();
				const audioBuffer = await new AudioContext().decodeAudioData(arrayBuffer);
				const duration = audioBuffer.duration;

				// 🧠 Set defaults for this file
				timeRangeMap[file.name] = { start: 0, end: duration };
				// ampRangeMap[file.name] = { min: minAmp, max: maxAmp };
				freqRangeMap[file.name] = { min: minFreq, max: maxFreq };
				audioDurationMap[file.name] = duration;

				// 📦 Add to file state
				originalAudioFiles = [...originalAudioFiles, file];
				audioDataArray = [...audioDataArray, { name: file.name, inputName }];
				selectedFiles = [...selectedFiles, { id: crypto.randomUUID(), name: file.name }];
			})
		);

		await tick();

		// ✅ Rerun graph generation for all
		if (showWaveform || showSpectrogram) {
			update_graph_versions(true, false); // triggers re-render
			await generateVisualizations();
		}

		isProcessing = false;
	}

	function handleReorder({ detail }: CustomEvent) {
		selectedFiles = detail.items;

		originalAudioFiles = selectedFiles
			.map((f) => originalAudioFiles.find((of) => of.name === f.name))
			.filter((f): f is File => f !== undefined);

		audioDataArray = selectedFiles
			.map((f) => audioDataArray.find((a) => a.name === f.name))
			.filter((a): a is { name: string; inputName: string } => a !== undefined);
	}

	function removeFile(name: string) {
		selectedFiles = selectedFiles.filter((f) => f.name !== name);
		originalAudioFiles = originalAudioFiles.filter((f) => f.name !== name);
		audioDataArray = audioDataArray.filter((a) => a.name !== name);
		delete waveformDataMap[name];
		delete audioDurationMap[name];
	}

	function extractWaveformData(audioBuffer: AudioBuffer, start: number, end: number) {
		const sampleRate = audioBuffer.sampleRate;
		const startSample = Math.floor(start * sampleRate);
		const endSample = Math.min(Math.floor(end * sampleRate), audioBuffer.length);
		const channelData = audioBuffer.getChannelData(0);
		const maxPoints = 5000;
		const totalSamples = endSample - startSample;
		const step = totalSamples > maxPoints ? Math.floor(totalSamples / maxPoints) : 1;
		const waveform = [];

		let minAmplitude = Infinity;
		let maxAmplitude = -Infinity;

		for (let i = startSample; i < endSample; i += step) {
			waveform.push({
				time: i / sampleRate,
				amplitude: channelData[i]
			});

			minAmplitude = Math.min(minAmplitude, channelData[i]);
			maxAmplitude = Math.max(maxAmplitude, channelData[i]);
		}

		if (debug) {
			console.log(`Extracted waveform data from ${start}s to ${end}s: ${waveform.length} points`);
			console.log(`Amplitude range: ${minAmplitude} to ${maxAmplitude}`);
		}

		return {
			waveform: waveform,
			minAmp: minAmplitude,
			maxAmp: maxAmplitude
		};
	}

	function update_graph_versions(waveform: boolean, spectrogram: boolean) {
		if (waveform) waveformVersion += 1;
		if (spectrogram) spectrogramVersion += 1;

		scrollY = window.scrollY; // Capture scroll position before re-render

		if (debug) console.log('New Scroll Position:', scrollY);
	}

	async function generateVisualizations() {
		if (!isFFmpegReady || !ffmpeg) {
			alert(
				'Please load FFmpeg first. - If you are reading this error, the site will not be able to graph files'
			);
			return;
		}

		if (startTime >= endTime) {
			console.warn('Invalid time range: start >= end');
			return;
		}

		isProcessing = true;
		processingProgress = 0;

		const audioContext = new AudioContext();

		if (debug) {
			console.log(
				`Generating visualizations for ${originalAudioFiles.length} audio files from ${startTime}s to ${endTime}s`
			);
		}

		for (let i = 0; i < originalAudioFiles.length; i++) {
			const file = originalAudioFiles[i];
			const arrayBuffer = await file.arrayBuffer();
			const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
			audioDurationMap[file.name] = audioBuffer.duration;
			const { start, end } = timeRangeMap[file.name] ?? { start: 0, end: audioBuffer.duration };
			const duration = audioBuffer.duration;
			audioDurationMap[file.name] = duration;

			if (start >= duration) {
				console.warn(
					`Skipping ${file.name}: selected time range [${start}, ${end}] is outside duration (${duration})`
				);
				continue;
			}

			if (showWaveform) {
				waveformDataMap[file.name] = extractWaveformData(audioBuffer, start, end);
				ampRangeMap[file.name] = {
					min: waveformDataMap[file.name].minAmp,
					max: waveformDataMap[file.name].maxAmp
				};

				if (debug) {
					console.log(`Extracted waveform data for ${file.name} from ${start}s to ${end}s`);
					console.log(
						`Waveform points: ${waveformDataMap[file.name].waveform.length}, Min Amp: ${waveformDataMap[file.name].minAmp}, Max Amp: ${waveformDataMap[file.name].maxAmp}`
					);
				}
			}

			if (!showWaveform) {
				delete waveformDataMap[file.name];
			}
			processingProgress = Math.round(((i + 1) / originalAudioFiles.length) * 100);
		}

		isProcessing = false;
		update_graph_versions(true, false);
		await tick();
	}

	function handleTimeChange(event: CustomEvent<{ values: number[] }>, fileName: string) {
		const [start, end] = event.detail.values;
		timeRangeMap[fileName] = { start, end };
		update_graph_versions(showWaveform, showSpectrogram);
	}

	function handleAmpChange(event: CustomEvent<{ values: number[] }>, fileName: string) {
		const [min, max] = event.detail.values;
		ampRangeMap[fileName] = { min, max };
		update_graph_versions(true, false);
	}

	function handleFreqChange(event: CustomEvent<{ values: number[] }>, fileName: string) {
		const [min, max] = event.detail.values;
		freqRangeMap[fileName] = { min, max };
		update_graph_versions(false, true);
	}

	function handleAllTimeChange(start: number, end: number) {
		startTime = start;
		endTime = end;
		for (const { name } of audioDataArray) {
			timeRangeMap[name] = { start, end };
		}
		update_graph_versions(showWaveform, showSpectrogram);
	}

	function handleAllAmpChange(min: number, max: number) {
		minAmp = min;
		maxAmp = max;

		for (const { name } of audioDataArray) {
			ampRangeMap[name] = { min, max };
		}

		if (showWaveform) {
			update_graph_versions(true, false);
		}
	}

	function handleAllFreqChange(min: number, max: number) {
		minFreq = min;
		maxFreq = max;
		for (const { name } of audioDataArray) {
			freqRangeMap[name] = { min, max };
		}
		update_graph_versions(false, true);
	}

	function handleVisChange(wave: boolean, spec: boolean) {
		const changedWaveform = wave !== showWaveform;
		const changedSpectrogram = spec !== showSpectrogram;

		showWaveform = wave;
		showSpectrogram = spec;

		if (audioDataArray.length > 0 && (wave || spec)) {
			generateVisualizations();
		}

		if (changedWaveform) waveformVersion += 1;
		if (changedSpectrogram) spectrogramVersion += 1;
	}

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
			const ampvalues = ampValuesMap[audioFile.name];
			if (ampvalues) {
				ampRangeMap[audioFile.name] = { min: ampvalues[0], max: ampvalues[1] };
			}

			const timevalues = timeValuesMap[audioFile.name];
			if (timevalues) {
				timeRangeMap[audioFile.name] = { start: timevalues[0], end: timevalues[1] };
			}
		}
	}
</script>

<div class="mb-6">
	<Fileselector
		disabled={!isFFmpegReady || isProcessing}
		on:select={(e) => processFiles(e.detail)}
	/>

	<Filelist {selectedFiles} {audioDurationMap} {removeFile} {handleReorder} />

	<Rangeinput
		label="Time Range"
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
		unit="(Hz)"
		minLabel="Min Frequency"
		maxLabel="Max Frequency"
		minValue={minFreq}
		maxValue={maxFreq}
		step={10}
		onChange={handleAllFreqChange}
	/>

	{#if selectedFiles.length > 0}
		<div class="mt-6">
			<Viewselector bind:showWaveform bind:showSpectrogram onChange={handleVisChange} />
		</div>
	{/if}

	{#if isProcessing}
		<div class="mt-4 rounded-lg bg-gray-100 p-4">
			<p class="font-medium">Processing audio files...</p>
			<div class="h-4 w-full rounded-full bg-gray-200">
				<div
					class="h-4 rounded-full bg-blue-600 transition-all duration-300"
					style="width: {processingProgress}%"
				></div>
			</div>
			<p class="mt-1 text-sm text-gray-600">{processingProgress}% complete</p>
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
					/>
				{/key}
			{/each}
		</div>
	{/if}

	{#if (showWaveform || showSpectrogram) && audioDataArray.length > 0}
		{#if showWaveform}
			{#each audioDataArray as audioFile (audioFile.name)}
				<div class="mt-6 overflow-hidden rounded-lg border bg-gray-100 p-4 shadow">
					<div class="mb-4 flex items-center justify-between">
						<h3
							class="animate-fade-in bg-gradient-to-r from-green-800 to-green-500 bg-clip-text text-lg font-bold text-transparent"
						>
							{audioFile.name} — Waveform
						</h3>
						<div class="flex gap-2">
							{#if showDownload}
								<button
									class="rounded-md border border-green-500 bg-green-50 px-3 py-1 text-xs font-medium text-green-700 transition hover:bg-green-100"
									on:click={() => waveformRefs[audioFile.name]?.downloadWaveform()}
								>
									Download .svg
								</button>
							{/if}
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
					</div>

					{#if showDetails}
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
						{#if showSliders && showReset}
							<button
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

									timeValuesMap[audioFile.name] = [
										timeRangeMap[audioFile.name].start,
										timeRangeMap[audioFile.name].end
									];
									ampValuesMap[audioFile.name] = [
										ampRangeMap[audioFile.name].min,
										ampRangeMap[audioFile.name].max
									];

									timeValuesMap = { ...timeValuesMap };
									ampValuesMap = { ...ampValuesMap };

									update_graph_versions(true, false);
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
						{#if showSliders}
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
						{#if showSliders}
							<script>
								// Start values for amplitude slider
								let ampValues: [number, number] = [
									ampRangeMap[audioFile.name]?.min ??
										waveformDataMap[audioFile.name]?.minAmp ??
										-0.01,
									ampRangeMap[audioFile.name]?.max ??
										waveformDataMap[audioFile.name]?.maxAmp ??
										0.01
								];

								// Reactive sync: update ampRangeMap whenever ampValues change
								$: ampRangeMap[audioFile.name] = { min: ampValues[0], max: ampValues[1] };
							</script>
							<!-- <div class="flex gap-4 h-full"> -->
							<div class="flex h-full items-stretch gap-4 overflow-hidden">
								<!-- class="flex flex-col w-32 h-full" -->
								<div
									class="flex h-full w-32 flex-col"
									style="flex: 0 0 auto; height: {waveformRefs[audioFile.name]?.computedHeight ||
										400}px"
								>
									<div class="flex flex-1 flex-col" style="height: 100%">
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

								<!-- Waveform in the CENTER with Time slider below -->
								<div class="flex flex-grow flex-col">
									<!-- <div class="flex-grow h-full"> -->
									<Waveform
										bind:this={waveformRefs[audioFile.name]}
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
									<!-- </div> -->

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
											step={0.5}
											on:change={(e) => handleTimeChange(e, audioFile.name)}
											bind:values={timeValuesMap[audioFile.name]}
										/>
									</div>
								</div>
							</div>
						{:else}
							<div class="mx-auto items-center">
								<!-- <div class="mx-auto flex items-center justify-center"> -->
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
						{/if}
					{/key}
				</div>
			{/each}
		{/if}

		{#if showSpectrogram}
			{#each audioDataArray as audioFile (audioFile.name)}
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
							{audioFile.name} — Waveform
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
							<!-- Reset button for waveform -->
							{#if showSliders && showReset}
								<button
									class="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-50"
									on:click={() => {
										// Reset time range to full audio duration
										timeRangeMap[audioFile.name] = {
											start: 0,
											end: audioDurationMap[audioFile.name] ?? 10
										};
										// Reset amplitude range to waveform's actual min/max
										ampRangeMap[audioFile.name] = {
											min: waveformDataMap[audioFile.name]?.minAmp ?? -0.01,
											max: waveformDataMap[audioFile.name]?.maxAmp ?? 0.01
										};

										timeValuesMap[audioFile.name] = [0, audioDurationMap[audioFile.name] ?? 10];

										timeValuesMap[audioFile.name] = [0, audioDurationMap[audioFile.name] ?? 10];
										// // Trigger re-render
										update_graph_versions(true, false);
									}}
								>
									Reset Changes
								</button>
							{/if}
						</div>
					</div>

					{#if showDetails}
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
						<div class="mx-auto flex w-fit flex-col items-center">
							<Spectrogram
								{ffmpeg}
								inputFileName={audioFile.inputName}
								startTime={timeRangeMap[audioFile.name]?.start ?? 0}
								endTime={timeRangeMap[audioFile.name]?.end ?? 10}
								minFreq={freqRangeMap[audioFile.name]?.min ?? 0}
								maxFreq={freqRangeMap[audioFile.name]?.max ?? 5000}
							/>
						</div>
						{#if showSliders}
							<div class=" px-7">
								<Rangeslider
									title="Time"
									min={0}
									max={audioDurationMap[audioFile.name] ?? 100}
									start={[
										timeRangeMap[audioFile.name]?.start ?? 0,
										timeRangeMap[audioFile.name]?.end ?? 10
									]}
									on:change={(e) => handleTimeChange(e, audioFile.name)}
									step={1}
								/>
								<Rangeslider
									title="Frequency"
									min={0}
									max={44000}
									start={[
										freqRangeMap[audioFile.name]?.min ?? 0,
										freqRangeMap[audioFile.name]?.max ?? 5000
									]}
									step={10}
									on:change={(e) => handleFreqChange(e, audioFile.name)}
								/>
							</div>
						{/if}
					{/key}
				</div>
			{/each}
		{/if}
	{/if}
</div>
