<!--
  @component
  Description: Numeric min/max input pair for editing an amplitude or time range.

  @author K. Seow <kseow@wisc.edu>
  @contributors Grace Steinmetz <gesparkles@gmail.com>
  @created 2025-05-30
  @version 0.2.0
  @license MIT
-->
<script lang="ts">
	export let label: string;
	export let description: string = '';
	export let unit: string = '';
	export let minLabel: string = 'Min';
	export let maxLabel: string = 'Max';
	export let minValue: number;
	export let maxValue: number;
	export let onChange: (min: number, max: number) => void;
	export let validMin: number | undefined = undefined;
	export let validMax: number | undefined = undefined;
	export let softMaxes: { name: string; max: number }[] | undefined = undefined;

	let localMin: string = minValue.toString();
	$: localMin = minValue.toString();
	let localMax: string = maxValue.toString();
	$: localMax = maxValue.toString();

	$: slug = label
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');
	$: minId = `${slug}-min-input`;
	$: maxId = `${slug}-max-input`;

	function checkBounds(min: number, max: number): { error?: string; warning?: string } {
		if (validMin !== undefined && min < validMin) {
			return { error: `${minLabel} cannot be less than ${validMin}.` };
		}
		if (validMax !== undefined && max > validMax) {
			return { error: `${maxLabel} cannot exceed ${validMax}.` };
		}
		if (min >= max) {
			return { error: `${minLabel} must be less than ${maxLabel}.` };
		}
		if (softMaxes && softMaxes.length > 0) {
			const exceeded = softMaxes.filter((s) => max > s.max);
			if (exceeded.length === softMaxes.length) {
				const longest = Math.max(...softMaxes.map((s) => s.max));
				return {
					error: `${maxLabel} ${max} exceeds every file's duration (longest is ${longest.toFixed(2)}${unit ? ' ' + unit : ''}).`
				};
			}
			if (exceeded.length > 0) {
				const list = exceeded.map((s) => `${s.name} (${s.max.toFixed(2)})`).join(', ');
				return { warning: `${maxLabel} exceeds duration of: ${list}.` };
			}
		}
		return {};
	}

	let hardError: string | null = null;
	let softWarning: string | null = null;
	let userHasInteracted = false;

	$: {
		const { error, warning } = checkBounds(minValue, maxValue);
		hardError = userHasInteracted ? (error ?? null) : null;
		softWarning = userHasInteracted ? (warning ?? null) : null;
	}

	let prevSoftMaxesKey: string | null = null;
	$: {
		const key = softMaxes ? softMaxes.map((s) => `${s.name}:${s.max}`).join('|') : null;
		if (prevSoftMaxesKey !== null && key !== prevSoftMaxesKey) {
			userHasInteracted = false;
		}
		prevSoftMaxesKey = key;
	}

	function commitMin() {
		const normalized = localMin.replace(',', '.');
		const parsed = parseFloat(normalized);
		if (isNaN(parsed)) {
			localMin = minValue.toString();
			return;
		}
		userHasInteracted = true;
		const { error, warning } = checkBounds(parsed, maxValue);
		hardError = error ?? null;
		softWarning = warning ?? null;
		if (!error) onChange(parsed, maxValue);
	}

	function commitMax() {
		const normalized = localMax.replace(',', '.');
		const parsed = parseFloat(normalized);
		if (isNaN(parsed)) {
			localMax = maxValue.toString();
			return;
		}
		userHasInteracted = true;
		const { error, warning } = checkBounds(minValue, parsed);
		hardError = error ?? null;
		softWarning = warning ?? null;
		if (!error) onChange(minValue, parsed);
	}
</script>

<div class="mt-4 space-y-2">
	<div>
		<p
			class="animate-fade-in bg-gradient-to-r from-green-800 to-green-500 bg-clip-text text-lg font-bold text-transparent"
		>
			{label}
		</p>
		<div class="min-h-[2.25rem]" aria-live="polite">
			{#if hardError}
				<div
					class="flex items-start gap-2 rounded-md border border-red-300 bg-red-50 px-2 py-1 text-sm text-red-800"
					role="alert"
				>
					<svg
						class="mt-0.5 h-4 w-4 flex-shrink-0"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						viewBox="0 0 24 24"
						aria-hidden="true"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M12 9v4m0 4h.01M10.29 3.86l-8.18 14.14A2 2 0 003.84 21h16.32a2 2 0 001.73-2.99L13.71 3.86a2 2 0 00-3.42 0z"
						/>
					</svg>
					<span>{hardError}</span>
				</div>
			{:else if softWarning}
				<div
					class="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-sm text-amber-800"
					role="status"
				>
					<svg
						class="mt-0.5 h-4 w-4 flex-shrink-0"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						viewBox="0 0 24 24"
						aria-hidden="true"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M12 9v4m0 4h.01M10.29 3.86l-8.18 14.14A2 2 0 003.84 21h16.32a2 2 0 001.73-2.99L13.71 3.86a2 2 0 00-3.42 0z"
						/>
					</svg>
					<span>{softWarning}</span>
				</div>
			{:else if description}
				<p class="text-sm text-gray-500">{description}</p>
			{/if}
		</div>
	</div>

	<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
		<div class="space-y-1">
			<label for={minId} class="block text-sm font-semibold tracking-wide text-gray-700">
				{minLabel}
				{unit}
			</label>
			<input
				id={minId}
				type="text"
				bind:value={localMin}
				on:blur={commitMin}
				on:keydown={(e) => e.key === 'Enter' && commitMin()}
				placeholder={`Enter ${minLabel.toLowerCase()}`}
				class="w-full rounded-lg border bg-white px-4 py-2 text-sm text-gray-800 shadow-sm focus:ring-2 {hardError
					? 'border-red-500 focus:border-red-600 focus:ring-red-300'
					: 'border-gray-300 focus:border-green-600 focus:ring-green-400'}"
			/>
		</div>

		<div class="space-y-1">
			<label for={maxId} class="block text-sm font-semibold tracking-wide text-gray-700">
				{maxLabel}
				{unit}
			</label>
			<input
				id={maxId}
				type="text"
				bind:value={localMax}
				on:blur={commitMax}
				on:keydown={(e) => e.key === 'Enter' && commitMax()}
				placeholder={`Enter ${maxLabel.toLowerCase()}`}
				class="w-full rounded-lg border bg-white px-4 py-2 text-sm text-gray-800 shadow-sm focus:ring-2 {hardError
					? 'border-red-500 focus:border-red-600 focus:ring-red-300'
					: 'border-gray-300 focus:border-green-600 focus:ring-green-400'}"
			/>
		</div>
	</div>
</div>
