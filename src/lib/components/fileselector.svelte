<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { initFFmpeg } from '$lib/utils/audioProcessing';
	import type { FFmpeg } from '@ffmpeg/ffmpeg';
	import { fetchFile } from '@ffmpeg/util';
	import Waveform from './waveform.svelte';
	import Spectrogram from './spectrogram.svelte';
	import Rangeslider from './rangeslider.svelte';

	let debug = true;
	let isProcessing = false;
	let processingProgress = 0;
	let isFFmpegReady = false;

	let fileInput: HTMLInputElement | null = null;
	let ffmpeg: FFmpeg | null = null;
	let selectedFiles: string[] = [];

	let originalAudioFiles: File[] = [];
	let audioDataArray: { name: string; inputName: string }[] = [];
	let waveformDataMap: Record<string, { time: number; amplitude: number }[]> = {};
	let audioDurationMap: Record<string, number> = {};
	let waveformVersion = 0;

	let startTime = 0;
	let endTime = 10;
	let minAmp = -0.01;
	let maxAmp = 0.01;
	let minFreq = 0;
	let maxFreq = 5000;
	let audioLength = 100;
	let showSpectrograms = false;

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

	async function handleFileSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		const files = input.files;
		if (!files || !files.length) return;

		originalAudioFiles = Array.from(files);
		audioDataArray = [];
		isProcessing = true;
		selectedFiles = originalAudioFiles.map((f) => f.name);

		await Promise.all(
			originalAudioFiles.map(async (file) => {
				if (!ffmpeg) return;
				const inputName = `input_${file.name.replace(/[^a-zA-Z0-9]/g, '_')}`;
				const data = await fetchFile(file);
				await ffmpeg.writeFile(inputName, data);

				audioDataArray.push({
					name: file.name,
					inputName
				});
			})
		);

		isProcessing = false;
		await tick();
	}

	function extractWaveformData(audioBuffer: AudioBuffer, start: number, end: number) {
		const sampleRate = audioBuffer.sampleRate;
		const startSample = Math.floor(start * sampleRate);
		const endSample = Math.min(Math.floor(end * sampleRate), audioBuffer.length);
		const channelData = audioBuffer.getChannelData(0);
		const maxPoints = 2000;
		const totalSamples = endSample - startSample;
		const step = totalSamples > maxPoints ? Math.floor(totalSamples / maxPoints) : 1;
		const waveform = [];

		for (let i = startSample; i < endSample; i += step) {
			waveform.push({
				time: i / sampleRate,
				amplitude: channelData[i]
			});
		}
		return waveform;
	}

	async function generateVisualizations() {
		if (!isFFmpegReady || !ffmpeg) {
			alert('Please load FFmpeg first.');
			return;
		}
		isProcessing = true;
		processingProgress = 0;

		const audioContext = new AudioContext();

		for (let i = 0; i < originalAudioFiles.length; i++) {
			const file = originalAudioFiles[i];

			// Decode the audio
			const arrayBuffer = await file.arrayBuffer();
			const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
			audioDurationMap[file.name] = audioBuffer.duration;

			// Extract waveform data
			waveformDataMap[file.name] = extractWaveformData(audioBuffer, startTime, endTime);
			processingProgress = Math.round(((i + 1) / originalAudioFiles.length) * 100);
		}

		isProcessing = false;
		showSpectrograms = true;
		waveformVersion += 1;
		await tick();
	}

	function openFileSelector() {
		if (!isProcessing && isFFmpegReady && fileInput) {
			fileInput.click();
		}
	}

	function updateTimeRange(start: number, end: number) {
		startTime = start;
		endTime = end;
		generateVisualizations();
	}

	function handleTimeChange(event: CustomEvent<{ values: number[] }>) {
		const [start, end] = event.detail.values;
		startTime = start;
		endTime = end;
		// timeRange = [start, end]; // keep everything in sync
		generateVisualizations();
	}

	function handleAmpChange(event: CustomEvent<{ values: number[] }>) {
		const [min, max] = event.detail.values;
		minAmp = min;
		maxAmp = max;
		generateVisualizations();
	}
</script>

