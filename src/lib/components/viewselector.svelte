<!--
  @component
  Description: Checkbox group for choosing waveform and/or spectrogram visualization.

  @author Grace Steinmetz <gesparkles@gmail.com>
  @contributors K. Seow <kseow@wisc.edu>
  @created 2025-05-30
  @version 1.0.1
  @license MIT
-->
<script lang="ts">
	/** Set to false to grey out and disable the spectrogram checkbox — used as a kill-switch when FFmpeg isn't ready or spectrogram support is intentionally off. */
	export let spectrogramOnline: boolean = true;
	/** Whether the waveform checkbox is currently checked. */
	export let showWaveform: boolean;
	/** Whether the spectrogram checkbox is currently checked. */
	export let showSpectrogram: boolean;
	/** Called whenever either checkbox toggles, with the new `(waveform, spectrogram)` pair so the parent can act on both flags atomically. */
	export let onChange: (waveform: boolean, spectrogram: boolean) => void;
</script>

<div class="mt-6">
	<h3
		class="animate-fade-in mb-1 bg-gradient-to-r from-green-800 to-green-500 bg-clip-text text-lg font-bold text-transparent"
	>
		Select Visualization Type
	</h3>
	<p class="mb-3 text-sm text-gray-500">Pick one or both.</p>

	<div class="flex flex-wrap gap-2">
		<label
			class="flex w-fit cursor-pointer items-center gap-3 rounded-lg border border-gray-300 bg-white p-3 pr-6 shadow-sm transition hover:border-gray-400 hover:bg-gray-50 has-[:checked]:border-purple-400 has-[:checked]:bg-purple-50 has-[:checked]:shadow-md"
		>
			<input
				type="checkbox"
				class="peer hidden"
				checked={showWaveform}
				on:change={() => onChange(!showWaveform, showSpectrogram)}
			/>
			<span
				class="h-5 w-5 rounded border border-gray-600 peer-checked:border-purple-600 peer-checked:bg-purple-600"
			></span>
			<span class="text-base text-gray-800 peer-checked:font-semibold">Waveform</span>
		</label>

		<label
			class="flex w-fit cursor-pointer items-center gap-3 rounded-lg border border-gray-300 bg-white p-3 pr-6 shadow-sm transition hover:border-gray-400 hover:bg-gray-50 has-[:checked]:border-purple-400 has-[:checked]:bg-purple-50 has-[:checked]:shadow-md"
			class:opacity-50={!spectrogramOnline}
			class:pointer-events-none={!spectrogramOnline}
		>
			<input
				type="checkbox"
				class="peer hidden"
				disabled={!spectrogramOnline}
				checked={showSpectrogram}
				on:change={() => onChange(showWaveform, !showSpectrogram)}
			/>
			<span
				class="h-5 w-5 rounded border border-gray-600 peer-checked:border-purple-600 peer-checked:bg-purple-600"
			></span>
			<span class="text-base text-gray-800 peer-checked:font-semibold">
				Spectrogram{#if !spectrogramOnline} (Coming Soon! Reworking for smoother performance!){/if}
			</span>
		</label>
	</div>
</div>
