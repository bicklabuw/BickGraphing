<!--
  @component
  Description: Full-width D3 waveform renderer with scroll handling and download-as-SVG support.

  @author K. Seow <kseow@wisc.edu>
  @contributors Alex Arovas <aarovas@wisc.edu>, Grace Steinmetz <gesparkles@gmail.com>
  @created 2025-04-01
  @version 0.2.0
  @license MIT
-->
<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import * as d3 from 'd3';
	// Skip our redraws while the spectrogram is busy — avoids ~6× redundant D3 work.
	import { spectrogramBusy } from '$lib/stores/uiBusy';

	/** Pre-decoded `{time, amplitude}` series for the audio segment to render. */
	export let waveformData: { time: number; amplitude: number }[] = [];
	/** Lower bound of the x-axis (time, in seconds). */
	export let startTime = 0;
	/** Upper bound of the x-axis (time, in seconds). */
	export let endTime = 10;
	/** Lower bound of the y-axis (amplitude). */
	export let minAmp = -1;
	/** Upper bound of the y-axis (amplitude). */
	export let maxAmp = 1;

	/** Filename used as the SVG title and as the basename for `Download .svg`. */
	export let audioFileName: string = 'waveform';

	/** Two-way bindable: rendered SVG height in px. Parent uses it to size the adjacent amplitude slider. */
	export let computedHeight: number = 400;
	/** When true, swaps the SVG for a progress bar at the same aspect ratio. */
	export let loading: boolean = false;
	/** Audio duration in seconds; heuristic for the loading bar (decodeAudioData has no real progress). */
	export let audioDurationSec: number = 0;
	let container: HTMLDivElement;

	let elapsedMs = 0;
	let progressInterval: ReturnType<typeof setInterval> | undefined;
	let loadingStartTs = 0;

	$: expectedMs = Math.max(500, Math.min(60000, audioDurationSec * 3));
	$: progressPercent = Math.min(95, Math.round((elapsedMs / expectedMs) * 100));

	$: {
		if (loading) {
			if (!progressInterval) {
				loadingStartTs = performance.now();
				elapsedMs = 0;
				progressInterval = setInterval(() => {
					elapsedMs = performance.now() - loadingStartTs;
				}, 100);
			}
		} else {
			if (progressInterval) {
				clearInterval(progressInterval);
				progressInterval = undefined;
			}
			elapsedMs = 0;
		}
	}
	let observer: ResizeObserver | undefined;

	/**
	 * Serializes the SVG and triggers a download in the chosen format. Exposed via
	 * `bind:this` for the parent's Download dropdown. Patches a white background onto
	 * the clone so it renders correctly outside the page's dark chrome.
	 */
	export function downloadWaveform(format: 'svg' | 'png' | 'jpeg' = 'svg') {
		if (!container) return;

		const svgEl = container.querySelector('svg');
		if (!svgEl) return;

		// Clone SVG and pin explicit pixel dimensions so the raster path can render it.
		const rect = svgEl.getBoundingClientRect();
		const width = Math.round(rect.width);
		const height = Math.round(rect.height);

		const clone = svgEl.cloneNode(true) as SVGSVGElement;
		clone.setAttribute('width', String(width));
		clone.setAttribute('height', String(height));

		// Add white background
		const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
		bg.setAttribute('width', '100%');
		bg.setAttribute('height', '100%');
		bg.setAttribute('fill', 'white');
		clone.insertBefore(bg, clone.firstChild);

		const cleanName = audioFileName.replace(/\.wav$/i, '');
		const baseName = `${cleanName}_waveform_t${startTime.toFixed(1)}-${endTime.toFixed(1)}s`;
		const source = new XMLSerializer().serializeToString(clone);

		if (format === 'svg') {
			const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
			triggerDownload(URL.createObjectURL(blob), `${baseName}.svg`);
			return;
		}

		// Raster path: SVG → Image → 2× canvas → PNG/JPEG blob.
		const scale = 2;
		const svgUrl = URL.createObjectURL(new Blob([source], { type: 'image/svg+xml;charset=utf-8' }));
		const img = new Image();
		img.onload = () => {
			const canvas = document.createElement('canvas');
			canvas.width = width * scale;
			canvas.height = height * scale;
			const ctx = canvas.getContext('2d');
			if (!ctx) return;
			ctx.scale(scale, scale);
			ctx.drawImage(img, 0, 0, width, height);
			URL.revokeObjectURL(svgUrl);

			const mime = format === 'png' ? 'image/png' : 'image/jpeg';
			const ext = format === 'png' ? 'png' : 'jpg';
			canvas.toBlob(
				(blob) => {
					if (!blob) return;
					triggerDownload(URL.createObjectURL(blob), `${baseName}.${ext}`);
				},
				mime,
				format === 'jpeg' ? 0.95 : undefined
			);
		};
		img.src = svgUrl;
	}

	function triggerDownload(href: string, filename: string) {
		const a = document.createElement('a');
		a.href = href;
		a.download = filename;
		a.click();
		URL.revokeObjectURL(href);
	}

	onMount(() => {
		if (waveformData.length > 0) {
			createWaveform();
		}

		// Resize watcher. Skips while spectrogram is busy; the reactive block below re-fires
		// when the flag clears and redraws once with the final size.
		observer = new ResizeObserver(() => {
			if ($spectrogramBusy) return;
			createWaveform();
		});
		if (container) observer.observe(container);
	});

	// Redraw on data/param changes. $spectrogramBusy is listed as a dep so this re-fires
	// when the flag clears, driving the settle-redraw at the end of a spectrogram run.
	$: if (container && waveformData.length > 0 && !$spectrogramBusy) {
		startTime;
		endTime;
		minAmp;
		maxAmp;
		createWaveform();
	}

	onDestroy(() => {
		if (observer && container) observer.unobserve(container);
		if (progressInterval) clearInterval(progressInterval);
	});

	function createWaveform() {
		d3.select(container).html('');

		const margin = { top: 20, right: 40, bottom: 24, left: 58 };
		const maxRect = container.getBoundingClientRect();
		const aspectRatio = 21 / 9; // 16:9 aspect ratio
		const height = maxRect.width / aspectRatio;
		const width = maxRect.width;
		computedHeight = Math.round(height);

		const innerWidth = width - margin.left - margin.right;
		const innerHeight = height - margin.top - margin.bottom;

		const svg = d3
			.select(container)
			.append('svg')
			.attr('width', '100%')
			.attr('height', height)
			.attr('viewBox', `0 0 ${width} ${height}`)
			.attr('preserveAspectRatio', 'xMidYMid meet')
			.attr('role', 'img')
			.attr(
				'aria-label',
				`${audioFileName.replace(/\.wav$/i, '')} waveform from ${startTime.toFixed(2)} to ${endTime.toFixed(2)} seconds`
			);

		svg.append('title').text(`${audioFileName.replace(/\.wav$/i, '')}: Waveform`);

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
			)
			.append('text')
			.attr('x', innerWidth / 2)
			.attr('y', 22)
			.attr('fill', '#000')
			.attr('font-size', '10px')
			.style('text-anchor', 'middle')
			.text('Time (s)');

		g.append('g')
			.call(d3.axisLeft(y).ticks(5))
			.append('text')
			.attr('transform', 'rotate(-90)')
			.attr('x', -innerHeight / 2)
			.attr('y', -32)
			.attr('fill', '#000')
			.attr('font-size', '10px')
			.style('text-anchor', 'middle')
			.text('Amplitude');

		g.append('text')
			.attr('x', innerWidth / 2)
			.attr('y', -5)
			.attr('text-anchor', 'middle')
			.attr('font-size', '14px')
			.attr('font-weight', 'bold')
			.text(`${audioFileName.replace(/\.wav$/i, '')}: Waveform`);

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

{#if loading}
	<div
		role="status"
		aria-live="polite"
		aria-label={`Generating waveform, ${progressPercent} percent complete`}
		class="flex w-full items-center justify-center rounded-lg bg-gray-50"
		style="aspect-ratio: 21 / 9;"
	>
		<div class="w-3/4">
			<p class="mb-2 text-center text-sm font-medium text-gray-700">Generating waveform...</p>
			<div
				role="progressbar"
				aria-valuemin="0"
				aria-valuemax="100"
				aria-valuenow={progressPercent}
				class="h-3 w-full overflow-hidden rounded-full bg-gray-200"
			>
				<div
					class="h-full rounded-full bg-blue-600 transition-all duration-200"
					style="width: {progressPercent}%"
				></div>
			</div>
			<p class="mt-1 text-center text-xs text-gray-500">{progressPercent}% complete</p>
		</div>
	</div>
{:else}
	<div bind:this={container} class="waveform"></div>
{/if}
