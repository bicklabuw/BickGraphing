<script lang="ts">
	export let spectrogramOnline: boolean = true;
	export let showWaveform: boolean;
	export let showSpectrogram: boolean;
	export let onChange: (waveform: boolean, spectrogram: boolean) => void;

	function handleSelection(value: string) {
		if (value === 'waveform') onChange(true, false);
		else if (value === 'spectrogram') onChange(false, true);
		else if (value === 'both') onChange(true, true);
		else if (value === 'none') onChange(false, false);
	}
</script>

<div class="mt-6">
	<h3
		class="animate-fade-in mb-4 bg-gradient-to-r from-green-800 to-green-500 bg-clip-text text-lg font-bold text-transparent"
	>
		Select Visualization Type
	</h3>

	<div class="flex flex-col gap-2">
		<label class="flex cursor-pointer items-center gap-3">
			<input
				type="radio"
				name="view"
				value="none"
				class="peer hidden"
				checked={!showWaveform && !showSpectrogram}
				on:change={() => handleSelection('none')}
			/>
			<span
				class="h-4 w-4 rounded-full border border-gray-600 peer-checked:border-purple-600 peer-checked:ring-2 peer-checked:ring-purple-500"
			></span>
			<span class="text-sm text-gray-800 peer-checked:font-semibold">No Selection</span>
		</label>

		<label class="flex cursor-pointer items-center gap-3">
			<input
				type="radio"
				name="view"
				value="waveform"
				class="peer hidden"
				checked={showWaveform && !showSpectrogram}
				on:change={() => handleSelection('waveform')}
			/>
			<span
				class="h-4 w-4 rounded-full border border-gray-600 peer-checked:border-purple-600 peer-checked:ring-2 peer-checked:ring-purple-500"
			></span>
			<span class="text-sm text-gray-800 peer-checked:font-semibold">Waveform</span>
		</label>

		<label
			class="flex cursor-pointer items-center gap-3"
			class:opacity-50={!spectrogramOnline}
			class:pointer-events-none={!spectrogramOnline}
		>
			<input
				type="radio"
				name="view"
				value="spectrogram"
				class="peer hidden"
				checked={!showWaveform && showSpectrogram}
				on:change={() => handleSelection('spectrogram')}
			/>
			<span
				class="h-4 w-4 rounded-full border border-gray-600 peer-checked:border-purple-600 peer-checked:ring-2 peer-checked:ring-purple-500"
			></span>
			<span class="text-sm text-gray-800 peer-checked:font-semibold"
				>Spectrogram (Coming Soon! Reworking for smoother performance!)</span
			>
		</label>

		<label
			class="flex cursor-pointer items-center gap-3"
			class:opacity-50={!spectrogramOnline}
			class:pointer-events-none={!spectrogramOnline}
		>
			<input
				type="radio"
				name="view"
				value="both"
				class="peer hidden"
				disabled={!spectrogramOnline}
				checked={showWaveform && showSpectrogram}
				on:change={() => handleSelection('both')}
			/>
			<span
				class="h-4 w-4 rounded-full border border-gray-600 peer-checked:border-purple-600 peer-checked:ring-2 peer-checked:ring-purple-500"
			></span>
			<span class="text-sm text-gray-800 peer-checked:font-semibold"
				>Both Waveform and Spectrogram (Coming Soon! Reworking for smoother performance!)</span
			>
		</label>
	</div>
</div>
