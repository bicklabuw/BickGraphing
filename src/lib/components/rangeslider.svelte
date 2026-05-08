<!--
  @component
  Description: Dual-handle noUiSlider wrapper for selecting a numeric range, with optional inline inputs.

  @author K. Seow <kseow@wisc.edu>
  @contributors Grace Steinmetz <gesparkles@gmail.com>
  @created 2025-05-30
  @version 0.2.0
  @license MIT
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import noUiSlider from 'nouislider';
	import 'nouislider/dist/nouislider.css';

	/** Heading shown above the slider. */
	export let title = 'Test Title';
	/** Lower bound of the slider's full range. */
	export let min = -100;
	/** Upper bound of the slider's full range. */
	export let max = 3000;
	/** Initial `[lowHandle, highHandle]` positions. */
	export let start = [10, 1000]; // default start range
	/** Step granularity for handle movement. */
	export let step = 0.0001;
	/** noUiSlider formatter: `to` renders numbers, `from` parses input back to numbers. */
	export let format = {
		to: (value: number) => value.toFixed(5),
		from: (value: string) => parseFloat(value)
	};
	/** When true, renders the slider top-to-bottom instead of left-to-right (used for amplitude axes). */
	export let vertical: boolean = false;
	/** When true, shows numeric text inputs alongside the handles for direct entry. */
	export let showInputs: boolean = true;
	/** Two-way bindable `[low, high]` value pair — bind with `bind:values={...}` to keep the parent's state in sync. */
	export let values: [number, number] = [start[0], start[1]];

	let minRange: number = start[0];
	let maxRange: number = start[1];

	let minRangeStr: string = start[0].toString();
	let maxRangeStr: string = start[1].toString();

	/** Optional height override for the vertical layout (e.g. `"100%"` or `400`). When undefined a sensible default is used. */
	export let height: number | string | undefined = undefined;

	import { createEventDispatcher } from 'svelte';
	const dispatch = createEventDispatcher();

	let sliderEl: HTMLDivElement;

	$: heightStyle =
		height === undefined
			? vertical
				? `height: 400px; min-height: 200px;`
				: ''
			: typeof height === 'number'
				? `height: ${height}px; min-height: ${height}px;`
				: `height: ${height}; min-height: ${height};`;

	onMount(() => {
		const slider = noUiSlider.create(sliderEl, {
			start,
			step,
			range: { min, max },
			connect: true,
			tooltips: true,
			pips: {
				mode: 'count',
				values: 5
			} as any,
			format,
			orientation: vertical ? 'vertical' : 'horizontal',
			direction: vertical ? 'rtl' : 'ltr',
			handleAttributes: [
				{ 'aria-label': `${title} minimum` },
				{ 'aria-label': `${title} maximum` }
			]
		});

		slider.on('update', (sliderVals: (string | number)[]) => {
			const numericVals = sliderVals.map((v) => (typeof v === 'string' ? format.from(v) : v));

			minRange = numericVals[0];
			maxRange = numericVals[1];
			minRangeStr = numericVals[0].toString();
			maxRangeStr = numericVals[1].toString();
			values = [minRange, maxRange];
			// dispatch('change', { values: [...values] });
		});

		slider.on('change', (sliderVals: (string | number)[]) => {
			const numericVals = sliderVals.map((v) => (typeof v === 'string' ? format.from(v) : v));
			dispatch('change', { values: numericVals });
		});
	});

	function handleInputChange() {
		const sliderInstance = (sliderEl as any).noUiSlider;
		if (sliderInstance) {
			sliderInstance.set([minRange, maxRange]);
			values = [minRange, maxRange];
		}
	}

	function handleMinInput(e: Event) {
		const inputValue = (e.target as HTMLInputElement).value;
		const value = parseFloat(inputValue);
		if (!isNaN(value) && value >= min && value <= maxRange) {
			minRange = value;
			minRangeStr = inputValue;
			handleInputChange();
		} else {
			(e.target as HTMLInputElement).value = minRangeStr;
		}
	}

	function handleMaxInput(e: Event) {
		const inputValue = (e.target as HTMLInputElement).value;
		const value = parseFloat(inputValue);
		if (!isNaN(value) && value <= max && value >= minRange) {
			maxRange = value;
			maxRangeStr = inputValue;
			handleInputChange();
		} else {
			(e.target as HTMLInputElement).value = maxRangeStr;
		}
	}

	let lastStart: [number, number] | null = null;

	$: if (sliderEl && start) {
		const sliderInstance = (sliderEl as any).noUiSlider;
		if (
			sliderInstance &&
			(!lastStart || lastStart[0] !== start[0] || lastStart[1] !== start[1])
		) {
			sliderInstance.set(start);
			values = [start[0], start[1]];
			minRangeStr = start[0].toString();
			maxRangeStr = start[1].toString();
			lastStart = [start[0], start[1]];
		}
	}

