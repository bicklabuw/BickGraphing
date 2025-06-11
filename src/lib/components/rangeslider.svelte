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

	import { createEventDispatcher } from 'svelte';
	const dispatch = createEventDispatcher();

	let sliderEl: HTMLDivElement;

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
			format

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

		slider.on('change', (values: (string | number)[]) => {
			const numericValues = values.map((v) => (typeof v === 'string' ? format.from(v) : v));
			dispatch('change', { values: numericValues });
		});
	});

	$: if (sliderEl && start) {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const sliderInstance = (sliderEl as any).noUiSlider;
		if (sliderInstance) {
			sliderInstance.set(start);
		}
	}
</script>

{#if title}
	<h3
		class="animate-fade-in mb-4 bg-gradient-to-r from-green-800 to-green-500 bg-clip-text text-lg font-bold text-transparent"
	>
		{title}
	</h3>
{/if}
<div class="h-6"></div>
<div bind:this={sliderEl}></div>
<div class="h-12"></div>
