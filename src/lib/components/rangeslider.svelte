<script lang="ts">
	import { onMount } from 'svelte';
	import noUiSlider from 'nouislider';
	import 'nouislider/dist/nouislider.css';

	export let title = 'Test Title';
	export let min = -100;
	export let max = 3000;
	export let start = [10, 1000]; // default start range
	export let step = 0.0001;
	export let format = {
		to: (value: number) => value.toFixed(5),
		from: (value: string) => parseFloat(value)
	};
	export let vertical: boolean = false;
	export let showInputs: boolean = true;
	export let values: [number, number] = [start[0], start[1]];

	let minRange: number = start[0];
	let maxRange: number = start[1];

	let minRangeStr: string = start[0].toString();
	let maxRangeStr: string = start[1].toString();

	export let height: number | string | undefined = undefined;

	import { createEventDispatcher } from 'svelte';
	const dispatch = createEventDispatcher();

	let sliderEl: HTMLDivElement;

	$: if (height !== undefined) {
		console.log('Slider height updated:', height); 
	}

	$: heightStyle = height === undefined
		? (vertical ? `height: 400px; min-height: 200px;` : '')
		: (typeof height === 'number'
			? `height: ${height}px; min-height: ${height}px;`
			: `height: ${height}; min-height: ${height};`);

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
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
			} as any,
			format,
			orientation: vertical ? 'vertical' : 'horizontal',
			direction: vertical ? 'rtl' : 'ltr'

			// cssClasses: {
			//     target: "", // "relative h-2 mb-10 rounded-full bg-gray-100 dark:bg-neutral-700",
			//     base: "", // "w-full h-full relative z-1",
			//     origin: "", // "absolute top-0 end-0 w-full h-full origin-[0_0] rounded-full",
			//     handle: "", // "absolute top-1/2 end-0 size-4.5 bg-white border-4 border-blue-600 rounded-full cursor-pointer translate-x-2/4 -translate-y-2/4 dark:border-blue-500",
			//     handleLower: "",
			//     handleUpper: "",
			//     touchArea: "", // "absolute -top-1 -bottom-1 -start-1 -end-1",
			//     horizontal: "",
			//     vertical: "",
			//     background: "",
			//     connect: "", // "absolute top-0 end-0 z-1 w-full h-full bg-blue-600 origin-[0_0] dark:bg-blue-500",
			//     connects: "", // "relative z-0 w-full h-full rounded-full overflow-hidden",
			//     ltr: "",
			//     rtl: "",
			//     textDirectionLtr: "",
			//     textDirectionRtl: "",
			//     draggable: "",
			//     drag: "",
			//     tap: "",
			//     active: "",
			//     tooltip: "", // "bg-white border border-gray-200 text-sm text-gray-800 py-1 px-2 rounded-lg mb-3 absolute bottom-full start-2/4 -translate-x-2/4 dark:bg-neutral-800 dark:border-neutral-700 dark:text-white",
			//     pips: "", // "relative w-full h-10 mt-1",
			//     pipsHorizontal: "",
			//     pipsVertical: "",
			//     marker: "", // "absolute border-s border-gray-400 dark:border-neutral-500",
			//     markerHorizontal: "",
			//     markerVertical: "",
			//     markerNormal: "h-2",
			//     markerLarge: "h-4",
			//     markerSub: "",
			//     value: "absolute top-4 -translate-x-2/4 text-sm text-gray-400 dark:text-neutral-500",
			//     valueHorizontal: "",
			//     valueVertical: "",
			//     valueNormal: "",
			//     valueLarge: "",
			//     valueSub: ""
			// }
		});

		// slider.on('update', (values: (string | number)[]) => {
		// 	const numericValues = values.map((v) => (typeof v === 'string' ? format.from(v) : v));
		// 	minRange = numericValues[0];
		// 	maxRange = numericValues[1];

		// 	values = [minRange, maxRange];
		// 	// Update string versions to reflect slider changes
		// 	minRangeStr = numericValues[0].toString();
		// 	maxRangeStr = numericValues[1].toString();
		// });

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
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
	<div class="flex flex-col items-center w-full h-full">
		{#if title}
			<h3 class="mb-2 px-2 text-center bg-gradient-to-r from-green-800 to-green-500 bg-clip-text text-lg font-bold text-transparent">
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
		<div class="flex flex-col w-auto mx-auto mr-7" style="height: {typeof height === 'number' ? height + 'px' : height || '400px'}">
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
	<div class="flex flex-col items-center w-full">
		{#if title}
			<h3 class="mb-10 bg-gradient-to-r from-green-800 to-green-500 bg-clip-text text-lg font-bold text-transparent">
				{title}
			</h3>
		{/if}

		<!-- Horizontal slider with text boxes on sides -->
		 <!-- class="w-24 rounded border border-gray-400 px-2 py-1 text-center text-xs flex-shrink-0" -->
		<div class="flex items-center w-full gap-2">
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
