<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	let fileInput: HTMLInputElement;
	export let disabled = false;
	export let accept = '.wav';

	const dispatch = createEventDispatcher();

	function openFileSelector() {
		if (!disabled && fileInput) {
			fileInput.click();
		}
	}

	function handleChange(event: Event) {
		const input = event.target as HTMLInputElement;
		if (input?.files?.length) {
			dispatch('select', input.files);
			input.value = '';
		}
	}

	function handleDrop(event: DragEvent) {
		event.preventDefault();
		const files = event.dataTransfer?.files;
		if (files && files.length > 0) {
			dispatch('select', files);
		}
	}
</script>

<input
	bind:this={fileInput}
	type="file"
	{accept}
	on:change={handleChange}
	multiple
	class="hidden"
	{disabled}
/>

<button
	on:click={openFileSelector}
	{disabled}
	class="relative isolate inline-flex items-center justify-center w-full gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg ring-1 ring-inset ring-blue-500/30 transition-all duration-200 hover:from-blue-700 hover:to-indigo-700 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50"
>
	<svg
		class="h-5 w-5 text-white opacity-80"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		viewBox="0 0 24 24"
	>
		<path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
	</svg>
	<span>ADD .WAV FILES</span>
</button>

<div
	role="button"
	tabindex="0"
	aria-label="Upload .wav files"
	on:keydown={(e) => {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			openFileSelector();
		}
	}}
	on:drop|preventDefault={handleDrop}
	on:dragover|preventDefault
	on:click={openFileSelector}
	class="mt-6 flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-blue-300 bg-white px-6 py-12 text-center text-sm text-gray-600 transition hover:border-blue-400 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-400"
>
	<img
		src="/icons/folder.svg"
		alt="Upload Folder Icon"
		class="h-10 w-10 text-blue-400 opacity-80"
	/>

	<p>
		<strong>Drag & drop</strong> your <code>{accept}</code> files here<br />
		<span class="underline">or click to browse</span>
	</p>
</div>
