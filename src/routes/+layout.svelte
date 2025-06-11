<script lang="ts">
	import '../app.css';
	import Navbar from '$lib/components/navbar.svelte';
	import Footer from '$lib/components/footer.svelte';
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

<a href="/#howto" class="fixed bottom-4 right-4 z-50">
	<div
		class="group flex items-center rounded-full bg-white/70 px-2 py-1 shadow-lg backdrop-blur-md transition-all duration-200 hover:scale-105 hover:bg-white/90"
	>
		<div class="flex h-6 w-6 items-center justify-center">
			<img
				src="/icons/info.svg"
				alt="Info Icon"
				class="h-4 w-4 opacity-60 transition group-hover:opacity-100"
			/>
		</div>
		<span
			class="black w-0 overflow-hidden whitespace-nowrap text-xs font-medium opacity-0 transition-all duration-200 group-hover:w-auto group-hover:pl-2 group-hover:pr-1 group-hover:opacity-100"
		>
			Graphing Instructions
		</span>
	</div>
</a>