<div class="mb-6">
	<input
		bind:this={fileInput}
		type="file"
		accept=".wav"
		on:change={handleFileSelect}
		multiple
		class="hidden"
		disabled={!isFFmpegReady || isProcessing}
	/>

	<button
		on:click={openFileSelector}
		disabled={!isFFmpegReady || isProcessing}
		class="flex items-center rounded-lg bg-blue-600 px-4 py-2 font-medium text-white shadow-md transition-colors duration-200 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
	>
		Choose Audio Files
	</button>

	<!-- Time Range Inputs -->
	<div class="mt-4 space-y-2">
		<label>
			Start Time (seconds):
			<input
				type="number"
				bind:value={startTime}
				min="0"
				step="0.1"
				on:change={() => updateTimeRange(startTime, endTime)}
			/>
		</label>
		<label>
			End Time (seconds):
			<input
				type="number"
				bind:value={endTime}
				min="0"
				step="0.1"
				on:change={() => updateTimeRange(startTime, endTime)}
			/>
		</label>
	</div>

	<!-- Amplitude Range Inputs -->
	<div class="mt-4 space-y-2">
		<label>
			Min Amplitude:
			<input type="number" bind:value={minAmp} step="0.01" on:change={generateVisualizations} />
		</label>
		<label>
			Max Amplitude:
			<input type="number" bind:value={maxAmp} step="0.01" on:change={generateVisualizations} />
		</label>
	</div>

	<!-- Frequency Range Inputs -->
	<div class="mt-4 space-y-2">
		<label>
			Min Frequency (Hz):
			<input
				type="number"
				bind:value={minFreq}
				min="0"
				step="10"
				on:change={generateVisualizations}
			/>
		</label>
		<label>
			Max Frequency (Hz):
			<input
				type="number"
				bind:value={maxFreq}
				min="0"
				step="100"
				on:change={generateVisualizations}
			/>
		</label>
	</div>
</div>

{#if selectedFiles.length > 0}
	<div class="mt-4 space-y-2">
		{#each selectedFiles as fileName (fileName)}
			<div class="rounded-md border border-gray-300 bg-gray-100 p-2 shadow-sm">
				<p class="truncate text-gray-700">{fileName}</p>
			</div>
		{/each}
	</div>
{/if}

<button
	on:click={generateVisualizations}
	disabled={!isFFmpegReady || audioDataArray.length === 0 || isProcessing}
	class="mt-4 rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
>
	Generate Visualizations
</button>

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

{#if showSpectrograms && audioDataArray.length > 0}
	{#each audioDataArray as audioFile (audioFile.name)}
		<div class="mt-6 overflow-hidden rounded-lg border bg-gray-100 p-4 shadow">
			<h3 class="font-medium">{audioFile.name}</h3>
			<p class="text-sm text-yellow-600 italic">
				Debug: Rendering spectrogram for <b>{audioFile.name}</b><br />
				inputFileName = {audioFile.inputName}<br />
				ffmpeg loaded = {Boolean(ffmpeg)}
				startTime = {startTime}
				endTime = {endTime}
				minAmp = {minAmp}
				maxAmp = {maxAmp}
				minFreq = {minFreq}
				maxFreq = {maxFreq}
				audioLength = {audioDurationMap[audioFile.name]?.toFixed(2)} seconds
			</p>

			{#if typeof window !== 'undefined' && isFFmpegReady && ffmpeg && audioFile.inputName}
				{#key `${audioFile.inputName}-${waveformVersion}-${startTime}-${endTime}-${minAmp}-${maxAmp}`}
					<Waveform
						waveformData={waveformDataMap[audioFile.name] ?? []}
						{startTime}
						{endTime}
						{minAmp}
						{maxAmp}
					/>
					<Rangeslider
						title="time"
						min={0}
						max={audioLength}
						start={[startTime, endTime]}
						on:change={handleTimeChange}
					/>

					<Rangeslider
						title="amp"
						min={-0.01}
						max={0.01}
						start={[minAmp, maxAmp]}
						step={0.001}
						on:change={handleAmpChange}
					/>

					<Spectrogram
						{ffmpeg}
						inputFileName={audioFile.inputName}
						{startTime}
						{endTime}
						{minFreq}
						{maxFreq}
					/>
				{/key}
			{/if}
		</div>
	{/each}
{/if}
