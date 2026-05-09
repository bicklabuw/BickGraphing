<!--
  @component
  Description: Site footer with a parallax frosted-noise background and lab/version info.

  @author Grace Steinmetz <gesparkles@gmail.com>
  @contributors K. Seow <kseow@wisc.edu>
  @created 2025-05-30
  @version 0.2.0
  @license MIT
-->
<script lang="ts">
	import { base, asset } from '$app/paths';

	let parallaxX = 50;
	let parallaxY = 50;

	function handleMouseMove(event: MouseEvent) {
		const { clientX, clientY } = event;
		parallaxX = 50 + (clientX / window.innerWidth - 0.5) * 10;
		parallaxY = 50 + (clientY / window.innerHeight - 0.5) * 10;
	}
</script>

<footer
	on:mousemove={handleMouseMove}
	class="relative mt-12 overflow-hidden border-t border-white/20 bg-white/20 text-sm text-gray-600 backdrop-blur-md"
>
	<div
		class="footer-texture absolute inset-0"
		style="background-image: url({asset(
			'/textures/green-frosted-noise.jpg'
		)}); background-position: {parallaxX}% {parallaxY}%"
	></div>

	<div class="pointer-events-none absolute inset-0 bg-white/50"></div>

	<div
		class="relative z-10 mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 py-8 md:flex-row"
	>
		<div class="text-center md:text-left">
			<p class="font-semibold text-gray-800">Bick Graphing</p>
			<p>&copy; {new Date().getFullYear()} Bick Lab, University of Wisconsin–Madison</p>
			<p class="mt-1 text-xs text-gray-500">
				Version 0.2.0 &mdash; By <a
					href="https://github.com/kayleyseow"
					target="_blank"
					rel="noopener noreferrer"
					class="transition hover:text-green-600">K. Seow</a
				>
			</p>
			<p class="text-xs text-gray-500">
				<a
					href="https://ie-graphing-709865.pages.doit.wisc.edu"
					target="_blank"
					rel="noopener noreferrer"
					class="transition hover:text-green-600"
				>
					Version 0.1.0
				</a>
				&mdash; Designed by
				<a
					href="https://www.gracesteinmetz.com"
					target="_blank"
					rel="noopener noreferrer"
					class="transition hover:text-green-600">Grace Steinmetz</a
				>
				&
				<a
					href="https://github.com/Alex-Arovas"
					target="_blank"
					rel="noopener noreferrer"
					class="transition hover:text-green-600">Alex Arovas</a
				>
			</p>
		</div>

		<div class="flex flex-wrap items-center justify-center gap-4">
			<!-- internal links -->
			<a
				href="{base}/"
				class="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:text-purple-600"
			>
				Home
			</a>
			<a
				href="{base}/graphing"
				class="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:text-purple-600"
			>
				Graphing Tool
			</a>
			<a
				href="{base}/faq"
				class="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:text-purple-600"
			>
				FAQ
			</a>
			<a
				href="{base}/benchmark"
				class="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:text-purple-600"
			>
				Benchmark
			</a>

			<!-- external links -->
			<a
				href="https://www.bicklab.com"
				target="_blank"
				rel="noopener noreferrer"
				class="transition hover:text-green-600"
			>
				Bick Lab
			</a>
			<a
				href="https://www.insecteavesdropper.com/home"
				target="_blank"
				rel="noopener noreferrer"
				class="transition hover:text-green-600"
			>
				Insect Eavesdropper
			</a>
			<!-- <a
				href="https://connect.doit.wisc.edu/bickportal/"
				target="_blank"
				rel="noopener noreferrer"
				class="transition hover:text-green-600"
			>
				Bick Portal
			</a> -->
		</div>
	</div>
</footer>

<style>
	.footer-texture {
		background-size: 140%;
		background-repeat: repeat;
		opacity: 0.2;
		transition: background-position 0.1s ease;
	}
</style>
