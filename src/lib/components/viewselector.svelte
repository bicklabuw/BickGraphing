<!--
  @component
  Description: Checkbox group for choosing waveform and/or spectrogram visualization.

  @author Grace Steinmetz <gesparkles@gmail.com>
  @contributors K. Seow <kseow@wisc.edu>
  @created 2025-05-30
  @version 0.2.0
  @license MIT
-->
<script lang="ts">
	/** Kill-switch for the spectrogram checkbox (greyed and disabled when false). */
	export let spectrogramOnline: boolean = true;
	/** Whether the waveform checkbox is checked. */
	export let showWaveform: boolean;
	/** Whether the spectrogram checkbox is checked. */
	export let showSpectrogram: boolean;
	/** Called on either toggle with the new `(waveform, spectrogram)` pair. */
	export let onChange: (waveform: boolean, spectrogram: boolean) => void;
</script>

<div class="mt-6">
	<h3
		class="animate-fade-in bg-gradient-to-r from-green-800 to-green-500 bg-clip-text text-lg font-bold text-transparent"
	>
		Select Visualization Type
	</h3>
	<p class="mb-3 text-sm text-gray-500">Pick one or both.</p>

	<div class="flex flex-wrap gap-2" role="group" aria-label="Visualization options">
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
