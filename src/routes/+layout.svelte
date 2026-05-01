<script lang="ts">
	import '../app.css';
	import { asset } from '$app/paths';
	import Navbar from '$lib/components/navbar.svelte';
	import Footer from '$lib/components/footer.svelte';

	const howtoSteps = [
		{
			title: 'Drag & Drop Your Audio',
			description: 'Drop one or more .wav files into the tool. Everything runs locally — no files are uploaded.'
		},
		{
			title: 'Choose Your Visualization',
			description: 'Pick Waveform, Spectrogram, or both to explore your audio visually.'
		},
		{
			title: 'Adjust Your Settings',
			description: 'Toggle Sliders to fine-tune amplitude and time. Toggle Details to see metadata. Download as SVG when ready.'
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

<div class="group fixed bottom-4 right-4 z-50">
	<!-- Hover popup with the instructions -->
	<div
		class="pointer-events-none absolute bottom-full right-0 mb-3 w-80 origin-bottom-right scale-95 opacity-0 transition-all duration-200 group-hover:pointer-events-auto group-hover:scale-100 group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:scale-100 group-focus-within:opacity-100"
	>
		<div class="rounded-2xl bg-white p-4 shadow-2xl ring-1 ring-gray-200">
			<h3 class="mb-3 text-base font-bold text-gray-800">Graphing Instructions</h3>
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

	<!-- Trigger button -->
	<button
		type="button"
		aria-label="Show graphing instructions"
		class="flex items-center rounded-full bg-white/70 px-3 py-1.5 shadow-lg backdrop-blur-md transition-all duration-200 hover:scale-105 hover:bg-white/90 focus:outline-none focus:ring-2 focus:ring-purple-400"
	>
		<div class="flex h-5 w-5 items-center justify-center">
			<img
				src={asset('/icons/info.svg')}
				alt=""
				class="h-4 w-4 opacity-70 transition group-hover:opacity-100"
			/>
		</div>
		<span class="ml-2 whitespace-nowrap text-xs font-medium text-gray-700">Instructions</span>
	</button>
</div>
