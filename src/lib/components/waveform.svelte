<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import * as d3 from 'd3';

	export let waveformData: { time: number; amplitude: number }[] = [];
	export let startTime = 0;
	export let endTime = 10;
	export let minAmp = -1;
	export let maxAmp = 1;

	export let scrollY: number = 0; // Initial scroll position

	export let audioFileName: string = 'waveform';

	export let computedHeight: number = 400;
	let container: HTMLDivElement;
	let observer: ResizeObserver | undefined;

	let initialScroll = false; // Flag to handle initial scroll position

	export function downloadWaveform() {
		if (!container) return;

		const svgEl = container.querySelector('svg');
		if (!svgEl) return;

		// Clone SVG to avoid modifying the live DOM
		const clone = svgEl.cloneNode(true) as SVGSVGElement;

		// Add white background
		const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
		rect.setAttribute('width', '100%');
		rect.setAttribute('height', '100%');
		rect.setAttribute('fill', 'white');
		clone.insertBefore(rect, clone.firstChild);

		// Serialize SVG
		const serializer = new XMLSerializer();
		const source = serializer.serializeToString(clone);
		const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });

		// Generate filename
		const filename = `${audioFileName}_${Math.floor(startTime)}s-${Math.floor(endTime)}s.svg`;

		// Trigger download
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = filename;
		a.click();
		URL.revokeObjectURL(url);
	}

	function handleScroll(/*event: Event*/) {
		if (window.scrollY === scrollY) {
			initialScroll = false; // No need to update on initial scroll
			window.removeEventListener('scroll', handleScroll);
		} else if (initialScroll) {
			requestAnimationFrame(() => {
				// console.log('Scroll position attempt after processing:', scrollY);
				window.scrollTo({ top: scrollY, behavior: 'instant' });
			});
		}
		// scrollY = window.scrollY;
		// console.log('Scroll position updated:', window.scrollY);
		// console.trace(); // show call stack that triggered it
		// console.log('Scroll Event:', event);
	}

	onMount(() => {
		window.addEventListener('scroll', handleScroll, { passive: true });
		if (waveformData.length > 0) {
			// console.log(`Scroll position before processing: ${scrollY}`);
			// console.log('Current Scroll Position:', window.scrollY);

			createWaveform();

			initialScroll = true; // Reset flag after initial render

			// await tick(); // Ensure DOM updates are applied before scrolling
			// await tick();

			// console.log('Scroll position after processing:', scrollY);
		}

		// Watch for resize
		observer = new ResizeObserver(() => {
			createWaveform();
		});
		if (container) observer.observe(container);
		return () => {
			if (initialScroll) window.removeEventListener('scroll', handleScroll);
		};
	});

	// re-rendering
	// $: if (container && waveformData.length > 0) {
	// 	startTime;
	// 	endTime;
	// 	minAmp;
	// 	maxAmp;
	// 	createWaveform();
	// }

	onDestroy(() => {
		if (observer && container) observer.unobserve(container);
	});

	function createWaveform() {
		d3.select(container).html('');

		console.log('minAmp:', minAmp);
		console.log('maxAmp:', maxAmp);
		console.log('Start Time:', startTime);
		console.log('End Time:', endTime);
		console.log('Waveform Data Length:', waveformData.length);

		console.log('Container:', container);

		const margin = { top: 30, right: 40, bottom: 30, left: 80 };
		const maxRect = container.getBoundingClientRect();
		console.log('Max Rect:', maxRect);
		const aspectRatio = 21 / 9; // 16:9 aspect ratio
		const height = maxRect.width / aspectRatio;
		const width = maxRect.width;
		computedHeight = Math.round(height);
		console.log('Waveform height computed:', computedHeight);

		console.log(`Creating waveform with dimensions: ${width}x${height}`);

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
			.attr('id', 'clipWaveform')
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

		g.append('line')
			.attr('x1', 0)
			.attr('y1', y(0))
			.attr('x2', innerWidth)
			.attr('y2', y(0))
			.attr('stroke', '#555')
			.attr('stroke-width', 1)
			.attr('stroke-dasharray', '3,3');

		g.append('g')
			.attr('transform', `translate(0,${innerHeight})`)
			.call(
				d3
					.axisBottom(x)
					.ticks(10)
					.tickFormat((d) => Number(d).toFixed(1))
			);

		g.append('g').call(d3.axisLeft(y).ticks(5));

		g.append('text')
			.attr('x', innerWidth / 2)
			.attr('y', -10)
			.attr('text-anchor', 'middle')
			.attr('font-size', '14px')
			.attr('font-weight', 'bold')
			.text(`Waveform (${startTime.toFixed(1)}s - ${endTime.toFixed(1)}s)`);

		const waveformGroup = g.append('g').attr('clip-path', 'url(#clipWaveform)');

		waveformGroup
			.append('path')
			.datum(waveformData)
			.attr('fill', 'none')
			.attr('stroke', '#4CAF50')
			.attr('stroke-width', 1.5)
			.attr('d', line);
	}
</script>

<div bind:this={container} class="waveform"></div>
