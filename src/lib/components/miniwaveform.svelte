<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import * as d3 from 'd3';

	export let waveformData: { time: number; amplitude: number }[] = [];
	export let startTime = 0;
	export let endTime = 10;
	export let minAmp = -1;
	export let maxAmp = 1;

	export let audioFileName: string = 'UNKNOWN';

	let container: HTMLDivElement;
	let relative_parent: HTMLDivElement;
	let observer: ResizeObserver | undefined;

	onMount(() => {
		if (waveformData.length > 0) {
			draw();
		}

		// Watch for resize
		observer = new ResizeObserver(() => {
			draw();
		});
		if (relative_parent) observer.observe(relative_parent);
	});

	onDestroy(() => {
		if (observer && relative_parent) observer.unobserve(relative_parent);
	});

	// $: if (waveformData.length > 0) draw();

	function draw() {
		console.log('Container:', container);
		container.classList.remove('absolute', 'bottom-2');
		d3.select(container).html('');
		const margin = { top: 4, right: 4, bottom: 16, left: 14 };
		const maxRect = container.getBoundingClientRect();
		console.log('Max Rect:', maxRect);
		const aspectRatio = 21 / 9; // 21:9 aspect ratio
		const height = maxRect.width / aspectRatio;
		const width = maxRect.width;

		console.log(`Creating mini waveform with dimensions: ${width}x${height}`);

		const innerWidth = width - margin.left - margin.right;
		const innerHeight = height - margin.top - margin.bottom;

		const svg = d3
			.select(container)
			.append('svg')
			.attr('width', '100%')
			.attr('height', height)
			.attr('viewBox', `0 0 ${width} ${height}`)
			.attr('preserveAspectRatio', 'xMidYMid meet');

		svg
			.append('defs')
			.append('clipPath')
			.attr('id', 'clipMiniWaveform')
			.append('rect')
			.attr('x', 0)
			.attr('y', 0)
			.attr('width', innerWidth)
			.attr('height', innerHeight);

		const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

		const x = d3.scaleLinear().domain([startTime, endTime]).range([0, innerWidth]);
		const y = d3.scaleLinear().domain([minAmp, maxAmp]).range([innerHeight, 0]);

		const line = d3
			.line<{ time: number; amplitude: number }>()
			.x((d) => x(d.time))
			.y((d) => y(d.amplitude));

		// Draw waveform
		const waveformGroup = g.append('g').attr('clip-path', 'url(#clipMiniWaveform)');

		waveformGroup
			.append('path')
			.datum(waveformData)
			.attr('fill', 'none')
			.attr('stroke', '#2e7d32')
			.attr('stroke-width', 1)
			.attr('d', line);

		// X-axis: show first and last ticks
		const xAxis = d3.axisBottom(x).tickValues([startTime, endTime]).tickFormat(d3.format('.0f'));

		g.append('g')
			.attr('transform', `translate(0, ${innerHeight})`)
			.call(xAxis)
			.selectAll('.domain, .tick line')
			.attr('stroke', '#ccc');

		g.selectAll('.tick text')
			.attr('text-anchor', (d: unknown) => {
				// console.log('Tick value:', d);
				// console.log('Start time:', startTime, 'End time:', endTime);
				d = d as number;
				if (d === endTime) return 'end';
				return 'middle';
			})
			.attr('dx', (d: unknown) => {
				d = d as number;
				if (d === endTime) return '0.25em';
				return '0';
			});

		const yAxis = g
			.append('g')
			.call(d3.axisLeft(y).tickValues([minAmp, maxAmp]).tickFormat(d3.format('.1e')));

		yAxis
			.selectAll('text')
			.attr('transform', 'rotate(-90)')
			.attr('dy', '-0.7em')
			.attr('dx', (d: unknown) => {
				d = d as number;
				if (d === maxAmp) return '1.2em';
				else if (d === minAmp) return '3.25em';
				return '0';
			});
		yAxis.selectAll('.domain, .tick line').attr('stroke', '#ccc');

		container.classList.add('absolute', 'bottom-2');
		relative_parent.style.setProperty('padding-bottom', `calc(0.5rem + ${height}px)`);
	}
</script>

<div bind:this={relative_parent} class="relative rounded border bg-white p-2 shadow-sm">
	<p class="mb-2 whitespace-normal break-words text-center text-xs font-semibold">
		{audioFileName}
	</p>
	<div class="items-center justify-center">
		<div bind:this={container} class="miniwaveform"></div>
	</div>
</div>
