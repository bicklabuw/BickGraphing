<script lang="ts">
	import { onMount } from 'svelte';
	import { base, asset } from '$app/paths';

	// If you already have shared components, import them here:
	// import GraphShell from '$lib/components/GraphShell.svelte';
	// import SpectrogramPanel from '$lib/components/SpectrogramPanel.svelte';

	// If your FFmpeg init lives in a lib module, import and call it here:
	// import { getFFmpeg } from '$lib/ffmpeg/init';

	let spectrogramOnly = true; // enforce page mode
	let ready = false;
	let error: string | null = null;

	onMount(async () => {
		try {
			// If you use ffmpeg.wasm, make sure to load the core from a base-aware path:
			// (Put core files in static/ffmpeg and reference with asset().)
			// const ffmpeg = await getFFmpeg(asset('/ffmpeg/ffmpeg-core.js'));
			// await ffmpeg.load();
			ready = true;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to initialize spectrogram.';
		}
	});
</script>

<section class="min-h-screen px-6 py-8">
	<div class="mx-auto max-w-6xl">
		<h1 class="mb-2 text-3xl font-bold">Spectrogram</h1>
		<p class="mb-6 text-gray-600">Upload .wav files and explore time–frequency content.</p>

		{#if error}
			<div class="mb-4 rounded-md border border-red-300 bg-red-50 p-4 text-red-700">{error}</div>
		{:else if !ready}
			<div class="text-gray-500">Initializing…</div>
		{:else}
			<!-- Replace this block with your existing spectrogram-only UI.
           If you have a shared shell, pass `mode="spectrogram"` or a boolean prop. -->
			<!-- <GraphShell mode="spectrogram" /> -->
			<!-- or -->
			<!-- <SpectrogramPanel /> -->
			<p class="text-sm text-gray-500">Spectrogram UI goes here.</p>
		{/if}

		<div class="mt-8">
			<a href={base + '/graphing'} class="text-blue-600 underline"> Back to Waveform page </a>
		</div>
	</div>
</section>
