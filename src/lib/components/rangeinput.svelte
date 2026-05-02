<!--
  @component
  Description: Numeric min/max input pair for editing an amplitude or time range.

  @author Grace Steinmetz <gesparkles@gmail.com>
  @contributors K. Seow <kseow@wisc.edu>
  @created 2025-05-30
  @version 1.0.1
  @license MIT
-->
<script lang="ts">
	/** Heading rendered above the input pair (e.g. "Time Range"). */
	export let label: string;
	/** Optional unit string shown alongside the label (e.g. "(seconds)", "(Hz)"). */
	export let unit: string = '';
	/** Caption above the min input. */
	export let minLabel: string = 'Min';
	/** Caption above the max input. */
	export let maxLabel: string = 'Max';
	/** Current minimum value. Treated as the source of truth — the local string is re-synced from this on every parent update. */
	export let minValue: number;
	/** Current maximum value. */
	export let maxValue: number;
	/** Step granularity passed to the underlying `<input type="number">`. */
	export let step: number = 0.00001;
	/** Called whenever either input commits a new valid number. Always receives the full `(min, max)` pair so the parent can update both at once. */
	export let onChange: (min: number, max: number) => void;

	let localMin: string = minValue.toString(); // Local string for editing
	$: localMin = minValue.toString(); //in sync when parent updates

	function commitMin() {
		const normalized = localMin.replace(',', '.');
		const parsed = parseFloat(normalized);
		if (!isNaN(parsed)) {
			onChange(parsed, maxValue);
		} else {
			localMin = minValue.toString(); // fallback
		}
	}

	// function updateMax(val: string) {
	// 	onChange(minValue, parseFloat(val));
	// }
	function updateMax(val: string) {
		const parsed = parseFloat(val);
		if (!isNaN(parsed)) {
			onChange(minValue, parsed);
		}
	}
</script>

<div class="mt-4 space-y-2">
	<p
		class="animate-fade-in bg-gradient-to-r from-green-800 to-green-500 bg-clip-text text-lg font-bold text-transparent"
	>
		{label}
	</p>

	<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
		<!-- Min input (safe text-based editing) -->
		<div class="space-y-1">
			<label for="min-input" class="block text-sm font-semibold tracking-wide text-gray-700">
				{minLabel}
				{unit}
			</label>
			<input
				id="min-input"
				type="text"
				bind:value={localMin}
				on:blur={commitMin}
				on:keydown={(e) => e.key === 'Enter' && commitMin()}
				placeholder={`Enter ${minLabel.toLowerCase()}`}
				class="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-800 shadow-sm focus:border-green-600 focus:ring-2 focus:ring-green-400"
			/>
		</div>

		<!-- Max input (still number for convenience) -->
		<div class="space-y-1">
			<label for="max-input" class="block text-sm font-semibold tracking-wide text-gray-700">
				{maxLabel}
				{unit}
			</label>
			<input
				id="max-input"
				type="number"
				value={maxValue}
				{step}
				on:input={(e) => updateMax((e.target as HTMLInputElement).value)}
				on:keydown={(e) => e.key === 'Enter' && updateMax((e.target as HTMLInputElement).value)}
				placeholder={`Enter ${maxLabel.toLowerCase()}`}
				class="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-800 shadow-sm focus:border-green-600 focus:ring-2 focus:ring-green-400"
			/>
		</div>
	</div>
</div>
