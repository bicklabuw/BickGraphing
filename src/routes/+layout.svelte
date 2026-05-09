<!--
  @component
  Description: Root SvelteKit layout — wraps every page with the navbar, content slot, and footer.

  @author K. Seow <kseow@wisc.edu>
  @contributors Grace Steinmetz <gesparkles@gmail.com>
  @created 2025-04-01
  @version 0.2.0
  @license MIT
-->
<script lang="ts">
	import '../app.css';
	import { asset } from '$app/paths';
	import Navbar from '$lib/components/navbar.svelte';
	import Footer from '$lib/components/footer.svelte';

	let pinned = false;
	let hovered = false;
	let focused = false;
	let forceClosed = false;

	$: popupVisible = !forceClosed && (pinned || hovered || focused);

	function closePopup() {
		pinned = false;
		forceClosed = true;
		// Drop focus so the latch can release once the cursor leaves.
		if (typeof document !== 'undefined') {
			(document.activeElement as HTMLElement | null)?.blur();
		}
	}

	function togglePinned() {
		if (pinned) {
			closePopup();
		} else {
			pinned = true;
			forceClosed = false;
		}
	}

	function maybeReleaseLatch() {
		if (!hovered && !focused) forceClosed = false;
	}

	const howtoSteps = [
		{
			title: 'Drop .wav files',
			description: 'Files load locally, nothing uploads.'
		},
		{
			title: 'Pick a view',
			description: 'Waveform, spectrogram, or both.'
		},
		{
			title: 'Adjust',
			description: 'Sliders for amplitude, time, and frequency. Details for per-file metadata.'
		},
		{
			title: 'Click a mini waveform thumbnail',
			description: 'Jumps the page to that file’s full waveform.'
		},
		{
			title: 'Download',
			description: 'Save any graph as SVG, PNG, or JPEG.'
		}
	];
</script>

<div
	class="flex min-h-screen flex-col bg-gradient-to-br from-[#0d3b2e] to-[#1b5e3b] font-sans tracking-tight text-gray-800 antialiased"
>
	<Navbar />

	<main
		class="mx-auto w-full flex-grow px-4 py-4 sm:px-6 sm:py-6 md:px-8 md:py-8 lg:px-12 lg:py-10"
	>
		<div
			class="rounded-2xl border border-white/10 bg-[#e5e7ebcc] p-4 shadow-xl backdrop-blur-sm sm:p-6 md:p-8"
		>
			<slot />
		</div>
	</main>

	<Footer />
</div>

<div
	class="group fixed bottom-4 right-4 z-50"
	on:mouseenter={() => (hovered = true)}
	on:mouseleave={() => {
		hovered = false;
		maybeReleaseLatch();
	}}
	on:focusin={() => (focused = true)}
	on:focusout={() => {
		focused = false;
		maybeReleaseLatch();
	}}
	role="presentation"
>
	<div
		class="absolute bottom-full right-0 mb-3 w-80 origin-bottom-right transition-all duration-200 {popupVisible
			? 'pointer-events-auto scale-100 opacity-100'
			: 'pointer-events-none scale-95 opacity-0'}"
	>
		<div class="rounded-2xl bg-white p-4 shadow-2xl ring-1 ring-gray-200">
			<div class="mb-3 flex items-start justify-between gap-2">
				<h3 class="text-base font-bold text-gray-800">Graphing Instructions</h3>
				{#if pinned}
					<button
						type="button"
						on:click={closePopup}
						aria-label="Close instructions"
						class="rounded text-sm leading-none text-gray-400 hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
					>
						✕
					</button>
				{/if}
			</div>
			<div class="space-y-3">
				{#each howtoSteps as step, i (step.title)}
					<div class="flex gap-3">
						<div
							class="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-purple-100 text-sm font-bold text-purple-600"
						>
							{i + 1}
						</div>
						<div>
							<h4 class="text-sm font-semibold text-gray-800">{step.title}</h4>
							<p class="text-xs text-gray-600">{step.description}</p>
						</div>
					</div>
				{/each}
			</div>
		</div>
	</div>

	<!-- Trigger button to click and hover over Instruction button. -->
	<button
		type="button"
		on:click={togglePinned}
		aria-label={pinned ? 'Hide graphing instructions' : 'Show graphing instructions'}
		aria-expanded={pinned}
		class="flex items-center rounded-full bg-white/70 px-3 py-1.5 shadow-lg backdrop-blur-md transition-all duration-200 hover:scale-105 hover:bg-white/90 focus:outline-none focus:ring-2 focus:ring-purple-400"
	>
		<div class="flex h-5 w-5 items-center justify-center">
			<img
				src={asset('/icons/info.svg')}
				alt=""
				class="h-4 w-4 opacity-70 transition group-hover:opacity-100"
			/>
		</div>
		<span class="ml-2 whitespace-nowrap text-xs font-medium text-gray-700">
			{pinned ? 'Hide' : 'Instructions'}
		</span>
	</button>
</div>

<!-- You're really diving deep into our code! hope you're enjoying using our tool so far :] -->