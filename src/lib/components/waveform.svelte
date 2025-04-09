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
			createWaveform();
		}
	});

	function createWaveform() {
		d3.select(container).html('');

		const margin = { top: 30, right: 40, bottom: 30, left: 80 };
		const width = 800 - margin.left - margin.right;
		const height = 200 - margin.top - margin.bottom;

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

		svg
			.append('line')
			.attr('x1', 0)
			.attr('y1', y(0))
			.attr('x2', width)
			.attr('y2', y(0))
			.attr('stroke', '#555')
			.attr('stroke-width', 1)
			.attr('stroke-dasharray', '3,3');

		svg
			.append('path')
			.datum(waveformData)
			.attr('fill', 'none')
			.attr('stroke', '#4CAF50')
			.attr('stroke-width', 1.5)
			.attr('d', line);

		svg
			.append('g')
			.attr('transform', `translate(0,${height})`)
			.call(
				d3
					.axisBottom(x)
					.ticks(10)
					.tickFormat((d) => Number(d).toFixed(1))
			);

		svg.append('g').call(d3.axisLeft(y).ticks(5));

		svg
			.append('text')
			.attr('x', width / 2)
			.attr('y', -10)
			.attr('text-anchor', 'middle')
			.attr('font-size', '14px')
			.attr('font-weight', 'bold')
			.text(`Waveform (${startTime.toFixed(1)}s - ${endTime.toFixed(1)}s)`);
	}
</script>

<div bind:this={container} class="waveform"></div>
