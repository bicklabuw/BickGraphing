<script lang="ts">
	let parallaxX = 50;
	let parallaxY = 50;

	function handleMouseMove(event: MouseEvent) {
		const { clientX, clientY } = event;
		parallaxX = 50 + (clientX / window.innerWidth - 0.5) * 10;
		parallaxY = 50 + (clientY / window.innerHeight - 0.5) * 10;
	}
</script>

<nav
	on:mousemove={handleMouseMove}
	class="relative top-0 z-50 overflow-hidden border-b border-white/20 bg-white/20 backdrop-blur-md"
>
	<div
		class="nav-texture absolute inset-0"
		style="background-position: {parallaxX}% {parallaxY}%"
	></div>

	<div class="pointer-events-none absolute inset-0 bg-white/50"></div>

	<div class="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
		<a href="/" class="flex items-center gap-3">
			<img src="/bicklab_logo.png" alt="BickLab Logo" class="h-8 w-auto" />
			<span class="font-bugslife text-lg font-semibold tracking-tight text-gray-800">
				Bick Graphing
			</span>
		</a>

		<div class="hidden items-center gap-3 md:flex">
			<!-- Internal Links -->
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

			<!-- External Links -->
			<!-- { label: 'Bick Portal', href: 'https://connect.doit.wisc.edu/bickportal/' } -->
			{#each [{ label: 'Bick Lab', href: 'https://www.bicklab.com' }, { label: 'Insect Eavesdropper', href: 'https://www.insecteavesdropper.com/home' }] as link (link.label)}
				<a
					href={link.href}
					target="_blank"
					rel="noopener noreferrer"
					class="rounded-lg bg-gradient-to-r from-green-600 to-emerald-500 px-3 py-1.5 text-sm font-medium text-white shadow-lg transition hover:from-green-700 hover:to-emerald-600"
				>
					{link.label}
				</a>
			{/each}
		</div>
	</div>
</nav>

<style>
	.nav-texture {
		background-image: url('/textures/green-frosted-noise.jpg');
		background-size: 140%;
		background-repeat: repeat;
		background-position: center;
		opacity: 0.2;
		transition: background-position 0.1s ease;
	}
</style>
