<script lang="ts">
	import { onMount } from 'svelte';
	import * as d3 from 'd3';

	export let waveformData: { time: number; amplitude: number }[] = [];
	export let startTime = 0;
	export let endTime = 10;
	export let minAmp = -1;
	export let maxAmp = 1;

	let container: HTMLDivElement;

	onMount(() => {
		if (waveformData.length > 0) {
			draw();
		}
	});

	$: if (waveformData.length > 0) draw();

	function draw() {
		d3.select(container).html('');
		const margin = { top: 4, right: 4, bottom: 16, left: 4 };
		const width = 200;
		const height = 50;

		const svg = d3
			.select(container)
			.append('svg')
			.attr('width', width + margin.left + margin.right)
			.attr('height', height + margin.top + margin.bottom)
			.append('g')
			.attr('transform', `translate(${margin.left},${margin.top})`);

		const x = d3.scaleLinear().domain([startTime, endTime]).range([0, width]);
		const y = d3.scaleLinear().domain([minAmp, maxAmp]).range([height, 0]);

		const line = d3
			.line<{ time: number; amplitude: number }>()
			.x((d) => x(d.time))
			.y((d) => y(d.amplitude));

		// Draw waveform
		svg
			.append('path')
			.datum(waveformData)
			.attr('fill', 'none')
			.attr('stroke', '#2e7d32')
			.attr('stroke-width', 1)
			.attr('d', line);

		// X-axis: show first and last ticks
		const xAxis = d3.axisBottom(x).tickValues([startTime, endTime]).tickFormat(d3.format('.2f'));

		svg
			.append('g')
			.attr('transform', `translate(0, ${height})`)
			.call(xAxis)
			.selectAll('.domain, .tick line')
			.attr('stroke', '#ccc');
	}
</script>

<div bind:this={container} class="miniwaveform"></div>
