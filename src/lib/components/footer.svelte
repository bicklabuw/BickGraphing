<script lang="ts">
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
		style="background-position: {parallaxX}% {parallaxY}%"
	></div>

	<div class="pointer-events-none absolute inset-0 bg-white/50"></div>

	<div
		class="relative z-10 mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 py-8 md:flex-row"
	>
		<div class="text-center md:text-left">
			<p class="font-semibold text-gray-800">Bick Graphing</p>
			<p>&copy; {new Date().getFullYear()} Bick Lab, University of Wisconsin–Madison</p>
			<p class="mt-1 text-xs text-gray-500">
				Version 1.0.0 &mdash; Designed by <a
					href="https://gracesteinmetz.com"
					target="_blank"
					rel="noopener noreferrer">Grace Steinmetz</a
				>
			</p>
		</div>

		<div class="flex flex-wrap items-center justify-center gap-4">
			<!-- internal links -->
			<a
				href="/"
				class="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:text-purple-600"
			>
				Home
			</a>
			<a
				href="/graphing"
				class="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:text-purple-600"
			>
				Graphing Tool
			</a>
			<a
				href="/faq"
				class="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:text-purple-600"
			>
				FAQ
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
		background-image: url('/textures/green-frosted-noise.jpg');
		background-size: 140%;
		background-repeat: repeat;
		background-position: center;
		opacity: 0.2;
		transition: background-position 0.1s ease;
	}
</style>
