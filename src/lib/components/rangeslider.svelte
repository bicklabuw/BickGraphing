<!--
  @component
  Description: Dual-handle noUiSlider wrapper for selecting a numeric range, with optional inline inputs.

  @author K. Seow <kseow@wisc.edu>
  @contributors Grace Steinmetz <gesparkles@gmail.com>
  @created 2025-05-30
  @version 1.0.1
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
	/**
	 * Display formatter passed straight to noUiSlider. `to` formats numbers
	 * for display; `from` parses user input back into numbers. Override to
	 * change precision or to add unit suffixes.
	 */
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

	$: if (height !== undefined) {
		console.log('Slider height updated:', height);
	}

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
			direction: vertical ? 'rtl' : 'ltr'
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
			dispatch('change', { sliderVals: numericVals });
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

	$: if (sliderEl && start) {
		const sliderInstance = (sliderEl as any).noUiSlider;
		if (sliderInstance) {
			sliderInstance.set(start);
			values = [start[0], start[1]];
			minRangeStr = start[0].toString();
			maxRangeStr = start[1].toString();
		}
	}

	$: console.log('showInputs:', showInputs);
</script>

<!-- {#if title}
	<h3
		class="animate-fade-in mb-4 bg-gradient-to-r from-green-800 to-green-500 bg-clip-text text-lg font-bold text-transparent"
	>
		{title}
	</h3>
{/if} -->

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
			<!-- <div bind:this={sliderEl} class="flex-grow w-full min-h-[300px]"></div> -->
			<!-- <div bind:this={sliderEl} class="flex-grow w-full h-full"></div> -->
			<!-- <div bind:this={sliderEl} class="flex-grow w-full"></div> -->
			<div bind:this={sliderEl} class="w-full" style={heightStyle}></div>
		</div>

		<!-- Bottom input (min amplitude) -->
		{#if showInputs}
			<input
				type="text"
				value={minRangeStr}
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
		<!-- class="w-24 rounded border border-gray-400 px-2 py-1 text-center text-xs flex-shrink-0" -->
		<div class="flex w-full items-center gap-2">
			{#if showInputs}
				<input
					type="text"
					value={minRangeStr}
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
					on:change={handleMaxInput}
					on:blur={handleMaxInput}
					class="w-20 rounded border border-gray-400 px-1 text-center"
				/>
			{/if}
		</div>
	</div>
{/if}
