<script lang="ts">
	export let label: string;
	export let unit: string = '';
	export let minLabel: string = 'Min';
	export let maxLabel: string = 'Max';
	export let minValue: number;
	export let maxValue: number;
	export let step: number = 1;
	export let minLimit: number = 0;
	export let onChange: (min: number, max: number) => void;

	function updateMin(val: string) {
		onChange(parseFloat(val), maxValue);
	}
	function updateMax(val: string) {
		onChange(minValue, parseFloat(val));
	}
</script>

<div class="mt-4 space-y-2">
	<p
		class="animate-fade-in bg-gradient-to-r from-green-800 to-green-500 bg-clip-text text-lg font-bold text-transparent"
	>
		{label}
	</p>

	<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
		<!-- min input -->
		<div class="space-y-1">
			<label for="min-input" class="block text-sm font-semibold tracking-wide text-gray-700">
				{minLabel}
				{unit}
			</label>
			<input
				id="min-input"
				type="number"
				value={minValue}
				min={minLimit}
				{step}
				on:input={(e) => updateMin((e.target as HTMLInputElement).value)}
				class="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-800 shadow-sm focus:border-green-600 focus:ring-2 focus:ring-green-400"
			/>
		</div>

		<!-- max input -->
		<div class="space-y-1">
			<label for="max-input" class="block text-sm font-semibold tracking-wide text-gray-700">
				{maxLabel}
				{unit}
			</label>
			<input
				id="max-input"
				type="number"
				value={maxValue}
				min={minLimit}
				{step}
				on:input={(e) => updateMax((e.target as HTMLInputElement).value)}
				class="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-800 shadow-sm focus:border-green-600 focus:ring-2 focus:ring-green-400"
			/>
		</div>
	</div>
</div>
