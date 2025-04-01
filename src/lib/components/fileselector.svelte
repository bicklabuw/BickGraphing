<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { initFFmpeg, AudioProcessor } from '$lib/utils/audioProcessing';
	import type { FFmpeg } from '@ffmpeg/ffmpeg';

	import Webgl from './webgl.svelte';

	let debug = true;
	let isProcessing = false;
	let processingProgress = 0;
	let isFFmpegReady = false;
	let audioDataArray: { name: string; data: Float32Array }[] = [];
	let fileInput: HTMLInputElement | null = null;
	let ffmpeg: FFmpeg | null = null;
	let selectedFiles: string[] = [];

	//TODO: only take .wav files
	onMount(async () => {
		try {
			ffmpeg = await initFFmpeg();
			isFFmpegReady = true; // Mark FFmpeg as ready
			if (debug) console.log('FFmpeg Mounted');
			await tick(); // Ensure UI updates
		} catch (error) {
			console.error('Failed to initialize FFmpeg:', error);
		}
	});

	async function handleFileSelect(event: Event) {
		if (debug) console.log('File Handled');

		const input = event.target as HTMLInputElement;
		const files = input.files;
		if (!files || !files.length || !isFFmpegReady) return;

		isProcessing = true;
		processingProgress = 0;
		audioDataArray = []; // Clear previous audio files
		const fileList = files as FileList;
		selectedFiles = Array.from(fileList).map((file) => file.name); // Store file names
		if (debug) console.log(selectedFiles);
		await tick(); // Ensure UI updates before processing

		try {
			for (let i = 0; i < files.length; i++) {
				const file = files[i];

				// Create an AudioProcessor instance
				const processor = new AudioProcessor(ffmpeg!, file, (progress: number) => {
					processingProgress = Math.round(progress / files.length + i * (100 / files.length));
				});

				// Process the file
				const data = await processor.process();
				if (!data) return;
				console.log('✅ Processed Audio Data:', data.slice(0, 10)); // Log first 10 values

				// Assign processed data to audioData
				audioDataArray = [...audioDataArray, { name: file.name, data }];

				await tick(); // Ensure UI updates
			}
		} catch (error) {
			console.error('Processing failed:', error);
		} finally {
			isProcessing = false;
			processingProgress = 0;
			await tick(); // Final UI update
		}
	}

	function openFileSelector() {
		if (!isProcessing && isFFmpegReady) {
			if (!fileInput) return;
			fileInput.click();
		}
	}
</script>

<div class="mb-6">
	<input
		bind:this={fileInput}
		type="file"
		accept="audio/*"
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
		<svg
			xmlns="http://www.w3.org/2000/svg"
			class="mr-2 h-5 w-5"
			viewBox="0 0 20 20"
			fill="currentColor"
		>
			<path
				fill-rule="evenodd"
				d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z"
				clip-rule="evenodd"
			/>
		</svg>
		Choose Audio Files
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
</div>

<!-- Hidden file name box -->
{#if selectedFiles.length > 0}
	<div class="mt-4 space-y-2">
		{#each selectedFiles as fileName (fileName)}
			<div class="rounded-md border border-gray-300 bg-gray-100 p-2 shadow-sm md:block">
				<p class="truncate text-gray-700">{fileName}</p>
			</div>
		{/each}
	</div>
{/if}

<!-- Render waveform for each processed file -->
{#each audioDataArray as audioFile (audioFile.name)}
	<div class="mt-6 overflow-hidden rounded-lg border bg-gray-100 p-4 shadow">
		<h3 class="font-medium">{audioFile.name}</h3>
		<div class="h-80 w-full bg-gray-900">
			<Webgl audioData={audioFile.data} />
		</div>
	</div>
{/each}