</script>

{#if vertical}
	<div class="flex h-full w-full flex-col items-center">
		{#if title}
			<h3
				class="mb-2 bg-gradient-to-r from-green-800 to-green-500 bg-clip-text px-2 text-center text-lg font-bold text-transparent"
			>
				{title}
			</h3>
		{/if}

		<!-- Top input (max amplitude) -->
		<!-- changeback: bind:value={maxRange} after number -->
		{#if showInputs}
			<input
				type="text"
				value={maxRangeStr}
				aria-label={`${title} maximum value`}
				on:change={handleMaxInput}
				on:blur={handleMaxInput}
				class="mb-6 w-20 rounded border border-gray-400 px-1 text-center"
			/>
		{/if}

		<!-- Vertical slider -->
		<div
			class="mx-auto mr-7 flex w-auto flex-col"
			style="height: {typeof height === 'number' ? height + 'px' : height || '400px'}"
		>
			<div bind:this={sliderEl} class="w-full" style={heightStyle}></div>
		</div>

		<!-- Bottom input (min amplitude) -->
		{#if showInputs}
			<input
				type="text"
				value={minRangeStr}
				aria-label={`${title} minimum value`}
				on:change={handleMinInput}
				on:blur={handleMinInput}
				class="mt-6 w-20 rounded border border-gray-400 px-1 text-center"
			/>
		{/if}
	</div>
{:else}
	<div class="flex w-full flex-col items-center">
		{#if title}
			<h3
				class="mb-10 bg-gradient-to-r from-green-800 to-green-500 bg-clip-text text-lg font-bold text-transparent"
			>
				{title}
			</h3>
		{/if}

		<!-- Horizontal slider with text boxes on sides -->
		<div class="flex w-full items-center gap-2">
			{#if showInputs}
				<input
					type="text"
					value={minRangeStr}
					aria-label={`${title} minimum value`}
					on:change={handleMinInput}
					on:blur={handleMinInput}
					class="w-20 rounded border border-gray-400 px-1 text-center"
				/>
			{/if}

			<div class="flex-grow px-4 pb-10">
				<div bind:this={sliderEl}></div>
			</div>

			{#if showInputs}
				<input
					type="text"
					value={maxRangeStr}
					aria-label={`${title} maximum value`}
					on:change={handleMaxInput}
					on:blur={handleMaxInput}
					class="w-20 rounded border border-gray-400 px-1 text-center"
				/>
			{/if}
		</div>
	</div>
{/if}

<style>
	/* Vertical sliders only: move noUiSlider tick labels from the default right
	   side to the LEFT (outer) side so they don't collide with the adjacent
	   plot's y-axis labels. Horizontal sliders are untouched.

	   Note: the slider has `direction: rtl`, so children inherit RTL static
	   positioning. Each rule pins position via explicit `right:` to defeat
	   that inheritance; padding-only tricks would land in the wrong spot. */

	/* Pips container moves to the LEFT of the track. */
	:global(.noUi-vertical .noUi-pips-vertical) {
		left: auto;
		right: 100%;
	}
	/* Tick markers: clear gap to the left of the bar (was overlapping at 3px). */
	:global(.noUi-vertical .noUi-marker-vertical) {
		left: auto;
		right: 8px;
	}
	/* Labels: pinned 30px to the left of the bar; text right-aligned so it
	   reads leftward (away from the bar). */
	:global(.noUi-vertical .noUi-value-vertical) {
		left: auto;
		right: 30px;
		padding-left: 0;
		padding-right: 0;
		text-align: right;
	}
	/* Vertical slider tooltips: flip from default LEFT side of the handle to
	   the RIGHT side, so the start/end value tags sit between the slider and
	   the plot (the parent flex layout has been widened to make room). */
	:global(.noUi-vertical .noUi-tooltip) {
		right: auto;
		left: 120%;
	}
</style>
