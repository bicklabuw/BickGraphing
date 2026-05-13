<!--
  @component
  Description: Checkbox group for choosing waveform and/or spectrogram visualization.

  @author K. Seow <kseow@wisc.edu>
  @contributors Grace Steinmetz <gesparkles@gmail.com>
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

	let waveformGlow = false;
	let spectrogramGlow = false;
	let waveformGlowTimer: ReturnType<typeof setTimeout> | null = null;
	let spectrogramGlowTimer: ReturnType<typeof setTimeout> | null = null;

	function pulse(target: 'waveform' | 'spectrogram') {
		if (target === 'waveform') {
			if (waveformGlowTimer) clearTimeout(waveformGlowTimer);
			waveformGlow = false;
			requestAnimationFrame(() => {
				waveformGlow = true;
				waveformGlowTimer = setTimeout(() => (waveformGlow = false), 700);
			});
		} else {
			if (spectrogramGlowTimer) clearTimeout(spectrogramGlowTimer);
			spectrogramGlow = false;
			requestAnimationFrame(() => {
				spectrogramGlow = true;
				spectrogramGlowTimer = setTimeout(() => (spectrogramGlow = false), 700);
			});
		}
	}

	function toggleWaveform() {
		const next = !showWaveform;
		if (next) pulse('waveform');
		onChange(next, showSpectrogram);
	}

	function toggleSpectrogram() {
		const next = !showSpectrogram;
		if (next) pulse('spectrogram');
		onChange(showWaveform, next);
	}
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
			class:viewselector-glow={waveformGlow}
		>
			<input
				type="checkbox"
				class="peer hidden"
				checked={showWaveform}
				on:change={toggleWaveform}
			/>
			<span
				class="check-box relative flex h-5 w-5 items-center justify-center rounded border border-gray-600 transition-colors peer-checked:border-purple-600 peer-checked:bg-purple-600"
			>
				<svg
					class="check-mark h-3.5 w-3.5 text-white"
					viewBox="0 0 24 24"
					fill="none"
					aria-hidden="true"
				>
					<path
						d="M5 12 L10 17 L19 8"
						stroke="currentColor"
						stroke-width="3"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
				</svg>
			</span>
			<span class="grid text-base text-gray-800 peer-checked:font-semibold">
				<span aria-hidden="true" class="invisible col-start-1 row-start-1 font-semibold"
					>Waveform</span
				>
				<span class="col-start-1 row-start-1">Waveform</span>
			</span>
		</label>

		<label
			class="flex w-fit cursor-pointer items-center gap-3 rounded-lg border border-gray-300 bg-white p-3 pr-6 shadow-sm transition hover:border-gray-400 hover:bg-gray-50 has-[:checked]:border-purple-400 has-[:checked]:bg-purple-50 has-[:checked]:shadow-md"
			class:opacity-50={!spectrogramOnline}
			class:pointer-events-none={!spectrogramOnline}
			class:viewselector-glow={spectrogramGlow}
		>
			<input
				type="checkbox"
				class="peer hidden"
				disabled={!spectrogramOnline}
				checked={showSpectrogram}
				on:change={toggleSpectrogram}
			/>
			<span
				class="check-box relative flex h-5 w-5 items-center justify-center rounded border border-gray-600 transition-colors peer-checked:border-purple-600 peer-checked:bg-purple-600"
			>
				<svg
					class="check-mark h-3.5 w-3.5 text-white"
					viewBox="0 0 24 24"
					fill="none"
					aria-hidden="true"
				>
					<path
						d="M5 12 L10 17 L19 8"
						stroke="currentColor"
						stroke-width="3"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
				</svg>
			</span>
			<span class="grid text-base text-gray-800 peer-checked:font-semibold">
				<span aria-hidden="true" class="invisible col-start-1 row-start-1 font-semibold">
					Spectrogram{#if !spectrogramOnline}
						(Coming Soon! Reworking for smoother performance!){/if}
				</span>
				<span class="col-start-1 row-start-1">
					Spectrogram{#if !spectrogramOnline}
						(Coming Soon! Reworking for smoother performance!){/if}
				</span>
			</span>
		</label>
	</div>
</div>

<style>
	@keyframes viewselector-glow {
		0% {
			box-shadow: 0 0 0 0 rgba(168, 85, 247, 0);
		}
		30% {
			box-shadow: 0 0 16px 4px rgba(168, 85, 247, 0.55);
		}
		100% {
			box-shadow: 0 0 0 0 rgba(168, 85, 247, 0);
		}
	}
	.viewselector-glow {
		animation: viewselector-glow 0.7s ease-out;
	}

	.check-mark path {
		stroke-dasharray: 24;
		stroke-dashoffset: 24;
		transition: stroke-dashoffset 220ms ease-out 60ms;
	}
	.peer:checked ~ .check-box .check-mark path {
		stroke-dashoffset: 0;
	}
</style>
